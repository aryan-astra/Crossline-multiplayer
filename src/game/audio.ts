import type { World, WorldEvent } from "./types";

export type AudioSnapshot = Pick<
  World,
  "tick" | "events" | "entities" | "objective"
> & { map: Pick<World["map"], "id">; player?: World["player"] };

export interface AudioListener {
  x: number;
  y: number;
}

export interface SpatialCue {
  gain: number;
  pan: number;
}

const audibleEvents = new Set<WorldEvent["type"]>([
  "death",
  "detention",
  "unjustified_detention",
  "release",
  "objective_capture",
  "objective_defense",
  "chant",
  "supply_delivery",
  "resource_collection",
]);

const objectiveEvents = new Set<WorldEvent["type"]>([
  "objective_capture",
  "objective_defense",
]);

export function spatialCue(
  source: { x: number; y: number },
  listener: AudioListener,
  volume: number,
): SpatialCue {
  const lx = Number.isFinite(listener.x) ? listener.x : 0;
  const ly = Number.isFinite(listener.y) ? listener.y : 0;
  const x = Number.isFinite(source.x) ? source.x : lx;
  const y = Number.isFinite(source.y) ? source.y : ly;
  const distance = Math.hypot(x - lx, y - ly);
  return {
    gain:
      (Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 0)) * 0.08) /
      (1 + distance / 240),
    pan: Math.max(-1, Math.min(1, (x - lx) / 360)),
  };
}

/** Emits synthesized positional event cues; this is not recorded city ambience. */
export class DirectionalEventAudio {
  private seen = new Set<number>();
  private initialized = false;
  private disposed = false;
  private mapId: string | undefined;
  private tick = 0;
  private playerHp: number | undefined;

  constructor(private readonly context: AudioContext) {}

  resume(): Promise<void> {
    this.disposed = false;
    return this.context.resume();
  }

  resetHistory(): void {
    this.initialized = false;
  }

  update(
    snapshot: AudioSnapshot,
    listener: AudioListener,
    volume: number,
  ): void {
    if (this.disposed) return;
    const events = snapshot.events;
    if (
      !this.initialized ||
      snapshot.map.id !== this.mapId ||
      snapshot.tick < this.tick
    ) {
      this.seed(snapshot);
      return;
    }
    this.tick = snapshot.tick;
    const player = snapshot.player;
    if (
      player &&
      this.playerHp !== undefined &&
      player.hp < this.playerHp &&
      volume > 0
    )
      this.playTone(spatialCue(player, listener, volume), 220);
    this.playerHp = player?.hp;
    for (const event of events) {
      if (this.seen.has(event.id)) continue;
      this.seen.add(event.id);
      if (volume <= 0 || !audibleEvents.has(event.type)) continue;
      const source =
        event.actorId != null
          ? snapshot.entities.find((entity) => entity.id === event.actorId)
          : undefined;
      const target =
        event.targetId != null
          ? snapshot.entities.find((entity) => entity.id === event.targetId)
          : undefined;
      const position =
        source ??
        target ??
        (objectiveEvents.has(event.type) ? snapshot.objective : undefined);
      if (!position) continue;
      const cue = spatialCue(position, listener, volume);
      if (
        event.type === "chant" ||
        event.type === "supply_delivery" ||
        event.type === "resource_collection"
      ) {
        cue.gain *= 0.35;
      }
      this.play(event, cue);
    }
    this.prune(events);
  }

  dispose(): void {
    this.disposed = true;
    void this.context.suspend().catch(() => {});
  }

  private seed(snapshot: AudioSnapshot): void {
    this.seen = new Set(snapshot.events.map((event) => event.id));
    this.mapId = snapshot.map.id;
    this.tick = snapshot.tick;
    this.playerHp = snapshot.player?.hp;
    this.initialized = true;
  }

  private prune(events: WorldEvent[]): void {
    const currentIds = new Set(events.map((event) => event.id));
    this.seen = new Set([...this.seen].filter((id) => currentIds.has(id)));
  }

  private play(event: WorldEvent, cue: SpatialCue): void {
    this.playTone(cue, event.type === "death" ? 180 : 520);
  }

  private playTone(cue: SpatialCue, frequency: number): void {
    if (cue.gain <= 0) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const pan = this.context.createStereoPanner();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    pan.pan.value = cue.pan;
    gain.gain.setValueAtTime(cue.gain, now);
    gain.gain.exponentialRampToValueAtTime(
      Math.min(cue.gain, 0.001),
      now + 0.16,
    );
    oscillator.connect(gain);
    gain.connect(pan);
    pan.connect(this.context.destination);
    oscillator.addEventListener(
      "ended",
      () => {
        oscillator.disconnect();
        gain.disconnect();
        pan.disconnect();
      },
      { once: true },
    );
    oscillator.start(now);
    oscillator.stop(now + 0.17);
  }
}
