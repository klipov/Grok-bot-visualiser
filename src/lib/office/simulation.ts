import { botById, type BotId, type Point } from "./team";

const WALK_SPEED = 2.6;
const DESK_VISIT_MS = 1400;

function aisleRoute(id: BotId, visiting = false): Point[] {
  const home = botById(id).home;
  const desk = visiting
    ? {
        x: home.x + (id === "fern" ? 0 : 0.8),
        y: home.y + (id === "fern" ? 0.8 : 0),
      }
    : { ...home };
  if (id === "fern")
    return [desk, { x: desk.x, y: 14 }, { x: 7.5, y: 14 }, { x: 7.5, y: 7 }];
  if (id === "kit") return [desk, { x: 17.7, y: desk.y }, { x: 17.7, y: 7 }];
  return [desk, { x: desk.x, y: 7 }];
}

export function routeBetween(from: BotId, to: BotId): Point[] {
  return [...aisleRoute(from), ...aisleRoute(to, true).reverse()];
}

export type Trip = {
  position: Point;
  phase: "outbound" | "visiting" | "returning" | "settled";
  route: Point[];
  waypoint: number;
  visitRemaining: number;
};

export function createTrip(from: BotId, to: BotId): Trip {
  const route = routeBetween(from, to);
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
