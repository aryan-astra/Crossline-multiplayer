import {
  createServer,
  type IncomingMessage,
  type RequestListener,
  type ServerResponse,
} from "node:http";
import { performance } from "node:perf_hooks";
import type { Duplex } from "node:stream";
import { WebSocket, WebSocketServer } from "ws";
import { STEP } from "../game/loop";
import { parseMessage, type ServerMessage } from "../network/protocol";
import { GameService } from "./service";
import type { Store } from "./store";
import type { MapId } from "../game/types";

const COOKIE = "crossline_session";
const MAX_QUEUE = 512 * 1024;
type Connection = {
  socket: WebSocket;
  seq: number;
  alive: boolean;
  start: number;
  tokens: number;
  budgetAt: number;
  actions: number;
  blockedAt: number;
  invalid: number;
  mapId?: MapId;
  snapshotPending?: boolean;
};

function token(request: IncomingMessage): string {
  return (
    request.headers.cookie
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${COOKIE}=`))
      ?.slice(COOKIE.length + 1) ?? ""
  );
}

function sameOrigin(request: IncomingMessage, publicOrigin?: string): boolean {
  try {
    const protocol =
      "encrypted" in request.socket && request.socket.encrypted
        ? "https:"
        : "http:";
    return (
      typeof request.headers.origin === "string" &&
      new URL(request.headers.origin).origin ===
        (publicOrigin ?? `${protocol}//${request.headers.host}`)
    );
  } catch {
    return false;
  }
}

function respond(
  response: ServerResponse,
  status: number,
  value: unknown,
): void {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(value));
}

async function readName(request: IncomingMessage): Promise<string> {
  if (!request.headers["content-type"]?.startsWith("application/json"))
    throw new Error("Expected application/json");
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 4096) throw new Error("Request body too large");
    chunks.push(Buffer.from(chunk));
  }
  const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (
    !value ||
    typeof value !== "object" ||
    !("name" in value) ||
    typeof value.name !== "string"
  )
    throw new Error("A display name is required");
  return value.name;
}

export function createGameServer({
  store,
  handler,
  tick = true,
  publicOrigin,
}: {
  store: Store;
  handler?: RequestListener;
  tick?: boolean;
  publicOrigin?: string;
}) {
  if (publicOrigin) {
    const url = new URL(publicOrigin);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      throw new Error("PUBLIC_ORIGIN must be an HTTP(S) origin");
    publicOrigin = url.origin;
  }
  const service = new GameService(store);
  const clients = new Map<string, Connection>();
  const requests = new Map<string, { start: number; count: number }>();
  const socketOptions = {
    noServer: true,
    maxPayload: 8192,
    // Browser inputs also use negotiated compression; queued inflate work delays controls.
    perMessageDeflate: false,
    closeTimeout: 1000,
  };
  const sockets = new WebSocketServer(socketOptions);
  let closing = false;
  const permitted = (request: IncomingMessage) => {
    const now = Date.now();
    for (const [key, entry] of requests)
      if (now - entry.start >= 60_000) requests.delete(key);
    const key = request.socket.remoteAddress ?? "local";
    let entry = requests.get(key);
    if (!entry) {
      if (requests.size >= 1000) return false;
      entry = { start: now, count: 0 };
      requests.set(key, entry);
    }
    return ++entry.count <= 60;
  };
  const server = createServer((request, response) => {
    void (async () => {
      const path = request.url?.split("?")[0];
      if (path === "/api/health" && request.method === "GET")
        return respond(response, closing ? 503 : 200, {
          ok: !closing,
          online: clients.size,
        });
      if (
        (path === "/api/session" || path === "/api/leaderboards") &&
        !permitted(request)
      )
        return respond(response, 429, { error: "API request limit reached" });
      if (path === "/api/leaderboards" && request.method === "GET")
        return respond(response, 200, { rankings: store.rankings() });
      if (path !== "/api/session") {
        if (handler) return handler(request, response);
        return respond(response, 404, { error: "Not found" });
      }
      if (request.method !== "GET" && request.method !== "POST")
        return respond(response, 405, { error: "Method not allowed" });
      if (request.method === "POST" && !sameOrigin(request, publicOrigin))
        return respond(response, 403, { error: "Origin rejected" });
      let profile = store.identify(token(request));
      const name =
        request.method === "POST" ? await readName(request) : "Guest";
      if (!profile) {
        const guest = store.createGuest(name);
        profile = guest.profile;
        const secure =
          ("encrypted" in request.socket && request.socket.encrypted) ||
          publicOrigin?.startsWith("https:")
            ? "; Secure"
            : "";
        response.setHeader(
          "Set-Cookie",
          `${COOKIE}=${guest.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000${secure}`,
        );
      } else if (request.method === "POST")
        profile = store.rename(profile.id, name);
      respond(response, 200, { profile });
    })().catch((error) => {
      if (!response.headersSent && !response.destroyed)
        respond(response, 400, {
          error:
            error instanceof Error
              ? error.message.slice(0, 160)
              : "Request failed",
        });
    });
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 10_000;
  const reject = (socket: Duplex, status: number, message: string) => {
    socket.end(
      `HTTP/1.1 ${status} ${message}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`,
    );
  };
  const send = (connection: Connection, message: ServerMessage) => {
    if (connection.socket.readyState !== WebSocket.OPEN) return false;
    if (connection.socket.bufferedAmount > MAX_QUEUE) {
      if (!connection.blockedAt) connection.blockedAt = Date.now();
      if (Date.now() - connection.blockedAt > 5000)
        connection.socket.terminate();
      return false;
    }
    connection.blockedAt = 0;
    if (message.type === "snapshot") connection.snapshotPending = true;
    // shortcut: use uncompressed frames until payload reduction and browser input latency are measured together.
    connection.socket.send(
      JSON.stringify(message),
      { compress: false },
      (error) => {
        if (message.type === "snapshot") connection.snapshotPending = false;
        if (error) connection.socket.terminate();
      },
    );
    return true;
  };
  const snapshot = (id: string, connection: Connection) => {
    // Superseded snapshots are disposable; never queue them behind an unfinished write.
    if (connection.snapshotPending) return;
    try {
      const full = service.snapshot(id, connection.seq, clients.size);
      if (connection.mapId !== full.world.map.id) {
        if (!send(connection, { v: 1, type: "map", map: full.world.map }))
          return;
        connection.mapId = full.world.map.id;
      }
      const { map, ...world } = full.world;
      const compact = {
        ...full,
        world,
        mapId: map.id,
        buildingStates: map.buildings.map(
          (building) => [building.hp, !!building.broken] as [number, boolean],
        ),
      };
      send(connection, compact);
    } catch (error) {
      console.error("Snapshot failed", error);
      connection.socket.close(1011, "Snapshot unavailable");
    }
  };
  server.on("upgrade", (request, socket, head) => {
    if (request.url?.split("?")[0] !== "/socket") {
      if (!handler) reject(socket, 404, "Not Found");
      return;
    }
    if (closing) return reject(socket, 503, "Unavailable");
    if (!sameOrigin(request, publicOrigin))
      return reject(socket, 403, "Forbidden");
    if (!permitted(request)) return reject(socket, 429, "Too Many Requests");
    const profile = store.identify(token(request));
    if (!profile) return reject(socket, 401, "Unauthorized");
    if (sockets.clients.size >= 128)
      return reject(socket, 503, "Capacity Reached");
    if (clients.size >= 64 && !clients.has(profile.id))
      return reject(socket, 503, "Capacity Reached");
    sockets.handleUpgrade(request, socket, head, (websocket) => {
      const connection: Connection = {
        socket: websocket,
        seq: 0,
        alive: true,
        start: Date.now(),
        tokens: 120,
        budgetAt: performance.now(),
        actions: 0,
        blockedAt: 0,
        invalid: 0,
      };
      const previous = clients.get(profile.id);
      clients.set(profile.id, connection);
      previous?.socket.close(4001, "Session opened in another tab");
      websocket.on("error", () => {
        // Receiver errors already start a bounded protocol close (e.g. oversized input).
        if (websocket.readyState === WebSocket.OPEN) websocket.terminate();
      });
      websocket.on("pong", () => {
        connection.alive = true;
      });
      websocket.on("close", () => {
        if (clients.get(profile.id) !== connection) return;
        clients.delete(profile.id);
        try {
          service.disconnect(profile.id);
        } catch (error) {
          console.error("Disconnect persistence failed", error);
        }
      });
      websocket.on("message", (raw, binary) => {
        if (clients.get(profile.id) !== connection) return;
        const now = Date.now();
        if (now - connection.start >= 1000) {
          connection.start = now;
          connection.actions = 0;
        }
        const budgetNow = performance.now();
        connection.tokens = Math.min(
          120,
          connection.tokens +
            Math.max(0, budgetNow - connection.budgetAt) * 0.06,
        );
        connection.budgetAt = budgetNow;
        if (connection.tokens < 1)
          return websocket.close(1008, "Input rate exceeded");
        connection.tokens--;
        let message;
        try {
          message = binary ? null : parseMessage(JSON.parse(raw.toString()));
        } catch {
          message = null;
        }
        if (!message) {
          send(connection, {
            v: 1,
            type: "error",
            seq: connection.seq,
            message: "Invalid message",
          });
          if (++connection.invalid >= 3)
            websocket.close(1008, "Invalid messages");
          return;
        }
        if (message.seq <= connection.seq)
          return send(connection, {
            v: 1,
            type: "error",
            seq: message.seq,
            requestId: message.requestId,
            message: "Stale input sequence",
          });
        connection.seq = message.seq;
        if (
          message.type !== "input" &&
          message.type !== "ping" &&
          ++connection.actions > 10
        )
          return send(connection, {
            v: 1,
            type: "error",
            seq: message.seq,
            requestId: message.requestId,
            message: "Action rate exceeded",
          });
        try {
          service.command(profile.id, message);
          send(connection, {
            v: 1,
            type: "ack",
            seq: message.seq,
            requestId: message.requestId,
            message: "Accepted",
          });
          if (message.type !== "input" && message.type !== "ping")
            snapshot(profile.id, connection);
        } catch (error) {
          send(connection, {
            v: 1,
            type: "error",
            seq: message.seq,
            requestId: message.requestId,
            message:
              error instanceof Error
                ? error.message.slice(0, 160)
                : "Action rejected",
          });
        }
      });
      snapshot(profile.id, connection);
    });
  });
  const simulation = tick
    ? setInterval(() => {
        try {
          // Under load, slow the shared clock instead of starving network I/O with catch-up ticks.
          service.advance(STEP);
        } catch (error) {
          console.error("Authoritative simulation stopped", error);
          clearInterval(simulation!);
          closing = true;
          for (const connection of clients.values())
            connection.socket.close(1011, "Simulation unavailable");
        }
      }, 1000 / 30)
    : undefined;
  const updates = setInterval(() => {
    if (!closing)
      for (const [id, connection] of clients) snapshot(id, connection);
  }, 100);
  const heartbeat = setInterval(() => {
    for (const connection of clients.values()) {
      if (!connection.alive) {
        connection.socket.terminate();
        continue;
      }
      connection.alive = false;
      connection.socket.ping(
        undefined,
        undefined,
        (error: Error | undefined) => {
          if (error) connection.socket.terminate();
        },
      );
    }
  }, 15_000);
  let shutdown: Promise<void> | undefined;
  const close = () =>
    (shutdown ??= (async () => {
      closing = true;
      clearInterval(simulation);
      clearInterval(updates);
      clearInterval(heartbeat);
      for (const connection of clients.values()) connection.socket.terminate();
      await new Promise<void>((resolve) => sockets.close(() => resolve()));
      if (server.listening)
        await new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
          server.closeIdleConnections();
        });
      service.checkpoint();
    })());
  return { server, service, close };
}
