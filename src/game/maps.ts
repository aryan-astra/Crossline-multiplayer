import type { Building, MapDef } from "./types";

const B = (
  x: number,
  y: number,
  w: number,
  h: number,
  kind: Building["kind"],
  extra: Partial<Building> = {},
): Building => ({
  x,
  y,
  w,
  h,
  kind,
  hp: kind === "shop" ? 100 : 400,
  maxHp: kind === "shop" ? 100 : 400,
  ...extra,
});

/* ================= DELHI — JANTAR MANTAR ================= */
function delhi(): MapDef {
  const buildings: Building[] = [
    // perimeter walls of the observatory complex (gates: south x760-900, east y620-740)
    B(240, 210, 1260, 16, "wall"),
    B(240, 210, 16, 1140, "wall"),
    B(240, 1334, 520, 16, "wall"),
    B(900, 1334, 600, 16, "wall"),
    B(1484, 210, 16, 410, "wall"),
    B(1484, 740, 16, 610, "wall"),
    // ticket office
    B(280, 250, 130, 80, "block", {
      name: "Ticket Office",
      color: "#c96f4a",
      roof: "#a85536",
    }),
    // SAMRAT YANTRA — great triangular sundial, N-S gnomon with staircase
    B(770, 380, 130, 380, "monument", {
      monument: "samrat",
      name: "Samrat Yantra",
    }),
    // MISRA YANTRA — cross-shaped composite instrument
    B(380, 420, 200, 200, "monument", {
      monument: "misra",
      name: "Misra Yantra",
    }),
    // JAI PRAKASH YANTRA — twin sunken hemispherical bowls
    B(1040, 480, 200, 200, "monument", {
      monument: "jaiprakash1",
      name: "Jai Prakash Yantra",
    }),
    B(1260, 480, 190, 190, "monument", { monument: "jaiprakash2" }),
    // RAM YANTRA — twin open cylindrical structures
    B(400, 800, 180, 180, "monument", { monument: "ram1", name: "Ram Yantra" }),
    B(630, 800, 180, 180, "monument", { monument: "ram2" }),
    // small yantras south of Samrat
    B(950, 760, 90, 60, "monument", {
      monument: "small",
      name: "Dakshinottara",
    }),
    B(1090, 760, 70, 70, "monument", { monument: "small" }),
    // east side — Sansad Marg shops (Connaught-style white colonnades)
    B(1620, 260, 170, 130, "shop", { name: "Chai Point", awning: "#b3402e" }),
    B(1620, 420, 170, 130, "shop", {
      name: "Khadi Bhandar",
      awning: "#2e6b4f",
    }),
    B(1620, 580, 170, 130, "shop", {
      name: "Camera Repair",
      awning: "#31589c",
    }),
    B(1620, 740, 170, 130, "shop", {
      name: "Delhi Book House",
      awning: "#8a5a2b",
    }),
    B(1620, 900, 170, 130, "shop", {
      name: "Halwai Sweets",
      awning: "#b3862e",
    }),
    B(1620, 1060, 170, 130, "shop", {
      name: "Mobile Plaza",
      awning: "#5a3d8a",
    }),
    // far east city blocks
    B(1900, 240, 260, 300, "block", {
      color: "#d8cfc0",
      roof: "#bfb4a1",
      name: "Statesman House",
    }),
    B(1900, 600, 260, 300, "block", { color: "#cfc4b2", roof: "#b5a992" }),
    B(1900, 960, 260, 320, "block", { color: "#d8cfc0", roof: "#bfb4a1" }),
    // west across Sansad Marg
    B(-80, 300, 180, 340, "block", { color: "#cbb9a4", roof: "#b09e88" }),
    B(-80, 720, 180, 340, "block", { color: "#cbb9a4", roof: "#b09e88" }),
    // police detain compound (van + tent drawn by renderer)
  ];
  const trees = [];
  for (let i = 0; i < 9; i++) trees.push({ x: 300 + i * 135, y: 1290, r: 22 });
  for (let i = 0; i < 7; i++) trees.push({ x: 205, y: 260 + i * 160, r: 20 });
  for (let i = 0; i < 8; i++) trees.push({ x: 1555, y: 260 + i * 150, r: 18 });
  trees.push(
    { x: 960, y: 960, r: 26 },
    { x: 1180, y: 1000, r: 24 },
    { x: 560, y: 680, r: 22 },
    { x: 1330, y: 320, r: 24 },
  );
  return {
    id: "delhi",
    name: "Mantar Jantar",
    country: "Fictional city inspired by Delhi",
    w: 2200,
    h: 1500,
    ambience: "delhi",
    buildings,
    trees,
    lamps: [
      { x: 200, y: 400 },
      { x: 200, y: 800 },
      { x: 200, y: 1200 },
      { x: 1560, y: 400 },
      { x: 1560, y: 800 },
      { x: 1560, y: 1200 },
    ],
    roads: [
      { x: 100, y: 0, w: 110, h: 1500 }, // Sansad Marg
      { x: 1500, y: 0, w: 100, h: 1500 }, // service lane
      { x: 0, y: 0, w: 2200, h: 130 }, // Parliament St top
      { x: 0, y: 1400, w: 2200, h: 100 },
    ],
    lawns: [
      { x: 280, y: 260, w: 420, h: 130 },
      { x: 940, y: 880, w: 480, h: 200 },
      { x: 300, y: 1020, w: 900, h: 230 }, // protest garden
    ],
    labels: [
      { x: 155, y: 750, text: "SANSAD MARG", size: 15 },
      { x: 870, y: 180, text: "JANTAR MANTAR · OBSERVATORY (1724)", size: 17 },
      { x: 850, y: 1180, text: "DESIGNATED PROTEST SITE", size: 14 },
      { x: 1440, y: 1260, text: "DETAIN ZONE", size: 12 },
    ],
    rallyPoints: [
      { x: 620, y: 1150 },
      { x: 850, y: 1120 },
      { x: 1080, y: 1160 },
      { x: 850, y: 1230 },
    ],
    policeLine: [
      { x: 1300, y: 940 },
      { x: 1350, y: 1000 },
      { x: 1390, y: 1060 },
      { x: 1410, y: 1120 },
      { x: 1410, y: 1180 },
      { x: 1390, y: 1240 },
    ],
    checkpoints: [
      { x: 830, y: 1380 },
      { x: 1540, y: 680 },
      { x: 870, y: 300 },
    ],
    spawns: {
      protester: { x: 830, y: 1420 },
      police: { x: 1450, y: 1180 },
      military: { x: 1540, y: 700 },
      civilian: { x: 1550, y: 500 },
    },
    detainZone: { x: 1440, y: 1280 },
    depots: { protester: { x: 340, y: 1240 }, police: { x: 1420, y: 1200 } },
    truckRoutes: {
      protester: [
        { x: -60, y: 60 },
        { x: 155, y: 60 },
        { x: 155, y: 1440 },
        { x: 830, y: 1440 },
        { x: 830, y: 1280 },
        { x: 340, y: 1280 },
        { x: 340, y: 1240 },
      ],
      police: [
        { x: 2260, y: 60 },
        { x: 1550, y: 60 },
        { x: 1550, y: 680 },
        { x: 1420, y: 680 },
        { x: 1420, y: 1200 },
      ],
    },
  };
}

/* ================= PARIS — PLACE DE LA RÉPUBLIQUE ================= */
function paris(): MapDef {
  const buildings: Building[] = [];
  // Haussmann blocks — north side
  const north = [40, 340, 640, 940, 1240, 1540, 1840];
  north.forEach((x, i) =>
    buildings.push(
      B(x, 20, 260, 300, "block", {
        color: i % 2 ? "#ded4c2" : "#d6cab5",
        roof: "#6d7480",
        name: i === 3 ? "Hôtel Moderne" : undefined,
      }),
    ),
  );
  // south side with shops facing the plaza
  buildings.push(
    B(40, 1200, 260, 280, "block", { color: "#ded4c2", roof: "#6d7480" }),
  );
  buildings.push(
    B(340, 1200, 220, 150, "shop", {
      name: "Café République",
      awning: "#9c2f2f",
    }),
  );
  buildings.push(
    B(600, 1200, 220, 150, "shop", {
      name: "Brasserie du Peuple",
      awning: "#1f5c40",
    }),
  );
  buildings.push(
    B(860, 1200, 220, 150, "shop", {
      name: "Librairie Voltaire",
      awning: "#31589c",
    }),
  );
  buildings.push(
    B(1120, 1200, 220, 150, "shop", {
      name: "Pâtisserie Marianne",
      awning: "#b3862e",
    }),
  );
  buildings.push(
    B(1380, 1200, 220, 150, "shop", { name: "Métro Shop", awning: "#5a3d8a" }),
  );
  buildings.push(
    B(1640, 1200, 260, 280, "block", { color: "#ded4c2", roof: "#6d7480" }),
  );
  buildings.push(
    B(1940, 1200, 220, 280, "block", { color: "#d6cab5", roof: "#6d7480" }),
  );
  buildings.push(
    B(340, 1380, 1260, 100, "block", { color: "#cfc4ae", roof: "#767d89" }),
  );
  // west blocks
  buildings.push(
    B(20, 420, 280, 300, "block", { color: "#d6cab5", roof: "#6d7480" }),
  );
  buildings.push(
    B(20, 780, 280, 320, "block", { color: "#ded4c2", roof: "#6d7480" }),
  );
  // east blocks (gap y700-800 = police entry street)
  buildings.push(
    B(1900, 420, 280, 260, "block", { color: "#ded4c2", roof: "#6d7480" }),
  );
  buildings.push(
    B(1900, 820, 280, 280, "block", { color: "#d6cab5", roof: "#6d7480" }),
  );
  // Monument à la République pedestal
  buildings.push(
    B(950, 620, 150, 150, "monument", {
      monument: "republique",
      name: "Monument à la République",
    }),
  );
  return {
    id: "paris",
    name: "Paris / Republica Plaza",
    country: "Fictional city inspired by Paris",
    w: 2200,
    h: 1500,
    ambience: "paris",
    buildings,
    trees: [
      ...Array.from({ length: 10 }, (_, i) => ({
        x: 380 + i * 160,
        y: 385,
        r: 19,
      })),
      ...Array.from({ length: 10 }, (_, i) => ({
        x: 380 + i * 160,
        y: 1130,
        r: 19,
      })),
      { x: 360, y: 500, r: 20 },
      { x: 360, y: 650, r: 20 },
      { x: 360, y: 800, r: 20 },
      { x: 360, y: 950, r: 20 },
      { x: 1840, y: 500, r: 20 },
      { x: 1840, y: 650, r: 20 },
      { x: 1840, y: 900, r: 20 },
      { x: 1840, y: 1040, r: 20 },
    ],
    lamps: [
      { x: 500, y: 470 },
      { x: 900, y: 470 },
      { x: 1300, y: 470 },
      { x: 1700, y: 470 },
      { x: 500, y: 1050 },
      { x: 900, y: 1050 },
      { x: 1300, y: 1050 },
      { x: 1700, y: 1050 },
      { x: 950, y: 750 },
      { x: 1150, y: 750 },
    ],
    roads: [
      { x: 0, y: 330, w: 2200, h: 90 }, // Bd Saint-Martin / Voltaire axis
      { x: 0, y: 1110, w: 2200, h: 80 },
      { x: 310, y: 330, w: 90, h: 870 },
      { x: 1800, y: 330, w: 90, h: 870 },
      { x: 2180, y: 690, w: 20, h: 130 },
      { x: 1800, y: 700, w: 400, h: 110 }, // east entry street
    ],
    lawns: [],
    labels: [
      { x: 1100, y: 375, text: "BOULEVARD SAINT-MARTIN", size: 15 },
      { x: 1100, y: 1150, text: "RUE DU FAUBOURG DU TEMPLE", size: 13 },
      { x: 1050, y: 560, text: "PLACE DE LA RÉPUBLIQUE", size: 18 },
      { x: 2020, y: 1150, text: "DETAIN ZONE", size: 12 },
    ],
    rallyPoints: [
      { x: 640, y: 720 },
      { x: 700, y: 900 },
      { x: 560, y: 820 },
      { x: 780, y: 780 },
    ],
    policeLine: [
      { x: 1450, y: 540 },
      { x: 1480, y: 620 },
      { x: 1500, y: 700 },
      { x: 1500, y: 780 },
      { x: 1480, y: 860 },
      { x: 1450, y: 940 },
    ],
    checkpoints: [
      { x: 1850, y: 755 },
      { x: 420, y: 400 },
      { x: 1700, y: 1100 },
    ],
    spawns: {
      protester: { x: 480, y: 760 },
      police: { x: 2050, y: 755 },
      military: { x: 1850, y: 740 },
      civilian: { x: 1200, y: 1080 },
    },
    detainZone: { x: 2020, y: 1130 },
    depots: { protester: { x: 250, y: 1130 }, police: { x: 1845, y: 1000 } },
    truckRoutes: {
      protester: [
        { x: -60, y: 375 },
        { x: 355, y: 375 },
        { x: 355, y: 1150 },
        { x: 250, y: 1150 },
        { x: 250, y: 1130 },
      ],
      police: [
        { x: 2260, y: 755 },
        { x: 1845, y: 755 },
        { x: 1845, y: 1000 },
      ],
    },
  };
}

export const MAPS: Record<"delhi" | "paris", MapDef> = {
  delhi: delhi(),
  paris: paris(),
};

export function collideBuildings(
  map: MapDef,
  x: number,
  y: number,
  r: number,
): { x: number; y: number } {
  for (const b of map.buildings) {
    if (
      b.kind === "wall" ||
      b.kind === "block" ||
      b.kind === "shop" ||
      b.kind === "monument"
    ) {
      const nx = Math.max(b.x, Math.min(x, b.x + b.w));
      const ny = Math.max(b.y, Math.min(y, b.y + b.h));
      const dx = x - nx;
      const dy = y - ny;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        if (d2 === 0) {
          // inside: push out along shortest axis
          const l = x - b.x,
            rr = b.x + b.w - x,
            t = y - b.y,
            bt = b.y + b.h - y;
          const m = Math.min(l, rr, t, bt);
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
  }
  x = Math.max(10, Math.min(map.w - 10, x));
  y = Math.max(10, Math.min(map.h - 10, y));
  return { x, y };
}
