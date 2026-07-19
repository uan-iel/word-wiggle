export const AUTO_SPEED = 82;
export const SLOW_SPEED = 52;
export const DRAG_IDLE_MS = 100;
export const MAX_DRAG_SPEED = 720;

export const measureDragMotion = (control, event, now, width, height) => {
  const elapsed = Math.max((now - control.lastMoveAt) / 1000, .001);
  const dx = (event.clientX - control.lastClientX) * width / control.arenaWidth;
  const dy = (event.clientY - control.lastClientY) * height / control.arenaHeight;
  const distance = Math.hypot(dx, dy);
  return {dx, dy, speed:Math.min(MAX_DRAG_SPEED, distance / elapsed)};
};

export const resolveSnakeSpeed = ({ control, now, slowMotion, speedMultiplier }) => {
  const baseSpeed = (slowMotion ? SLOW_SPEED : AUTO_SPEED) * speedMultiplier;
  if (!control?.active) return baseSpeed;
  return now - control.lastMoveAt < DRAG_IDLE_MS ? control.dragSpeed : 0;
};
