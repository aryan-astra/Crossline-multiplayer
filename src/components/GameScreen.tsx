"use client";

import { useEffect, useRef, useState } from "react";
import { buildGround, drawFrame, drawMinimap } from "@/game/render";
import {
  cameraZoom,
  clampZoom,
  constrainCamera,
  trackCamera,
} from "@/game/camera";
import { connectWorld } from "@/network/client";
import type { Command, Snapshot } from "@/network/protocol";
import type { InputState, MapId, Role, World } from "@/game/types";

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
type Panel = "settings" | "guide" | "rankings" | null;

export default function GameScreen({
  mapId,
  role,
  name,
  onExit,
}: {
  mapId: MapId;
  role: Role;
  name: string;
  onExit: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const minimap = useRef<HTMLCanvasElement>(null);
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
  const qualityRef = useRef(2);
  const audio = useRef<AudioContext | null>(null);
  const volumeRef = useRef(0);
  const sendRef = useRef<(command: Command) => boolean>(() => false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [status, setStatus] = useState("Connecting");
  const [notice, setNotice] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [following, setFollowing] = useState(false);
  const [command, setCommand] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [quality, setQuality] = useState(2);
  const [volume, setVolume] = useState(0);
  const [frameMs, setFrameMs] = useState(0);
  const [stake, setStake] = useState(5);
  const [running, setRunning] = useState(false);
  const [hudCollapsed, setHudCollapsed] = useState(false);

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
  const action = (kind: Extract<Command, { type: "action" }>["action"]) => {
    if (!paused.current)
      send({
        type: "action",
        action: kind,
        ...(selectedRef.current ? { targetId: selectedRef.current } : {}),
      });
  };

  useEffect(() => {
    if (panel) modal.current?.showModal();
    else modal.current?.close();
  }, [panel]);

  useEffect(
    () => () => {
      if (audio.current && audio.current.state !== "closed")
        void audio.current.close();
    },
    [],
  );

  useEffect(() => {
    let stopped = false;
    const connection = connectWorld({
      name,
      join: () => ({
        type: "join",
        mapId: latest.current?.self.mapId ?? mapId,
        role: latest.current?.self.role ?? role,
      }),
      onStatus: (next) => {
        if (!stopped) {
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
          old.world.map.id === next.world.map.id &&
          next.tick < old.tick
        )
          return;
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
        const event = next.world.events?.at(-1);
        if (
          event &&
          event.id !== old?.world.events?.at(-1)?.id &&
          ["objective_capture", "objective_defense", "death"].includes(
            event.type,
          ) &&
          audio.current &&
          volumeRef.current > 0
        ) {
          const oscillator = audio.current.createOscillator(),
            gain = audio.current.createGain();
          oscillator.frequency.value = event.type === "death" ? 180 : 520;
          gain.gain.setValueAtTime(
            volumeRef.current * 0.08,
            audio.current.currentTime,
          );
          gain.gain.exponentialRampToValueAtTime(
            0.001,
            audio.current.currentTime + 0.15,
          );
          oscillator.connect(gain);
          gain.connect(audio.current.destination);
          oscillator.start();
          oscillator.stop(audio.current.currentTime + 0.16);
        }
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
          : (w?.player ?? { x: 0, y: 0 });
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
  }, [mapId, role, name]);

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
        if (!grounds.has(w.map.id)) grounds.set(w.map.id, buildGround(w.map));
        const alpha = Math.min(1, (now - receivedAt.current) / 100);
        const prior = previous.current?.world;
        const oldEntities = new Map(
          prior?.map.id === w.map.id
            ? prior.entities.map((e) => [e.id, e])
            : [],
        );
        const entities = w.entities.map((e) => {
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
          const point = player ?? w.objective ?? w.map.rallyPoints[0];
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
        drawMinimap(miniCtx, presentation, mini.width, mini.height);
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
      if (
        paused.current ||
        (event.target instanceof Element &&
          event.target.closest(
            "input,select,textarea,button,summary,a,[contenteditable=true]",
          ))
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
        sendRef.current({ type: "action", action: "primary" });
        event.preventDefault();
      }
      if (key === "q") sendRef.current({ type: "action", action: "secondary" });
      if (key === "t") sendRef.current({ type: "action", action: "special" });
      if (key === "f") sendRef.current({ type: "action", action: "interact" });
      if (key === "b")
        sendRef.current({
          type: "action",
          action: latest.current?.world.player?.buildingId ? "exit" : "enter",
        });
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
  }, []);

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
  const selected = w?.entities.find((e) => e.id === selectedId && !e.remove);
  const online = status === "Connected" && !!snapshot;
  const disabled = !online || !!panel;
  const symbol = w?.map.id === "paris" ? "€" : "₹";
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
    <main className="game-shell">
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
          pointers.current.delete(event.pointerId);
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
          } else
            select(
              world.entities
                .filter(
                  (e) =>
                    !e.remove &&
                    e.kind !== "truck" &&
                    e.kind !== "crate" &&
                    e.buildingId === world.player?.buildingId,
                )
                .sort(
                  (a, b) =>
                    Math.hypot(a.x - point.x, a.y - point.y) -
                    Math.hypot(b.x - point.x, b.y - point.y),
                )
                .find((e) => Math.hypot(e.x - point.x, e.y - point.y) < 22)
                ?.id ?? null,
            );
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
        <div>
          <b>FAULTLINE</b>
          <span>
            {w?.map.name ?? "Entering public world"} /{" "}
            {actualRole === "watcher" ? "SPECTATOR" : actualRole.toUpperCase()}
          </span>
        </div>
        <span role="status">
          {status} · {snapshot?.online ?? 0} online
        </span>
        <button
          aria-expanded={!hudCollapsed}
          aria-controls="world-hud"
          onClick={() => setHudCollapsed(!hudCollapsed)}
        >
          {hudCollapsed ? "Show HUD" : "Hide HUD"}
        </button>
        <button onClick={() => togglePanel("settings")}>Settings</button>
        <button onClick={onExit}>Leave</button>
      </header>
      <aside
        id="world-hud"
        className="game-panel"
        data-collapsed={hudCollapsed}
      >
        <p className="eyebrow">PUBLIC WORLD · {name}</p>
        <p role="status" className="muted">
          {notice ||
            (online
              ? "Shared simulation active. Your progress is server-owned."
              : "Connecting to the local game server…")}
        </p>
        <div className="stats">
          <span>
            <b>{actualRole === "watcher" ? "—" : Math.round(p?.hp ?? 0)}</b>
            HEALTH
          </span>
          <span>
            <b>
              {symbol}
              {(snapshot?.self.credits ?? 0).toFixed(0)}
            </b>
            GAME CREDITS
          </span>
          <span>
            <b>{snapshot?.self.score ?? 0}</b>SCORE
          </span>
        </div>
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
        <label className="meter">
          UNREST {Math.round(w?.tension ?? 0)}%
          <progress max="100" value={w?.tension ?? 0} />
        </label>
        <div className="selected-unit">
          <b>Constitution Book</b>
          <span>
            Faction objectives · Protesters {w?.factionScores?.protester ?? 0} /
            Police {w?.factionScores?.police ?? 0}
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
        <canvas
          ref={minimap}
          width="240"
          height="164"
          aria-label="Minimap. Yellow marks your character; pale square marks the Constitution Book."
        />
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
                  send({ type: "observe", mapId: event.target.value as MapId })
                }
              >
                <option value="delhi">Mantar Jantar</option>
                <option value="paris">Paris / Republica Plaza</option>
              </select>
            </label>
          </>
        )}
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
                </option>
              ))}
          </select>
        </label>
        {selected && (
          <div className="selected-unit">
            <b>{selected.name}</b>
            <span>
              {selected.kind} · {selected.state} · HP {Math.round(selected.hp)}
            </span>
          </div>
        )}
        {actualRole === "watcher" && (
          <details>
            <summary>Markets, predictions & supplies</summary>
            <p className="muted">
              Fictional credits. Trades use rounded quotes with a 2% fee
              (minimum 1). Predictions pay 2× stake including stake returned. At
              most five open predictions; each stake is limited to 20% of your
              balance.
            </p>
            {w?.instruments.map((item) => (
              <div className="market-row" key={item.id}>
                <span>
                  {item.ticker} {symbol}
                  {item.price.toFixed(0)}{" "}
                  <small>×{snapshot?.holdings[item.id] ?? 0}</small>
                </span>
                <button
                  disabled={disabled}
                  aria-label={`Buy ${item.name}`}
                  onClick={() =>
                    send({ type: "trade", instrument: item.id, quantity: 1 })
                  }
                >
                  Buy
                </button>
                <button
                  disabled={disabled}
                  aria-label={`Sell ${item.name}`}
                  onClick={() =>
                    send({ type: "trade", instrument: item.id, quantity: -1 })
                  }
                >
                  Sell
                </button>
              </div>
            ))}
            <label className="inspect-label">
              Prediction stake (1–50)
              <input
                type="number"
                min="1"
                max="50"
                value={stake}
                onChange={(e) =>
                  setStake(
                    Math.max(
                      1,
                      Math.min(50, Math.floor(Number(e.target.value) || 1)),
                    ),
                  )
                }
              />
            </label>
            <div className="supply-actions">
              <button
                disabled={disabled || selected?.kind !== "protester"}
                onClick={() =>
                  send({
                    type: "bet",
                    contract: "free60",
                    stake,
                    targetId: selected?.id,
                  })
                }
              >
                Selected stays free · 60s
              </button>
              <button
                disabled={disabled}
                onClick={() =>
                  send({ type: "bet", contract: "capture120", stake })
                }
              >
                Book captured · 120s
              </button>
              <button
                disabled={disabled}
                onClick={() =>
                  send({ type: "bet", contract: "defend120", stake })
                }
              >
                Book defended · 120s
              </button>
              <button
                disabled={disabled}
                onClick={() =>
                  send({ type: "bet", contract: "unrest60", stake })
                }
              >
                Unrest ≥60 at 60s
              </button>
            </div>
            <p className="muted">
              Open:{" "}
              {snapshot?.predictions.filter((b) => b.status === "open")
                .length ?? 0}{" "}
              · Won:{" "}
              {snapshot?.predictions.filter((b) => b.status === "won").length ??
                0}
            </p>
            {snapshot?.predictions.slice(-5).map((prediction) => (
              <p className="muted" key={prediction.id}>
                {prediction.contract} · {prediction.stake} at {prediction.odds}×
                · {prediction.status}
                {prediction.status === "open"
                  ? ` · ${Math.max(0, Math.ceil(prediction.deadline - (w?.time ?? 0)))}s`
                  : ""}
              </p>
            ))}
            <p className="muted">
              Free means no detention or death during the interval. Capture
              means a capture occurs; defend means none occurs. Funding requires
              no open bets or holdings, then pauses trading and predictions for
              60s.
            </p>
            <div className="supply-actions">
              <button
                disabled={disabled}
                onClick={() => send({ type: "fund", faction: "protester" })}
              >
                Crowd supply · {symbol}20
              </button>
              <button
                disabled={disabled}
                onClick={() => send({ type: "fund", faction: "police" })}
              >
                Police supply · {symbol}20
              </button>
            </div>
          </details>
        )}
        <details className="feed" open>
          <summary>World news</summary>
          {w?.feed.slice(0, 5).map((event) => (
            <p key={event.t} data-tone={event.tone}>
              {event.text}
            </p>
          ))}
        </details>
        <div className="view-controls">
          <button onClick={() => togglePanel("guide")}>How to play</button>
          <button onClick={() => togglePanel("rankings")}>Rankings</button>
        </div>
        <p className="perf">
          {frameMs.toFixed(1)} ms render work · {w?.entities.length ?? 0}{" "}
          entities · Server tick {snapshot?.tick ?? 0}
        </p>
      </aside>
      <div className="game-bottom">
        <p>
          {command
            ? "Click the city to place your formation."
            : help[actualRole]}
          <br />
          <span>
            WASD / arrows move · Shift run · World continues while settings are
            open
          </span>
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
                  : "Throw"}
            </button>
            {actualRole === "police" && (
              <button
                disabled={disabled || deathActive}
                onClick={() => action("special")}
              >
                T · Gas
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
        <div className="touch-pad" aria-label="Movement controls">
          {(
            [
              ["up", "↑"],
              ["left", "←"],
              ["down", "↓"],
              ["right", "→"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              aria-label={`Move ${key}`}
              disabled={disabled || deathActive}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                input.current[key] = true;
              }}
              onPointerUp={() => {
                input.current[key] = false;
              }}
              onPointerCancel={() => {
                input.current[key] = false;
              }}
              onLostPointerCapture={() => {
                input.current[key] = false;
              }}
            >
              {label}
            </button>
          ))}
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
          {panel === "settings"
            ? "Settings"
            : panel === "guide"
              ? "Field guide"
              : "Public rankings"}
        </h1>
        <p className="muted">
          Your input is paused. The public world continues.
        </p>
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
              Notification volume
              <input
                aria-label="Notification volume"
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  volumeRef.current = value;
                  setVolume(value);
                  if (value > 0) {
                    audio.current ??= new AudioContext();
                    void audio.current
                      .resume()
                      .catch(() =>
                        setNotice(
                          "Audio could not start; gameplay remains available.",
                        ),
                      );
                  }
                }}
              />
            </label>
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
        <button className="primary" onClick={() => togglePanel(null)}>
          Return to city
        </button>
      </dialog>
    </main>
  );
}
