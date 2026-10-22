"use client";

import { useEffect, useRef, useState } from "react";
import {
  createWorld,
  update,
  doAction,
  issueOrder,
  buy,
  fund,
  placeBet,
  portfolioValue,
} from "@/game/engine";
import { buildGround, drawFrame, drawMinimap } from "@/game/render";
import { advance, STEP } from "@/game/loop";
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
  protester: "E / Space: chant · Q: throw if supplied · WASD / arrows: move",
  police:
    "E: detain nearby active threat · Q: baton · T: gas if supplied · C + click: command",
  military: "Q: warning · E: engage a warned active threat · WASD: move",
  watcher: "WASD / arrows: pan · Click a person to inspect · Scroll: zoom",
};

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
  const world = useRef<World | null>(null);
  const input = useRef(emptyInput());
  const [hud, setHud] = useState<World | null>(null);
  const [command, setCommand] = useState(false);
  const [paused, setPaused] = useState(false);
  const pauseRef = useRef(false);
  const [performanceMs, setPerformanceMs] = useState(0);
  const modal = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (paused || hud?.over) modal.current?.showModal();
    else modal.current?.close();
  }, [paused, hud?.over]);

  useEffect(() => {
    const w = createWorld(mapId, role, name, "local-practice", 1000, 0);
    world.current = w;
    const view = canvas.current!;
    const ctx = view.getContext("2d");
    const mini = minimap.current!;
    const miniCtx = mini.getContext("2d");
    if (!ctx || !miniCtx) return;
    const ground = buildGround(w.map);
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      view.width = Math.round(view.clientWidth * dpr);
      view.height = Math.round(view.clientHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    let frame = 0,
      last = performance.now(),
      accumulator = 0,
      hudAt = 0;
    let totalMs = 0,
      frames = 0;
    const loop = (now: number) => {
      const elapsed = (now - last) / 1000;
      last = now;
      const start = performance.now();
      if (!pauseRef.current && !document.hidden) {
        if (w.player)
          w.player.target = {
            x: w.camX + (input.current.mouseX - view.clientWidth / 2) / w.zoom,
            y: w.camY + (input.current.mouseY - view.clientHeight / 2) / w.zoom,
          };
        accumulator = advance(accumulator, elapsed, () =>
          update(w, STEP, input.current),
        );
      }
      drawFrame(ctx, w, view.clientWidth, view.clientHeight, ground);
      drawMinimap(miniCtx, w, mini.width, mini.height);
      totalMs += performance.now() - start;
      frames++;
      if (now - hudAt > 200) {
        setHud({ ...w });
        setCommand(w.commandMode);
        setPerformanceMs(totalMs / frames);
        hudAt = now;
        totalMs = 0;
        frames = 0;
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
    const keydown = (event: KeyboardEvent) => {
      if (modal.current?.open) return;
      if (
        event.target instanceof Element &&
        event.target.closest("input, select, textarea, [contenteditable=true]")
      )
        return;
      const key = event.key.toLowerCase();
      if (
        (key === " " || key === "enter") &&
        event.target instanceof Element &&
        event.target.closest("button, summary, a")
      )
        return;
      if (keys[key]) {
        input.current[keys[key]] = true;
        event.preventDefault();
      }
      if (event.repeat || pauseRef.current) return;
      if (key === "e" || key === " ") {
        doAction(w, "primary");
        event.preventDefault();
      }
      if (key === "q") doAction(w, "secondary");
      if (key === "t") doAction(w, "special");
      if (key === "c" && (role === "police" || role === "military"))
        w.commandMode = !w.commandMode;
    };
    const keyup = (event: KeyboardEvent) => {
      const key = keys[event.key.toLowerCase()];
      if (key) input.current[key] = false;
    };
    const clear = () => {
      input.current = emptyInput();
      accumulator = 0;
      last = performance.now();
    };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      w.zoom = Math.max(
        0.55,
        Math.min(1.8, w.zoom - Math.sign(event.deltaY) * 0.1),
      );
    };
    window.addEventListener("resize", resize);
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", clear);
    view.addEventListener("wheel", wheel, { passive: false });
    return () => {
      cancelAnimationFrame(frame);
      world.current = null;
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", clear);
      view.removeEventListener("wheel", wheel);
    };
  }, [mapId, role, name]);

  const selected = hud?.entities.find((e) => e.id === hud.selectedId);
  const remaining = Math.max(
    0,
    Math.ceil((hud?.duration ?? 300) - (hud?.time ?? 0)),
  );
  const act = (action: "primary" | "secondary" | "special") => {
    if (world.current && !pauseRef.current) doAction(world.current, action);
  };
  return (
    <main className="game-shell">
      <canvas
        ref={canvas}
        aria-label="Interactive city map. Use WASD or arrow keys to move."
        className={command ? "command-cursor" : ""}
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          input.current.mouseX = event.clientX - rect.left;
          input.current.mouseY = event.clientY - rect.top;
        }}
        onClick={(event) => {
          const w = world.current;
          if (!w || pauseRef.current || w.over) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const point = {
            x: w.camX + (event.clientX - rect.left - rect.width / 2) / w.zoom,
            y: w.camY + (event.clientY - rect.top - rect.height / 2) / w.zoom,
          };
          if (w.commandMode) {
            issueOrder(w, point.x, point.y, "move");
            w.commandMode = false;
          } else
            w.selectedId =
              w.entities
                .filter(
                  (e) => !e.remove && e.kind !== "crate" && e.kind !== "truck",
                )
                .find((e) => Math.hypot(e.x - point.x, e.y - point.y) < 20)
                ?.id ?? null;
        }}
      />
      <header className="game-top">
        <div>
          <b>CROSSLINE</b>
          <span>
            {hud?.map.name ?? "Preparing city"} /{" "}
            {role === "watcher" ? "SPECTATOR" : role.toUpperCase()}
          </span>
        </div>
        <span className="practice-tag">LOCAL PRACTICE</span>
        <time>
          {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
        </time>
        <button
          onClick={() => {
            pauseRef.current = !pauseRef.current;
            input.current = emptyInput();
            setPaused(pauseRef.current);
          }}
        >
          {paused ? "Resume" : "Pause"}
        </button>
        <button onClick={onExit}>Exit ↗</button>
      </header>
      <aside className="game-panel">
        <p className="eyebrow">FIELD INTELLIGENCE</p>
        <h2>{name}</h2>
        <p className="muted">{hud?.player?.state ?? "Observing the city"}</p>
        <label className="meter">
          TENSION <strong>{Math.round(hud?.tension ?? 0)}%</strong>
          <progress max="100" value={hud?.tension ?? 0} />
        </label>
        <label className="meter">
          CROWD MORALE <strong>{Math.round(hud?.morale ?? 0)}%</strong>
          <progress max="100" value={hud?.morale ?? 0} />
        </label>
        <div className="stats">
          <span>
            <b>
              {hud?.entities.filter(
                (e) =>
                  e.kind === "protester" &&
                  e.state !== "down" &&
                  e.state !== "detained",
              ).length ?? 0}
            </b>
            CROWD
          </span>
          <span>
            <b>{hud?.detentions ?? 0}</b>DETAINED
          </span>
          <span>
            <b>{Math.round(hud?.player?.hp ?? 100)}</b>
            {role === "watcher" ? "OBSERVER" : "HEALTH"}
          </span>
        </div>
        <canvas
          ref={minimap}
          width="240"
          height="164"
          aria-label="City minimap; yellow marks your position"
        />
        <div className="view-controls">
          <button
            aria-label="Zoom out"
            onClick={() => {
              if (world.current)
                world.current.zoom = Math.max(0.55, world.current.zoom - 0.15);
            }}
          >
            −
          </button>
          <button
            aria-label="Zoom in"
            onClick={() => {
              if (world.current)
                world.current.zoom = Math.min(1.8, world.current.zoom + 0.15);
            }}
          >
            +
          </button>
          {role === "police" && (
            <button
              disabled={paused || hud?.over}
              onClick={() => {
                const w = world.current;
                if (w?.player)
                  issueOrder(w, w.player.x, w.player.y - 60, "line");
              }}
            >
              Form on me
            </button>
          )}
        </div>
        <label className="inspect-label">
          Inspect agent
          <select
            value={hud?.selectedId ?? ""}
            onChange={(event) => {
              if (world.current)
                world.current.selectedId = event.target.value
                  ? Number(event.target.value)
                  : null;
            }}
          >
            <option value="">Choose a person</option>
            {hud?.entities
              .filter(
                (e) => !e.remove && e.kind !== "crate" && e.kind !== "truck",
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
              {selected.kind} / {selected.state}
            </span>
            {role === "watcher" &&
              (selected.kind === "protester" || selected.kind === "police") && (
                <button
                  disabled={paused || hud?.over}
                  onClick={() => {
                    if (world.current)
                      placeBet(
                        world.current,
                        selected.id,
                        selected.kind === "police" ? "detain60" : "free60",
                        50,
                      );
                  }}
                >
                  Practice bet · 50 credits
                </button>
              )}
          </div>
        )}
        {role === "watcher" && (
          <details>
            <summary>Practice market & supplies</summary>
            <p className="muted">
              Session credits: {Math.floor(hud?.wallet ?? 1000)} · Holdings:{" "}
              {Math.floor(hud ? portfolioValue(hud) : 0)}. Resets on exit.
            </p>
            {hud?.instruments.map((item) => (
              <div className="market-row" key={item.id}>
                <span>
                  {item.ticker} {item.price.toFixed(0)}{" "}
                  <small>×{hud.holdings[item.id] ?? 0}</small>
                </span>
                <button
                  disabled={paused || hud.over}
                  onClick={() => {
                    if (world.current) buy(world.current, item.id, 1);
                  }}
                >
                  Buy
                </button>
                <button
                  disabled={paused || hud.over}
                  onClick={() => {
                    if (world.current) buy(world.current, item.id, -1);
                  }}
                >
                  Sell
                </button>
              </div>
            ))}
            <div className="supply-actions">
              <button
                disabled={paused || hud?.over}
                onClick={() => {
                  if (world.current) fund(world.current, "protester", 100);
                }}
              >
                Crowd supply · 100
              </button>
              <button
                disabled={paused || hud?.over}
                onClick={() => {
                  if (world.current) fund(world.current, "police", 100);
                }}
              >
                Police supply · 100
              </button>
            </div>
            <p className="muted">
              Bets: {hud?.bets.filter((b) => b.status === "open").length ?? 0}{" "}
              open · {hud?.bets.filter((b) => b.status === "won").length ?? 0}{" "}
              won
            </p>
          </details>
        )}
        <details className="feed" open>
          <summary>Event log</summary>
          {hud?.feed.slice(0, 6).map((event) => (
            <p key={event.t} data-tone={event.tone}>
              {event.text}
            </p>
          ))}
        </details>
        <p className="perf">
          {performanceMs.toFixed(1)} ms / frame work ·{" "}
          {hud?.entities.length ?? 0} agents & props
        </p>
      </aside>
      <div className="game-bottom">
        <p>
          {command
            ? "Click the map to place an officer formation."
            : help[role]}
          <br />
          <span>Shift: sprint · Scroll: zoom · Yellow ring: you</span>
        </p>
        {role !== "watcher" && (
          <div className="action-buttons">
            <button
              disabled={paused || hud?.over}
              onClick={() => act("primary")}
            >
              E ·{" "}
              {role === "protester"
                ? "Chant"
                : role === "police"
                  ? "Detain"
                  : "Engage"}
            </button>
            <button
              disabled={paused || hud?.over}
              onClick={() => act("secondary")}
            >
              Q ·{" "}
              {role === "military"
                ? "Warn"
                : role === "police"
                  ? "Baton"
                  : "Secondary"}
            </button>
            {role === "police" && (
              <button
                disabled={paused || hud?.over}
                onClick={() => act("special")}
              >
                T · Gas
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
        </div>
      </div>
      <dialog
        ref={modal}
        className="game-modal"
        aria-labelledby="pause-title"
        onCancel={(event) => {
          event.preventDefault();
          if (!hud?.over) {
            pauseRef.current = false;
            setPaused(false);
          }
        }}
      >
        <p className="eyebrow">
          {hud?.over ? "OPERATION COMPLETE" : "SIMULATION PAUSED"}
        </p>
        <h1 id="pause-title">
          {hud?.over ? "The city settles." : "Take a breath."}
        </h1>
        <p>{hud?.over ? hud.overReason : "Resume when you are ready."}</p>
        <p>
          {hud?.detentions ?? 0} detentions · {hud?.stats.throws ?? 0} throws ·{" "}
          {hud?.stats.roeViolations ?? 0} ROE violations
        </p>
        <p className="muted">
          Local practice results. No career or wallet changes are saved.
        </p>
        <button
          className="primary"
          onClick={
            hud?.over
              ? onExit
              : () => {
                  pauseRef.current = false;
                  setPaused(false);
                }
          }
        >
          {hud?.over ? "Return to menu" : "Resume operation"}
        </button>
      </dialog>
    </main>
  );
}
