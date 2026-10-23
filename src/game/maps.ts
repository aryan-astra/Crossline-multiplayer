import delhiData from "./geography/delhi.json";
import parisData from "./geography/paris.json";
import type { Building, MapDef, RoadWay } from "./types";

type OSMExport = {
  location: string;
  bounds: { west: number; south: number; east: number; north: number };
  projection: {
    center: { lon: number; lat: number };
    metersPerWorldUnit: number;
  };
  buildings: { id: string; tags: Record<string, string>; ring: number[][] }[];
  roads: { id: string; tags: Record<string, string>; line: number[][] }[];
};
type Point = { x: number; y: number };

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
  const { lon, lat } = data.projection.center;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const cropRect = {
    x:
      1100 -
      ((data.bounds.east - data.bounds.west) * 111320 * cosLat * scale) / 2,
    y: 750 - ((data.bounds.north - data.bounds.south) * 111320 * scale) / 2,
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
    w: 2200,
    h: 1500,
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
    x: 1100 + (longitude - lon) * 111320 * cosLat * scale,
    y: 750 - (latitude - lat) * 111320 * scale,
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
  map.objectivePoint = open(landmark);
  const at = (dx: number, dy: number) =>
    open({ x: landmark.x + dx, y: landmark.y + dy });
  map.rallyPoints = [at(-80, 0), at(-35, 45), at(35, -35), at(80, 30)];
  map.policeLine = [
    at(260, -120),
    at(280, -60),
    at(300, 0),
    at(300, 60),
    at(280, 120),
    at(260, 180),
  ];
  map.checkpoints = [at(-420, 0), at(420, -180), at(0, 360)];
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
  for (const shop of buildings.filter((b) => b.kind === "shop").slice(0, 3)) {
    // Place the public entrance on the nearest navigable edge of the real footprint.
    const center = { x: shop.x + shop.w / 2, y: shop.y + shop.h / 2 };
    shop.entrance = open({ x: center.x, y: shop.y + shop.h + 14 });
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

function resolveBuildings(map: MapDef, x: number, y: number, r: number): Point {
  for (let pass = 0; pass < 12; pass++) {
    const startX = x,
      startY = y;
    for (const b of map.buildings) {
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

export function collideBuildings(
  map: MapDef,
  x: number,
  y: number,
  r: number,
): Point {
  const resolved = resolveBuildings(map, x, y, r);
  const checked = resolveBuildings(map, resolved.x, resolved.y, r);
  if (Math.hypot(checked.x - resolved.x, checked.y - resolved.y) < 0.01)
    return resolved;
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
        const clear = resolveBuildings(map, candidate.x, candidate.y, r);
        if (Math.hypot(clear.x - candidate.x, clear.y - candidate.y) < 0.01)
          return candidate;
      }
  }
  return resolved;
}
