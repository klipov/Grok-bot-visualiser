import assert from "node:assert/strict";
import { test } from "node:test";
import {
  botFromDraft,
  parseTeamDrafts,
  executionOrder,
} from "../src/lib/office/team";
import { demoHandoff } from "../src/lib/office/demo";

test("team input accepts repeated roles and an optional lead, but rejects ambiguous rosters", () => {
  const members = [
    { id: "reader-1", name: "  Ada  ", role: "Librarian" },
    { id: "reader-2", name: "Bea", role: "Librarian" },
  ];
  assert.equal(parseTeamDrafts(members)?.[0].name, "Ada");
  assert.equal(parseTeamDrafts(members)?.length, 2);
  for (const invalid of [
    [],
    Array.from({ length: 13 }, (_, i) => ({
      id: `bot-${i}`,
      name: "Bot",
      role: "Generalist",
    })),
    [members[0], members[0]],
    [{ ...members[0], role: "Unknown" }],
    [{ ...members[0], name: " " }],
    [{ ...members[0], id: "bad id" }],
    [
      { id: "a", name: "A", role: "Coordinator" },
      { id: "b", name: "B", role: "Coordinator" },
    ],
  ])
    assert.equal(parseTeamDrafts(invalid), null);
});

test("a lone teammate has no invented desk visits and custom colleagues talk to each other", () => {
  const ada = botFromDraft({ id: "ada", name: "Ada", role: "Librarian" });
  const bea = botFromDraft({ id: "bea", name: "Bea", role: "Researcher" });
  assert.equal(demoHandoff(0, [ada]), null);
  const handoff = demoHandoff(0, [ada, bea])!;
  assert.equal(handoff.from, "bea");
  assert.equal(handoff.to, "ada");
  assert.equal(executionOrder([ada, bea]).length, 2);
});
