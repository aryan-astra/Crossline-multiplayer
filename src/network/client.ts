import type { Command, ServerMessage, Snapshot } from "./protocol";

export function readServerMessage(raw: string): ServerMessage | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const message = value as Record<string, unknown>;
  if (message.v !== 1) return null;
  if (message.type === "ack" || message.type === "error") {
    return typeof message.message === "string" &&
      Number.isSafeInteger(message.seq)
      ? (value as ServerMessage)
      : null;
  }
  if (
    message.type !== "snapshot" ||
    !Number.isSafeInteger(message.tick) ||
    !Number.isSafeInteger(message.ack)
  )
    return null;
  const snapshot = value as Snapshot;
  if (
    !snapshot.world?.map ||
    !Array.isArray(snapshot.world.entities) ||
    !snapshot.self ||
    !["delhi", "paris"].includes(snapshot.world.map.id) ||
    !["protester", "police", "military", "watcher"].includes(
      snapshot.self.role,
    ) ||
    !Array.isArray(snapshot.predictions) ||
    !Array.isArray(snapshot.rankings)
  )
    return null;
  return snapshot;
}

export function isStaleSnapshot(
  nextTick: number,
  currentTick: number,
  sameWorld: boolean,
  connectionReset: boolean,
) {
  return sameWorld && !connectionReset && nextTick < currentTick;
}

export function connectWorld(options: {
  name: string;
  join: () => Extract<Command, { type: "join" }>;
  onSnapshot: (snapshot: Snapshot) => void;
  onStatus: (status: string) => void;
  onNotice: (message: string) => void;
}) {
  let socket: WebSocket | null = null;
  let stopped = false,
    ready = false,
    attempt = 0,
    seq = 0;
  let retry: ReturnType<typeof setTimeout> | undefined;
  const abort = new AbortController();
  const send = (command: Command) => {
    if (
      !socket ||
      socket.readyState !== WebSocket.OPEN ||
      socket.bufferedAmount > 64_000
    )
      return false;
    socket.send(
      JSON.stringify({
        ...command,
        v: 1,
        seq: ++seq,
        requestId:
          typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : Array.from(crypto.getRandomValues(new Uint32Array(4)), (part) =>
                part.toString(16).padStart(8, "0"),
              ).join(""),
      }),
    );
    return true;
  };
  const schedule = () => {
    if (stopped) return;
    options.onStatus("Reconnecting");
    retry = setTimeout(
      () => {
        void start();
      },
      Math.min(8000, 1000 * 2 ** attempt++),
    );
  };
  async function start() {
    if (stopped) return;
    options.onStatus(attempt ? "Reconnecting" : "Connecting");
    try {
      if (!ready) {
        const response = await fetch("/api/session", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: options.name }),
          signal: abort.signal,
        });
        if (!response.ok)
          throw new Error(`Session unavailable (${response.status})`);
        ready = true;
      }
      if (stopped) return;
      const url = new URL("/socket", window.location.href);
      url.protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const active = new WebSocket(url);
      socket = active;
      active.onopen = () => {
        if (stopped) {
          active.close();
          return;
        }
        seq = 0;
        attempt = 0;
        options.onStatus("Connected");
        send(options.join());
      };
      active.onmessage = (event: MessageEvent) => {
        if (stopped || socket !== active || typeof event.data !== "string")
          return;
        const message = readServerMessage(event.data);
        if (!message) {
          options.onNotice("Server sent an unsupported message.");
          return;
        }
        if (message.type === "snapshot") options.onSnapshot(message);
        else if (message.type === "error") options.onNotice(message.message);
      };
      active.onerror = () => {
        if (!stopped)
          options.onNotice("Connection interrupted; retrying automatically.");
      };
      active.onclose = (event: CloseEvent) => {
        if (socket === active) {
          socket = null;
          if (event.code === 4001 || event.code === 1008) {
            stopped = true;
            options.onStatus(
              event.code === 4001
                ? "Session active in another tab"
                : "Connection rejected",
            );
            options.onNotice(
              event.code === 4001
                ? "This session moved to another tab. Close it there before returning here."
                : event.reason === "Input rate exceeded"
                  ? "Input rate exceeded. Return to the menu to reconnect."
                  : "The server rejected this connection. Return to the menu before trying again.",
            );
            return;
          }
          schedule();
        }
      };
    } catch (error) {
      if (stopped) return;
      options.onNotice(
        error instanceof Error ? error.message : "Unable to connect.",
      );
      schedule();
    }
  }
  void start();
  return {
    send,
    close() {
      stopped = true;
      abort.abort();
      clearTimeout(retry);
      if (socket) {
        socket.onclose = null;
        socket.close();
        socket = null;
      }
    },
  };
}
