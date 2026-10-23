import { type Bot, type BotId, type Point } from "./team";
import { walkingRoute } from "./layout";

const WALK_SPEED = 2.6;
const DESK_VISIT_MS = 1400;

export function routeBetween(
  from: BotId,
  to: BotId,
  roster?: readonly Bot[],
): Point[] {
  return walkingRoute(from, to, roster);
}

export type Trip = {
  position: Point;
  phase: "outbound" | "visiting" | "returning" | "settled";
  route: Point[];
  waypoint: number;
  visitRemaining: number;
};

export function createTrip(
  from: BotId,
  to: BotId,
  roster?: readonly Bot[],
): Trip {
  const route = routeBetween(from, to, roster);
  return {
    position: { ...route[0] },
    phase: "outbound",
    route,
    waypoint: 1,
    visitRemaining: DESK_VISIT_MS,
  };
}

export function advanceTrip(
  trip: Trip,
  deltaMs: number,
  paused = false,
): ("delivered" | "settled")[] {
  const events: ("delivered" | "settled")[] = [];
  if (paused || deltaMs <= 0 || trip.phase === "settled") return events;
  let remaining = deltaMs;
  while (remaining > 0 && trip.phase !== "settled") {
    if (trip.phase === "visiting") {
      const elapsed = Math.min(trip.visitRemaining, remaining);
      remaining -= elapsed;
      trip.visitRemaining -= elapsed;
      if (trip.visitRemaining === 0) {
        trip.phase = "returning";
        trip.route = [...trip.route].reverse();
        trip.waypoint = 1;
      }
      continue;
    }
    const destination = trip.route[trip.waypoint];
    const dx = destination.x - trip.position.x;
    const dy = destination.y - trip.position.y;
    const distance = Math.hypot(dx, dy);
    const duration = (distance / WALK_SPEED) * 1000;
    if (remaining < duration) {
      const fraction = remaining / duration;
      trip.position = {
        x: trip.position.x + dx * fraction,
        y: trip.position.y + dy * fraction,
      };
      remaining = 0;
    } else {
      trip.position = { ...destination };
      remaining -= duration;
      trip.waypoint++;
      if (trip.waypoint === trip.route.length) {
        if (trip.phase === "outbound") {
          trip.phase = "visiting";
          events.push("delivered");
        } else {
          trip.phase = "settled";
          events.push("settled");
        }
      }
    }
  }
  return events;
}
