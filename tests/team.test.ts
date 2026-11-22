import assert from "node:assert/strict";
import { test } from "node:test";
import {
  botFromDraft,
  parseTeamDrafts,
  executionOrder,
  workspaceRole,
} from "../src/lib/office/team";
import { demoHandoff } from "../src/lib/office/demo";

test("the reported title or bot name chooses the office furniture", () => {
  assert.equal(workspaceRole("Copywriting Cathy"), "Copywriter");
  assert.equal(workspaceRole("Sam", "Sales"), "Sales");
  assert.equal(workspaceRole("Manager Marg"), "Manager");
  assert.equal(workspaceRole("Sales Sam", "Product Designer"), "Designer");
  assert.equal(workspaceRole("Penn", "Poet"), "Generalist");
  assert.equal(workspaceRole("Writerly"), "Generalist");
});

test("department names and job titles take precedence over generic management roles", () => {
  const examples = [
    ["HRHannah", "Generalist", "HR"],
    ["Helen", "People Operations Manager", "HR"],
    ["Fran", "Accounts Payable Coordinator", "Finance"],
    ["Sofia", "Customer Success Manager", "Support"],
    ["Social-Media-Sam", "Assistant", "Marketing"],
    ["Ollie", "Head of Logistics", "Operations"],
    ["Ellen", "Engineering Manager", "Engineer"],
    ["Designer Dee", "Manager", "Designer"],
    ["Richard", "Research Coordinator", "Researcher"],
    ["Sales_Sam", "Custom bot", "Sales"],
    ["Sam", "Account Executive", "Sales"],
    ["Sandy", "Director", "Manager"],
  ];
  for (const [name, title, department] of examples) {
    assert.equal(workspaceRole(name, title), department, name);
  }
});

test("sample team drafts accept an avatar choice and choose a default when omitted", () => {
  const draft = {
    id: "c",
    name: "Copywriting Cathy",
    role: "Copywriter",
  } as const;
  assert.equal(botFromDraft(draft).avatar, "feminine");
  const chosen = { ...draft, avatar: "neutral" } as const;
  assert.deepEqual(parseTeamDrafts([chosen]), [chosen]);
  assert.equal(botFromDraft(chosen).avatar, "neutral");
  assert.equal(parseTeamDrafts([{ ...draft, avatar: "unknown" }]), null);
});

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
