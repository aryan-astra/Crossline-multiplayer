import type { InputState, MapDef, MapId, Role, World } from "../game/types";
import type { AreaId } from "../game/locations";
import type { SupplyKind } from "../game/equipment";

export const PROTOCOL_VERSION = 1;
export type Command =
  | {
      type: "join";
      mapId: MapId;
      role: Role;
      areaId?: AreaId;
      supportsDeltas?: boolean;
    }
  | { type: "input"; input: InputState }
  | {
      type: "action";
      action:
        | "primary"
        | "secondary"
        | "special"
        | "interact"
        | "enter"
        | "exit";
      targetId?: number;
    }
  | { type: "order"; x: number; y: number }
  | { type: "trade"; instrument: string; quantity: number }
  | {
      type: "bet";
      contract: "free60" | "capture120" | "defend120" | "unrest60";
      stake: number;
      targetId?: number;
    }
  | { type: "fund"; faction: "protester" | "police"; kind?: SupplyKind }
  | { type: "respawn"; role: "protester" | "police" }
  | { type: "observe"; mapId: MapId }
  | { type: "ping" };
export type ClientMessage = Command & { v: 1; seq: number; requestId: string };

export interface Profile {
  id: string;
  name: string;
  credits: number;
  lifeCredits: number;
  lifeId: number;
  score: number;
  policeScore: number;
  protesterScore: number;
  watcherProfit: number;
  detentions: number;
  penalties: number;
  appointmentUntil: number;
  mapId: MapId;
  role: Role;
  deathUntil: number;
}
export interface Prediction {
  id: string;
  profileId: string;
  mapId: MapId;
  contract: "free60" | "capture120" | "defend120" | "unrest60";
  targetId?: number;
  targetLife?: number;
  stake: number;
  odds: number;
  deadline: number;
  cycle: number;
  status: "open" | "won" | "lost" | "refunded";
  failed?: boolean;
  resolved?: boolean;
}
export interface Ranking {
  id: string;
  name: string;
  credits: number;
  score: number;
  policeScore: number;
  protesterScore: number;
  watcherProfit: number;
  appointmentUntil: number;
}
export interface PoliceDispatch {
  targetId: number;
  name: string;
  wantedLevel: number;
  x: number;
  y: number;
  inBuilding: boolean;
}
export interface Snapshot {
  v: 1;
  type: "snapshot";
  tick: number;
  ack: number;
  world: World;
  self: Profile;
  holdings: Record<string, number>;
  predictions: Prediction[];
  rankings: Ranking[];
  online: number;
  appointmentIn: number;
  policeTask?: PoliceDispatch;
}
export type WireSnapshot = Omit<Snapshot, "world"> & {
  world: Omit<World, "map">;
  mapId: MapId;
  buildingStates: [number, boolean][];
};
export interface SnapshotDelta {
  v: 1;
  type: "delta";
  tick: number;
  ack: number;
  baseTick: number;
  mapId: MapId;
  patch: Record<string, unknown>;
  unset?: string[];
  world: Record<string, unknown>;
  worldUnset?: string[];
  entities: {
    remove: number[];
    order: number[];
    upsert: { id: number; fields: Record<string, unknown>; unset?: string[] }[];
  };
  events: Snapshot["world"]["events"];
  eventsReset?: boolean;
}
export interface MapMessage {
  v: 1;
  type: "map";
  map: MapDef;
}
export type ServerMessage =
  | Snapshot
  | WireSnapshot
  | SnapshotDelta
  | MapMessage
  | {
      v: 1;
      type: "error" | "ack";
      seq: number;
      requestId?: string;
      message: string;
    };

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const finite = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= min &&
  value <= max;
const map = (value: unknown): value is MapId =>
  value === "delhi" || value === "paris";
const role = (value: unknown): value is Role =>
  value === "protester" ||
  value === "police" ||
  value === "military" ||
  value === "watcher";
export function parseMessage(value: unknown): ClientMessage | null {
  if (
    !record(value) ||
    value.v !== 1 ||
    !Number.isSafeInteger(value.seq) ||
    !finite(value.seq, 1, Number.MAX_SAFE_INTEGER) ||
    typeof value.requestId !== "string" ||
    !/^[a-zA-Z0-9:_-]{1,80}$/.test(value.requestId)
  )
    return null;
  let valid = false;
  switch (value.type) {
    case "join":
      valid =
        map(value.mapId) &&
        role(value.role) &&
        (value.areaId === undefined ||
          value.areaId === "gathering" ||
          value.areaId === "approach") &&
        (value.supportsDeltas === undefined ||
          typeof value.supportsDeltas === "boolean");
      break;
    case "observe":
      valid = map(value.mapId);
      break;
    case "input":
      valid =
        record(value.input) &&
        ["up", "down", "left", "right", "sprint"].every(
          (key) =>
            typeof value.input === "object" &&
            value.input !== null &&
            typeof (value.input as Record<string, unknown>)[key] === "boolean",
        ) &&
        finite(value.input.mouseX, -100, 5000) &&
        finite(value.input.mouseY, -100, 5000);
      break;
    case "action":
      valid =
        [
          "primary",
          "secondary",
          "special",
          "interact",
          "enter",
          "exit",
        ].includes(String(value.action)) &&
        (value.targetId === undefined ||
          (Number.isSafeInteger(value.targetId) &&
            finite(value.targetId, 1, Number.MAX_SAFE_INTEGER)));
      break;
    case "order":
      valid = finite(value.x, 0, 5000) && finite(value.y, 0, 5000);
      break;
    case "trade":
      valid =
        typeof value.instrument === "string" &&
        ["calm", "chaos", "glass", "media"].includes(value.instrument) &&
        Number.isSafeInteger(value.quantity) &&
        finite(value.quantity, -50, 50) &&
        value.quantity !== 0;
      break;
    case "bet":
      valid =
        ["free60", "capture120", "defend120", "unrest60"].includes(
          String(value.contract),
        ) &&
        Number.isSafeInteger(value.stake) &&
        finite(value.stake, 1, 50) &&
        (value.targetId === undefined ||
          (Number.isSafeInteger(value.targetId) &&
            finite(value.targetId, 1, Number.MAX_SAFE_INTEGER)));
      break;
    case "fund":
      valid =
        (value.faction === "police" || value.faction === "protester") &&
        (value.kind === undefined ||
          value.kind === "essentials" ||
          value.kind === "gear" ||
          value.kind === "arms");
      break;
    case "respawn":
      valid = value.role === "police" || value.role === "protester";
      break;
    case "ping":
      valid = true;
  }
  return valid ? (value as ClientMessage) : null;
}
