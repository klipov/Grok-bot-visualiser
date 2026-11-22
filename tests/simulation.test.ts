import assert from "node:assert/strict";
import test from "node:test";
import {
  createTrip,
  advanceTrip,
  routeBetween,
} from "../src/lib/office/simulation";
import { createRoster } from "../src/lib/office/layout";
import { team } from "../src/lib/office/team";

test("visits use the open aisle instead of crossing the desk rows", () => {
  const route = routeBetween("cathy", "marg");
  assert.deepEqual(route[0], { x: 9.5, y: 5.5 });
  assert.ok(route.some((point) => point.y === 6.9));
  assert.equal(route.at(-1)?.y, 5.5);
  const twoRows = createRoster([
    ...team,
    { id: "fern", name: "Fern", role: "Librarian" },
    { id: "kit", name: "Kit", role: "Engineer" },
  ]);
  const libraryRoute = routeBetween("fern", "kit", twoRows);
  assert.ok(libraryRoute.some((point) => point.y === 13.9));
  assert.ok(libraryRoute.every((point) => point.y >= 12.5));
});

test("pause preserves position and delivery fires once before returning home", () => {
  const trip = createTrip("cathy", "marg");
  const initial = { ...trip.position };
  assert.deepEqual(advanceTrip(trip, 1000, true), []);
  assert.deepEqual(trip.position, initial);
  let delivered = 0;
  let settled = 0;
  for (let i = 0; i < 1000; i++) {
    for (const event of advanceTrip(trip, 100)) {
      if (event === "delivered") delivered++;
      if (event === "settled") settled++;
    }
  }
  assert.equal(delivered, 1);
  assert.equal(settled, 1);
  assert.equal(trip.phase, "settled");
  assert.deepEqual(trip.position, initial);
  assert.deepEqual(advanceTrip(trip, 100000), []);
});

test("larger time steps finish a trip without skipping its delivery", () => {
  const trip = createTrip("sam", "marg");
  assert.deepEqual(advanceTrip(trip, 1_000_000), ["delivered", "settled"]);
});
