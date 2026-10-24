import type { MapDef, MapId, Role } from "./types";

export type AreaId = "gathering" | "approach";
export const AREAS: Record<
  MapId,
  { id: AreaId; name: string; description: string }[]
> = {
  delhi: [
    {
      id: "gathering",
      name: "Observatory quarter",
      description: "Start near the gathering at Jantar Mantar.",
    },
    {
      id: "approach",
      name: "Street approach",
      description: "Enter from the outer checkpoint and find your way in.",
    },
  ],
  paris: [
    {
      id: "gathering",
      name: "Republic square",
      description: "Start near the gathering at Place de la République.",
    },
    {
      id: "approach",
      name: "Boulevard approach",
      description: "Enter from the outer checkpoint and approach the square.",
    },
  ],
};

export function entryPoint(map: MapDef, role: Role, area: AreaId) {
  if (area === "approach")
    return map.checkpoints[role === "police" ? 1 : role === "military" ? 2 : 0];
  return role === "watcher"
    ? (map.objectivePoint ?? map.rallyPoints[0])
    : map.spawns[role];
}
