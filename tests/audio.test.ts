import assert from "node:assert/strict";
import test from "node:test";
import { DirectionalEventAudio, spatialCue } from "../src/game/audio";
import type { AudioSnapshot } from "../src/game/audio";

function fixture() {
  const oscillators: {
    disconnects: number;
    ended?: () => void;
    frequency: { value: number };
    connect(): void;
    addEventListener(type: string, callback: () => void): void;
    start(): void;
    stop(): void;
  }[] = [];
  const ramps: number[] = [];
  const context = {
    currentTime: 1,
    destination: {},
    resume: async () => {},
    suspend: async () => {},
    createOscillator: () => {
      const oscillator = {
        disconnects: 0,
        ended: undefined as (() => void) | undefined,
        frequency: { value: 0 },
        connect() {},
        addEventListener(_type: string, callback: () => void) {
          oscillator.ended = callback;
        },
        start() {},
        stop() {},
        disconnect() {
          oscillator.disconnects++;
        },
      };
      oscillators.push(oscillator);
      return oscillator;
    },
    createGain: () => ({
      gain: {
        setValueAtTime() {},
        exponentialRampToValueAtTime(value: number) {
          ramps.push(value);
        },
      },
      connect() {},
      disconnect() {},
    }),
    createStereoPanner: () => ({
      pan: { value: 0 },
      connect() {},
      disconnect() {},
    }),
  } as unknown as AudioContext;
  return { audio: new DirectionalEventAudio(context), oscillators, ramps };
}

function snapshot(
  events: AudioSnapshot["events"] = [],
  overrides: Partial<AudioSnapshot> = {},
): AudioSnapshot {
  return {
    map: { id: "delhi" } as AudioSnapshot["map"],
    tick: 1,
    events,
    entities: [{ id: 4, x: 100, y: 0 } as AudioSnapshot["entities"][number]],
    objective: { x: 50, y: 20 } as AudioSnapshot["objective"],
    ...overrides,
  };
}

test("spatial cue bounds pan and attenuates by distance with finite inputs", () => {
  const near = spatialCue({ x: 0, y: 0 }, { x: 0, y: 0 }, 1);
  const far = spatialCue({ x: 10000, y: 0 }, { x: 0, y: 0 }, 2);
  assert.equal(near.pan, 0);
  assert.equal(near.gain, 0.08);
  assert.equal(far.pan, 1);
  assert.ok(far.gain < near.gain);
  assert.ok(
    Number.isFinite(
      spatialCue({ x: Infinity, y: NaN }, { x: NaN, y: 0 }, Infinity).gain,
    ),
  );
});

test("first snapshot, mute and map or tick resets do not replay history", () => {
  const { audio, oscillators } = fixture();
  const death = {
    id: 1,
    tick: 1,
    time: 1,
    type: "death" as const,
    targetId: 4,
  };
  audio.update(snapshot([death]), { x: 0, y: 0 }, 1);
  audio.update(
    snapshot([death, { ...death, id: 2, tick: 2 }]),
    { x: 0, y: 0 },
    0,
  );
  audio.update(
    snapshot([death, { ...death, id: 2, tick: 2 }]),
    { x: 0, y: 0 },
    1,
  );
  assert.equal(oscillators.length, 0);

  audio.update(snapshot([{ ...death, id: 3, tick: 3 }]), { x: 0, y: 0 }, 1);
  assert.equal(oscillators.length, 1);
  audio.update(
    snapshot([{ ...death, id: 4, tick: 1 }], { map: { id: "paris" }, tick: 1 }),
    { x: 0, y: 0 },
    1,
  );
  audio.update(
    snapshot([{ ...death, id: 5, tick: 0 }], { tick: 0 }),
    { x: 0, y: 0 },
    1,
  );
  assert.equal(oscillators.length, 1);
  audio.resetHistory();
  audio.update(
    snapshot([{ ...death, id: 6, tick: 20 }], { tick: 20 }),
    { x: 0, y: 0 },
    1,
  );
  assert.equal(oscillators.length, 1);
});

test("dedupes within history, skips unknown sources, bounds history and disconnects nodes", () => {
  const { audio, oscillators, ramps } = fixture();
  audio.update(snapshot(), { x: 0, y: 0 }, 1);
  const death = {
    id: 1,
    tick: 2,
    time: 2,
    type: "death" as const,
    targetId: 4,
  };
  audio.update(snapshot([death]), { x: 0, y: 0 }, 1);
  audio.update(snapshot([death]), { x: 0, y: 0 }, 1);
  assert.equal(oscillators.length, 1);
  oscillators[0].ended?.();
  assert.equal(oscillators[0].disconnects, 1);

  const missing = { ...death, id: 2, tick: 3, targetId: 999 };
  audio.update(snapshot([death, missing]), { x: 0, y: 0 }, 1);
  assert.equal(oscillators.length, 1);
  for (let id = 3; id < 103; id++) {
    const events = Array.from({ length: 10 }, (_, index) => ({
      id: id + index,
      tick: id,
      time: id,
      type: "news" as const,
    }));
    audio.update(snapshot(events, { tick: id }), { x: 0, y: 0 }, 0);
  }
  assert.ok((audio as unknown as { seen: Set<number> }).seen.size <= 10);
  audio.update(
    snapshot([{ ...death, id: 200, tick: 103 }], { tick: 103 }),
    { x: 0, y: 0 },
    0.00001,
  );
  assert.ok(
    ramps.at(-1)! <= spatialCue({ x: 100, y: 0 }, { x: 0, y: 0 }, 0.00001).gain,
  );
});

test("plays a local hit cue when the player loses health", () => {
  const { audio, oscillators } = fixture();
  const player = {
    id: 4,
    x: 100,
    y: 0,
    hp: 100,
    isPlayer: true,
  } as AudioSnapshot["entities"][number];
  audio.update(
    snapshot([], { entities: [player], player }),
    { x: 100, y: 0 },
    1,
  );
  audio.update(
    snapshot([], {
      tick: 2,
      entities: [{ ...player, hp: 76 }],
      player: { ...player, hp: 76 },
    }),
    { x: 100, y: 0 },
    1,
  );
  assert.equal(oscillators.length, 1);
  assert.ok(oscillators[0].frequency.value < 520);
});
