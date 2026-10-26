import delhiData from "./geography/delhi.json";
import parisData from "./geography/paris.json";
import type { Building, MapDef, RoadWay } from "./types";

type OSMExport = {
  location: string;
  bounds: { west: number; south: number; east: number; north: number };
  projection: {
    center: { lon: number; lat: number };
    metersPerWorldUnit: number;
    width?: number;
    height?: number;
  };
  buildings: { id: string; tags: Record<string, string>; ring: number[][] }[];
  roads: { id: string; tags: Record<string, string>; line: number[][] }[];
};
type Point = { x: number; y: number };
const buildingGrid = new WeakMap<
  MapDef,
  { buildings: Building[]; length: number; cells: Map<string, number[]> }
>();
const gridSize = 160;

function clipRing(
  ring: Point[],
  rect: { x: number; y: number; w: number; h: number },
): Point[] {
  let points = ring.slice(0, -1);
  const edges: [(p: Point) => boolean, (a: Point, b: Point) => Point][] = [
    [
      (p: Point) => p.x >= rect.x,
      (a: Point, b: Point) => ({
        x: rect.x,
        y: a.y + ((b.y - a.y) * (rect.x - a.x)) / (b.x - a.x),
      }),
    ],
    [
      (p: Point) => p.x <= rect.x + rect.w,
      (a: Point, b: Point) => ({
        x: rect.x + rect.w,
        y: a.y + ((b.y - a.y) * (rect.x + rect.w - a.x)) / (b.x - a.x),
      }),
    ],
    [
      (p: Point) => p.y >= rect.y,
      (a: Point, b: Point) => ({
        y: rect.y,
        x: a.x + ((b.x - a.x) * (rect.y - a.y)) / (b.y - a.y),
      }),
    ],
    [
      (p: Point) => p.y <= rect.y + rect.h,
      (a: Point, b: Point) => ({
        y: rect.y + rect.h,
        x: a.x + ((b.x - a.x) * (rect.y + rect.h - a.y)) / (b.y - a.y),
      }),
    ],
  ] as const;
  for (const [inside, intersect] of edges) {
    const input = points;
    points = [];
    for (let i = 0; i < input.length; i++) {
      const a = input[i],
        b = input[(i + 1) % input.length],
        aIn = inside(a),
        bIn = inside(b);
      if (aIn && bIn) points.push(b);
      else if (aIn && !bIn) points.push(intersect(a, b));
      else if (!aIn && bIn) points.push(intersect(a, b), b);
    }
  }
  if (points.length < 3) return [];
  points.push(points[0]);
  return points;
}

function clipLine(
  line: Point[],
  rect: { x: number; y: number; w: number; h: number },
): Point[][] {
  const chunks: Point[][] = [];
  let current: Point[] = [];
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1],
      b = line[i],
      dx = b.x - a.x,
      dy = b.y - a.y;
    let lo = 0,
      hi = 1;
    for (const [p, q] of [
      [-dx, a.x - rect.x],
      [dx, rect.x + rect.w - a.x],
      [-dy, a.y - rect.y],
      [dy, rect.y + rect.h - a.y],
    ] as [number, number][]) {
      if (!p && q < 0) {
        lo = 2;
        break;
      }
      if (p) {
        const t = q / p;
        if (p < 0) lo = Math.max(lo, t);
        else hi = Math.min(hi, t);
      }
    }
    if (lo > hi || lo > 1 || hi < 0) {
      if (current.length > 1) chunks.push(current);
      current = [];
      continue;
    }
    const start = { x: a.x + dx * lo, y: a.y + dy * lo },
      end = { x: a.x + dx * hi, y: a.y + dy * hi };
    if (
      !current.length ||
      Math.hypot(current.at(-1)!.x - start.x, current.at(-1)!.y - start.y) >
        0.01
    ) {
      if (current.length > 1) chunks.push(current);
      current = [start];
    }
    current.push(end);
  }
  if (current.length > 1) chunks.push(current);
  return chunks;
}

function makeMap(id: "delhi" | "paris", data: OSMExport): MapDef {
  const point = (p: number[]): Point => ({ x: p[0], y: p[1] });
  const scale = 1 / data.projection.metersPerWorldUnit;
  const w = data.projection.width ?? 2200;
  const h = data.projection.height ?? 1500;
  const center = { x: w / 2, y: h / 2 };
  const { lon, lat } = data.projection.center;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const cropRect = {
    x:
      center.x -
      ((data.bounds.east - data.bounds.west) * 111320 * cosLat * scale) / 2,
    y:
      center.y - ((data.bounds.north - data.bounds.south) * 111320 * scale) / 2,
    w: (data.bounds.east - data.bounds.west) * 111320 * cosLat * scale,
    h: (data.bounds.north - data.bounds.south) * 111320 * scale,
  };
  const buildings: Building[] = data.buildings.flatMap(
    ({ id: osmId, tags, ring }) => {
      const footprint = clipRing(ring.map(point), cropRect);
      if (footprint.length < 4) return [];
      const xs = footprint.map((p) => p.x),
        ys = footprint.map((p) => p.y);
      const shop = Boolean(
        tags.shop ||
          ["cafe", "restaurant", "fast_food", "bar"].some(
            (key) => tags.amenity === key,
          ),
      );
      const monument = tags.name === "Samrat Yantra" ? "samrat" : undefined;
      return [
        {
          id: `osm-way-${osmId}`,
          name: tags.name,
          kind: monument ? "monument" : shop ? "shop" : "block",
          monument,
          x: Math.min(...xs),
          y: Math.min(...ys),
          w: Math.max(...xs) - Math.min(...xs),
          h: Math.max(...ys) - Math.min(...ys),
          footprint,
          hp: shop ? 100 : 400,
          maxHp: shop ? 100 : 400,
        },
      ];
    },
  );
  const roadWays: RoadWay[] = data.roads
    .filter(({ tags }) =>
      [
        "primary",
        "secondary",
        "tertiary",
        "residential",
        "living_street",
        "pedestrian",
        "unclassified",
      ].includes(tags.highway),
    )
    .flatMap(({ id: osmId, tags, line }) =>
      clipLine(line.map(point), cropRect).map((line, i) => ({
        id: `osm-way-${osmId}-${i}`,
        name: tags.name,
        highway: tags.highway,
        line,
      })),
    );
  const map: MapDef = {
    id,
    name:
      id === "delhi"
        ? "Jantar Mantar, New Delhi"
        : "Place de la République, Paris",
    country: id === "delhi" ? "India" : "France",
    w,
    h,
    ambience: id,
    buildings,
    trees: [],
    lamps: [],
    roads: [],
    roadWays,
    lawns: [],
    labels: [],
    rallyPoints: [],
    policeLine: [],
    checkpoints: [],
    spawns: {
      protester: { x: 0, y: 0 },
      police: { x: 0, y: 0 },
      military: { x: 0, y: 0 },
      civilian: { x: 0, y: 0 },
    },
    detainZone: { x: 0, y: 0 },
    depots: { protester: { x: 0, y: 0 }, police: { x: 0, y: 0 } },
    truckRoutes: { protester: [], police: [] },
    bounds: data.bounds,
    cropRect,
    objectivePoint: { x: 0, y: 0 },
  };
  const projectGeo = (latitude: number, longitude: number): Point => ({
    x: center.x + (longitude - lon) * 111320 * cosLat * scale,
    y: center.y - (latitude - lat) * 111320 * scale,
  });
  const landmark =
    id === "delhi" ? projectGeo(28.6271, 77.2166) : projectGeo(48.8675, 2.3638);
  const open = (target: Point): Point => {
    for (let radius = 0; radius <= 280; radius += 12) {
      for (let n = -radius; n <= radius; n += 12)
        for (const [dx, dy] of [
          [n, -radius],
          [n, radius],
          [-radius, n],
          [radius, n],
        ]) {
          const p = { x: target.x + dx, y: target.y + dy };
          const clear = collideBuildings(map, p.x, p.y, 9);
          if (clear.x === p.x && clear.y === p.y) return p;
        }
    }
    return collideBuildings(map, target.x, target.y, 9);
  };
  map.objectivePoint = (() => {
    for (let radius = 0; radius <= 280; radius += 12)
      for (let n = -radius; n <= radius; n += 12)
        for (const [dx, dy] of [
          [n, -radius],
          [n, radius],
          [-radius, n],
          [radius, n],
        ]) {
          const p = open({ x: landmark.x + dx, y: landmark.y + dy });
          if (isWalkable(map, p.x, p.y, 90)) return p;
        }
    return open(landmark);
  })();
  ensureObjectiveDefenses(map);
  ensureStreetShops(map);
  const at = (dx: number, dy: number) =>
    open({ x: landmark.x + dx, y: landmark.y + dy });
  const cells = new Map<string, { point: Point; distance: number }>();
  for (const way of roadWays)
    for (let i = 1; i < way.line.length; i++) {
      const a = way.line[i - 1];
      const b = way.line[i];
      const p = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const cx = Math.floor((p.x / w) * 4);
      const cy = Math.floor((p.y / h) * 4);
      if (cx < 0 || cx > 3 || cy < 0 || cy > 3) continue;
      const center = { x: ((cx + 0.5) * w) / 4, y: ((cy + 0.5) * h) / 4 };
      const distance = Math.hypot(p.x - center.x, p.y - center.y);
      const key = `${cx},${cy}`;
      if (distance < (cells.get(key)?.distance ?? Infinity))
        cells.set(key, { point: p, distance });
    }
  const districtRallies = [...cells.values()]
    .map(({ point }) => open(point))
    .filter(
      (p, i, points) =>
        isWalkable(map, p.x, p.y, 9) &&
        points
          .slice(0, i)
          .every((other) => Math.hypot(p.x - other.x, p.y - other.y) > 100),
    );
  map.rallyPoints = [at(-35, 45), at(35, -35), ...districtRallies];
  map.checkpoints.push(at(-420, 0), at(420, -180), at(0, 360));
  map.spawns = {
    protester: at(-180, 0),
    police: at(220, 0),
    military: at(310, 70),
    civilian: at(0, -260),
  };
  map.detainZone = at(430, 260);
  const getRoad = (name: string): Point[] => {
    const candidates = roadWays
      .filter((way) => way.name === name)
      .sort((a, b) => b.line.length - a.line.length);
    const line = candidates[0]?.line ?? [];
    return line
      .map((p) => open(p))
      .filter(
        (p, i, points) =>
          i === 0 ||
          Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y) > 18,
      );
  };
  const routeA = getRoad(
    id === "delhi" ? "Jantar Mantar Road" : "Rue du Temple",
  );
  const routeB = getRoad(id === "delhi" ? "Sansad Marg" : "Boulevard Voltaire");
  map.truckRoutes = {
    protester: routeA.length > 1 ? routeA : [at(-500, 0), ...map.rallyPoints],
    police:
      routeB.length > 1 ? routeB : [at(500, 0), ...map.policeLine.slice(0, 3)],
  };
  map.depots = {
    protester: map.truckRoutes.protester.at(-1) ?? at(-80, 0),
    police: map.truckRoutes.police.at(-1) ?? at(80, 0),
  };
  map.labels = [
    {
      x: landmark.x,
      y: landmark.y - 100,
      text: id === "delhi" ? "JANTAR MANTAR" : "PLACE DE LA RÉPUBLIQUE",
      size: 18,
    },
  ];
  const labeledRoads = new Set<string>();
  for (const way of roadWays)
    if (
      way.name &&
      !labeledRoads.has(way.name) &&
      (way.name.includes("Sansad") ||
        way.name.includes("Boulevard") ||
        way.name.includes("Avenue") ||
        way.name.includes("Janpath"))
    ) {
      labeledRoads.add(way.name);
      const p = way.line[Math.floor(way.line.length / 2)];
      map.labels.push({
        x: p.x,
        y: p.y - 15,
        text: way.name.toUpperCase(),
        size: 11,
      });
    }
  for (const [index, building] of buildings
    .filter((b) => b.kind !== "wall" && b.kind !== "monument")
    .entries()) {
    building.id ??= `${id}-building-${index}`;
    building.entrance = open({
      x: building.x + building.w / 2,
      y: building.y + building.h + 14,
    });
    building.interior = {
      w: 240,
      h: 180,
      capacity: 6,
      obstacles: [
        { x: 30, y: 30, w: 70, h: 28 },
        { x: 150, y: 30, w: 60, h: 28 },
      ],
    };
  }
  return map;
}

export const MAPS: Record<"delhi" | "paris", MapDef> = {
  delhi: makeMap("delhi", delhiData as unknown as OSMExport),
  paris: makeMap("paris", parisData as unknown as OSMExport),
};

function insidePolygon(x: number, y: number, ring: Point[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (
      a.y > y !== b.y > y &&
      x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x
    )
      inside = !inside;
  }
  return inside;
}
function nearestOnSegment(p: Point, a: Point, b: Point): Point {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1),
    ),
  );
  return { x: a.x + dx * t, y: a.y + dy * t };
}
function collidePolygon(
  b: Building,
  x: number,
  y: number,
  r: number,
): Point | undefined {
  const ring = b.footprint;
  if (!ring?.length) return;
  const inside = insidePolygon(x, y, ring);
  let edgePoint: Point | undefined,
    edgeIndex = 0,
    distance2 = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const p = nearestOnSegment({ x, y }, ring[i], ring[(i + 1) % ring.length]);
    const d2 = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d2 < distance2) {
      distance2 = d2;
      edgePoint = p;
      edgeIndex = i;
    }
  }
  if (!edgePoint || (!inside && distance2 >= r * r)) return;
  let dx = x - edgePoint.x,
    dy = y - edgePoint.y,
    distance = Math.hypot(dx, dy);
  if (inside || distance < 1e-6) {
    const a = ring[edgeIndex],
      b = ring[(edgeIndex + 1) % ring.length];
    const nx = -(b.y - a.y),
      ny = b.x - a.x,
      length = Math.hypot(nx, ny) || 1;
    const one = {
      x: edgePoint.x + (nx / length) * 0.1,
      y: edgePoint.y + (ny / length) * 0.1,
    };
    const sign = insidePolygon(one.x, one.y, ring) ? -1 : 1;
    dx = (nx / length) * sign;
    dy = (ny / length) * sign;
    distance = 0;
  } else {
    dx /= distance;
    dy /= distance;
  }
  return { x: edgePoint.x + dx * (r + 0.01), y: edgePoint.y + dy * (r + 0.01) };
}

export function queryBuildings(
  map: MapDef,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
) {
  let grid = buildingGrid.get(map);
  if (
    !grid ||
    grid.buildings !== map.buildings ||
    grid.length !== map.buildings.length
  ) {
    const cells = new Map<string, number[]>();
    map.buildings.forEach((b, index) => {
      for (
        let cy = Math.floor(b.y / gridSize);
        cy <= Math.floor((b.y + b.h) / gridSize);
        cy++
      )
        for (
          let cx = Math.floor(b.x / gridSize);
          cx <= Math.floor((b.x + b.w) / gridSize);
          cx++
        ) {
          const key = `${cx},${cy}`;
          const bucket = cells.get(key);
          if (bucket) bucket.push(index);
          else cells.set(key, [index]);
        }
    });
    grid = { buildings: map.buildings, length: map.buildings.length, cells };
    buildingGrid.set(map, grid);
  }
  const indexes = new Set<number>();
  for (
    let cy = Math.floor(minY / gridSize);
    cy <= Math.floor(maxY / gridSize);
    cy++
  )
    for (
      let cx = Math.floor(minX / gridSize);
      cx <= Math.floor(maxX / gridSize);
      cx++
    )
      for (const index of grid.cells.get(`${cx},${cy}`) ?? [])
        indexes.add(index);
  return [...indexes]
    .sort((a, b) => a - b)
    .map((index) => map.buildings[index]);
}

function nearbyBuildings(map: MapDef, x: number, y: number, r: number) {
  return queryBuildings(map, x - r, y - r, x + r, y + r);
}

function resolveBuildings(map: MapDef, x: number, y: number, r: number): Point {
  for (let pass = 0; pass < 12; pass++) {
    const startX = x,
      startY = y;
    for (const b of nearbyBuildings(map, x, y, r)) {
      if (b.barricade && b.broken) continue;
      if (
        b.kind !== "wall" &&
        b.kind !== "block" &&
        b.kind !== "shop" &&
        b.kind !== "monument"
      )
        continue;
      if (x + r < b.x || x - r > b.x + b.w || y + r < b.y || y - r > b.y + b.h)
        continue;
      if (b.footprint) {
        const p = collidePolygon(b, x, y, r);
        if (p) {
          x = p.x;
          y = p.y;
        }
        continue;
      }
      const nx = Math.max(b.x, Math.min(x, b.x + b.w)),
        ny = Math.max(b.y, Math.min(y, b.y + b.h));
      const dx = x - nx,
        dy = y - ny,
        d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        if (d2 === 0) {
          const l = x - b.x,
            rr = b.x + b.w - x,
            t = y - b.y,
            bt = b.y + b.h - y,
            m = Math.min(l, rr, t, bt);
          if (m === l) x = b.x - r;
          else if (m === rr) x = b.x + b.w + r;
          else if (m === t) y = b.y - r;
          else y = b.y + b.h + r;
        } else {
          const d = Math.sqrt(d2);
          x = nx + (dx / d) * r;
          y = ny + (dy / d) * r;
        }
      }
    }
    if (Math.hypot(x - startX, y - startY) < 0.01) break;
  }
  return {
    x: Math.max(10, Math.min(map.w - 10, x)),
    y: Math.max(10, Math.min(map.h - 10, y)),
  };
}

export function isWalkable(
  map: MapDef,
  x: number,
  y: number,
  r: number,
): boolean {
  if (x < 10 || y < 10 || x > map.w - 10 || y > map.h - 10) return false;
  for (const b of nearbyBuildings(map, x, y, r)) {
    if (b.barricade && b.broken) continue;
    if (!["wall", "block", "shop", "monument"].includes(b.kind)) continue;
    if (x + r < b.x || x - r > b.x + b.w || y + r < b.y || y - r > b.y + b.h)
      continue;
    if (b.footprint?.length) {
      if (insidePolygon(x, y, b.footprint)) return false;
      for (let i = 0; i < b.footprint.length; i++) {
        const p = nearestOnSegment(
          { x, y },
          b.footprint[i],
          b.footprint[(i + 1) % b.footprint.length],
        );
        if ((p.x - x) ** 2 + (p.y - y) ** 2 < r * r - 1e-6) return false;
      }
    } else {
      const dx = x - Math.max(b.x, Math.min(x, b.x + b.w));
      const dy = y - Math.max(b.y, Math.min(y, b.y + b.h));
      if (dx * dx + dy * dy < r * r - 1e-6) return false;
    }
  }
  return true;
}

export function collideBuildings(
  map: MapDef,
  x: number,
  y: number,
  r: number,
): Point {
  const resolved = resolveBuildings(map, x, y, r);
  if (isWalkable(map, resolved.x, resolved.y, r)) return resolved;
  for (let radius = 6; radius <= 120; radius += 6) {
    for (let dy = -radius; dy <= radius; dy += 6)
      for (let dx = -radius; dx <= radius; dx += 6) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const candidate = resolveBuildings(
          map,
          resolved.x + dx,
          resolved.y + dy,
          r,
        );
        if (isWalkable(map, candidate.x, candidate.y, r)) return candidate;
      }
  }
  return resolved;
}

export function ensureObjectiveDefenses(map: MapDef) {
  const objective = map.objectivePoint ?? map.spawns.police;
  for (let i = 0; i < 4; i++) {
    const id = `${map.id}-objective-barricade-${i}`;
    if (map.buildings.some((building) => building.id === id)) continue;
    map.buildings.push({
      id,
      kind: "wall",
      barricade: true,
      x: objective.x - 146 + i * 76,
      y: objective.y + 105,
      w: 44,
      h: 18,
      hp: 100,
      maxHp: 100,
    });
  }
  map.policeLine = Array.from({ length: 14 }, (_, i) => {
    const innerRing = i < 6;
    const ringIndex = innerRing ? i : i - 6;
    const ringCount = innerRing ? 6 : 8;
    const angle = (ringIndex * Math.PI * 2) / ringCount;
    const radius = innerRing ? 65 : 170;
    return collideBuildings(
      map,
      objective.x + Math.cos(angle) * radius,
      objective.y + Math.sin(angle) * radius,
      9,
    );
  });
  const defenseCheckpoints = [-120, 0, 120].flatMap((y) =>
    [-220, 220].map((x) =>
      collideBuildings(map, objective.x + x, objective.y + y, 9),
    ),
  );
  map.checkpoints = [...defenseCheckpoints, ...map.checkpoints].filter(
    (point, i, points) =>
      points.findIndex(
        (other) => Math.hypot(point.x - other.x, point.y - other.y) < 1,
      ) === i,
  );
}

export function ensureStreetShops(map: MapDef) {
  const shops = map.buildings.filter((building) => building.kind === "shop");
  const initialCount = shops.length;
  const candidates = map.buildings
    .filter(
      (building) =>
        building.kind === "block" &&
        building.w <= 100 &&
        building.h <= 100 &&
        Math.hypot(
          building.x + building.w / 2 - (map.objectivePoint?.x ?? 0),
          building.y + building.h / 2 - (map.objectivePoint?.y ?? 0),
        ) >= 180,
    )
    .sort(
      (a, b) => a.w * a.h - b.w * b.h || (a.id ?? "").localeCompare(b.id ?? ""),
    );
  const names =
    map.id === "delhi"
      ? ["Kirana shop", "Chai corner", "Street provisions", "Market kiosk"]
      : ["Boulangerie", "Café de quartier", "Épicerie", "Pâtisserie"];
  while (shops.length < 8) {
    let best = -1,
      bestDistance = 180;
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      const x = candidate.x + candidate.w / 2,
        y = candidate.y + candidate.h / 2;
      const nearest = shops.length
        ? Math.min(
            ...shops.map((shop) =>
              Math.hypot(x - shop.x - shop.w / 2, y - shop.y - shop.h / 2),
            ),
          )
        : Infinity;
      if (nearest > bestDistance) {
        best = i;
        bestDistance = nearest;
      }
    }
    if (best < 0) break;
    const shop = candidates.splice(best, 1)[0];
    shop.kind = "shop";
    shop.hp = Math.min(shop.hp, 100);
    shop.maxHp = Math.min(shop.maxHp, 100);
    shop.name ??= names[(shops.length - initialCount) % names.length];
    shops.push(shop);
  }
}
