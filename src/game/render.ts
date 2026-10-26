import type { World, Entity, MapDef, Building } from "./types";
import { isWalkable } from "./maps";
import { placeName } from "./place-names";

const SKINS = ["#e8b98d", "#c98e5f", "#a5673f", "#8a5232", "#f0c9a0"];
const PROTEST_CLOTH = [
  "#c94f3d",
  "#3d7bc9",
  "#4d9c57",
  "#c9a13d",
  "#7a4dc9",
  "#4db6c9",
];
const CIV_CLOTH = [
  "#8b8f96",
  "#a39a8b",
  "#7d8a94",
  "#968f7d",
  "#8a7f96",
  "#93968a",
];

/* ------------ ground texture (cached) ------------ */
export function buildGround(map: MapDef): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = map.w;
  c.height = map.h;
  const g = c.getContext("2d")!;
  const ground = g.createLinearGradient(0, 0, 0, map.h);
  ground.addColorStop(0, map.ambience === "delhi" ? "#c6d1ca" : "#c5d2d2");
  ground.addColorStop(1, map.ambience === "delhi" ? "#adc3bb" : "#b3c8c4");
  g.fillStyle = ground;
  g.fillRect(0, 0, map.w, map.h);
  g.strokeStyle = "rgba(53,72,74,0.075)";
  g.lineWidth = 1;
  for (let y = 32; y < map.h; y += 32) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(map.w, y);
    g.stroke();
  }
  for (let x = 0; x < map.w; x += 64) {
    g.beginPath();
    for (let y = (Math.floor(x / 64) % 2) * 16; y < map.h; y += 32) {
      g.moveTo(x, y);
      g.lineTo(x, y + 32);
    }
    g.stroke();
  }
  for (const lawn of map.lawns) {
    g.fillStyle = "#79a779";
    g.fillRect(lawn.x, lawn.y, lawn.w, lawn.h);
    g.fillStyle = "rgba(221,226,196,0.22)";
    g.fillRect(lawn.x + 6, lawn.y + 6, Math.max(0, lawn.w - 12), 2);
  }
  // roads
  for (const r of map.roads) {
    g.fillStyle = "#57656a";
    g.fillRect(r.x, r.y, r.w, r.h);
    g.strokeStyle = "rgba(214,222,211,0.35)";
    g.lineWidth = 2;
    g.setLineDash([18, 22]);
    g.beginPath();
    if (r.h > r.w) {
      g.moveTo(r.x + r.w / 2, r.y);
      g.lineTo(r.x + r.w / 2, r.y + r.h);
    } else {
      g.moveTo(r.x, r.y + r.h / 2);
      g.lineTo(r.x + r.w, r.y + r.h / 2);
    }
    g.stroke();
    g.setLineDash([]);
  }
  for (const road of map.roadWays ?? []) {
    if (road.line.length < 2) continue;
    const width =
      road.highway === "primary" || road.highway === "secondary"
        ? 30
        : road.highway === "tertiary" || road.highway === "trunk"
          ? 22
          : road.highway === "residential" || road.highway === "unclassified"
            ? 14
            : road.highway === "service"
              ? 9
              : 5;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.strokeStyle = "#899795";
    g.lineWidth = width + 10;
    g.beginPath();
    g.moveTo(road.line[0].x, road.line[0].y);
    for (const p of road.line.slice(1)) g.lineTo(p.x, p.y);
    g.stroke();
    g.strokeStyle = "#58676c";
    g.lineWidth = width;
    g.beginPath();
    g.moveTo(road.line[0].x, road.line[0].y);
    for (const p of road.line.slice(1)) g.lineTo(p.x, p.y);
    g.stroke();
    if (width >= 22) {
      g.strokeStyle = "rgba(215,221,206,0.55)";
      g.lineWidth = 2;
      g.setLineDash([14, 20]);
      g.stroke();
      g.setLineDash([]);
    }
  }
  drawStreetGreenery(g, map);
  // labels
  for (const l of map.labels) {
    g.font = `700 ${l.size ?? 14}px 'Barlow', sans-serif`;
    g.fillStyle = "rgba(40,59,64,0.56)";
    g.textAlign = "center";
    g.save();
    if (l.text === "SANSAD MARG") {
      g.translate(l.x, l.y);
      g.rotate(-Math.PI / 2);
      g.fillText(placeName(l.text), 0, 0);
    } else g.fillText(placeName(l.text), l.x, l.y);
    g.restore();
  }
  // depot pads
  for (const key of ["protester", "police"] as const) {
    const d = map.depots[key];
    g.strokeStyle =
      key === "police" ? "rgba(80,140,255,0.6)" : "rgba(255,160,60,0.6)";
    g.lineWidth = 3;
    g.setLineDash([8, 6]);
    g.strokeRect(d.x - 60, d.y - 45, 120, 90);
    g.setLineDash([]);
    g.font = "700 11px 'Barlow', sans-serif";
    g.fillStyle =
      key === "police" ? "rgba(80,140,255,0.8)" : "rgba(255,160,60,0.85)";
    g.textAlign = "center";
    g.fillText(
      key === "police" ? "POLICE DEPOT" : "PROTEST DEPOT",
      d.x,
      d.y - 54,
    );
  }
  // detain zone pad
  const dz = map.detainZone;
  g.fillStyle = "rgba(60,90,160,0.18)";
  g.fillRect(dz.x - 55, dz.y - 40, 110, 80);
  g.strokeStyle = "rgba(90,130,220,0.5)";
  g.lineWidth = 2;
  g.strokeRect(dz.x - 55, dz.y - 40, 110, 80);
  return c;
}

function drawStreetGreenery(g: CanvasRenderingContext2D, map: MapDef) {
  for (const way of map.roadWays ?? []) {
    if (way.line.length < 2) continue;
    const halfWidth =
      way.highway === "primary" || way.highway === "secondary"
        ? 30
        : way.highway === "tertiary" || way.highway === "trunk"
          ? 22
          : way.highway === "residential" || way.highway === "unclassified"
            ? 14
            : way.highway === "service"
              ? 9
              : 5;
    let distance = 0;
    let next = 190 + ((way.id.length * 37) % 90);
    for (let i = 1; i < way.line.length; i++) {
      const a = way.line[i - 1];
      const b = way.line[i];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.hypot(dx, dy);
      if (!length) continue;
      while (distance + length >= next) {
        const t = (next - distance) / length;
        const side = ((Math.floor(next / 80) + way.id.length) % 2) * 2 - 1;
        const x = a.x + dx * t - (dy / length) * side * (halfWidth + 26);
        const y = a.y + dy * t + (dx / length) * side * (halfWidth + 26);
        if (isWalkable(map, x, y, 12)) {
          g.fillStyle = "rgba(43,66,53,0.14)";
          g.beginPath();
          g.ellipse(x + 3, y + 3, 13, 8, 0, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = "#7f9a83";
          g.beginPath();
          g.arc(x - 4, y, 5, 0, Math.PI * 2);
          g.arc(x + 3, y - 2, 6, 0, Math.PI * 2);
          g.arc(x + 8, y + 2, 4, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = "rgba(219,225,193,0.42)";
          g.fillRect(x - 2, y - 3, 3, 2);
        }
        next += 190 + ((Math.floor(next) + way.id.length * 13) % 90);
      }
      distance += length;
    }
  }
}

/* ------------ buildings & monuments ------------ */
function drawBuilding(
  g: CanvasRenderingContext2D,
  b: Building,
  map: MapDef,
  time: number,
  player?: Entity | null,
) {
  if (b.barricade) {
    g.fillStyle = b.broken ? "#998361" : "#e7b94c";
    g.fillRect(b.x, b.y + (b.broken ? 12 : 0), b.w, b.broken ? 5 : b.h);
    if (!b.broken) {
      g.strokeStyle = "#423e32";
      g.lineWidth = 3;
      for (let x = 4; x < b.w - 3; x += 10) {
        g.beginPath();
        g.moveTo(b.x + x, b.y + 3);
        g.lineTo(b.x + x - 3, b.y + b.h - 3);
        g.stroke();
      }
      g.fillStyle = "#292c29";
      g.fillRect(b.x + 3, b.y + b.h, 5, 4);
      g.fillRect(b.x + b.w - 8, b.y + b.h, 5, 4);
      if (b.hp < b.maxHp) {
        g.fillStyle = "#161d20";
        g.fillRect(b.x, b.y - 6, b.w, 3);
        g.fillStyle = "#edbd63";
        g.fillRect(b.x, b.y - 6, (b.w * b.hp) / b.maxHp, 3);
      }
    }
    return;
  }
  const palette = buildingPalette(b, map);
  if (b.footprint) {
    const height = b.kind === "shop" ? 20 : map.ambience === "paris" ? 42 : 32;
    const path = (dy = 0, inset = 0) => {
      const cx =
        b.footprint!.reduce((sum, p) => sum + p.x, 0) / b.footprint!.length;
      const cy =
        b.footprint!.reduce((sum, p) => sum + p.y, 0) / b.footprint!.length;
      g.beginPath();
      b.footprint!.forEach((p, i) => {
        const x = cx + (p.x - cx) * (1 - inset),
          y = cy + (p.y - cy) * (1 - inset) + dy;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      });
      g.closePath();
    };
    g.fillStyle = "rgba(12,18,24,0.25)";
    path(height * 0.45 + 5);
    g.fill();
    g.fillStyle = palette.facade;
    path();
    g.fill();
    g.fillStyle = palette.roof;
    path(-height, 0.08);
    g.fill();
    if (b.kind === "monument") {
      g.save();
      path(-height, 0.08);
      g.clip();
      g.translate(0, -height);
      drawMonument(g, b, time);
      g.restore();
    }
    drawEntrance(g, b, player);
    if (b.name && b.w > 70 && b.h > 35) {
      g.font = "600 10px 'Barlow', sans-serif";
      g.fillStyle = "rgba(35,32,28,0.7)";
      g.textAlign = "center";
      g.fillText(
        placeName(b.name),
        b.x + b.w / 2,
        b.y + b.h / 2 - height - 3,
        Math.min(b.w, 150),
      );
    }
    return;
  }
  if (b.kind === "monument") {
    drawRoof(g, b, map, time);
    return;
  }
  const height =
    b.kind === "wall"
      ? 7
      : b.kind === "shop"
        ? 22
        : map.ambience === "paris"
          ? 48
          : 35;
  g.fillStyle = "rgba(12,18,24,0.22)";
  g.beginPath();
  g.moveTo(b.x, b.y);
  g.lineTo(b.x + b.w, b.y);
  g.lineTo(b.x + b.w + height * 0.65, b.y + b.h + height * 0.35);
  g.lineTo(b.x + height * 0.65, b.y + b.h + height * 0.35);
  g.closePath();
  g.fill();
  g.fillStyle = palette.facade;
  g.fillRect(b.x, b.y + b.h - height, b.w, height);
  g.fillStyle = "rgba(36,31,27,0.22)";
  g.fillRect(b.x + b.w - 6, b.y - height, 6, b.h + height);
  if (b.kind !== "wall") {
    for (let x = b.x + 12; x < b.x + b.w - 12; x += 28) {
      g.fillStyle = "#34434c";
      g.fillRect(x, b.y + b.h - height + 9, 10, Math.max(6, height - 18));
      g.fillStyle = "#e0d5ba";
      g.fillRect(x - 2, b.y + b.h - 5, 14, 3);
      if (map.ambience === "paris") {
        g.strokeStyle = "#3d4142";
        g.lineWidth = 1;
        g.strokeRect(x - 2, b.y + b.h - 15, 14, 7);
      }
    }
  }
  g.save();
  g.translate(0, -height);
  drawRoof(g, b, map, time);
  g.restore();
  drawEntrance(g, b, player);
}

function buildingPalette(b: Building, map: MapDef) {
  const palettes =
    map.ambience === "paris"
      ? [
          ["#eadcc2", "#6389a0"],
          ["#d4e1d4", "#577f77"],
          ["#edd0c6", "#ac7064"],
          ["#d4deea", "#6d83a2"],
          ["#e4d7e5", "#8e789e"],
        ]
      : [
          ["#ead9b7", "#b96f53"],
          ["#c6dfcf", "#568d80"],
          ["#ead9b3", "#b88c52"],
          ["#d0e0e5", "#5b88a0"],
          ["#ebd1d4", "#a97786"],
        ];
  const index =
    Math.abs(Math.floor(b.x * 0.17 + b.y * 0.31 + b.w * 0.13 + b.h * 0.07)) %
    palettes.length;
  return {
    facade: b.color ?? palettes[index][0],
    roof: b.roof ?? palettes[index][1],
  };
}

function drawEntrance(
  g: CanvasRenderingContext2D,
  b: Building,
  player?: Entity | null,
) {
  const p = b.entrance;
  if (!p) return;
  g.fillStyle = "#34494b";
  g.fillRect(p.x - 6, p.y - 8, 12, 12);
  g.strokeStyle = "#d5cba8";
  g.lineWidth = 1.5;
  g.strokeRect(p.x - 6, p.y - 8, 12, 12);
  g.fillStyle = "#9db7ae";
  g.fillRect(p.x + 1, p.y - 5, 2, 2);
  if (
    player &&
    !player.buildingId &&
    Math.hypot(player.x - p.x, player.y - p.y) <= 76
  )
    label(g, p.x, p.y + 18, "ENTER", "#f2e4bb");
}

function drawRoof(
  g: CanvasRenderingContext2D,
  b: Building,
  map: MapDef,
  time: number,
) {
  const paris = map.ambience === "paris";
  if (b.kind === "wall") {
    g.fillStyle = "#b06a45";
    g.fillRect(b.x, b.y, b.w, b.h);
    g.fillStyle = "rgba(0,0,0,0.15)";
    g.fillRect(b.x, b.y + b.h - 4, b.w, 4);
    return;
  }
  // drop shadow
  g.fillStyle = "rgba(0,0,0,0.22)";
  g.fillRect(b.x + 7, b.y + 9, b.w, b.h);
  if (b.kind === "monument") {
    drawMonument(g, b, time);
    return;
  }
  if (b.kind === "block") {
    g.fillStyle = buildingPalette(b, map).facade;
    g.fillRect(b.x, b.y, b.w, b.h);
    if (paris) {
      // mansard roof with dormers
      g.fillStyle = buildingPalette(b, map).roof;
      g.fillRect(b.x + 12, b.y + 12, b.w - 24, b.h - 24);
      g.strokeStyle = "rgba(255,255,255,0.12)";
      g.lineWidth = 1;
      for (let y = b.y + 24; y < b.y + b.h - 12; y += 16) {
        g.beginPath();
        g.moveTo(b.x + 12, y);
        g.lineTo(b.x + b.w - 12, y);
        g.stroke();
      }
      g.fillStyle = "#e8e2d2";
      for (let x = b.x + 30; x < b.x + b.w - 24; x += 44) {
        g.fillRect(x, b.y + 4, 14, 8);
        g.fillRect(x, b.y + b.h - 12, 14, 8);
      }
      g.fillStyle = "#565b64";
      g.fillRect(b.x + b.w * 0.3, b.y + b.h * 0.35, 16, 16);
      g.fillRect(b.x + b.w * 0.65, b.y + b.h * 0.6, 16, 16);
    } else {
      g.fillStyle = buildingPalette(b, map).roof;
      g.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
      g.strokeStyle = "rgba(0,0,0,0.12)";
      g.lineWidth = 2;
      g.strokeRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
      // water tanks + AC units
      g.fillStyle = "#3a3a3a";
      g.beginPath();
      g.arc(b.x + b.w * 0.3, b.y + b.h * 0.3, 9, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#8f959c";
      g.fillRect(b.x + b.w * 0.6, b.y + b.h * 0.55, 20, 14);
      g.fillRect(b.x + b.w * 0.25, b.y + b.h * 0.7, 16, 12);
    }
    if (b.name) {
      g.font = "600 11px 'Barlow', sans-serif";
      g.fillStyle = "rgba(40,35,25,0.65)";
      g.textAlign = "center";
      g.fillText(placeName(b.name), b.x + b.w / 2, b.y + b.h / 2 + 4);
    }
    return;
  }
  // shop
  g.fillStyle = b.broken ? "#6b6258" : "#e6ddca";
  g.fillRect(b.x, b.y, b.w, b.h);
  g.fillStyle = b.broken ? "#4a443c" : "#cfc4ae";
  g.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
  // storefront windows on the side facing the action
  const faceLeft = map.ambience === "delhi";
  const wy = b.y + 18;
  g.fillStyle = b.broken ? "#211d18" : "#7fb2c9";
  if (faceLeft) {
    g.fillRect(b.x + 2, wy, 12, b.h - 36);
  } else {
    g.fillRect(b.x + 14, b.y + 2, b.w - 28, 12);
  }
  // awning stripes
  const awningPalette = ["#ba765f", "#6f9a98", "#c29d64", "#8c9278", "#9c7e8a"];
  const aw =
    b.awning ??
    awningPalette[
      Math.abs(Math.floor(b.x * 0.13 + b.y * 0.29)) % awningPalette.length
    ];
  for (let i = 0; i < 5; i++) {
    g.fillStyle = i % 2 ? "#efe8d8" : aw;
    if (faceLeft)
      g.fillRect(b.x - 12, wy + i * ((b.h - 36) / 5), 14, (b.h - 36) / 5);
    else
      g.fillRect(b.x + 14 + i * ((b.w - 28) / 5), b.y - 12, (b.w - 28) / 5, 14);
  }
  if (b.broken) {
    g.strokeStyle = "rgba(200,220,235,0.6)";
    g.lineWidth = 1;
    for (let i = 0; i < 7; i++) {
      const fraction =
        ((Math.imul(i + 1, 73) + b.x * 17 + b.y * 31) % 101) / 101;
      const sx = faceLeft
        ? b.x - 4 - fraction * 16
        : b.x + 20 + fraction * (b.w - 40);
      const sy = faceLeft
        ? wy + fraction * (b.h - 36)
        : b.y - 4 - fraction * 14;
      g.beginPath();
      g.moveTo(sx, sy);
      g.lineTo(sx + 5, sy + 4);
      g.stroke();
    }
    g.font = "700 10px 'Barlow', sans-serif";
    g.fillStyle = "#ffb14d";
    g.textAlign = "center";
    g.fillText("CLOSED", b.x + b.w / 2, b.y + b.h / 2 + 14);
  }
  if (b.name) {
    g.font = "700 11px 'Barlow', sans-serif";
    g.fillStyle = b.broken ? "rgba(255,255,255,0.4)" : "rgba(50,40,25,0.85)";
    g.textAlign = "center";
    g.fillText(placeName(b.name), b.x + b.w / 2, b.y + b.h / 2 + 2);
  }
}

function drawMonument(g: CanvasRenderingContext2D, b: Building, time: number) {
  const cx = b.x + b.w / 2,
    cy = b.y + b.h / 2;
  const terra = "#c1613c",
    terraD = "#9e4a2b",
    terraL = "#d97e54";
  switch (b.monument) {
    case "samrat": {
      // side quadrant arcs
      g.fillStyle = terraD;
      g.beginPath();
      g.arc(b.x - 10, cy, 130, Math.PI * 0.6, Math.PI * 1.4);
      g.lineTo(b.x - 10, cy);
      g.fill();
      g.beginPath();
      g.arc(b.x + b.w + 10, cy, 130, -Math.PI * 0.4, Math.PI * 0.4);
      g.lineTo(b.x + b.w + 10, cy);
      g.fill();
      g.strokeStyle = "rgba(255,235,210,0.4)";
      g.lineWidth = 2;
      for (let i = 1; i < 6; i++) {
        g.beginPath();
        g.arc(b.x - 10, cy, 130 - i * 20, Math.PI * 0.6, Math.PI * 1.4);
        g.stroke();
        g.beginPath();
        g.arc(b.x + b.w + 10, cy, 130 - i * 20, -Math.PI * 0.4, Math.PI * 0.4);
        g.stroke();
      }
      // great triangle (gnomon) pointing north
      g.fillStyle = terra;
      g.beginPath();
      g.moveTo(cx, b.y - 30);
      g.lineTo(b.x + b.w, b.y + b.h);
      g.lineTo(b.x, b.y + b.h);
      g.closePath();
      g.fill();
      g.fillStyle = terraL;
      g.beginPath();
      g.moveTo(cx, b.y - 30);
      g.lineTo(cx + 14, b.y + b.h);
      g.lineTo(cx - 14, b.y + b.h);
      g.closePath();
      g.fill();
      // staircase
      g.strokeStyle = "rgba(80,30,10,0.5)";
      g.lineWidth = 1.5;
      for (let i = 0; i < 22; i++) {
        const t = i / 22;
        const y = b.y - 20 + t * (b.h + 16);
        const half = 4 + t * 12;
        g.beginPath();
        g.moveTo(cx - half, y);
        g.lineTo(cx + half, y);
        g.stroke();
      }
      break;
    }
    case "misra": {
      g.fillStyle = terra;
      g.fillRect(cx - 30, b.y, 60, b.h);
      g.fillRect(b.x, cy - 30, b.w, 60);
      g.fillStyle = terraD;
      for (const [ox, oy] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ] as const) {
        g.beginPath();
        g.arc(cx + ox * 55, cy + oy * 55, 26, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#e8d9c2";
        g.beginPath();
        g.arc(cx + ox * 55, cy + oy * 55, 16, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = terraD;
      }
      g.fillStyle = terraL;
      g.fillRect(cx - 8, b.y + 8, 16, b.h - 16);
      break;
    }
    case "jaiprakash1":
    case "jaiprakash2": {
      const r = b.w / 2;
      g.fillStyle = "#d9cbb2";
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#bfae90";
      g.beginPath();
      g.arc(cx, cy, r - 12, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "rgba(90,70,40,0.55)";
      g.lineWidth = 1.5;
      for (let i = 1; i < 5; i++) {
        g.beginPath();
        g.arc(cx, cy, (r - 12) * (i / 5), 0, Math.PI * 2);
        g.stroke();
      }
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        g.beginPath();
        g.moveTo(cx, cy);
        g.lineTo(cx + Math.cos(a) * (r - 12), cy + Math.sin(a) * (r - 12));
        g.stroke();
      }
      // alternating marble segments
      g.fillStyle = "rgba(245,240,228,0.75)";
      for (let i = 0; i < 6; i++) {
        const a =
          (i / 6) * Math.PI * 2 + (b.monument === "jaiprakash2" ? 0.26 : 0);
        g.beginPath();
        g.moveTo(cx, cy);
        g.arc(cx, cy, r - 12, a, a + 0.26);
        g.closePath();
        g.fill();
      }
      g.strokeStyle = "#8a6f45";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(cx - r + 12, cy);
      g.lineTo(cx + r - 12, cy);
      g.moveTo(cx, cy - r + 12);
      g.lineTo(cx, cy + r - 12);
      g.stroke();
      break;
    }
    case "ram1":
    case "ram2": {
      const r = b.w / 2;
      g.fillStyle = terra;
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#e0d2b8";
      g.beginPath();
      g.arc(cx, cy, r - 14, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = terraD;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.2;
        g.save();
        g.translate(cx, cy);
        g.rotate(a);
        g.fillRect(14, -5, r - 28, 10);
        g.restore();
      }
      g.fillStyle = terraL;
      g.beginPath();
      g.arc(cx, cy, 14, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#5c4326";
      g.fillRect(cx - 2, cy - 14, 4, 14);
      break;
    }
    case "republique": {
      // stepped pedestal
      g.fillStyle = "#9a958a";
      g.fillRect(b.x - 24, b.y - 24, b.w + 48, b.h + 48);
      g.fillStyle = "#b0aa9d";
      g.fillRect(b.x - 10, b.y - 10, b.w + 20, b.h + 20);
      g.fillStyle = "#c4beb0";
      g.fillRect(b.x, b.y, b.w, b.h);
      // bronze group
      g.fillStyle = "#4e5a4a";
      g.beginPath();
      g.arc(cx, cy, 40, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#5d6b57";
      g.beginPath();
      g.arc(cx, cy, 28, 0, Math.PI * 2);
      g.fill();
      // Marianne silhouette rising
      g.fillStyle = "#3f4a3c";
      g.beginPath();
      g.moveTo(cx, cy - 58);
      g.lineTo(cx + 10, cy - 20);
      g.lineTo(cx + 16, cy + 10);
      g.lineTo(cx - 16, cy + 10);
      g.lineTo(cx - 10, cy - 20);
      g.closePath();
      g.fill();
      g.beginPath();
      g.arc(cx, cy - 62, 7, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "#3f4a3c";
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(cx + 6, cy - 44);
      g.lineTo(cx + 26, cy - 66);
      g.stroke();
      // torch glint
      const gl = 0.5 + Math.sin(time * 3) * 0.3;
      g.fillStyle = `rgba(255,220,130,${gl})`;
      g.beginPath();
      g.arc(cx + 28, cy - 70, 5, 0, Math.PI * 2);
      g.fill();
      // wreaths at corners
      g.fillStyle = "#6b7a5e";
      for (const [ox, oy] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ] as const) {
        g.beginPath();
        g.arc(
          cx + ox * (b.w / 2 + 12),
          cy + oy * (b.h / 2 + 12),
          8,
          0,
          Math.PI * 2,
        );
        g.fill();
      }
      break;
    }
    default: {
      g.fillStyle = terra;
      g.fillRect(b.x, b.y, b.w, b.h);
      g.fillStyle = terraL;
      g.beginPath();
      g.arc(cx, cy, Math.min(b.w, b.h) / 3, 0, Math.PI * 2);
      g.fill();
    }
  }
  if (b.name) {
    g.font = "600 11px 'Barlow', sans-serif";
    g.fillStyle = "rgba(60,35,15,0.7)";
    g.textAlign = "center";
    g.fillText(placeName(b.name), cx, b.y + b.h + 18);
  }
}

/* ------------ entities ------------ */
function drawPerson(
  g: CanvasRenderingContext2D,
  w: World,
  e: Entity,
  time: number,
  showSpeech = true,
) {
  const moving =
    e.moving ??
    ["march", "flee", "patrol", "wander", "order"].includes(e.state);
  const running = e.running ?? e.state === "flee";
  const stride = moving ? Math.sin(time * (running ? 14 : 8) + e.id * 0.7) : 0;
  const bob = stride * (running ? 1.8 : 1.2);
  g.save();
  g.translate(e.x, e.y);
  // shadow
  g.fillStyle = "rgba(0,0,0,0.25)";
  g.beginPath();
  g.ellipse(2, 4, 9, 5, 0, 0, Math.PI * 2);
  g.fill();
  if (e.state === "down") {
    g.rotate(e.dir + Math.PI / 2);
    g.globalAlpha = e.deathUntil ? 0.5 : 0.85;
    g.fillStyle =
      e.kind === "police"
        ? "#2c4a7c"
        : e.kind === "military"
          ? "#4a5238"
          : "#8a6f5c";
    g.beginPath();
    g.ellipse(0, 0, 13, 6, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = SKINS[e.skin];
    g.beginPath();
    g.arc(12, 0, 5, 0, Math.PI * 2);
    g.fill();
    g.restore();
    label(
      g,
      e.x,
      e.y - 16,
      e.deathUntil && e.profileId ? "RESPAWNING" : "DOWN",
      "#e0d4c5",
    );
    drawNameTag(g, w, e);
    return;
  }
  const detained = e.state === "detained";
  g.rotate(e.dir + Math.PI / 2);
  g.translate(0, bob * 0.4);
  // Animation follows motion, while uniform/equipment identify role.
  g.fillStyle = "#2b2c2e";
  g.fillRect(-6, 5 + stride * 3, 4, 7);
  g.fillRect(2, 5 - stride * 3, 4, 7);
  const body =
    e.kind === "police"
      ? "#2c4f8f"
      : e.kind === "military"
        ? "#4f5a38"
        : e.kind === "civilian"
          ? CIV_CLOTH[e.cloth]
          : PROTEST_CLOTH[e.cloth];
  // shield (front)
  if (e.shield) {
    g.fillStyle =
      e.kind === "police" ? "rgba(160,200,240,0.55)" : "rgba(180,150,90,0.8)";
    g.strokeStyle = e.kind === "police" ? "#9cc3e8" : "#8a6f3a";
    g.lineWidth = 1.5;
    g.beginPath();
    g.roundRect(-9, -16, 18, 8, 3);
    g.fill();
    g.stroke();
  }
  // shoulders / torso
  g.fillStyle = detained ? "#7d838c" : body;
  g.beginPath();
  g.roundRect(-8, -6, 16, 12, 5);
  g.fill();
  // arms
  g.fillStyle = detained ? "#7d838c" : body;
  g.beginPath();
  g.arc(detained ? -3 : -9, detained ? 6 : -1 + bob * 0.5, 3.4, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(
    detained ? 3 : 9,
    e.state === "detain" ? -9 : detained ? 6 : -1 - bob * 0.5,
    3.4,
    0,
    Math.PI * 2,
  );
  g.fill();
  // rifle for military
  if (e.kind === "military") {
    g.strokeStyle = "#23261c";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(5, 2);
    g.lineTo(7, -18);
    g.stroke();
  }
  // baton for police
  if (e.kind === "police") {
    g.strokeStyle = "#1a1d24";
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(9, 0);
    g.lineTo(13, -8);
    g.stroke();
  }
  // head
  g.fillStyle = SKINS[e.skin];
  g.beginPath();
  g.arc(0, -2, 5.2, 0, Math.PI * 2);
  g.fill();
  // headgear
  if (e.kind === "police") {
    g.fillStyle = "#1d3868";
    g.beginPath();
    g.arc(0, -2.5, 5.2, Math.PI * 0.9, Math.PI * 2.1);
    g.fill();
    g.fillRect(-5, -4, 10, 2.4);
  } else if (e.kind === "military") {
    g.fillStyle = "#3a422a";
    g.beginPath();
    g.arc(0, -2, 5.8, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#4f5a38";
    g.beginPath();
    g.arc(0, -2.6, 4.4, 0, Math.PI * 2);
    g.fill();
  } else {
    const style = e.id % 6;
    g.fillStyle = ["#241a12", "#0f0d0b", "#3a2a18", "#72675b"][e.id % 4];
    g.beginPath();
    g.arc(0, -3.4, style === 1 ? 5.6 : 4.6, Math.PI * 0.95, Math.PI * 2.05);
    g.fill();
    if (style === 2) {
      g.beginPath();
      g.arc(-3, 2, 3, 0, Math.PI * 2);
      g.fill();
    }
    if (style === 3 || (style === 4 && w.map.ambience === "delhi")) {
      g.fillStyle = ["#c5b594", "#596878", "#8a644f"][Math.floor(e.id / 6) % 3];
      g.beginPath();
      g.ellipse(0, -3, style === 4 ? 6 : 5, 5, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "rgba(255,255,255,0.35)";
      g.lineWidth = 1;
      if (style === 4) {
        g.beginPath();
        g.moveTo(-4, -5);
        g.lineTo(4, -1);
        g.stroke();
      } else g.fillRect(-5, -7, 10, 2);
    }
  }
  // sign for protesters
  if (e.sign && e.kind === "protester" && !detained) {
    g.save();
    g.rotate(Math.sin(time * 3 + e.brain.seed) * 0.12);
    g.strokeStyle = "#7a5c34";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(8, 0);
    g.lineTo(13, -22);
    g.stroke();
    g.fillStyle = "#f2ead6";
    g.strokeStyle = "#c9bda0";
    g.lineWidth = 1;
    g.beginPath();
    g.roundRect(3, -34, 22, 13, 2);
    g.fill();
    g.stroke();
    g.fillStyle = ["#c94f3d", "#2c4f8f", "#3a7c46"][e.cloth % 3];
    g.fillRect(6, -31, 16, 2.4);
    g.fillRect(6, -27, 12, 2.4);
    g.restore();
  }
  g.restore();

  // ---- overlays in world space ----
  // violent indicator
  if (e.violentT > 0) {
    const pulse = 0.6 + Math.sin(time * 8) * 0.3;
    g.strokeStyle = `rgba(255,70,50,${pulse})`;
    g.lineWidth = 2;
    g.beginPath();
    g.arc(e.x, e.y, 14, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = "#ff4632";
    g.beginPath();
    g.moveTo(e.x, e.y - 30);
    g.lineTo(e.x + 6, e.y - 20);
    g.lineTo(e.x - 6, e.y - 20);
    g.closePath();
    g.fill();
    g.fillStyle = "#fff";
    g.font = "700 8px 'Barlow', sans-serif";
    g.textAlign = "center";
    g.fillText("!", e.x, e.y - 22);
  }
  if (e.warnedT > 0 && e.kind === "protester") {
    g.strokeStyle = "rgba(255,200,60,0.8)";
    g.lineWidth = 1.5;
    g.setLineDash([4, 4]);
    g.beginPath();
    g.arc(e.x, e.y, 17, 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);
  }
  // detain progress
  if (e.detainProgress > 0 && e.state !== "detained") {
    g.strokeStyle = "#4da3ff";
    g.lineWidth = 3;
    g.beginPath();
    g.arc(
      e.x,
      e.y,
      12,
      -Math.PI / 2,
      -Math.PI / 2 + (e.detainProgress / 1.2) * Math.PI * 2,
    );
    g.stroke();
  }
  if (detained) {
    g.font = "700 9px 'Barlow', sans-serif";
    g.fillStyle = "#9cc3e8";
    g.textAlign = "center";
    g.fillText("⛓ DETAINED", e.x, e.y - 18);
  }
  // stun stars
  if (e.stun > 0) {
    g.fillStyle = "#ffd75e";
    g.font = "10px sans-serif";
    g.textAlign = "center";
    g.fillText("✶ ", e.x + Math.sin(time * 10) * 4, e.y - 20);
  }
  // hp bar
  if (e.hp < e.maxHp) {
    g.fillStyle = "rgba(0,0,0,0.5)";
    g.fillRect(e.x - 12, e.y + 12, 24, 3.4);
    g.fillStyle = e.hp > 50 ? "#5ec96a" : e.hp > 25 ? "#e8b13d" : "#e05545";
    g.fillRect(e.x - 12, e.y + 12, 24 * Math.max(0, e.hp / e.maxHp), 3.4);
  }
  // Only the local player gets the prominent gold marker.
  if (w.player?.id === e.id) {
    g.strokeStyle = "#ffd75e";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(e.x, e.y, 15, 0, Math.PI * 2);
    g.stroke();
  } else if (e.remote || e.profileId) {
    g.strokeStyle = "rgba(91,211,195,0.72)";
    g.lineWidth = 1.25;
    g.beginPath();
    g.arc(e.x, e.y, 12, 0, Math.PI * 2);
    g.stroke();
  }
  drawNameTag(g, w, e);
  if (w.selectedId === e.id) {
    g.strokeStyle = "#fff";
    g.lineWidth = 1.5;
    g.setLineDash([5, 4]);
    g.beginPath();
    g.arc(e.x, e.y, 19, time * 2, time * 2 + Math.PI * 2);
    g.stroke();
    g.setLineDash([]);
  }
  if (e.wanted > 0) {
    g.fillStyle = "#ff806d";
    g.beginPath();
    g.arc(e.x, e.y - 17, 4, 0, Math.PI * 2);
    g.fill();
    if (w.selectedId === e.id)
      label(g, e.x, e.y - 45 / w.zoom, "WANTED " + e.wanted, "#ff8875");
  }
  // rank pips for police
  if ((e.kind === "police" || e.kind === "military") && e.rank > 0) {
    g.fillStyle = "#ffd75e";
    for (let i = 0; i < e.rank; i++) {
      g.beginPath();
      g.arc(e.x - 6 + i * 6, e.y - 16, 1.8, 0, Math.PI * 2);
      g.fill();
    }
  }
  // speech bubble
  if (e.bubble && showSpeech) {
    g.font = "600 11px 'Barlow', sans-serif";
    const tw = g.measureText(e.bubble).width;
    const bx = e.x - tw / 2 - 7,
      by = e.y - 80 / w.zoom;
    g.fillStyle = "rgba(20,22,26,0.88)";
    g.beginPath();
    g.roundRect(bx, by, tw + 14, 20, 6);
    g.fill();
    g.beginPath();
    g.moveTo(e.x - 4, by + 20);
    g.lineTo(e.x + 4, by + 20);
    g.lineTo(e.x, by + 26);
    g.closePath();
    g.fill();
    g.fillStyle = "#f2ead6";
    g.textAlign = "center";
    g.fillText(e.bubble, e.x, by + 14);
  }
}

function drawNameTag(g: CanvasRenderingContext2D, w: World, e: Entity) {
  const local = w.player?.id === e.id;
  const human = e.isPlayer || e.remote || !!e.profileId;
  g.save();
  g.translate(e.x, e.y);
  g.scale(1 / w.zoom, 1 / w.zoom);
  label(
    g,
    0,
    -28,
    local ? `▼ ${e.name}` : human ? `◉ ${e.name}` : `${e.name} · BOT`,
    local ? "#ffd75e" : human ? "#8ce1d5" : "#cbd4d6",
  );
  g.restore();
}

function label(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  color: string,
) {
  g.font = "700 10px 'Barlow', sans-serif";
  g.textAlign = "center";
  g.fillStyle = "rgba(0,0,0,0.55)";
  const tw = g.measureText(text).width;
  g.fillRect(x - tw / 2 - 4, y - 9, tw + 8, 13);
  g.fillStyle = color;
  g.fillText(text, x, y + 1);
}

function drawTruck(g: CanvasRenderingContext2D, e: Entity, time: number) {
  g.save();
  g.translate(e.x, e.y);
  g.rotate(e.dir);
  g.fillStyle = "rgba(0,0,0,0.3)";
  g.fillRect(-26, -12 + 5, 56, 26);
  g.fillStyle = e.truckFaction === "police" ? "#2c4f8f" : "#b3862e";
  g.beginPath();
  g.roundRect(-28, -13, 40, 26, 3);
  g.fill();
  g.fillStyle = e.truckFaction === "police" ? "#3d63a8" : "#c9a13d";
  g.beginPath();
  g.roundRect(12, -11, 18, 22, 4);
  g.fill();
  g.fillStyle = "#9fd4e8";
  g.fillRect(24, -9, 5, 18);
  g.fillStyle = "#1a1c20";
  for (const [wx, wy] of [
    [-20, -14],
    [-20, 12],
    [16, -13],
    [16, 11],
  ] as const)
    g.fillRect(wx, wy, 9, 4);
  g.fillStyle = "#fff";
  g.font = "700 9px 'Barlow', sans-serif";
  g.textAlign = "center";
  g.save();
  g.rotate((Math.PI / 2) * 0);
  g.fillText(e.truckFaction === "police" ? "POLICE" : "SUPPLY", -8, 3);
  g.restore();
  if (e.state === "drive" && Math.sin(time * 10) > 0) {
    g.fillStyle = e.truckFaction === "police" ? "#5d9cff" : "#ffd75e";
    g.beginPath();
    g.arc(14, 0, 4, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

function drawCrate(
  g: CanvasRenderingContext2D,
  e: Entity,
  time: number,
  player: Entity | null,
) {
  if (
    e.roadsidePickup &&
    (e.crateItem === "stones" ||
      e.crateItem === "stick" ||
      e.crateItem === "bat")
  ) {
    const nearby =
      !!player &&
      !player.buildingId &&
      player.faction === e.crateFaction &&
      Math.hypot(player.x - e.x, player.y - e.y) <= 60;
    g.fillStyle = nearby ? "rgba(245,226,157,0.3)" : "rgba(245,226,157,0.15)";
    g.beginPath();
    g.arc(e.x, e.y, nearby ? 22 : 17, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = nearby ? "#ffe598" : "#c9b66e";
    g.lineWidth = nearby ? 2 : 1;
    g.stroke();
    if (e.crateItem === "stones") {
      g.fillStyle = "#d7ddd4";
      for (const [x, y, r] of [
        [-4, 0, 4],
        [3, -4, 3],
        [4, 4, 3],
      ]) {
        g.beginPath();
        g.arc(e.x + x, e.y + y, r, 0, Math.PI * 2);
        g.fill();
      }
    } else {
      g.strokeStyle = e.crateItem === "bat" ? "#dab87b" : "#997556";
      g.lineWidth = e.crateItem === "bat" ? 5 : 3;
      g.beginPath();
      g.moveTo(e.x - 6, e.y + 7);
      g.lineTo(e.x + 6, e.y - 7);
      g.stroke();
    }
    label(
      g,
      e.x,
      e.y - 28,
      `${nearby ? "Walk over · " : ""}${e.crateItem === "stones" ? "STONES" : e.crateItem === "bat" ? "BAT" : "STICK"}`,
      "#ffe598",
    );
    return;
  }
  const glow = 0.5 + Math.sin(time * 4 + e.id) * 0.3;
  g.fillStyle = `rgba(255,215,94,${glow * 0.25})`;
  g.beginPath();
  g.arc(e.x, e.y, 16, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "rgba(0,0,0,0.25)";
  g.fillRect(e.x - 7, e.y - 4, 16, 12);
  g.fillStyle = "#a8813f";
  g.fillRect(e.x - 8, e.y - 8, 16, 14);
  g.strokeStyle = "#6b5023";
  g.lineWidth = 1.5;
  g.strokeRect(e.x - 8, e.y - 8, 16, 14);
  g.beginPath();
  g.moveTo(e.x - 8, e.y - 1);
  g.lineTo(e.x + 8, e.y - 1);
  g.stroke();
  g.fillStyle = e.crateFaction === "police" ? "#4da3ff" : "#ffb14d";
  g.fillRect(e.x - 3, e.y - 5, 6, 8);
}

/* ------------ main frame ------------ */
function drawInterior(
  ctx: CanvasRenderingContext2D,
  w: World,
  building: Building,
  cw: number,
  ch: number,
) {
  const room = building.interior!;
  const player = w.player!;
  ctx.fillStyle = "#12191b";
  ctx.fillRect(0, 0, cw, ch);
  ctx.save();
  ctx.translate(cw / 2, ch / 2);
  ctx.scale(w.zoom, w.zoom);
  ctx.translate(-player.x, -player.y);
  ctx.fillStyle = w.map.ambience === "delhi" ? "#b29a76" : "#a5a3a0";
  ctx.fillRect(0, 0, room.w, room.h);
  ctx.strokeStyle = "rgba(50,48,42,0.18)";
  ctx.lineWidth = 1;
  for (let x = 0; x < room.w; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, room.h);
    ctx.stroke();
  }
  for (let y = 0; y < room.h; y += 24) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(room.w, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "#514d46";
  ctx.lineWidth = 10;
  ctx.strokeRect(0, 0, room.w, room.h);
  for (const obstacle of room.obstacles) {
    ctx.fillStyle = "rgba(20,20,20,0.2)";
    ctx.fillRect(obstacle.x + 4, obstacle.y + 4, obstacle.w, obstacle.h);
    ctx.fillStyle = "#77634b";
    ctx.fillRect(obstacle.x, obstacle.y - 5, obstacle.w, obstacle.h);
    ctx.strokeStyle = "#c6ae86";
    ctx.lineWidth = 1;
    ctx.strokeRect(obstacle.x, obstacle.y - 5, obstacle.w, obstacle.h);
  }
  for (const e of w.entities
    .filter((e) => !e.remove && e.buildingId === building.id)
    .sort((a, b) => a.y - b.y))
    drawPerson(ctx, w, e, w.time);
  label(ctx, room.w / 2, room.h - 12, "EXIT · INTERACT", "#eee1bd");
  ctx.restore();
  label(
    ctx,
    cw / 2,
    35,
    `${building.name ? placeName(building.name) : "PUBLIC BUILDING"} · INTERIOR`,
    "#eee1bd",
  );
}

function drawObjective(ctx: CanvasRenderingContext2D, w: World) {
  const objective = w.objective;
  if (!objective) return;
  ctx.save();
  ctx.translate(objective.x, objective.y);
  ctx.strokeStyle = objective.status === "contested" ? "#cf945d" : "#c4c7b1";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  ctx.arc(0, 0, 38, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#58534b";
  ctx.fillRect(-20, -13, 40, 28);
  ctx.fillStyle = objective.status === "recovering" ? "#77776c" : "#a47743";
  ctx.fillRect(-13, -21, 26, 23);
  ctx.fillStyle = "#efe2c5";
  ctx.fillRect(-10, -19, 9, 18);
  ctx.fillRect(1, -19, 9, 18);
  ctx.strokeStyle = "#8a7557";
  ctx.lineWidth = 1;
  for (let y = -15; y < -3; y += 4) {
    ctx.beginPath();
    ctx.moveTo(-8, y);
    ctx.lineTo(-3, y);
    ctx.moveTo(3, y);
    ctx.lineTo(8, y);
    ctx.stroke();
  }
  if (objective.progress > 0) {
    ctx.strokeStyle = "#dfa45f";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(
      0,
      0,
      42,
      -Math.PI / 2,
      -Math.PI / 2 +
        Math.PI *
          2 *
          Math.min(1, objective.progress / objective.captureSeconds),
    );
    ctx.stroke();
  }
  label(ctx, 0, -49, "CONSTITUTION BOOK", "#eedbb4");
  label(ctx, 0, 57, objective.status.toUpperCase(), "#ddd6c8");
  ctx.restore();
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  w: World,
  cw: number,
  ch: number,
  ground: HTMLCanvasElement,
) {
  const room = w.player?.buildingId
    ? w.map.buildings.find((b) => b.id === w.player!.buildingId && b.interior)
    : undefined;
  if (room) {
    drawInterior(ctx, w, room, cw, ch);
    return;
  }
  const time = w.time;
  const z = w.zoom;
  const left = w.camX - cw / (2 * z),
    right = w.camX + cw / (2 * z);
  const top = w.camY - ch / (2 * z),
    bottom = w.camY + ch / (2 * z);
  const visible = (x: number, y: number, radius: number) =>
    x + radius >= left &&
    x - radius <= right &&
    y + radius >= top &&
    y - radius <= bottom;
  ctx.clearRect(0, 0, cw, ch);
  ctx.save();
  ctx.translate(cw / 2, ch / 2);
  ctx.scale(z, z);
  ctx.translate(-w.camX, -w.camY);

  ctx.drawImage(ground, 0, 0);

  // trees shadows + canopies (below entities partially)
  for (const t of w.map.trees) {
    if (!visible(t.x, t.y, t.r + 8)) continue;
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath();
    ctx.ellipse(t.x + 6, t.y + 7, t.r, t.r * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // order marker
  if (w.order && w.order.t > 0) {
    const o = w.order;
    const pulse = 1 + Math.sin(time * 5) * 0.15;
    ctx.strokeStyle = "rgba(77,163,255,0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(o.x, o.y, 24 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "#4da3ff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(o.x, o.y);
    ctx.lineTo(o.x, o.y - 36);
    ctx.stroke();
    ctx.fillStyle = "#4da3ff";
    ctx.beginPath();
    ctx.moveTo(o.x, o.y - 36);
    ctx.lineTo(o.x + 24, o.y - 30);
    ctx.lineTo(o.x, o.y - 24);
    ctx.closePath();
    ctx.fill();
    ctx.font = "700 10px 'Barlow', sans-serif";
    ctx.fillStyle = "#cfe4ff";
    ctx.textAlign = "center";
    ctx.fillText(o.mode.toUpperCase(), o.x, o.y + 40);
  }

  // crates & entities sorted by y
  const drawables: { depth: number; building?: Building; entity?: Entity }[] =
    [];
  for (const b of w.map.buildings) {
    if (
      b.x + b.w + 160 < left ||
      b.x - 160 > right ||
      b.y + b.h + 60 < top ||
      b.y - 160 > bottom
    )
      continue;
    drawables.push({ depth: b.y + b.h, building: b });
  }
  for (const e of w.entities) {
    if (e.remove || e.buildingId || !visible(e.x, e.y, e.bubble ? 150 : 60))
      continue;
    drawables.push({ depth: e.y, entity: e });
  }
  drawables.sort((a, b) => a.depth - b.depth);
  const speech: { x: number; y: number }[] = [];
  for (const item of drawables) {
    if (item.building) {
      drawBuilding(ctx, item.building, w.map, time, w.player);
      continue;
    }
    const e = item.entity!;
    if (e.kind === "crate") drawCrate(ctx, e, time, w.player);
    else if (e.kind === "truck") drawTruck(ctx, e, time);
    else {
      const showSpeech =
        e.id === w.player?.id ||
        e.id === w.selectedId ||
        (speech.length < 4 &&
          !speech.some(
            (p) => Math.abs(p.x - e.x) < 150 && Math.abs(p.y - e.y) < 55,
          ));
      if (e.bubble && showSpeech) speech.push(e);
      drawPerson(ctx, w, e, time, showSpeech);
    }
  }
  for (const resource of w.resources ?? []) {
    if (
      !visible(resource.x, resource.y, 40) ||
      resource.food + resource.water <= 0
    )
      continue;
    ctx.fillStyle = "#748b91";
    ctx.fillRect(resource.x - 9, resource.y - 9, 18, 16);
    label(ctx, resource.x, resource.y - 19, "FOOD / WATER", "#d6e6df");
  }
  if (w.objective && visible(w.objective.x, w.objective.y, 100))
    drawObjective(ctx, w);

  // trees canopies on top
  for (const t of w.map.trees) {
    if (!visible(t.x, t.y, t.r)) continue;
    ctx.fillStyle = w.map.ambience === "delhi" ? "#4f7031" : "#3f5c33";
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = w.map.ambience === "delhi" ? "#6b8f42" : "#547544";
    ctx.beginPath();
    ctx.arc(t.x - t.r * 0.25, t.y - t.r * 0.25, t.r * 0.65, 0, Math.PI * 2);
    ctx.fill();
  }

  // projectiles
  for (const pr of w.projectiles) {
    if (!visible(pr.x, pr.y, 50)) continue;
    const k = Math.min(1, pr.t / pr.dur);
    if (pr.kind === "stone") {
      const lift = Math.sin(k * Math.PI) * 34;
      ctx.strokeStyle = "rgba(233,195,115,0.48)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pr.sx, pr.sy);
      ctx.lineTo(pr.x, pr.y - lift);
      ctx.stroke();
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath();
      ctx.ellipse(pr.x, pr.y, 3, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(222,177,99,0.28)";
      ctx.beginPath();
      ctx.arc(pr.x, pr.y - lift, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#c6a96d";
      ctx.beginPath();
      ctx.arc(pr.x, pr.y - lift, 4.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (pr.kind === "bullet") {
      ctx.strokeStyle = "rgba(255,230,150,0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pr.sx, pr.sy);
      ctx.lineTo(pr.x, pr.y);
      ctx.stroke();
    } else {
      ctx.fillStyle = "#8a949c";
      ctx.save();
      ctx.translate(pr.x, pr.y - Math.sin(k * Math.PI) * 26);
      ctx.rotate(k * 9);
      ctx.fillRect(-3, -5, 6, 10);
      ctx.restore();
    }
  }

  // gas clouds
  for (const gc of w.gases) {
    if (!visible(gc.x, gc.y, gc.r * 1.1)) continue;
    const life = 1 - gc.t / gc.dur;
    for (let i = 0; i < 5; i++) {
      const a = time * 0.7 + i * 1.26;
      const ox = Math.cos(a) * gc.r * 0.3,
        oy = Math.sin(a * 1.3) * gc.r * 0.3;
      const grad = ctx.createRadialGradient(
        gc.x + ox,
        gc.y + oy,
        4,
        gc.x + ox,
        gc.y + oy,
        gc.r * 0.75,
      );
      grad.addColorStop(0, `rgba(190,200,170,${0.34 * life})`);
      grad.addColorStop(1, "rgba(190,200,170,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(gc.x + ox, gc.y + oy, gc.r * 0.75, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // effects
  for (const f of w.effects) {
    if (!visible(f.x, f.y, Math.max(80, f.r ?? 0))) continue;
    const k = f.t / f.dur;
    if (f.kind === "ring") {
      ctx.strokeStyle = f.color ?? "#fff";
      ctx.globalAlpha = 1 - k;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(f.x, f.y, 8 + k * (f.r ?? 30), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (f.kind === "flash") {
      ctx.fillStyle = `rgba(255,230,140,${1 - k})`;
      ctx.beginPath();
      ctx.arc(f.x, f.y, 6 + k * 10, 0, Math.PI * 2);
      ctx.fill();
    } else if (f.kind === "smoke") {
      ctx.fillStyle = `rgba(150,150,150,${0.5 * (1 - k)})`;
      ctx.beginPath();
      ctx.arc(f.x, f.y - k * 10, (f.r ?? 6) + k * 12, 0, Math.PI * 2);
      ctx.fill();
    } else if (f.kind === "text") {
      ctx.font = "800 13px 'Barlow', sans-serif";
      ctx.textAlign = "center";
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillText(f.text ?? "", f.x + 1, f.y - k * 26 + 1);
      ctx.fillStyle = f.color ?? "#fff";
      ctx.fillText(f.text ?? "", f.x, f.y - k * 26);
      ctx.globalAlpha = 1;
    }
  }

  // lamps glow (paris dusk)
  if (w.map.ambience === "paris") {
    for (const l of w.map.lamps) {
      if (!visible(l.x, l.y, 75)) continue;
      const grad = ctx.createRadialGradient(l.x, l.y, 2, l.x, l.y, 70);
      grad.addColorStop(0, "rgba(255,210,130,0.30)");
      grad.addColorStop(1, "rgba(255,210,130,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(l.x, l.y, 70, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffdf9e";
      ctx.beginPath();
      ctx.arc(l.x, l.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();

  // ambience tint + vignette (screen space)
  ctx.fillStyle =
    w.map.ambience === "delhi"
      ? "rgba(255,170,70,0.05)"
      : "rgba(25,35,70,0.14)";
  ctx.fillRect(0, 0, cw, ch);
  const vg = ctx.createRadialGradient(
    cw / 2,
    ch / 2,
    Math.min(cw, ch) * 0.42,
    cw / 2,
    ch / 2,
    Math.max(cw, ch) * 0.75,
  );
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.4)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, cw, ch);
}

/* ------------ minimap ------------ */
function drawMinimapGround(
  ctx: CanvasRenderingContext2D,
  w: World,
  mw: number,
  mh: number,
) {
  const sx = mw / w.map.w,
    sy = mh / w.map.h;
  ctx.clearRect(0, 0, mw, mh);
  ctx.fillStyle = "#243c3d";
  ctx.fillRect(0, 0, mw, mh);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  for (const road of w.map.roadWays ?? []) {
    if (road.line.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(road.line[0].x * sx, road.line[0].y * sy);
    for (const p of road.line.slice(1)) ctx.lineTo(p.x * sx, p.y * sy);
    ctx.strokeStyle = "rgba(70,68,64,0.85)";
    ctx.lineWidth =
      road.highway === "primary" || road.highway === "secondary" ? 2 : 1;
    ctx.stroke();
  }
  for (const b of w.map.buildings) {
    if (b.barricade) continue;
    ctx.beginPath();
    const ring = b.footprint ?? [
      { x: b.x, y: b.y },
      { x: b.x + b.w, y: b.y },
      { x: b.x + b.w, y: b.y + b.h },
      { x: b.x, y: b.y + b.h },
    ];
    ring.forEach((p, i) =>
      i === 0 ? ctx.moveTo(p.x * sx, p.y * sy) : ctx.lineTo(p.x * sx, p.y * sy),
    );
    ctx.closePath();
    ctx.fillStyle = "#6e8781";
    ctx.fill();
  }
}
const minimapGrounds = new WeakMap<
  object,
  {
    canvas: HTMLCanvasElement;
    width: number;
    height: number;
    buildings: number;
  }
>();
export function drawMinimap(
  ctx: CanvasRenderingContext2D,
  w: World,
  mw: number,
  mh: number,
  viewWidth: number,
  viewHeight: number,
  dispatch?: { x: number; y: number },
) {
  const sx = mw / w.map.w,
    sy = mh / w.map.h;
  const key = w.map.roadWays ?? w.map.buildings;
  if (typeof document === "undefined") drawMinimapGround(ctx, w, mw, mh);
  else {
    let cached = minimapGrounds.get(key);
    if (
      !cached ||
      cached.width !== mw ||
      cached.height !== mh ||
      cached.buildings !== w.map.buildings.length
    ) {
      const canvas = document.createElement("canvas");
      canvas.width = mw;
      canvas.height = mh;
      const background = canvas.getContext("2d");
      if (background) drawMinimapGround(background, w, mw, mh);
      cached = {
        canvas,
        width: mw,
        height: mh,
        buildings: w.map.buildings.length,
      };
      minimapGrounds.set(key, cached);
    }
    ctx.clearRect(0, 0, mw, mh);
    ctx.drawImage(cached.canvas, 0, 0);
  }
  for (const b of w.map.buildings)
    if (b.barricade && !b.broken) {
      ctx.fillStyle = "#edbd63";
      ctx.fillRect(
        b.x * sx,
        b.y * sy,
        Math.max(2, b.w * sx),
        Math.max(2, b.h * sy),
      );
    }
  for (const e of w.entities) {
    if (e.remove || e.buildingId || e.kind === "crate" || e.kind === "truck")
      continue;
    ctx.fillStyle =
      e.id === w.player?.id
        ? "#ffd75e"
        : e.remote || e.profileId
          ? "#64c9bb"
          : e.state === "detained"
            ? "#6b7686"
            : e.wanted > 0
              ? "#ffd75e"
              : e.kind === "protester"
                ? e.violentT > 0
                  ? "#ff4632"
                  : "#ff9c4d"
                : e.kind === "police"
                  ? "#4da3ff"
                  : e.kind === "military"
                    ? "#8fd45e"
                    : "#b8b8b8";
    ctx.beginPath();
    ctx.arc(
      e.x * sx,
      e.y * sy,
      e.id === w.player?.id ? 3 : 1.7,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    if (e.id === w.selectedId) {
      ctx.strokeStyle = "#fff1a8";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(e.x * sx, e.y * sy, 5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  if (w.order && w.order.t > 0) {
    ctx.strokeStyle = "#4da3ff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(w.order.x * sx, w.order.y * sy, 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (w.objective) {
    ctx.fillStyle = "#eee0aa";
    ctx.fillRect(w.objective.x * sx - 3, w.objective.y * sy - 3, 6, 6);
  }
  if (dispatch) {
    ctx.strokeStyle = "#fff1a8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(dispatch.x * sx, dispatch.y * sy, 7, 0, Math.PI * 2);
    ctx.stroke();
  }
  // camera viewport
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = 1;
  const vw = (viewWidth / w.zoom) * sx,
    vh = (viewHeight / w.zoom) * sy;
  ctx.strokeRect(w.camX * sx - vw / 2, w.camY * sy - vh / 2, vw, vh);
}
