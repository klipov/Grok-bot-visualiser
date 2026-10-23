import { test, expect } from "@playwright/test";
import { team } from "../../src/lib/office/team";
import { createRoster, layoutOffice } from "../../src/lib/office/layout";
import { officeMetrics, project } from "../../src/lib/office/art";

test("the rendered office delivers a message at the desk and supports playback and inspection", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/");
  const world = page.locator('[data-ready="true"]');
  await expect(world).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "Pause office" }).click();
  await expect(page.getByText("Office paused", { exact: true })).toBeVisible();
  const phase = await world.getAttribute("data-phase");
  await page.waitForTimeout(150);
  const pausedCanvas = await page.locator("canvas").screenshot();
  await page.waitForTimeout(800);
  await expect(world).toHaveAttribute("data-phase", phase!);
  expect((await page.locator("canvas").screenshot()).equals(pausedCanvas)).toBe(
    true,
  );
  await page.getByRole("button", { name: /Fern Librarian/ }).click();
  await expect(
    page.getByRole("heading", { name: "Fern's desk" }),
  ).toBeVisible();
  const canvas = page.locator("canvas");
  const bounds = (await canvas.boundingBox())!;
  const roster = createRoster(team);
  const layout = layoutOffice(roster);
  const metrics = officeMetrics(layout);
  const kit = project(roster.find((bot) => bot.id === "kit")!.home, layout, 20);
  const scale = Math.min(
    bounds.width / metrics.width,
    bounds.height / metrics.height,
  );
  await canvas.click({
    position: {
      x: (bounds.width - metrics.width * scale) / 2 + kit.x * scale,
      y: (bounds.height - metrics.height * scale) / 2 + kit.y * scale,
    },
  });
  await expect(page.getByRole("heading", { name: "Kit's desk" })).toBeVisible();
  await page.getByRole("combobox", { name: "Playback speed" }).click();
  await page.getByRole("option", { name: "4× speed" }).click();
  await page.getByRole("button", { name: "Resume office" }).click();
  await page.getByRole("tab", { name: /Activity/ }).click();
  await expect(page.getByText("Demo · Delivered").first()).toBeVisible({
    timeout: 20_000,
  });
  await page
    .getByRole("button", { name: /Demo · Delivered/ })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByText("Delivered at the desk", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: /On the floor/ }).click();
  await page.screenshot({
    path: "test-results/office-desktop.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("mobile layout fits and the brief dialog works with keyboard", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator('[data-ready="true"]')).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator("canvas")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Give the team a brief" }).click();
  await page
    .getByLabel("The brief", { exact: true })
    .fill("Plan a neighbourhood book exchange");
  await page.getByRole("button", { name: "Rehearse the handoffs" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByText("Demo office · simulated activity"),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/office-mobile.png",
    fullPage: true,
  });
});

test("a streamed Grok handoff becomes a desk visit and the final answer remains readable", async ({
  page,
}) => {
  await page.route("**/api/grok/status", (route) =>
    route.fulfill({ json: { configured: true, model: "test-model" } }),
  );
  await page.route("**/api/grok/run", async (route) => {
    expect(route.request().headers().authorization).toBe(
      "Bearer test-office-token",
    );
    expect(route.request().postDataJSON().brief).toBe(
      "Plan a neighbourhood book exchange",
    );
    const events = [
      { type: "working", bot: "atlas" },
      {
        type: "handoff",
        handoff: {
          id: "live-1",
          from: "atlas",
          to: "mira",
          message: "Start by identifying a venue and volunteer organiser.",
          source: "grok",
        },
      },
      {
        type: "complete",
        summary: "Use the community hall and start with one shelf.",
      },
    ];
    await route.fulfill({
      contentType: "application/x-ndjson",
      body: events.map((event) => JSON.stringify(event)).join("\n") + "\n",
    });
  });
  await page.goto("/");
  await expect(page.locator('[data-ready="true"]')).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Connect Grok" }).click();
  await page
    .getByLabel("Office access token", { exact: true })
    .fill("test-office-token");
  await page.getByRole("button", { name: "Use this token" }).click();
  await page.getByRole("button", { name: "Give the team a brief" }).click();
  await expect(
    page.getByRole("tab", { name: "Real Grok team" }),
  ).toHaveAttribute("data-state", "active");
  await page
    .getByLabel("The brief", { exact: true })
    .fill("Plan a neighbourhood book exchange");
  await page.getByRole("button", { name: "Run Grok · up to 6 calls" }).click();
  await expect(
    page.getByText("Use the community hall and start with one shelf."),
  ).toBeVisible();
  await page.getByRole("combobox", { name: "Playback speed" }).click();
  await page.getByRole("option", { name: "4× speed" }).click();
  await page.getByRole("tab", { name: /Activity/ }).click();
  await expect(page.getByText("Grok · Delivered")).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page.getByText("Start by identifying a venue and volunteer organiser."),
  ).toBeVisible();
});

test("failed Grok connection is shown without pretending it was a demo", async ({
  page,
}) => {
  await page.route("**/api/grok/status", (route) =>
    route.fulfill({ json: { configured: true, model: "test-model" } }),
  );
  await page.route("**/api/grok/run", (route) =>
    route.fulfill({
      status: 401,
      json: { error: "The office access token isn't correct." },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Connect Grok" }).click();
  await page
    .getByLabel("Office access token", { exact: true })
    .fill("wrong-token");
  await page.getByRole("button", { name: "Use this token" }).click();
  await page.getByRole("button", { name: "Give the team a brief" }).click();
  await page
    .getByLabel("The brief", { exact: true })
    .fill("Plan a neighbourhood book exchange");
  await page.getByRole("button", { name: "Run Grok · up to 6 calls" }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "The office access token isn't correct." }),
  ).toBeVisible();
  await expect(
    page.getByText("Grok team · session", { exact: true }),
  ).toBeVisible();
});

test("a streamed error keeps the partial Grok handoff available for delivery", async ({
  page,
}) => {
  await page.route("**/api/grok/status", (route) =>
    route.fulfill({ json: { configured: true, model: "test-model" } }),
  );
  await page.route("**/api/grok/run", (route) =>
    route.fulfill({
      contentType: "application/x-ndjson",
      body:
        [
          {
            type: "handoff",
            handoff: {
              id: "partial-1",
              from: "atlas",
              to: "mira",
              message:
                "The venue plan is ready; the next step still needs work.",
              source: "grok",
            },
          },
          {
            type: "error",
            message:
              "Grok took too long to respond. Completed handoffs are still available.",
          },
        ]
          .map((event) => JSON.stringify(event))
          .join("\n") + "\n",
    }),
  );
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Connect Grok" }).click();
  await page
    .getByLabel("Office access token", { exact: true })
    .fill("test-office-token");
  await page.getByRole("button", { name: "Use this token" }).click();
  await page.getByRole("button", { name: "Give the team a brief" }).click();
  await page
    .getByLabel("The brief", { exact: true })
    .fill("Plan a neighbourhood book exchange");
  await page.getByRole("button", { name: "Run Grok · up to 6 calls" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Grok took too long" }),
  ).toBeVisible();
  await page.getByRole("combobox", { name: "Playback speed" }).click();
  await page.getByRole("option", { name: "4× speed" }).click();
  await page.getByRole("tab", { name: /Activity/ }).click();
  await expect(page.getByText("Grok · Delivered")).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page.getByText("The venue plan is ready; the next step still needs work."),
  ).toBeVisible();
  await expect(
    page.getByText("Grok team · session", { exact: true }),
  ).toBeVisible();
});

test("a demo brief replaces a returning trip and still reaches the next desk", async ({
  page,
}) => {
  await page.goto("/");
  const world = page.locator('[data-ready="true"]');
  await expect(page.locator("canvas")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("combobox", { name: "Playback speed" }).click();
  await page.getByRole("option", { name: "4× speed" }).click();
  await expect(world).toHaveAttribute("data-phase", "returning", {
    timeout: 15_000,
  });
  await page.getByRole("button", { name: "Pause office" }).click();
  await page.getByRole("button", { name: "Give the team a brief" }).click();
  await page
    .getByLabel("The brief", { exact: true })
    .fill("Plan a rooftop community garden");
  await page.getByRole("button", { name: "Rehearse the handoffs" }).click();
  await page.getByRole("tab", { name: /Activity/ }).click();
  await expect(
    page.getByText("Demo brief: Plan a rooftop community garden", {
      exact: false,
    }),
  ).toBeVisible({ timeout: 15_000 });
});

test("the office still renders when WebGL is unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      kind: string,
      ...args: unknown[]
    ) {
      if (kind.includes("webgl")) return null;
      return Reflect.apply(original, this, [kind, ...args]);
    } as typeof original;
  });
  await page.goto("/");
  await expect(page.locator('[data-ready="true"]')).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator("canvas")).toBeVisible();
});

test("an asset failure produces an accessible graphics error", async ({
  page,
}) => {
  await page.route("**/office/*.png", (route) => route.abort());
  await page.goto("/");
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "The office renderer could not start" }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByText("Try another browser or check its graphics settings", {
      exact: false,
    }),
  ).toBeVisible();
});

test("team composition rebuilds the actual floor and removes an absent head office", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/");
  const world = page.locator('[data-ready="true"]');
  await expect(world).toHaveAttribute("data-team-size", "5", {
    timeout: 30_000,
  });
  await expect(world).toHaveAttribute("data-head-offices", "1");
  const originalDepth = Number(await world.getAttribute("data-floor-depth"));
  await page.getByRole("button", { name: "Pause office" }).click();
  const originalScene = await page.locator("canvas").screenshot();
  await page.getByRole("button", { name: /Team setup/ }).click();
  await page
    .getByRole("button", { name: "Remove teammate 5", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Remove teammate 1", exact: true })
    .click();
  await page.getByRole("button", { name: "Apply team", exact: true }).click();
  await expect(world).toHaveAttribute("data-team-size", "3");
  await expect(world).toHaveAttribute("data-rooms", "3");
  await expect(world).toHaveAttribute("data-head-offices", "0");
  expect(Number(await world.getAttribute("data-floor-depth"))).toBeLessThan(
    originalDepth,
  );
  expect(
    (await page.locator("canvas").screenshot()).equals(originalScene),
  ).toBe(false);
  await page.screenshot({
    path: "test-results/office-three-specialists.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: /Team setup/ }).click();
  for (let i = 0; i < 9; i++)
    await page.getByRole("button", { name: /Add teammate/ }).click();
  await page.getByRole("button", { name: "Apply team", exact: true }).click();
  await expect(world).toHaveAttribute("data-team-size", "12");
  await expect(world).toHaveAttribute("data-rooms", "12");
  expect(Number(await world.getAttribute("data-floor-depth"))).toBeGreaterThan(
    originalDepth,
  );
  await page.screenshot({
    path: "test-results/office-twelve-teammates.png",
    fullPage: true,
  });
});

test("one teammate gets a compact role-specific workspace and no invented handoffs", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: /Team setup/ }).click();
  for (let i = 5; i > 1; i--)
    await page
      .getByRole("button", { name: `Remove teammate ${i}`, exact: true })
      .click();
  await page.getByRole("combobox", { name: "Role", exact: true }).click();
  await page.getByRole("option", { name: "Librarian", exact: true }).click();
  await page.getByLabel("Teammate 1", { exact: true }).fill("Ada");
  await page.getByRole("button", { name: "Apply team", exact: true }).click();
  const world = page.locator('[data-ready="true"]');
  await expect(world).toHaveAttribute("data-team-size", "1", {
    timeout: 30_000,
  });
  await expect(world).toHaveAttribute("data-head-offices", "0");
  await expect(
    page.getByRole("button", { name: /Ada Librarian/ }),
  ).toBeVisible();
  await expect(
    page.getByText("One teammate, one workspace.", { exact: false }),
  ).toBeVisible();
  await expect(world).toHaveAttribute("data-phase", "idle");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/office-one-librarian.png",
    fullPage: true,
  });
});
