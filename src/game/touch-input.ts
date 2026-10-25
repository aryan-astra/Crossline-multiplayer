export function joystickInput(dx: number, dy: number, radius = 40) {
  const distance = Math.hypot(dx, dy);
  const scale = Math.min(1, radius / (distance || 1));
  const active = distance > radius * 0.2;
  return {
    x: dx * scale,
    y: dy * scale,
    up: active && dy < -distance * 0.35,
    down: active && dy > distance * 0.35,
    left: active && dx < -distance * 0.35,
    right: active && dx > distance * 0.35,
  };
}
