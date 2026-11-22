import assert from "node:assert/strict";
import test from "node:test";
import {
  createRoster,
  layoutOffice,
  walkingRoute,
} from "../src/lib/office/layout";
import { team, type TeamDraft } from "../src/lib/office/team";

test("the sample has a writing desk, sales desk and manager's office", () => {
  const roster = createRoster(team);
  assert.deepEqual(
    layoutOffice(roster).stations.map(({ bot, privateOffice }) => [
      bot.name, bot.role, privateOffice,
    ]),
    [
      ["Manager Marg", "Manager", true],
      ["Copywriting Cathy", "Copywriter", false],
      ["Sales Sam", "Sales", false],
    ],
  );
});

const drafts = (count: number): TeamDraft[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `bot-${i}`,
    name: `Bot ${i}`,
    role: i === 0 ? "Coordinator" : i % 2 ? "Researcher" : "Librarian",
  }));

test("the office grows with its roster and creates no spare departments", () => {
  let previousArea = 0;
  for (const count of [1, 3, 6, 12]) {
    const roster = createRoster(drafts(count));
    const layout = layoutOffice(roster);
    assert.equal(layout.stations.length, count);
    assert.ok(layout.width * layout.depth > previousArea);
    previousArea = layout.width * layout.depth;
    for (const bot of roster) {
      assert.ok(bot.home.x > 0 && bot.home.x < layout.width);
      assert.ok(bot.home.y > 0 && bot.home.y < layout.depth);
    }
  }
});

test("a coordinator gets a private office and an unled team uses open desks", () => {
  const roster = createRoster([
    { id: "reader", name: "Reader", role: "Librarian" },
    { id: "lead", name: "Lead", role: "Coordinator" },
  ]);
  assert.equal(roster[0].id, "lead");
  assert.equal(
    layoutOffice(roster).stations.filter((station) => station.privateOffice)
      .length,
    1,
  );
  const noLead = createRoster([
    { id: "reader", name: "Reader", role: "Librarian" },
  ]);
  assert.equal(
    layoutOffice(noLead).stations.some((station) => station.privateOffice),
    false,
  );
  assert.deepEqual(
    layoutOffice(noLead).stations.map((station) => station.bot.role),
    ["Librarian"],
  );
});

test("cross-row handoffs use the side spine and stay inside the resized floor", () => {
  const roster = createRoster(drafts(12));
  const layout = layoutOffice(roster);
  const route = walkingRoute(roster[0].id, roster[11].id, roster);
  assert.ok(route.some((point) => point.x === layout.spineX));
  for (const point of route)
    assert.ok(
      point.x > 0 &&
        point.x < layout.width &&
        point.y > 0 &&
        point.y < layout.depth,
    );
  for (let i = 1; i < route.length; i++)
    assert.ok(route[i].x === route[i - 1].x || route[i].y === route[i - 1].y);
  for (const point of route.slice(1, -1)) {
    const inRoomInterior = layout.stations.some(
      (room) =>
        point.x > room.x &&
        point.x < room.x + room.width &&
        point.y > room.y &&
        point.y < room.y + 4.3,
    );
    assert.equal(inRoomInterior, false);
  }
});
