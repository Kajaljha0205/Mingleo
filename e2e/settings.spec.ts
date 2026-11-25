import { expect, test, type Page } from "@playwright/test";
import { expectNoHorizontalScroll, getState, seedOnboardedWithPeople, signIn } from "./helpers";

test.beforeEach(async ({ context }) => {
  await seedOnboardedWithPeople();
  await signIn(context);
});

const row = async () => (await getState()).row as unknown as Record<string, unknown>;
const sw = (page: Page, name: string) => page.getByRole("switch", { name, exact: true });

test.describe("S22 Settings", () => {
  test("opens from Profile; defaults; every change saves immediately and sticks", async ({ page }) => {
    await page.goto("/profile");
    await page.getByRole("link", { name: "Settings", exact: true }).filter({ visible: true }).click();
    await expect(page).toHaveURL("/settings");
    await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to Profile" }).filter({ visible: true })).toHaveAttribute("href", "/profile");
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Profile" })).toHaveAttribute("aria-current", "page");

    const location = page.getByRole("link", { name: /Location/ });
    await expect(location).toContainText("HSR Layout, Bengaluru");
    await expect(location).toHaveAttribute("href", "/location?from=settings");

    // Defaults (§9 S22, §12).
    await expect(page.getByRole("button", { name: "5 km", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(sw(page, "Show me in Discover")).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText("People nearby can find you and send requests")).toBeVisible();
    await expect(sw(page, "Show my age on profile")).toHaveAttribute("aria-checked", "true");
    await expect(page.getByLabel("Who sees my activity history")).toHaveValue("connections");
    for (const [name, on] of [
      ["Connection requests", "true"],
      ["New activities from connections", "true"],
      ["Join decisions and cancellations", "true"],
      ["When a request is declined", "false"],
    ]) {
      await expect(sw(page, name)).toHaveAttribute("aria-checked", on);
    }
    await expect(page.getByRole("button", { name: /Blocked people/ })).toContainText("None");
    await expect(page.getByRole("region", { name: "Account" })).toContainText("Google verified");

    await page.getByRole("button", { name: "10 km", exact: true }).click();
    await expect(page.getByRole("button", { name: "10 km", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect.poll(async () => (await row()).radius_km).toBe(10);
    await sw(page, "Show me in Discover").click();
    await expect(page.getByText("Hidden. Existing connections are unaffected")).toBeVisible();
    await expect.poll(async () => (await row()).discoverable).toBe(false);
    await sw(page, "Show my age on profile").click();
    await expect.poll(async () => (await row()).show_age).toBe(false);
    await page.getByLabel("Who sees my activity history").selectOption("only_me");
    await expect.poll(async () => (await row()).history_visibility).toBe("only_me");
    await sw(page, "When a request is declined").click();
    await expect.poll(async () => (await row()).notify_request_declined).toBe(true);
    await sw(page, "New activities from connections").click();
    await expect.poll(async () => (await row()).notify_new_activities).toBe(false);

    await page.reload();
    await expect(page.getByRole("button", { name: "10 km", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(sw(page, "Show me in Discover")).toHaveAttribute("aria-checked", "false");
    await expect(page.getByLabel("Who sees my activity history")).toHaveValue("only_me");
    await expect(sw(page, "When a request is declined")).toHaveAttribute("aria-checked", "true");

    // Radius applies straight away elsewhere (Discover chip).
    await page.goto("/discover");
    await expect(page.getByRole("link", { name: /^Location: HSR Layout, 10 km/ })).toBeVisible();
  });

  test("Location opens S06 in edit mode and comes back to Settings", async ({ page }) => {
    await page.goto("/location?from=settings");
    await expect(page.getByRole("link", { name: "Back to Settings" })).toHaveAttribute("href", "/settings");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL("/settings");
  });

  test("Blocked people list with Unblock (connection not restored)", async ({ page }) => {
    await page.goto("/people/p-meera?from=discover");
    await page.getByRole("button", { name: "More: report or block" }).click();
    await page.getByRole("button", { name: "Block Meera" }).click();
    await page.getByRole("dialog", { name: "Block Meera?" }).getByRole("button", { name: "Block" }).click();
    await expect.poll(async () => (await getState()).people.blocked).toEqual(["p-meera"]);

    await page.goto("/settings");
    await page.getByRole("button", { name: /Blocked people/ }).click();
    const sheet = page.getByRole("dialog", { name: "Blocked people" });
    await expect(sheet.getByRole("listitem")).toHaveText([/Meera/]);
    await expect(sheet).toContainText("Unblocking doesn't restore a connection.");
    await sheet.getByRole("button", { name: "Unblock Meera" }).click();
    await sheet.getByRole("group", { name: "Unblock Meera?" }).getByRole("button", { name: "Unblock", exact: true }).click();
    await expect(page.getByText("Meera is unblocked.")).toBeVisible();
    await expect(sheet).toContainText("You haven't blocked anyone.");
    await expect.poll(async () => (await getState()).people.blocked).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: /Blocked people/ })).toContainText("None");
  });

  test("Log out → S01", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL("/");
  });
});

const widths = [
  { width: 1440, height: 900, mobile: false },
  { width: 1024, height: 768, mobile: false },
  { width: 768, height: 1024, mobile: false },
  { width: 390, height: 844, mobile: true },
];

for (const w of widths) {
  test.describe(`S22 / DLG layout @ ${w.width}px`, () => {
    test.use({ viewport: { width: w.width, height: w.height } });

    test("S22 Settings", async ({ page }) => {
      await page.goto("/settings");
      await expect(sw(page, "Show me in Discover")).toBeVisible();
      await expectNoHorizontalScroll(page, w.width);
      for (const name of ["2 km", "25 km", "Log out"]) {
        const b = (await page.getByRole("button", { name, exact: true }).boundingBox())!;
        expect(b.height).toBeGreaterThanOrEqual(44);
        expect(b.x + b.width).toBeLessThanOrEqual(w.width);
      }
      const card = (await page.getByRole("region", { name: "Discovery" }).boundingBox())!;
      expect(card.width).toBeLessThanOrEqual(760);
      if (w.mobile) {
        await expect(page.getByRole("link", { name: "Back to Profile" }).filter({ visible: true })).toHaveCount(1); // header circle
        await page.getByRole("button", { name: "Log out" }).scrollIntoViewIfNeeded();
        const bar = (await page.getByRole("navigation", { name: "Main" }).boundingBox())!;
        const logout = (await page.getByRole("button", { name: "Log out" }).boundingBox())!;
        expect(logout.y + logout.height).toBeLessThanOrEqual(bar.y);
      } else {
        await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
      }
      await page.screenshot({ path: `test-results/s22-${w.width}.png`, fullPage: true });
    });

    test("DLG report + block dialogs", async ({ page }) => {
      await page.goto("/people/p-meera?from=discover");
      for (const [item, title] of [
        ["Report Meera", "Report Meera"],
        ["Block Meera", "Block Meera?"],
      ]) {
        await page.getByRole("button", { name: "More: report or block" }).click();
        await page.getByRole("button", { name: item }).click();
        const dialog = page.getByRole("dialog", { name: title });
        await expect(dialog).toBeVisible();
        const box = (await dialog.boundingBox())!;
        if (w.mobile) {
          // Bottom sheet: full width, anchored to the bottom.
          expect(Math.round(box.width)).toBe(w.width);
          expect(Math.round(box.y + box.height)).toBe(w.height);
        } else {
          // Centred 520 px dialog.
          expect(Math.round(box.width)).toBe(520);
          expect(Math.abs(box.x + box.width / 2 - w.width / 2)).toBeLessThan(2);
        }
        for (const b of await dialog.getByRole("button").all()) {
          expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        }
        await page.screenshot({ path: `test-results/dlg-${item.split(" ")[0].toLowerCase()}-${w.width}.png` });
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
      }
    });
  });
}
