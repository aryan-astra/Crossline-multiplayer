export type Role = "protester" | "police" | "military" | "watcher";
export type Faction = "protester" | "police" | "military" | "civilian";
export type MapId = "delhi" | "paris";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Building extends Rect {
  kind: "block" | "shop" | "wall" | "monument";
  name?: string;
  color?: string;
  roof?: string;
  monument?: string; // custom renderer key
  hp: number;
  maxHp: number;
  broken?: boolean;
  awning?: string;
}

export interface MapDef {
  id: MapId;
  name: string;
  country: string;
  w: number;
  h: number;
  ambience: "delhi" | "paris";
  buildings: Building[];
  trees: { x: number; y: number; r: number }[];
  lamps: { x: number; y: number }[];
  roads: Rect[];
  lawns: Rect[];
  labels: { x: number; y: number; text: string; size?: number }[];
  rallyPoints: { x: number; y: number }[];
  policeLine: { x: number; y: number }[];
  checkpoints: { x: number; y: number }[];
  spawns: Record<
    "protester" | "police" | "military" | "civilian",
    { x: number; y: number }
  >;
  detainZone: { x: number; y: number };
  depots: Record<"protester" | "police", { x: number; y: number }>;
  truckRoutes: Record<"protester" | "police", { x: number; y: number }[]>;
}

export interface Brain {
  aggression: number; // 0..1 tendency to escalate
  courage: number; // resists fleeing
  discipline: number; // obeys orders / ROE
  greed: number; // watcher betting appetite
  chattiness: number;
  seed: number;
}

export type EntityState =
  | "idle"
  | "march"
  | "chant"
  | "flee"
  | "throw"
  | "detained"
  | "patrol"
  | "order"
  | "engage"
  | "detain"
  | "down"
  | "wander"
  | "drive"
  | "unload";

export interface Entity {
  id: number;
  kind: "protester" | "police" | "military" | "civilian" | "truck" | "crate";
  faction: Faction;
  name: string;
  x: number;
  y: number;
  dir: number;
  speed: number;
  hp: number;
  maxHp: number;
  state: EntityState;
  stateT: number;
  think: number;
  brain: Brain;
  violentT: number; // >0 counts as violent
  recentThrowT: number;
  warnedT: number;
  stun: number;
  detainProgress: number;
  detainOfficer?: number | null;
  path?: { x: number; y: number }[];
  pathTarget?: { x: number; y: number };
  detainedBy: number | null;
  stones: number;
  gas: number;
  shield: boolean;
  sign: boolean;
  cooldown: number;
  chantT: number;
  bubble: string | null;
  bubbleT: number;
  rank: number; // police 0..3
  order: { x: number; y: number } | null;
  orderSeen: number;
  rallyIdx: number;
  target: { x: number; y: number } | null;
  isPlayer: boolean;
  remote: boolean;
  skin: number;
  cloth: number;
  remove: boolean;
  truckFaction?: "protester" | "police";
  truckPath?: { x: number; y: number }[];
  truckIdx?: number;
  crateFaction?: "protester" | "police";
  betWins?: number;
  everViolent?: boolean;
  actingOn?: number | null;
  detentionsThisRound: number;
  lawfulShots: number;
}

export interface Projectile {
  x: number;
  y: number;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  t: number;
  dur: number;
  kind: "stone" | "bullet" | "gascan";
  from: number;
  targetId?: number;
}

export interface Effect {
  kind: "smoke" | "flash" | "ring" | "text" | "siren";
  x: number;
  y: number;
  t: number;
  dur: number;
  text?: string;
  color?: string;
  r?: number;
}

export interface GasCloud {
  x: number;
  y: number;
  r: number;
  t: number;
  dur: number;
}

export interface Instrument {
  id: string;
  ticker: string;
  name: string;
  desc: string;
  price: number;
  prev: number;
  history: number[];
}

export interface Bet {
  id: number;
  entityId: number;
  entityName: string;
  type: "free60" | "detain60" | "violent60";
  stake: number;
  odds: number;
  deadline: number;
  startDetentions: number;
  status: "open" | "won" | "lost" | "refunded";
}

export interface WorldOrder {
  id: number;
  x: number;
  y: number;
  mode: "move" | "hold" | "line";
  t: number;
  issuer: string;
}

export interface World {
  rngState: number;
  feedSeq: number;
  map: MapDef;
  entities: Entity[];
  projectiles: Projectile[];
  effects: Effect[];
  gases: GasCloud[];
  tension: number;
  violenceRate: number;
  damage: number;
  detentions: number;
  morale: number;
  time: number;
  duration: number;
  over: boolean;
  overReason: string;
  role: Role;
  playerName: string;
  playerId: string;
  player: Entity | null;
  wallet: number;
  careerDetentions: number;
  instruments: Instrument[];
  holdings: Record<string, number>;
  bets: Bet[];
  order: WorldOrder | null;
  orderSeq: number;
  feed: { t: number; text: string; tone: "info" | "good" | "bad" | "market" }[];
  marketT: number;
  nextId: number;
  stats: {
    throws: number;
    shots: number;
    roeViolations: number;
    playerDetentions: number;
    funded: number;
    betProfit: number;
    tradeProfit: number;
  };
  camX: number;
  camY: number;
  zoom: number;
  selectedId: number | null;
  commandMode: boolean;
  lastSync: number;
  earned: number;
}

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  mouseX: number;
  mouseY: number;
}
