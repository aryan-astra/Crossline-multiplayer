import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Entity, MapId, World } from "../game/types";
import type { Prediction, Profile, Ranking } from "../network/protocol";

const columns = [
  "id",
  "name",
  "credits",
  "lifeCredits",
  "lifeId",
  "score",
  "policeScore",
  "protesterScore",
  "watcherProfit",
  "detentions",
  "penalties",
  "appointmentUntil",
  "mapId",
  "role",
  "deathUntil",
] as const;
const counters = [
  "credits",
  "lifeCredits",
  "lifeId",
  "detentions",
  "penalties",
] as const;
const scores = [
  "score",
  "policeScore",
  "protesterScore",
  "watcherProfit",
] as const;
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const mapValid = (value: unknown): value is MapId =>
  value === "delhi" || value === "paris";
const integer = (value: number, minimum = 0) => {
  if (!Number.isSafeInteger(value) || value < minimum)
    throw new Error("Invalid integer amount");
};
const finite = (value: number) => {
  if (!Number.isFinite(value)) throw new Error("Invalid numeric value");
};
const text = (value: string, max = 160) => {
  if (
    typeof value !== "string" ||
    !value.length ||
    value.length > max ||
    /[\u0000-\u001f\u007f-\u009f]/u.test(value)
  )
    throw new Error("Invalid text");
};
const nameOf = (value: string) => {
  if (typeof value !== "string") throw new Error("Invalid name");
  const name = value.replace(/[\u0000-\u001f\u007f-\u009f]/gu, "").trim();
  if ([...name].length < 2 || [...name].length > 24)
    throw new Error("Name must contain 2 to 24 characters");
  return name;
};

export class Store {
  private readonly db: DatabaseSync;
  private savepoint = 0;

  constructor(file: string) {
    if (file !== ":memory:")
      mkdirSync(dirname(resolve(file)), { recursive: true });
    this.db = new DatabaseSync(file, { timeout: 1000 });
    try {
      this.db.exec(
        "PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;",
      );
      const version = this.db.prepare("PRAGMA user_version").get()!
        .user_version;
      if (version !== 0 && version !== 1)
        throw new Error("Unsupported database schema version");
      if (version === 0)
        this.atomic(() => {
          this.db.exec(`
          CREATE TABLE profiles (
            id TEXT PRIMARY KEY, tokenHash TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
            credits INTEGER NOT NULL CHECK(credits>=0), lifeCredits INTEGER NOT NULL CHECK(lifeCredits>=0),
            lifeId INTEGER NOT NULL CHECK(lifeId>=0), score REAL NOT NULL, policeScore REAL NOT NULL,
            protesterScore REAL NOT NULL, watcherProfit REAL NOT NULL,
            detentions INTEGER NOT NULL CHECK(detentions>=0), penalties INTEGER NOT NULL CHECK(penalties>=0),
            appointmentUntil REAL NOT NULL CHECK(appointmentUntil>=0), mapId TEXT NOT NULL CHECK(mapId IN ('delhi','paris')),
            role TEXT NOT NULL CHECK(role IN ('protester','police','military','watcher')),
            deathUntil REAL NOT NULL CHECK(deathUntil>=0), character TEXT
          ) STRICT;
          CREATE TABLE ledger (
            ordinal INTEGER PRIMARY KEY, key TEXT NOT NULL UNIQUE,
            profileId TEXT NOT NULL REFERENCES profiles(id), amount INTEGER NOT NULL,
            balance INTEGER NOT NULL CHECK(balance>=0), reason TEXT NOT NULL
          ) STRICT;
          CREATE INDEX ledger_profile ON ledger(profileId,ordinal DESC);
          CREATE TABLE operations (
            profileId TEXT NOT NULL REFERENCES profiles(id), key TEXT NOT NULL,
            fingerprint TEXT NOT NULL, result TEXT NOT NULL, PRIMARY KEY(profileId,key)
          ) STRICT;
          CREATE TABLE holdings (
            profileId TEXT NOT NULL REFERENCES profiles(id), instrument TEXT NOT NULL,
            quantity INTEGER NOT NULL CHECK(quantity>=0), PRIMARY KEY(profileId,instrument)
          ) STRICT;
          CREATE TABLE bets (
            id TEXT PRIMARY KEY, profileId TEXT NOT NULL REFERENCES profiles(id),
            deadline REAL NOT NULL, status TEXT NOT NULL CHECK(status IN ('open','won','lost','refunded')),
            payload TEXT NOT NULL
          ) STRICT;
          CREATE INDEX bets_deadline ON bets(status,deadline);
          CREATE INDEX bets_profile ON bets(profileId);
          CREATE TABLE worlds (mapId TEXT PRIMARY KEY CHECK(mapId IN ('delhi','paris')), payload TEXT NOT NULL) STRICT;
          CREATE TABLE meta (key TEXT PRIMARY KEY, value REAL NOT NULL) STRICT;
          PRAGMA user_version=1;
        `);
        });
      if (this.db.prepare("PRAGMA quick_check").get()!.quick_check !== "ok")
        throw new Error("SQLite integrity check failed");
    } catch (error) {
      this.db.close();
      throw error;
    }
  }

  close(): void {
    this.db.close();
  }

  atomic<T>(fn: () => T): T {
    const nested = this.db.isTransaction;
    const point = `store_${++this.savepoint}`;
    this.db.exec(nested ? `SAVEPOINT ${point}` : "BEGIN IMMEDIATE");
    try {
      const result = fn();
      if (result && typeof (result as { then?: unknown }).then === "function")
        throw new Error("Store transactions must be synchronous");
      this.db.exec(nested ? `RELEASE ${point}` : "COMMIT");
      return result;
    } catch (error) {
      this.db.exec(
        nested ? `ROLLBACK TO ${point}; RELEASE ${point}` : "ROLLBACK",
      );
      throw error;
    }
  }

  createGuest(name: string): { token: string; profile: Profile } {
    const token = randomBytes(32).toString("hex");
    const profile: Profile = {
      id: randomUUID(),
      name: nameOf(name),
      credits: 69,
      lifeCredits: 69,
      lifeId: 1,
      score: 0,
      policeScore: 0,
      protesterScore: 0,
      watcherProfit: 0,
      detentions: 0,
      penalties: 0,
      appointmentUntil: 0,
      mapId: "delhi",
      role: "watcher",
      deathUntil: 0,
    };
    this.atomic(() => {
      this.db
        .prepare(
          `INSERT INTO profiles (${columns.join(",")},tokenHash) VALUES (${columns.map(() => "?").join(",")},?)`,
        )
        .run(...columns.map((key) => profile[key]), hash(token));
      this.db
        .prepare(
          "INSERT INTO ledger (key,profileId,amount,balance,reason) VALUES (?,?,?,?,?)",
        )
        .run(
          `initial:${profile.id}`,
          profile.id,
          69,
          69,
          "Initial life allocation",
        );
    });
    return { token, profile };
  }

  identify(token: string): Profile | null {
    if (typeof token !== "string" || !/^[a-f0-9]{64}$/u.test(token))
      return null;
    const row = this.db
      .prepare(`SELECT ${columns.join(",")} FROM profiles WHERE tokenHash=?`)
      .get(hash(token));
    return row ? ({ ...row } as unknown as Profile) : null;
  }

  profile(id: string): Profile {
    const row = this.db
      .prepare(`SELECT ${columns.join(",")} FROM profiles WHERE id=?`)
      .get(id);
    if (!row) throw new Error("Unknown profile");
    return { ...row } as unknown as Profile;
  }

  rename(id: string, name: string): Profile {
    const profile = this.profile(id);
    profile.name = nameOf(name);
    this.saveProfile(profile);
    return profile;
  }

  saveProfile(profile: Profile): void {
    const name = nameOf(profile.name);
    for (const key of counters) integer(profile[key]);
    for (const key of scores) finite(profile[key]);
    for (const key of ["appointmentUntil", "deathUntil"] as const) {
      finite(profile[key]);
      if (profile[key] < 0) throw new Error("Invalid timestamp");
    }
    if (
      !mapValid(profile.mapId) ||
      !["protester", "police", "military", "watcher"].includes(profile.role)
    )
      throw new Error("Invalid profile role or map");
    const values = { ...profile, name };
    const result = this.db
      .prepare(
        `UPDATE profiles SET ${columns
          .slice(1)
          .map((key) => `${key}=?`)
          .join(",")} WHERE id=?`,
      )
      .run(...columns.slice(1).map((key) => values[key]), profile.id);
    if (!result.changes) throw new Error("Unknown profile");
  }

  character(id: string): Entity | null {
    const row = this.db
      .prepare("SELECT character FROM profiles WHERE id=?")
      .get(id);
    if (!row) throw new Error("Unknown profile");
    return row.character === null
      ? null
      : (JSON.parse(String(row.character)) as Entity);
  }

  saveCharacter(id: string, entity: Entity | null): void {
    const result = this.db
      .prepare("UPDATE profiles SET character=? WHERE id=?")
      .run(entity === null ? null : JSON.stringify(entity), id);
    if (!result.changes) throw new Error("Unknown profile");
  }

  credit(id: string, delta: number, reason: string, key: string): boolean {
    if (!Number.isSafeInteger(delta)) throw new Error("Invalid credit amount");
    text(key);
    text(reason);
    return this.atomic(() => {
      const existing = this.db
        .prepare("SELECT profileId,amount,reason FROM ledger WHERE key=?")
        .get(key);
      if (existing) {
        if (
          existing.profileId !== id ||
          existing.amount !== delta ||
          existing.reason !== reason
        )
          throw new Error("Credit key reused with different data");
        return false;
      }
      const profile = this.profile(id);
      const balance = profile.credits + delta;
      integer(balance);
      this.db
        .prepare("UPDATE profiles SET credits=? WHERE id=?")
        .run(balance, id);
      this.db
        .prepare(
          "INSERT INTO ledger (key,profileId,amount,balance,reason) VALUES (?,?,?,?,?)",
        )
        .run(key, id, delta, balance, reason);
      return true;
    });
  }

  operate<T>(id: string, key: string, payload: unknown, fn: () => T): T {
    text(key, 80);
    const serialized = JSON.stringify(payload);
    if (serialized === undefined)
      throw new Error("Operation payload must be JSON");
    const fingerprint = hash(serialized);
    return this.atomic(() => {
      this.profile(id);
      const existing = this.db
        .prepare(
          "SELECT fingerprint,result FROM operations WHERE profileId=? AND key=?",
        )
        .get(id, key);
      if (existing) {
        if (existing.fingerprint !== fingerprint)
          throw new Error("Operation key reused with different payload");
        return (JSON.parse(String(existing.result)) as { value: T }).value;
      }
      const value = fn();
      if (value && typeof (value as { then?: unknown }).then === "function")
        throw new Error("Store operations must be synchronous");
      this.db
        .prepare("INSERT INTO operations VALUES (?,?,?,?)")
        .run(id, key, fingerprint, JSON.stringify({ value }));
      return value;
    });
  }

  holdings(id: string): Record<string, number> {
    const result: Record<string, number> = {};
    for (const row of this.db
      .prepare("SELECT instrument,quantity FROM holdings WHERE profileId=?")
      .all(id))
      result[String(row.instrument)] = Number(row.quantity);
    return result;
  }

  setHolding(id: string, instrument: string, quantity: number): void {
    integer(quantity);
    if (!["calm", "chaos", "glass", "media"].includes(instrument))
      throw new Error("Unknown instrument");
    this.db
      .prepare(
        "INSERT INTO holdings VALUES (?,?,?) ON CONFLICT(profileId,instrument) DO UPDATE SET quantity=excluded.quantity",
      )
      .run(id, instrument, quantity);
  }

  bets(id?: string): Prediction[] {
    const rows =
      id === undefined
        ? this.db.prepare("SELECT payload FROM bets ORDER BY deadline,id").all()
        : this.db
            .prepare(
              "SELECT payload FROM bets WHERE profileId=? ORDER BY deadline,id",
            )
            .all(id);
    return rows.map((row) => JSON.parse(String(row.payload)) as Prediction);
  }

  openBets(id?: string): Prediction[] {
    const rows =
      id === undefined
        ? this.db
            .prepare(
              "SELECT payload FROM bets WHERE status='open' ORDER BY deadline,id",
            )
            .all()
        : this.db
            .prepare(
              "SELECT payload FROM bets WHERE profileId=? AND status='open' ORDER BY deadline,id",
            )
            .all(id);
    return rows.map((row) => JSON.parse(String(row.payload)) as Prediction);
  }

  recentBets(id: string, limit = 30): Prediction[] {
    integer(limit, 1);
    if (limit > 100) throw new Error("Prediction history limit exceeded");
    return this.db
      .prepare(
        "SELECT payload FROM bets WHERE profileId=? ORDER BY deadline DESC,id DESC LIMIT ?",
      )
      .all(id, limit)
      .reverse()
      .map((row) => JSON.parse(String(row.payload)) as Prediction);
  }

  saveBet(bet: Prediction): void {
    text(bet.id);
    text(bet.profileId);
    if (
      !mapValid(bet.mapId) ||
      !["free60", "capture120", "defend120", "unrest60"].includes(
        bet.contract,
      ) ||
      !["open", "won", "lost", "refunded"].includes(bet.status)
    )
      throw new Error("Invalid prediction");
    integer(bet.stake, 1);
    integer(bet.cycle);
    finite(bet.odds);
    finite(bet.deadline);
    if (bet.odds <= 0 || bet.deadline < 0)
      throw new Error("Invalid prediction price or deadline");
    if (bet.targetId !== undefined) integer(bet.targetId, 1);
    if (bet.targetLife !== undefined) integer(bet.targetLife);
    this.atomic(() => {
      const existing = this.db
        .prepare("SELECT payload FROM bets WHERE id=?")
        .get(bet.id);
      if (existing) {
        const previous = JSON.parse(String(existing.payload)) as Prediction;
        for (const field of [
          "profileId",
          "mapId",
          "contract",
          "stake",
          "odds",
          "deadline",
          "cycle",
          "targetId",
          "targetLife",
        ] as const)
          if (previous[field] !== bet[field])
            throw new Error("Cannot change an accepted prediction");
        if (
          previous.status !== "open" &&
          JSON.stringify(previous) !== JSON.stringify(bet)
        )
          throw new Error("Cannot change a settled prediction");
      }
      this.db
        .prepare(
          "INSERT INTO bets VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,payload=excluded.payload",
        )
        .run(
          bet.id,
          bet.profileId,
          bet.deadline,
          bet.status,
          JSON.stringify(bet),
        );
    });
  }

  rankings(): Ranking[] {
    return this.db
      .prepare(
        "SELECT id,name,score,policeScore,protesterScore,watcherProfit,appointmentUntil FROM profiles ORDER BY score DESC,policeScore DESC,id LIMIT 100",
      )
      .all() as unknown as Ranking[];
  }

  checkpoint(mapId: MapId): World | null {
    if (!mapValid(mapId)) throw new Error("Unknown map");
    const row = this.db
      .prepare("SELECT payload FROM worlds WHERE mapId=?")
      .get(mapId);
    return row ? (JSON.parse(String(row.payload)) as World) : null;
  }

  saveWorld(mapId: MapId, world: World): void {
    if (!mapValid(mapId) || world.map.id !== mapId)
      throw new Error("World checkpoint map mismatch");
    this.db
      .prepare(
        "INSERT INTO worlds VALUES (?,?) ON CONFLICT(mapId) DO UPDATE SET payload=excluded.payload",
      )
      .run(mapId, JSON.stringify({ ...world, player: null }));
  }

  meta(key: string, fallback: number): number {
    text(key);
    finite(fallback);
    const row = this.db.prepare("SELECT value FROM meta WHERE key=?").get(key);
    return row ? Number(row.value) : fallback;
  }

  setMeta(key: string, value: number): void {
    text(key);
    finite(value);
    this.db
      .prepare(
        "INSERT INTO meta VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      )
      .run(key, value);
  }

  recentLedger(
    id: string,
  ): { key: string; amount: number; balance: number; reason: string }[] {
    return this.db
      .prepare(
        "SELECT key,amount,balance,reason FROM ledger WHERE profileId=? ORDER BY ordinal DESC LIMIT 20",
      )
      .all(id) as unknown as {
      key: string;
      amount: number;
      balance: number;
      reason: string;
    }[];
  }
}
