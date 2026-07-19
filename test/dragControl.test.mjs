import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_DRAG_SPEED, measureDragMotion, resolveSnakeSpeed } from '../src/dragControl.js';

const control = {
  active:true,
  lastClientX:100,
  lastClientY:80,
  lastMoveAt:1000,
  arenaWidth:500,
  arenaHeight:325,
  dragSpeed:320,
};

test('converts finger movement into game-coordinate speed and caps spikes', () => {
  const motion = measureDragMotion(control, {clientX:150, clientY:80}, 1050, 1000, 650);

  assert.equal(motion.dx, 100);
  assert.equal(motion.dy, 0);
  assert.equal(motion.speed, MAX_DRAG_SPEED);
});

test('keeps the snake still while a held finger is no longer moving', () => {
  const speed = resolveSnakeSpeed({control, now:1120, slowMotion:false, speedMultiplier:1});

  assert.equal(speed, 0);
});

test('returns to the configured automatic speed after release', () => {
  const speed = resolveSnakeSpeed({control:{...control, active:false}, now:1120, slowMotion:false, speedMultiplier:1.5});

  assert.equal(speed, 123);
});
