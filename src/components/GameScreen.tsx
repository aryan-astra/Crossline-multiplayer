"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import MarketDesk from "./MarketDesk";
import TouchJoystick from "./TouchJoystick";
import "@/app/game.css";
import { buildGround, drawFrame, drawMinimap } from "@/game/render";
import {
  cameraZoom,
  clampZoom,
  constrainCamera,
  trackCamera,
} from "@/game/camera";
import { interactionPrompt } from "@/game/prompts";
import { DirectionalEventAudio } from "@/game/audio";
import { entryPoint, type AreaId } from "@/game/locations";
import { connectWorld, isStaleSnapshot } from "@/network/client";
import type { Command, Snapshot } from "@/network/protocol";
import type { InputState, MapId, Role, World } from "@/game/types";
import { CITY_NAMES } from "@/game/place-names";
import { predictCharacter } from "@/game/prediction";

const emptyInput = (): InputState => ({
  up: false,
  down: false,
  left: false,
  right: false,
  sprint: false,
  mouseX: 0,
  mouseY: 0,
});
const help: Record<Role, string> = {
  protester: "E / Space chant · Q throw / shove · F interact · B enter / exit",
  police:
    "E detain active threat · Q baton · T gas · C then click command · F interact",
  military:
    "Q warning · E engage immediate threat · F interact · B enter / exit",
  watcher:
    "WASD / drag pan · Wheel / pinch zoom · Select a person to inspect or follow",
};
type Panel = "menu" | "settings" | "guide" | "rankings" | null;

export default function GameScreen({
  mapId,
  areaId = "gathering",
  role,
  name,
  onExit,
}: {
  mapId: MapId;
  areaId?: AreaId;
  role: Role;
  name: string;
  onExit: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const minimap = useRef<HTMLCanvasElement>(null);
  const marketButton = useRef<HTMLButtonElement>(null);
  const modal = useRef<HTMLDialogElement>(null);
  const latest = useRef<Snapshot | null>(null);
  const previous = useRef<Snapshot | null>(null);
  const receivedAt = useRef(0);
  const input = useRef(emptyInput());
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const camera = useRef({
    x: 0,
    y: 0,
    zoom: cameraZoom(role),
    targetZoom: cameraZoom(role),
  });
  const selectedRef = useRef<number | null>(null);
  const follow = useRef(false);
  const commandRef = useRef(false);
  const paused = useRef(false);
  const qualityRef = useRef(1);
  const audio = useRef<AudioContext | null>(null);
  const sound = useRef<DirectionalEventAudio | null>(null);
  const volumeRef = useRef(0.35);
  const sendRef = useRef<(command: Command) => boolean>(() => false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [status, setStatus] = useState("Connecting");
  const statusRef = useRef("Connecting");
  const [notice, setNotice] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [following, setFollowing] = useState(false);
  const [command, setCommand] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [quality, setQuality] = useState(1);
  const [volume, setVolume] = useState(0.35);
  const [frameMs, setFrameMs] = useState(0);
  const [hudTab, setHudTab] = useState<"overview" | "people" | "news">(
    "overview",
  );
  const [running, setRunning] = useState(false);
  const [hudCollapsed, setHudCollapsed] = useState(true);
  const [marketOpen, setMarketOpen] = useState(false);
  const [leadersOpen, setLeadersOpen] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 900px)").matches,
  );

  const select = (id: number | null) => {
    selectedRef.current = id;
    setSelectedId(id);
  };
  const togglePanel = (next: Panel) => {
    paused.current = !!next;
    input.current = emptyInput();
    setRunning(false);
    setPanel(next);
  };
  const send = (message: Command) => {
    if (!sendRef.current(message))
      setNotice("Waiting for the server connection.");
  };
  const actionRef = useRef<
    (kind: Extract<Command, { type: "action" }>["action"]) => void
  >((kind) => {
    if (!paused.current) {
      send({
        type: "action",
        action: kind,
        ...(selectedRef.current ? { targetId: selectedRef.current } : {}),
      });
    }
  });
  const action = (kind: Extract<Command, { type: "action" }>["action"]) =>
    actionRef.current(kind);

  const setSoundVolume = useCallback((value: number) => {
    volumeRef.current = value;
    setVolume(value);
    if (value <= 0) return;
    try {
      audio.current ??= new AudioContext();
      if (!sound.current) {
        sound.current = new DirectionalEventAudio(audio.current);
        if (latest.current)
          sound.current.update(latest.current.world, camera.current, 0);
      }
      void sound.current
        .resume()
        .catch(() =>
          setNotice("Audio could not start; gameplay remains available."),
        );
    } catch {
      setNotice("Audio is unavailable in this browser.");
    }
  }, []);
  const unlockAudio = useCallback(() => {
    if (
      volumeRef.current > 0 &&
      (!sound.current || audio.current?.state === "suspended")
    )
      setSoundVolume(volumeRef.current);
  }, [setSoundVolume]);

  useEffect(() => {
    if (panel) modal.current?.showModal();
    else modal.current?.close();
  }, [panel]);

  useEffect(
    () => () => {
      sound.current?.dispose();
      if (audio.current && audio.current.state !== "closed")
        void audio.current.close();
    },
    [],
  );

  useEffect(() => {
    let stopped = false;
    let connectionEpoch = 0,
      snapshotEpoch = -1;
    const connection = connectWorld({
      name,
      join: () => ({
        type: "join",
        mapId: latest.current?.self.mapId ?? mapId,
        role: latest.current?.self.role ?? role,
        areaId,
      }),
      onStatus: (next) => {
        statusRef.current = next;
        if (!stopped) {
          if (next !== "Connected") connectionEpoch++;
          if (next !== "Connected") sound.current?.resetHistory();
          setStatus(next);
          if (next === "Connected") setNotice("");
          if (next !== "Connected") input.current = emptyInput();
        }
      },
      onNotice: (message) => {
        if (!stopped) setNotice(message);
      },
      onSnapshot: (next) => {
        if (stopped) return;
        const old = latest.current;
        if (
          old &&
          isStaleSnapshot(
            next.tick,
            old.tick,
            old.world.map.id === next.world.map.id,
            snapshotEpoch !== connectionEpoch,
          )
        )
          return;
        snapshotEpoch = connectionEpoch;
        previous.current = old;
        latest.current = next;
        receivedAt.current = performance.now();
        setSnapshot(next);
        if (old && old.world.map.id !== next.world.map.id) {
          selectedRef.current = null;
          follow.current = false;
          setSelectedId(null);
          setFollowing(false);
        }
        sound.current?.update(next.world, camera.current, volumeRef.current);
      },
    });
    sendRef.current = connection.send;
    const interval = setInterval(() => {
      const w = latest.current?.world;
      const aim =
        pointer.current && w
          ? {
              x:
                (w.player?.buildingId ? w.player.x : camera.current.x) +
                (pointer.current.x - (canvas.current?.clientWidth ?? 0) / 2) /
                  camera.current.zoom,
              y:
                (w.player?.buildingId ? w.player.y : camera.current.y) +
                (pointer.current.y - (canvas.current?.clientHeight ?? 0) / 2) /
                  camera.current.zoom,
            }
          : w?.player
            ? {
                x: w.player.x + Math.cos(w.player.dir) * 240,
                y: w.player.y + Math.sin(w.player.dir) * 240,
              }
            : { x: 0, y: 0 };
      connection.send({
        type: "input",
        input: {
          ...(paused.current || document.hidden ? emptyInput() : input.current),
          mouseX: Math.max(0, Math.min(w?.map.w ?? 5000, aim.x)),
          mouseY: Math.max(0, Math.min(w?.map.h ?? 5000, aim.y)),
        },
      });
    }, 50);
    return () => {
      stopped = true;
      clearInterval(interval);
      connection.close();
      sendRef.current = () => false;
    };
  }, [mapId, role, name, areaId]);

  useEffect(() => {
    const view = canvas.current!,
      mini = minimap.current!;
    const ctx = view.getContext("2d"),
      miniCtx = mini.getContext("2d");
    if (!ctx || !miniCtx) {
      setNotice("Canvas rendering is unavailable in this browser.");
      return;
    }
    const grounds = new Map<MapId, HTMLCanvasElement>();
    let frame = 0,
      last = performance.now(),
      metricAt = last,
      miniAt = 0,
      total = 0,
      frames = 0;
    let shownMap: MapId | undefined, shownRole: Role | undefined;
    const loop = (now: number) => {
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      const current = latest.current;
      if (current && !document.hidden) {
        const start = performance.now(),
          w = current.world,
          actualRole = current.self.role;
        const dpr = Math.min(devicePixelRatio || 1, qualityRef.current);
        const width = view.clientWidth,
          height = view.clientHeight;
        if (
          view.width !== Math.round(width * dpr) ||
          view.height !== Math.round(height * dpr)
        ) {
          view.width = Math.round(width * dpr);
          view.height = Math.round(height * dpr);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (!grounds.has(w.map.id)) {
          grounds.clear();
          grounds.set(w.map.id, buildGround(w.map));
        }
        const alpha = Math.min(1, (now - receivedAt.current) / 100);
        const prior = previous.current?.world;
        const oldEntities = new Map(
          prior?.map.id === w.map.id
            ? prior.entities.map((e) => [e.id, e])
            : [],
        );
        const entities = w.entities.map((e) => {
          if (
            e.id === w.player?.id &&
            actualRole !== "watcher" &&
            !paused.current &&
            statusRef.current === "Connected"
          )
            return predictCharacter(
              w.map,
              e,
              input.current,
              (now - receivedAt.current) / 1000 + 1 / 30,
            );
          const old = oldEntities.get(e.id);
          return old &&
            old.buildingId === e.buildingId &&
            old.state === e.state &&
            Math.hypot(old.x - e.x, old.y - e.y) < 150
            ? {
                ...e,
                x: old.x + (e.x - old.x) * alpha,
                y: old.y + (e.y - old.y) * alpha,
              }
            : e;
        });
        const player = w.player
          ? (entities.find((e) => e.id === w.player!.id) ?? w.player)
          : null;
        const cam = camera.current;
        if (shownMap !== w.map.id || shownRole !== actualRole) {
          const point = player ?? entryPoint(w.map, actualRole, areaId);
          cam.x = point.x;
          cam.y = point.y;
          cam.zoom = cameraZoom(actualRole);
          cam.targetZoom = cam.zoom;
          shownMap = w.map.id;
          shownRole = actualRole;
        }
        cam.targetZoom = clampZoom(actualRole, cam.targetZoom);
        cam.zoom += (cam.targetZoom - cam.zoom) * (1 - Math.exp(-10 * dt));
        const followed = follow.current
          ? entities.find(
              (e) => e.id === selectedRef.current && !e.buildingId && !e.remove,
            )
          : undefined;
        if (actualRole !== "watcher" && player)
          Object.assign(cam, trackCamera(cam, player, dt));
        else if (followed) Object.assign(cam, trackCamera(cam, followed, dt));
        else if (!paused.current) {
          const speed = (450 * dt) / cam.zoom;
          cam.x +=
            (Number(input.current.right) - Number(input.current.left)) * speed;
          cam.y +=
            (Number(input.current.down) - Number(input.current.up)) * speed;
        }
        if (!player?.buildingId)
          Object.assign(
            cam,
            constrainCamera(cam, { w: width, h: height }, w.map, cam.zoom),
          );
        const presentation: World = {
          ...w,
          entities,
          player,
          camX: cam.x,
          camY: cam.y,
          zoom: cam.zoom,
          selectedId: selectedRef.current,
          time: w.time + Math.min(0.15, (now - receivedAt.current) / 1000),
        };
        drawFrame(ctx, presentation, width, height, grounds.get(w.map.id)!);
        if (now - miniAt >= 100) {
          drawMinimap(
            miniCtx,
            presentation,
            mini.width,
            mini.height,
            width,
            height,
            latest.current?.policeTask,
          );
          miniAt = now;
        }
        total += performance.now() - start;
        frames++;
        if (now - metricAt > 1000) {
          setFrameMs(total / Math.max(1, frames));
          total = 0;
          frames = 0;
          metricAt = now;
        }
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    const keys: Record<string, "up" | "down" | "left" | "right" | "sprint"> = {
      w: "up",
      arrowup: "up",
      s: "down",
      arrowdown: "down",
      a: "left",
      arrowleft: "left",
      d: "right",
      arrowright: "right",
      shift: "sprint",
    };
    const clear = () => {
      input.current = emptyInput();
      setRunning(false);
      last = performance.now();
      sendRef.current({ type: "input", input: emptyInput() });
    };
    const down = (event: KeyboardEvent) => {
      unlockAudio();
      if (
        paused.current ||
        (event.target instanceof Element &&
          (event.target.closest(
            "input,select,textarea,[contenteditable=true]",
          ) ||
            ((event.key === " " || event.key === "Enter") &&
              event.target.closest("button,summary,a"))))
      )
        return;
      const key = event.key.toLowerCase();
      if (keys[key]) {
        input.current[keys[key]] = true;
        if (key === "shift") setRunning(true);
        event.preventDefault();
        if (latest.current?.self.role === "watcher") {
          follow.current = false;
          setFollowing(false);
        }
      }
      if (event.repeat) return;
      if (key === "e" || key === " ") {
        actionRef.current("primary");
        event.preventDefault();
      }
      if (key === "q") actionRef.current("secondary");
      if (key === "t") actionRef.current("special");
      if (key === "f") actionRef.current("interact");
      if (key === "b")
        actionRef.current(
          latest.current?.world.player?.buildingId ? "exit" : "enter",
        );
      if (
        key === "c" &&
        ["police", "military"].includes(latest.current?.self.role ?? "")
      ) {
        commandRef.current = !commandRef.current;
        setCommand(commandRef.current);
      }
    };
    const up = (event: KeyboardEvent) => {
      const key = keys[event.key.toLowerCase()];
      if (key) input.current[key] = false;
      if (key === "sprint") setRunning(false);
    };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      if (latest.current?.self.role === "watcher" && !paused.current)
        camera.current.targetZoom = clampZoom(
          "watcher",
          camera.current.targetZoom * Math.exp(-event.deltaY * 0.001),
        );
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", clear);
    view.addEventListener("wheel", wheel, { passive: false });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", clear);
      view.removeEventListener("wheel", wheel);
    };
  }, [areaId, unlockAudio]);

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({
    x: 0,
    y: 0,
    camX: 0,
    camY: 0,
    moved: false,
    pinch: 0,
  });
  const pointAt = (x: number, y: number) => {
    const rect = canvas.current!.getBoundingClientRect(),
      cam = camera.current;
    const p = latest.current?.world.player;
    return {
      x:
        (p?.buildingId ? p.x : cam.x) +
        (x - rect.left - rect.width / 2) / cam.zoom,
      y:
        (p?.buildingId ? p.y : cam.y) +
        (y - rect.top - rect.height / 2) / cam.zoom,
    };
  };
  const actualRole = snapshot?.self.role ?? role,
    w = snapshot?.world,
    p = w?.player;
  const nearbyPrompt = interactionPrompt(w, actualRole);
  const selected = w?.entities.find((e) => e.id === selectedId && !e.remove);
  const policeTask = actualRole === "police" ? snapshot?.policeTask : undefined;
  const online = status === "Connected" && !!snapshot;
  const disabled = !online || !!panel;
  const symbol = w?.map.id === "paris" ? "€" : "₹";
  const closeMarket = useCallback(() => {
    setMarketOpen(false);
    marketButton.current?.focus();
  }, []);
  const deadFor = Math.max(
    0,
    Math.ceil(
      (snapshot?.self.deathUntil || p?.deathUntil || 0) - (w?.time ?? 0),
    ),
  );
  const deathActive = !!snapshot?.self.deathUntil || !!p?.deathUntil;
  const toggleCommand = () => {
    commandRef.current = !commandRef.current;
    setCommand(commandRef.current);
  };

  return (
    <main
      className="game-shell"
      data-role={actualRole}
      onPointerDownCapture={unlockAudio}
    >
      <canvas
        ref={canvas}
        aria-label="Public city. Move with WASD or arrows. Select agents from the inspector for keyboard access."
        className={command ? "command-cursor" : ""}
        onPointerDown={(event) => {
          if (disabled || event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          pointers.current.set(event.pointerId, {
            x: event.clientX,
            y: event.clientY,
          });
          if (pointers.current.size === 1)
            gesture.current = {
              x: event.clientX,
              y: event.clientY,
              camX: camera.current.x,
              camY: camera.current.y,
              moved: false,
              pinch: 0,
            };
          else {
            const [a, b] = [...pointers.current.values()];
            gesture.current.pinch = Math.hypot(a.x - b.x, a.y - b.y);
            gesture.current.moved = true;
          }
        }}
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          pointer.current = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          };
          if (!pointers.current.has(event.pointerId) || disabled) return;
          pointers.current.set(event.pointerId, {
            x: event.clientX,
            y: event.clientY,
          });
          if (
            Math.hypot(
              event.clientX - gesture.current.x,
              event.clientY - gesture.current.y,
            ) > 6
          )
            gesture.current.moved = true;
          if (actualRole !== "watcher") return;
          follow.current = false;
          setFollowing(false);
          const g = gesture.current;
          if (pointers.current.size >= 2) {
            const [a, b] = [...pointers.current.values()];
            const distance = Math.hypot(a.x - b.x, a.y - b.y);
            if (g.pinch > 0)
              camera.current.targetZoom = clampZoom(
                "watcher",
                (camera.current.targetZoom * distance) / g.pinch,
              );
            g.pinch = distance;
            g.moved = true;
          } else {
            const dx = event.clientX - g.x,
              dy = event.clientY - g.y;
            if (Math.hypot(dx, dy) > 6) g.moved = true;
            camera.current.x = g.camX - dx / camera.current.zoom;
            camera.current.y = g.camY - dy / camera.current.zoom;
          }
        }}
        onPointerUp={(event) => {
          if (!pointers.current.delete(event.pointerId)) return;
          const remaining = [...pointers.current.values()][0];
          if (remaining) {
            Object.assign(gesture.current, {
              x: remaining.x,
              y: remaining.y,
              camX: camera.current.x,
              camY: camera.current.y,
              pinch: 0,
              moved: true,
            });
            return;
          }
          if (disabled || gesture.current.moved) return;
          const point = pointAt(event.clientX, event.clientY),
            world = latest.current?.world;
          if (!world) return;
          if (commandRef.current) {
            send({ type: "order", ...point });
            commandRef.current = false;
            setCommand(false);
          } else {
            let closest = 22 / camera.current.zoom;
            let picked: number | null = null;
            for (const e of world.entities) {
              if (
                e.remove ||
                e.kind === "truck" ||
                e.kind === "crate" ||
                e.buildingId !== world.player?.buildingId
              )
                continue;
              const distance = Math.hypot(e.x - point.x, e.y - point.y);
              if (distance < closest) {
                closest = distance;
                picked = e.id;
              }
            }
            if (picked !== null) {
              select(picked);
              setHudTab("people");
              setHudCollapsed(false);
            }
          }
        }}
        onPointerCancel={(event) => {
          pointers.current.delete(event.pointerId);
          gesture.current.moved = true;
        }}
        onLostPointerCapture={(event) =>
          pointers.current.delete(event.pointerId)
        }
      />
      <header className="game-top">
        <div className="status-capsule">
          <b className="game-brand">
            <Image
              src="/brand/crossline-mark.svg"
              width={24}
              height={24}
              alt=""
            />{" "}
            <span>{w ? CITY_NAMES[w.map.id] : "Joining city"}</span>
          </b>
          <span>
            {actualRole === "watcher" ? "SPECTATOR" : actualRole.toUpperCase()}
            {p && ` · HP ${Math.round(p.hp)}`}
            {p?.shield && ` · Shield ${Math.round(p.shieldHp ?? 50)}`}
          </span>
          <small role="status" className="connection-status">
            {status} · {snapshot?.online ?? 0} online
          </small>
          <span
            className="header-wallet"
            aria-label="Available virtual credits"
          >
            {symbol}
            {snapshot?.self.credits ?? 0} credits
          </span>
        </div>
        <nav className="game-tools" aria-label="Game tools">
          <button
            aria-expanded={!hudCollapsed}
            aria-controls="world-hud"
            onClick={() => setHudCollapsed(!hudCollapsed)}
          >
            {hudCollapsed ? "Inspect" : "Close inspector"}
          </button>
          {actualRole === "watcher" && (
            <button
              ref={marketButton}
              disabled={!online}
              aria-expanded={marketOpen}
              onClick={() => {
                setMarketOpen(!marketOpen);
                setHudCollapsed(true);
              }}
            >
              Exchange
            </button>
          )}
          <button onClick={() => togglePanel("menu")}>Menu</button>
        </nav>
      </header>
      <div className="floating-minimap" aria-label="Live city map">
        <canvas
          ref={minimap}
          width="240"
          height={w ? Math.round((240 * w.map.h) / w.map.w) : 164}
          aria-label="Minimap. Gold is you; the book marks the objective."
        />
        <span>{w ? CITY_NAMES[w.map.id] : "Connecting"}</span>
      </div>
      {(actualRole === "police" || actualRole === "military") &&
        w?.objective &&
        (w.objective.status === "contested" || w.objective.progress > 0) && (
          <div className="objective-alarm" role="alert">
            <strong>THE BOOK IS UNDER THREAT</strong>
            <span>Return to the defense line</span>
          </div>
        )}
      {!marketOpen && snapshot && (
        <details
          className="live-leaderboard"
          open={leadersOpen}
          onToggle={(e) => setLeadersOpen(e.currentTarget.open)}
        >
          <summary>Leaderboard</summary>
          <table>
            <thead>
              <tr>
                <th scope="col">Player</th>
                <th scope="col">Score</th>
                <th scope="col">Credits</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.rankings.slice(0, 5).map((r, index) => (
                <tr
                  key={r.id}
                  aria-current={r.id === snapshot.self.id ? "true" : undefined}
                >
                  <td>
                    <span>
                      {index + 1}. {r.name}
                    </span>
                  </td>
                  <td>{Math.round(r.score)}</td>
                  <td>{r.credits}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {snapshot.rankings.length === 0 && (
            <p>No scores yet. Join the city to begin.</p>
          )}
        </details>
      )}
      {!marketOpen && (notice || status !== "Connected") && (
        <div className="game-toast" role="status">
          <span>{notice || status}</span>
          {notice && (
            <button aria-label="Dismiss message" onClick={() => setNotice("")}>
              ×
            </button>
          )}
        </div>
      )}
      <aside
        id="world-hud"
        className="game-panel"
        data-collapsed={hudCollapsed}
      >
        <div className="hud-heading">
          <h2>{actualRole === "watcher" ? "City watch" : "Field status"}</h2>
          <span>{name}</span>
        </div>
        <nav className="hud-tabs" aria-label="City inspector sections">
          {(
            [
              ["overview", "Overview"],
              ["people", "People"],
              ["news", "News"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              aria-pressed={hudTab === id}
              onClick={() => setHudTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="hud-section" hidden={hudTab !== "overview"}>
          <p role="status" className="muted">
            {notice ||
              (online
                ? "Shared simulation active. Your progress is server-owned."
                : "Connecting to the local game server…")}
          </p>
          {actualRole !== "watcher" && (
            <div className="stats">
              <span>
                <b>{Math.round(p?.hp ?? 0)}</b>
                HEALTH
              </span>
              <span>
                <b>
                  {actualRole === "protester"
                    ? (p?.stones ?? 0)
                    : (p?.gas ?? 0)}
                </b>
                {actualRole === "protester" ? "STONES" : "GAS"}
              </span>
              <span>
                <b>{snapshot?.self.score ?? 0}</b>SCORE
              </span>
            </div>
          )}
          {p && (
            <>
              <label className="meter">
                FOOD
                <progress max="100" value={p.hunger} />
              </label>
              <label className="meter">
                WATER
                <progress max="100" value={p.thirst} />
              </label>
              <p className="muted">
                {p.state.toUpperCase()}
                {p.wanted > 0 ? ` · Wanted ${p.wanted}` : ""}
                {p.custodyUntil
                  ? ` · Release in ${Math.max(0, Math.ceil(p.custodyUntil - (w?.time ?? 0)))}s`
                  : ""}
              </p>
            </>
          )}
          {actualRole === "police" && (
            <div className="dispatch-card">
              <p className="eyebrow">ACTIVE DISPATCH</p>
              {policeTask ? (
                <>
                  <b>{policeTask.name}</b>
                  <span>
                    Level {policeTask.wantedLevel} ·{" "}
                    {Math.round(
                      Math.hypot(
                        policeTask.x - (p?.x ?? 0),
                        policeTask.y - (p?.y ?? 0),
                      ),
                    )}{" "}
                    units away ·{" "}
                    {policeTask.inBuilding
                      ? "entrance marked"
                      : "target marked"}
                  </span>
                  <button onClick={() => select(policeTask.targetId)}>
                    Highlight on map
                  </button>
                </>
              ) : (
                <span>
                  No active dispatch. Patrol and respond to immediate threats.
                </span>
              )}
              <small>
                Detain only if actively violent; wanted status alone is not
                grounds for custody.
              </small>
            </div>
          )}
          <label className="meter">
            UNREST {Math.round(w?.tension ?? 0)}%
            <progress max="100" value={w?.tension ?? 0} />
          </label>
          <div className="selected-unit">
            <b>Constitution Book</b>
            <span>
              Faction objectives · Protesters {w?.factionScores?.protester ?? 0}{" "}
              / Police {w?.factionScores?.police ?? 0}
            </span>
            <span>
              {w?.objective?.status ?? "Awaiting world state"}
              {w?.objective?.status === "recovering"
                ? ` · Returns in ${Math.ceil(w.objective.recoveryT)}s`
                : ""}
            </span>
            {w?.objective && (
              <progress
                aria-label="Objective capture progress"
                max={w.objective.captureSeconds}
                value={w.objective.progress}
              />
            )}
          </div>
          {actualRole === "watcher" && (
            <>
              <div className="view-controls">
                <button
                  aria-label="Zoom out"
                  onClick={() => {
                    camera.current.targetZoom = clampZoom(
                      "watcher",
                      camera.current.targetZoom - 0.15,
                    );
                  }}
                >
                  −
                </button>
                <button
                  aria-label="Zoom in"
                  onClick={() => {
                    camera.current.targetZoom = clampZoom(
                      "watcher",
                      camera.current.targetZoom + 0.15,
                    );
                  }}
                >
                  +
                </button>
                <button
                  disabled={!selected}
                  onClick={() => {
                    follow.current = !follow.current;
                    setFollowing(follow.current);
                  }}
                >
                  {following ? "Stop following" : "Follow selected"}
                </button>
              </div>
              <label className="inspect-label">
                Public location
                <select
                  value={w?.map.id ?? mapId}
                  disabled={disabled}
                  onChange={(event) =>
                    send({
                      type: "observe",
                      mapId: event.target.value as MapId,
                    })
                  }
                >
                  <option value="delhi">
                    Mantar Jantar, {CITY_NAMES.delhi}
                  </option>
                  <option value="paris">
                    Liberty square, {CITY_NAMES.paris}
                  </option>
                </select>
              </label>
            </>
          )}
        </div>
        <div className="hud-section" hidden={hudTab !== "people"}>
          <p className="muted">
            Select someone in the city or choose a person below. Their state
            comes from the shared simulation.
          </p>
          <label className="inspect-label">
            Inspect person
            <select
              value={selectedId ?? ""}
              onChange={(event) =>
                select(event.target.value ? Number(event.target.value) : null)
              }
            >
              <option value="">Choose a person</option>
              {w?.entities
                .filter(
                  (e) =>
                    !e.remove &&
                    e.kind !== "truck" &&
                    e.kind !== "crate" &&
                    e.buildingId === p?.buildingId,
                )
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} / {e.kind}
                    {e.wanted > 0 ? " · Wanted " + e.wanted : ""}
                  </option>
                ))}
            </select>
          </label>
          {selected && (
            <div className="selected-unit">
              <b>{selected.name}</b>
              <span>
                {selected.kind} · {selected.state} · HP{" "}
                {Math.round(selected.hp)}
              </span>
            </div>
          )}
          {!selected && (
            <p className="muted">
              No person selected. Choose a person to see their role, health and
              current behavior.
            </p>
          )}
        </div>
        <div className="hud-section" hidden={hudTab !== "news"}>
          <details className="feed" open>
            <summary>World news</summary>
            {w?.feed.slice(0, 5).map((event, index) => (
              <p key={`${event.t}:${index}`} data-tone={event.tone}>
                {event.text}
              </p>
            ))}
          </details>
        </div>
        <div className="view-controls">
          <button onClick={() => togglePanel("rankings")}>
            Career &amp; rankings
          </button>
        </div>
        <p className="perf">
          {frameMs.toFixed(1)} ms render work · {w?.entities.length ?? 0}{" "}
          entities · Server tick {snapshot?.tick ?? 0}
        </p>
      </aside>
      {marketOpen && actualRole === "watcher" && snapshot && (
        <MarketDesk
          snapshot={snapshot}
          selected={selected}
          disabled={disabled}
          notice={notice || (!online ? status : "")}
          send={send}
          onClose={closeMarket}
        />
      )}
      <div className="game-bottom">
        <p>
          <strong className="interaction-prompt">
            {command ? "Click the city to place your formation." : nearbyPrompt}
          </strong>
          <br />
          <span>
            WASD / arrows move · Shift run · World continues while settings are
            open
          </span>
          <br />
        </p>
        {actualRole !== "watcher" && (
          <div className="action-buttons">
            <button
              disabled={disabled || deathActive}
              onClick={() => action("primary")}
            >
              E ·{" "}
              {actualRole === "protester"
                ? "Chant"
                : actualRole === "police"
                  ? "Detain"
                  : "Engage"}
            </button>
            <button
              disabled={disabled || deathActive}
              onClick={() => action("secondary")}
            >
              Q ·{" "}
              {actualRole === "military"
                ? "Warn"
                : actualRole === "police"
                  ? "Baton"
                  : `Throw (${p?.stones ?? 0})`}
            </button>
            {(actualRole === "police" ||
              (actualRole === "protester" && p?.equipment)) && (
              <button
                disabled={disabled || deathActive}
                onClick={() => action("special")}
              >
                T ·{" "}
                {actualRole === "police"
                  ? "Gas"
                  : p?.equipment === "firearm"
                    ? `Fire (${p.ammo ?? 0})`
                    : p?.equipment === "bat"
                      ? "Swing bat"
                      : "Swing stick"}
              </button>
            )}
            <button
              disabled={disabled || deathActive}
              onClick={() => action("interact")}
            >
              F · Interact
            </button>
            <button
              disabled={disabled || deathActive}
              onClick={() => action(p?.buildingId ? "exit" : "enter")}
            >
              B · {p?.buildingId ? "Exit" : "Enter"}
            </button>
            {["police", "military"].includes(actualRole) && (
              <button
                aria-pressed={command}
                disabled={disabled}
                onClick={toggleCommand}
              >
                Command
              </button>
            )}
          </div>
        )}
        <div
          className="touch-pad"
          aria-label={
            actualRole === "watcher" ? "Camera controls" : "Movement controls"
          }
          hidden={marketOpen}
        >
          <TouchJoystick
            disabled={disabled || deathActive}
            camera={actualRole === "watcher"}
            onMove={({ up, down, left, right }) => {
              Object.assign(input.current, { up, down, left, right });
              follow.current = false;
              setFollowing(false);
            }}
          />
          {actualRole !== "watcher" && (
            <button
              disabled={disabled || deathActive}
              aria-pressed={running}
              onClick={() => {
                input.current.sprint = !input.current.sprint;
                setRunning(input.current.sprint);
              }}
            >
              Run
            </button>
          )}
        </div>
      </div>
      {deathActive && (
        <section className="game-modal" aria-label="Respawn choices">
          <p className="eyebrow">CHARACTER INCAPACITATED</p>
          <h1>
            {deadFor > 0 ? `Return in ${deadFor}s` : "Choose your next role"}
          </h1>
          <p>
            Valid account progression remains. Military appointments end on
            death.
          </p>
          <div className="action-buttons">
            <button
              disabled={disabled || deadFor > 0}
              onClick={() => send({ type: "respawn", role: "protester" })}
            >
              Return as protester
            </button>
            <button
              disabled={disabled || deadFor > 0}
              onClick={() => send({ type: "respawn", role: "police" })}
            >
              Return as police
            </button>
          </div>
        </section>
      )}
      <a
        className="map-credit"
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
      >
        © OpenStreetMap contributors
      </a>
      <dialog
        ref={modal}
        className="game-modal"
        aria-labelledby="game-panel-title"
        onCancel={(event) => {
          event.preventDefault();
          togglePanel(null);
        }}
      >
        <h1 id="game-panel-title">
          {panel === "menu"
            ? "Crossline"
            : panel === "settings"
              ? "Settings"
              : panel === "guide"
                ? "Field guide"
                : "Public rankings"}
        </h1>
        <p className="muted">The city keeps moving while you pause.</p>
        {panel === "menu" && (
          <div className="menu-actions">
            <button className="primary" onClick={() => togglePanel(null)}>
              Resume game
            </button>
            <button onClick={() => togglePanel("guide")}>How to play</button>
            <button onClick={() => togglePanel("settings")}>
              Sound &amp; display
            </button>
            <button onClick={() => togglePanel("rankings")}>Leaderboard</button>
            <button onClick={onExit}>Leave city</button>
          </div>
        )}
        {panel === "settings" && (
          <>
            <label className="inspect-label">
              Graphics
              <select
                value={quality}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  qualityRef.current = value;
                  setQuality(value);
                }}
              >
                <option value="2">High · up to 2× resolution</option>
                <option value="1">Low · 1× resolution</option>
              </select>
            </label>
            <label className="inspect-label">
              Directional sound volume
              <input
                aria-label="Directional sound volume"
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={(event) => {
                  setSoundVolume(Number(event.target.value));
                }}
              />
            </label>
            <button onClick={() => setSoundVolume(volume > 0 ? 0 : 0.4)}>
              {volume > 0 ? "Mute sound" : "Enable sound"}
            </button>
            <p>
              Synthesized positional cues for nearby chants, custody, supplies
              and objectives. Stereo direction follows the camera.
            </p>
            <p>
              Zoom is fixed for active roles. Spectators can pan, follow, and
              zoom.
            </p>
          </>
        )}
        {panel === "guide" && (
          <>
            <p>{help[actualRole]}</p>
            <p>
              Approach an open doorway and use B to enter. Inside, use B near
              the exit. F collects nearby essentials or begins a Constitution
              Book capture when eligible. Stay nearby; defenders can contest
              progress.
            </p>
            <p>
              Police use timed detention on active disruptive targets. Military
              eligibility is server-appointed from police performance every 15
              minutes; a wanted marker alone never permits firing.
            </p>
            <p>
              Map security layouts and events are fictional. All displayed money
              is virtual gameplay credit. Guest access survives refresh through
              this browser’s session cookie.
            </p>
          </>
        )}
        {panel === "rankings" && (
          <>
            <div className="career-summary">
              <p className="eyebrow">
                YOUR CAREER · {snapshot?.self.name ?? name}
              </p>
              <div className="stats">
                <span>
                  <b>{snapshot?.self.score ?? 0}</b>TOTAL SCORE
                </span>
                <span>
                  <b>{snapshot?.self.detentions ?? 0}</b>DETENTIONS
                </span>
                <span>
                  <b>{snapshot?.self.penalties ?? 0}</b>PENALTIES
                </span>
              </div>
              <p className="muted">
                Police score {snapshot?.self.policeScore ?? 0} · Crowd score{" "}
                {snapshot?.self.protesterScore ?? 0} · Spectator result{" "}
                {snapshot?.self.watcherProfit ?? 0}. Your guest career belongs
                to this browser identity.
              </p>
            </div>
            <p>
              Military selection in {Math.ceil(snapshot?.appointmentIn ?? 0)}s.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Total</th>
                  <th>Police</th>
                  <th>Watcher</th>
                </tr>
              </thead>
              <tbody>
                {snapshot?.rankings.slice(0, 12).map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.name}
                      {r.appointmentUntil > (w?.time ?? 0) ? " ★" : ""}
                    </td>
                    <td>{r.score}</td>
                    <td>{r.policeScore}</td>
                    <td>{r.watcherProfit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        {panel !== "menu" && (
          <button className="primary" onClick={() => togglePanel(null)}>
            Return to city
          </button>
        )}
      </dialog>
    </main>
  );
}
