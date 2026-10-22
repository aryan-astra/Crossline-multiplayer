type Position = { x: number; y: number };

// Adapted from FLASHPOINT's centroid-relative squad line formation.
export function formationSlot(
  order: Position,
  members: (Position & { id: number })[],
  me: { id: number },
  spacing = 26,
): Position {
  const index = members.findIndex((member) => member.id === me.id);
  if (index < 0) return { x: order.x, y: order.y };
  let x = 0,
    y = 0;
  for (const member of members) {
    x += member.x;
    y += member.y;
  }
  const dx = order.x - x / members.length;
  const dy = order.y - y / members.length;
  const distance = Math.hypot(dx, dy);
  const forwardX = distance < 1 ? 0 : dx / distance;
  const forwardY = distance < 1 ? -1 : dy / distance;
  const offset = (index - (members.length - 1) / 2) * spacing;
  return { x: order.x - forwardY * offset, y: order.y + forwardX * offset };
}

// FLASHPOINT's personal offsets spread a crowd without consuming random state.
export function rallyTarget(
  unit: { id: number },
  rally: Position,
  radius: number,
  time: number,
): Position {
  const angle = unit.id * 2.399 + time * 0.03;
  const distance = radius * (0.25 + ((unit.id * 37) % 60) / 100);
  return {
    x: rally.x + Math.cos(angle) * distance,
    y: rally.y + Math.sin(angle) * distance,
  };
}
