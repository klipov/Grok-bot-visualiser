import { test, expect } from "@playwright/test";

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
  await page.waitForTimeout(800);
  await expect(world).toHaveAttribute("data-phase", phase!);
  await page.getByRole("button", { name: /Fern Librarian/ }).click();
  await expect(
    page.getByRole("heading", { name: "Fern's desk" }),
  ).toBeVisible();
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
