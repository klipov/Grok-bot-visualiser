import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { POST } from "../src/app/api/grok/observe/route";
import { parseDesktopResult } from "../src/lib/grok/observe";
import {
  customizeDesk,
  emptyOffice,
  updateOffice,
} from "../src/components/use-desktop-office";

const origin = "http://127.0.0.1:3000";
const headers = {
  host: "127.0.0.1:3000",
  origin,
  "x-office-observer": "desktop",
};

test("desktop reads require a same-origin request to the local office", async () => {
  const changes: Record<string, string>[] = [
    { origin: "https://example.com" },
    { origin: "http://127.0.0.1:8000" },
    { origin: "" },
    { host: "example.com", origin: "http://example.com" },
    { "x-office-observer": "" },
    { "x-forwarded-host": "example.com" },
    { "x-forwarded-for": "203.0.113.1, 127.0.0.1" },
  ];
  for (const changed of changes) {
    const request = new Request(origin + "/api/grok/observe", {
      method: "POST",
      headers: { ...headers, ...changed },
    });
    const result = await POST(request);
    assert.equal(result.status, 403);
    assert.equal(result.headers.get("cache-control"), "no-store");
    assert.deepEqual(Object.keys(await result.json()), ["error"]);
  }
});

test("a server without the desktop observer enabled returns no roster", async (t) => {
  const previous = process.env.GROK_DESKTOP_OBSERVER;
  delete process.env.GROK_DESKTOP_OBSERVER;
  t.after(() => {
    if (previous !== undefined) process.env.GROK_DESKTOP_OBSERVER = previous;
  });
  const result = await POST(
    new Request(origin + "/api/grok/observe", {
      method: "POST",
      headers,
    }),
  );
  assert.equal(result.status, 503);
  assert.deepEqual(Object.keys(await result.json()), ["error"]);
});

test("the desktop response contains only the roster and supported details", () => {
  const bot = {
    id: "a",
    name: "Catía",
    status: "working",
    task: "Review intro",
  };
  assert.deepEqual(
    parseDesktopResult(
      JSON.stringify({
        bots: [{ ...bot, unrelated: "omit" }],
        other: "omit",
      }),
    ),
    { bots: [bot] },
  );
  assert.deepEqual(parseDesktopResult('{"bots":[]}'), { bots: [] });
  assert.deepEqual(parseDesktopResult('{"error":"Open Grok Bot"}'), {
    error: "Open Grok Bot",
  });
  for (const bots of [
    [{ name: "No ID" }],
    [bot, bot],
    [{ ...bot, task: {} }],
    false,
  ]) {
    assert.throws(() => parseDesktopResult(JSON.stringify({ bots })));
  }
});

test("sidebar reordering updates visible activity without moving occupied desks", () => {
  const cathy = { id: "c", name: "Copywriting Cathy" };
  const sam = { id: "s", name: "Sales Sam" };
  const first = updateOffice(emptyOffice, [cathy, sam]);
  const next = updateOffice(first, [
    { ...sam, task: "Review pipeline" },
    cathy,
  ]);
  assert.equal(next.team, first.team);
  assert.equal(next.activity.get("s"), "Review pipeline");
  assert.equal(first.activity.size, 0);
});

test("manual desk choices survive a bot leaving and returning with a new job title", () => {
  const bot = {
    id: "s",
    name: "Sam",
    role: "Account Executive",
    task: "Review pipeline",
  };
  const first = updateOffice(emptyOffice, [bot]);
  const assigned = customizeDesk(first, "s", {
    role: "Sales",
    avatar: "feminine",
  });
  assert.equal(assigned.team[0].role, "Sales");
  assert.equal(assigned.team[0].roleLabel, "Account Executive");
  assert.equal(assigned.checkedAt, first.checkedAt);
  const refreshed = updateOffice(assigned, [
    { ...bot, role: "Writer", task: "Draft copy" },
  ]);
  assert.equal(refreshed.team[0].role, "Sales");
  assert.equal(refreshed.team[0].avatar, "feminine");
  assert.equal(customizeDesk(refreshed, "s", {}).team[0].avatar, "neutral");
  assert.equal(refreshed.activity.get("s"), "Draft copy");
  assert.equal(customizeDesk(refreshed, "s", {}).team[0].role, "Copywriter");
  const departed = updateOffice(refreshed, []);
  assert.equal(departed.activity.size, 0);
  assert.equal(customizeDesk(departed, "s", { role: "Designer" }), departed);
  const returned = updateOffice(departed, [{ ...bot, role: "Finance" }]);
  assert.equal(returned.team[0].role, "Sales");
  assert.equal(returned.team[0].avatar, "feminine");
  const reset = customizeDesk(returned, "s", { avatar: "feminine" });
  assert.equal(reset.team[0].role, "Finance");
  assert.equal(reset.team[0].avatar, "feminine");
});

test(
  "concurrent reads share one bounded PowerShell observation",
  {
    skip: process.platform !== "win32",
  },
  async (t) => {
    const directory = await mkdtemp(join(tmpdir(), "grok-office-test-"));
    const previous = process.env.GROK_DESKTOP_OBSERVER;
    const cwd = process.cwd();
    t.after(async () => {
      process.chdir(cwd);
      if (previous === undefined) delete process.env.GROK_DESKTOP_OBSERVER;
      else process.env.GROK_DESKTOP_OBSERVER = previous;
      await rm(directory, { recursive: true, force: true });
    });
    await mkdir(join(directory, "scripts"));
    await writeFile(
      join(directory, "scripts/read-grok-office.ps1"),
      [
        'Add-Content -LiteralPath (Join-Path $PSScriptRoot "reads") -Value "read"',
        'Write-Output \'{"bots":[{"id":"cathy","name":"Cathy"}]}\'',
      ].join("\r\n"),
    );
    process.chdir(directory);
    process.env.GROK_DESKTOP_OBSERVER = "1";
    const request = () =>
      new Request(origin + "/api/grok/observe", { method: "POST", headers });
    const [first, second] = await Promise.all([
      POST(request()),
      POST(request()),
    ]);
    for (const result of [first, second]) {
      assert.equal(result.status, 200);
      assert.deepEqual(await result.json(), {
        bots: [{ id: "cathy", name: "Cathy" }],
      });
    }
    assert.equal(
      (await readFile(join(directory, "scripts/reads"), "utf8")).trim(),
      "read",
    );
  },
);
