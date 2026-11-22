import { expect, test, type Page } from "@playwright/test";
import { team } from "../../src/lib/office/team";
import { createRoster, layoutOffice } from "../../src/lib/office/layout";
import { officeMetrics, project } from "../../src/lib/office/art";

// Only tests that install an explicit observer fixture can request desktop data.
test.beforeEach(async ({ page }) => {
  await page.route(/\/api\/grok\/|https:\/\/api\.x\.ai\//, async (route) => {
    await route.abort();
    throw new Error(`Unexpected Grok request: ${route.request().url()}`);
  });
});

async function watchDesktop(page: Page) {
  await page.getByRole("button", { name: "Connect Grok Bot" }).click();
  await page.getByRole("button", { name: "Watch desktop team" }).click();
}

test("the sample office supports playback, desk inspection and delivered messages", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/");
  const world = page.locator('[data-ready="true"]');
  await expect(world).toHaveAttribute("data-team-size", "3", {
    timeout: 30_000,
  });
  await expect(world).toHaveAttribute("data-head-offices", "1");
  await page.getByRole("button", { name: "Pause office" }).click();
  await expect(page.getByText("Office paused")).toBeVisible();
  const canvas = page.locator("canvas");
  const pausedImage = await canvas.screenshot();
  await page.waitForTimeout(400);
  expect((await canvas.screenshot()).equals(pausedImage)).toBe(true);

  await page.getByRole("button", { name: /^Copywriting Cathy/ }).click();
  await expect(
    page.getByRole("heading", { name: "Copywriting Cathy’s desk" }),
  ).toBeVisible();
  const bounds = (await canvas.boundingBox())!;
  const roster = createRoster(team);
  const layout = layoutOffice(roster);
  const metrics = officeMetrics(layout);
  const sam = project(roster.find((bot) => bot.id === "sam")!.home, layout, 20);
  const scale = Math.min(
    bounds.width / metrics.width,
    bounds.height / metrics.height,
  );
  await canvas.click({
    position: {
      x: (bounds.width - metrics.width * scale) / 2 + sam.x * scale,
      y: (bounds.height - metrics.height * scale) / 2 + sam.y * scale,
    },
  });
  await expect(
    page.getByRole("heading", { name: "Sales Sam’s desk" }),
  ).toBeVisible();

  await page.getByRole("combobox", { name: "Playback speed" }).click();
  await page.getByRole("option", { name: "4× speed" }).click();
  await page.getByRole("button", { name: "Resume office" }).click();
  await page.getByRole("tab", { name: /Activity/ }).click();
  const delivered = page
    .getByRole("button", { name: /Demo · Delivered/ })
    .first();
  await expect(delivered).toBeVisible({ timeout: 20_000 });
  await delivered.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("Delivered at the desk")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Restart demo" }).click();
  await expect(
    page.getByRole("heading", { name: "No handoffs yet" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test(
  "the mobile connection dialog can be inspected and dismissed without reading the desktop",
  { tag: "@platform" },
  async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.locator("canvas")).toBeVisible({ timeout: 30_000 });
    const open = page.getByRole("button", { name: "Connect Grok Bot" });
    await open.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", {
      name: "Watch your Grok Bot team",
    });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAccessibleDescription(
      /On a Mac, you can use the sample office\. Live activity requires Windows\./,
    );
    await expect(
      dialog.getByRole("button", { name: "Watch desktop team" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByText("Demo office · simulated activity"),
    ).toBeVisible();
  },
);

test(
  "live observation reports the Windows requirement on other platforms",
  { tag: "@platform" },
  async ({ request, baseURL }) => {
    test.skip(process.platform === "win32", "Windows has the desktop observer");
    const response = await request.post("/api/grok/observe", {
      headers: {
        origin: new URL(baseURL!).origin,
        "x-office-observer": "desktop",
      },
    });
    expect(response.status()).toBe(503);
    expect(await response.json()).toEqual({
      error: "The desktop connection is available on Windows.",
    });
  },
);

type VisibleBot = {
  id: string;
  name: string;
  role?: string;
  task?: string;
  status?: string;
};

test("the desktop floor shows concurrent work, refreshes task labels in place and follows roster changes", async ({
  page,
}) => {
  test.setTimeout(75_000);
  let bots: VisibleBot[] = [
    {
      id: "a",
      name: "Juno",
      role: "Staff Copywriter",
      status: "Working",
      task: "Review the catalogue",
    },
    { id: "b", name: "Sales Lee", task: "Prepare the April proposal" },
    { id: "c", name: "Manager Jo" },
  ];
  let reads = 0;
  await page.route("**/api/grok/observe", async (route) => {
    reads++;
    expect(route.request().method()).toBe("POST");
    expect(route.request().headers()["x-office-observer"]).toBe("desktop");
    await route.fulfill({ json: { bots } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Connect Grok Bot" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(reads).toBe(0);
  await page.getByRole("button", { name: "Watch desktop team" }).click();
  await expect(page.getByText("Connected · Grok Bot desktop")).toBeVisible();
  const world = page.locator('[data-ready="true"]');
  await expect(world).toHaveAttribute("data-team-size", "3", {
    timeout: 30_000,
  });
  await expect(world).toHaveAttribute("data-head-offices", "1");
  await expect(world).toHaveAttribute("data-phase", "idle");
  await expect(
    page.getByRole("button", { name: /Copywriting Cathy/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Pause office|Edit sample team/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Manager Jo.*No activity shown/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: /Juno.*Copywriter.*Working · Review the catalogue/,
    }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Activity 2" }).click();
  await expect(
    page.getByRole("button", { name: /Sales Lee.*Prepare the April proposal/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /Juno.*Review the catalogue/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Juno’s desk" }),
  ).toBeVisible();
  const department = page.getByRole("combobox", { name: "Department" });
  const gender = page.getByRole("combobox", { name: "Avatar gender" });
  const junoRow = page.getByRole("button", { name: /^Juno/ });
  const junoSprite = junoRow.locator("[data-avatar]");
  await expect(department).toHaveValue("auto");
  await expect(gender).toHaveValue("auto");
  await expect(junoSprite).toHaveCSS("background-image", /avatar-neutral\.png/);
  await expect(page.getByText("Grok title · Staff Copywriter")).toBeVisible();

  const canvas = await page.locator("canvas").elementHandle();
  const [juno, lee, jo] = bots;
  bots = [lee, jo, { ...juno, task: "Revise the headline" }];
  await expect(
    page.getByRole("button", { name: /Juno.*Revise the headline/ }),
  ).toBeVisible({ timeout: 12_000 });
  expect(
    await canvas!.evaluate(
      (element) => element === document.querySelector("canvas"),
    ),
  ).toBe(true);
  await expect(world).toHaveAttribute("data-phase", "idle");
  await department.selectOption("Manager");
  await expect(world).toHaveAttribute("data-head-offices", "2");
  await expect(gender).toHaveValue("auto");
  await gender.selectOption("masculine");
  await expect(junoSprite).toHaveCSS(
    "background-image",
    /avatar-masculine\.png/,
  );
  await expect(junoRow).toContainText("Manager");
  bots = [
    lee,
    jo,
    {
      ...juno,
      role: "Human Resources Manager",
      task: "Check the onboarding list",
    },
  ];
  await expect(junoRow).toContainText("Check the onboarding list", {
    timeout: 12_000,
  });
  await expect(
    page.getByText("Grok title · Human Resources Manager"),
  ).toBeVisible();
  await expect(department).toHaveValue("Manager");
  await expect(gender).toHaveValue("masculine");
  await gender.selectOption("auto");
  await expect(junoSprite).toHaveCSS("background-image", /avatar-neutral\.png/);
  await expect(world).toHaveAttribute("data-head-offices", "2");
  await department.selectOption("auto");
  await expect(junoRow).toContainText("HR");
  await expect(world).toHaveAttribute("data-head-offices", "1");
  bots = [lee];
  await expect(world).toHaveAttribute("data-team-size", "1", {
    timeout: 15_000,
  });
  await expect(world).toHaveAttribute("data-head-offices", "0");
  await expect(page.getByRole("heading", { name: "Juno’s desk" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("tab", { name: "Activity 1" })).toBeVisible();
  await page.getByRole("button", { name: "Disconnect" }).click();
  await expect(
    page.getByText("Demo office · simulated activity"),
  ).toBeVisible();
  await expect(world).toHaveAttribute("data-team-size", "3");
  await expect(page.getByText("Prepare the April proposal")).toHaveCount(0);
  const readsAtDisconnect = reads;
  await page.waitForTimeout(6500);
  expect(reads).toBe(readsAtDisconnect);
});

test("a group chat can be excluded from the floor across polls and restored", async ({
  page,
}) => {
  let writerTask = "Review the draft";
  await page.route("**/api/grok/observe", (route) =>
    route.fulfill({
      json: {
        bots: [
          { id: "writer", name: "Writer Jean", task: writerTask },
          { id: "group", name: "Launch group", task: "Review launch dates" },
        ],
      },
    }),
  );
  await page.goto("/");
  await watchDesktop(page);
  const world = page.locator('[data-ready="true"]');
  await expect(world).toHaveAttribute("data-team-size", "2", {
    timeout: 30_000,
  });

  const choose = page.getByRole("button", { name: "Choose desks" });
  const dialog = page.getByRole("dialog", { name: "Choose desks" });
  const group = dialog.getByRole("checkbox", {
    name: "Launch group",
    exact: true,
  });
  const done = dialog.getByRole("button", { name: "Done" });
  await choose.click();
  await group.uncheck();
  await done.click();
  await expect(world).toHaveAttribute("data-team-size", "1");
  await expect(page.getByRole("button", { name: /^Launch group/ })).toHaveCount(
    0,
  );
  await page.getByRole("tab", { name: "Activity 1" }).click();
  writerTask = "Proofread the final copy";
  await expect(page.getByText(writerTask, { exact: true })).toBeVisible({
    timeout: 12_000,
  });
  await expect(page.getByText("Review launch dates")).toHaveCount(0);
  await expect(world).toHaveAttribute("data-team-size", "1");

  await choose.click();
  await expect(group).not.toBeChecked();
  await group.check();
  await done.click();
  await expect(world).toHaveAttribute("data-team-size", "2");
  await page.getByRole("tab", { name: "Activity 2" }).click();
  await expect(
    page.getByRole("button", { name: /Launch group.*Review launch dates/ }),
  ).toBeVisible();
});

test("an unreadable desktop clears stale work and retry handles an empty roster", async ({
  page,
}) => {
  test.setTimeout(45_000);
  let result: { bots: VisibleBot[] } | { error: string } = {
    bots: [{ id: "a", name: "Local artist", task: "Design the cover" }],
  };
  await page.route("**/api/grok/observe", (route) =>
    route.fulfill({ status: "error" in result ? 503 : 200, json: result }),
  );
  await page.goto("/");
  await watchDesktop(page);
  await expect(
    page.getByRole("button", { name: /Local artist.*Design the cover/ }),
  ).toBeVisible();
  result = { error: "Open the Grok Bot window." };
  const error = page.getByRole("main").getByRole("alert");
  await expect(error).toContainText("Open the Grok Bot window.", {
    timeout: 12_000,
  });
  await expect(page.getByText("Desktop unavailable")).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "On the floor 0" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Local artist|Copywriting Cathy/ }),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: "Activity 0" }).click();
  await expect(
    page.getByRole("heading", { name: "No activity reported" }),
  ).toBeVisible();
  result = { bots: [] };
  await page.getByRole("button", { name: "Retry now" }).click();
  await expect(page.getByText("No bots visible on this floor")).toBeVisible();
  await expect(error).toHaveCount(0);
  await expect(page.locator("canvas")).toHaveCount(0);
});

test("the office renders when WebGL is unavailable", async ({ page }) => {
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
});

test("sample roster edits resize the floor from one specialist to twelve occupied desks", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: /Edit sample team/ }).click();
  await page.getByRole("button", { name: "Remove teammate 3" }).click();
  await page.getByRole("button", { name: "Remove teammate 1" }).click();
  await page.getByLabel("Teammate 1", { exact: true }).fill("Support Ada");
  await expect(page.getByRole("combobox", { name: "Department" })).toHaveValue(
    "auto",
  );
  await expect(
    page.getByRole("combobox", { name: "Avatar gender" }),
  ).toHaveValue("auto");
  await page.getByRole("button", { name: "Apply team" }).click();
  const world = page.locator('[data-ready="true"]');
  await expect(world).toHaveAttribute("data-team-size", "1", {
    timeout: 30_000,
  });
  await expect(world).toHaveAttribute("data-rooms", "1");
  await expect(world).toHaveAttribute("data-head-offices", "0");
  await expect(world).toHaveAttribute("data-phase", "idle");
  const teammate = page.getByRole("button", { name: /^Support Ada/ });
  const sprite = teammate.locator("[data-avatar]");
  await expect(teammate).toHaveAccessibleName(/Support Ada.*Support/);
  await expect(sprite).toHaveCSS("background-image", /avatar-feminine\.png/);
  const originalDepth = Number(await world.getAttribute("data-floor-depth"));
  await teammate.click();
  const department = page.getByRole("combobox", { name: "Department" });
  const gender = page.getByRole("combobox", { name: "Avatar gender" });
  await gender.selectOption("masculine");
  await expect(sprite).toHaveCSS("background-image", /avatar-masculine\.png/);
  await expect(department).toHaveValue("auto");
  // The back of this single room contains the furniture, above the nameplate.
  const furniture = async () => {
    const canvas = world.locator("canvas");
    await canvas.scrollIntoViewIfNeeded();
    const bounds = (await canvas.boundingBox())!;
    return page.screenshot({
      clip: {
        x: bounds.x + bounds.width * 0.46,
        y: bounds.y + bounds.height * 0.26,
        width: bounds.width * 0.16,
        height: bounds.height * 0.15,
      },
    });
  };
  const supportFurniture = await furniture();
  await department.selectOption("Finance");
  await expect(teammate).toContainText("Finance");
  await expect(sprite).toHaveCSS("background-image", /avatar-masculine\.png/);
  await expect
    .poll(async () => (await furniture()).equals(supportFurniture))
    .toBe(false);
  await department.selectOption("auto");
  await expect(teammate).toHaveAccessibleName(/Support Ada.*Support/);
  await expect
    .poll(async () => (await furniture()).equals(supportFurniture))
    .toBe(true);
  await gender.selectOption("auto");
  await expect(sprite).toHaveCSS("background-image", /avatar-feminine\.png/);

  await page.getByRole("button", { name: /Edit sample team/ }).click();
  for (let i = 1; i < 12; i++)
    await page.getByRole("button", { name: /Add teammate/ }).click();
  await page.getByRole("button", { name: "Apply team" }).click();
  await expect(world).toHaveAttribute("data-team-size", "12");
  await expect(world).toHaveAttribute("data-rooms", "12");
  expect(Number(await world.getAttribute("data-floor-depth"))).toBeGreaterThan(
    originalDepth,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
