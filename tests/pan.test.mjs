// Unit tests for js/pan.js. Run with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('moving a handpan tone field: it stays on the pan, clear of the others', async () => {
  const { settlePanPlace, PAN_BODY_R } = await import('../js/pan.js');
  const ding = { x: 250, y: 250, r: 36 };
  const dist = p => Math.hypot(p.x - 250, p.y - 250);
  // Dropped on the ding: pushed off it, still on the pan.
  const a = settlePanPlace('ring-1', 250, 255, 22, [ding]);
  assert.ok(Math.hypot(a.x - 250, a.y - 250) >= 36 + 22 && dist(a) <= PAN_BODY_R - 22);
  // Dragged off the pan: back onto its edge.
  const b = settlePanPlace('ring-2', 5, 5, 22, []);
  assert.ok(Math.abs(dist(b) - (PAN_BODY_R - 22 - 3)) < 2);
  // A note underneath dropped in the middle: out round the pan, inside the picture.
  const c = settlePanPlace('gu-0', 250, 250, 16, [ding]);
  assert.ok(dist(c) >= PAN_BODY_R + 16 && c.x >= 16 && c.x <= 484 && c.y >= 16 && c.y <= 484);
  // No room at all: null (it goes back where it was).
  const crowd = [];
  for (let x = 20; x < 500; x += 40) for (let y = 20; y < 500; y += 40) crowd.push({ x, y, r: 19 });
  assert.equal(settlePanPlace('gu-0', 30, 30, 16, crowd), null);
});
