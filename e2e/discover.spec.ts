import { expect, test, type Page } from "@playwright/test";
import { COMPLETE_ABOUT, expectNoHorizontalScroll, getState, seedOnboardedWithPeople, setState, signIn } from "./helpers";

test.describe("S08/S09 guards", () => {
  test("signed-out visitors go to S01", async ({ page }) => {
    await page.goto("/discover");
    await expect(page).toHaveURL("/");
    await page.goto("/people/p-meera");
    await expect(page).toHaveURL("/");
  });

  test("unfinished users resume onboarding", async ({ page, context }) => {
    await setState({ ...COMPLETE_ABOUT });
    await signIn(context);
    await page.goto("/discover");
    await expect(page).toHaveURL("/onboarding/photo");
  });

  test("unknown people get the friendly 404", async ({ page, context }) => {
    await seedOnboardedWithPeople();
    await signIn(context);
    await page.goto("/people/nobody");
    await expect(page.getByRole("heading", { name: "We couldn\u2019t find that" })).toBeVisible();
  });
});

test.describe("S08 Discover", () => {
  test.beforeEach(async ({ context }) => {
    await seedOnboardedWithPeople();
    await signIn(context);
  });

  test("Connect, Skip, empty state and Start over", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/discover");
    const card = page.getByTestId("discover-card");
    await expect(card).toHaveAttribute("aria-label", "Ananya");
    await expect(page.getByText("You both know Rohan")).toBeVisible();

    await page.getByRole("button", { name: "Connect" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Request sent to Ananya. It shows as Pending until they accept." })).toBeVisible();
    await expect(card).toHaveAttribute("aria-label", "Meera");
    await expect(page.getByText("You both know Rohan and Sneha")).toBeVisible();

    await page.getByRole("button", { name: "Skip" }).focus();
    await page.keyboard.press("Enter");
    await expect(card).toHaveAttribute("aria-label", "Aarav");
    await page.getByRole("button", { name: "Skip" }).click();

    await expect(page.getByRole("heading", { name: "You\u2019re all caught up" })).toBeVisible();
    expect((await getState()).people.sent).toEqual(["p-ananya"]);

    await page.getByRole("button", { name: "Start over" }).click();
    await expect(card).toHaveAttribute("aria-label", "Meera"); // skipped come back; Ananya is pending
  });

  test("swipe right connects and left skips", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/discover");
    const surface = page.getByTestId("swipe-surface");
    await expect(surface).toBeVisible();
    const box = (await surface.boundingBox())!;
    const y = box.y + 200;
    const swipe = async (dx: number) => {
      await page.mouse.move(box.x + box.width / 2, y);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + dx / 2, y, { steps: 5 });
      await page.mouse.move(box.x + box.width / 2 + dx, y, { steps: 5 });
      await page.mouse.up();
    };
    await swipe(60); // too short → snaps back
    await expect(page.getByTestId("discover-card")).toHaveAttribute("aria-label", "Ananya");
    await expect(page).toHaveURL("/discover");
    await swipe(180);
    await expect(page.getByTestId("discover-card")).toHaveAttribute("aria-label", "Meera");
    await swipe(-180);
    await expect(page.getByTestId("discover-card")).toHaveAttribute("aria-label", "Aarav");
    const { people } = await getState();
    expect(people.sent).toEqual(["p-ananya"]);
  });

  test("interest filter narrows the deck", async ({ page }) => {
    await page.goto("/discover");
    await page.getByRole("button", { name: "All my interests" }).click();
    const sheet = page.getByRole("dialog", { name: "Show people who like" });
    await sheet.getByRole("link", { name: "Badminton" }).click();
    await expect(page).toHaveURL("/discover?interest=badminton");
    await expect(page.getByRole("button", { name: "Badminton" })).toBeVisible();
    await expect(page.getByTestId("discover-card")).toHaveAttribute("aria-label", "Meera");
  });

  test("location chip opens S06 in edit mode and Save returns to Discover", async ({ page }) => {
    await page.goto("/discover");
    await page.getByRole("link", { name: /Location: HSR Layout, 5 km/ }).click();
    await expect(page).toHaveURL("/location?from=discover");
    await expect(page.getByRole("progressbar")).toHaveCount(0);
    await page.getByRole("button", { name: "10 km" }).click();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL("/discover");
    await expect(page.getByRole("link", { name: /Location: HSR Layout, 10 km/ })).toBeVisible();
  });

  test("a smaller radius updates the deck at once, and reopening shows the saved radius", async ({ page }) => {
    await page.goto("/discover");
    await expect(page.getByTestId("discover-card")).toHaveAttribute("aria-label", "Ananya");

    await page.getByRole("link", { name: /Location:/ }).click();
    await page.getByRole("button", { name: "25 km" }).click();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("link", { name: /25 km/ })).toBeVisible();

    await page.getByRole("link", { name: /Location:/ }).click();
    await expect(page.getByRole("button", { name: "25 km" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "2 km" }).click();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("link", { name: /2 km/ })).toBeVisible();
    // Only Aarav (0.4 km) is within 2 km.
    await expect(page.getByTestId("discover-card")).toHaveAttribute("aria-label", "Aarav");

    await page.getByRole("link", { name: /Location:/ }).click();
    await expect(page.getByRole("button", { name: "2 km" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "25 km" })).toHaveAttribute("aria-pressed", "false");
  });

  test("someone requested from their profile is gone from the deck on return", async ({ page }) => {
    await page.goto("/discover");
    await expect(page.getByTestId("discover-card")).toHaveAttribute("aria-label", "Ananya");
    await page.getByRole("link", { name: "View full profile" }).click();
    // Wait for S09 so "Connect" can't resolve to the deck button mid-navigation.
    await expect(page.getByRole("heading", { level: 1, name: "Ananya, 28" })).toBeVisible();
    await page.getByRole("button", { name: "Connect" }).click();
    await expect(page.getByRole("button", { name: "Pending" })).toBeVisible();
    await page.getByRole("link", { name: "Back to Discover" }).click();
    await expect(page).toHaveURL("/discover");
    await expect(page.getByTestId("discover-card")).toHaveAttribute("aria-label", "Meera");
  });
});

test.describe("S09 Person profile", () => {
  test.beforeEach(async ({ context }) => {
    await seedOnboardedWithPeople();
    await signIn(context);
  });

  test("opens from the card; Connect → Pending → Withdraw", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto("/discover");
    await page.getByRole("link", { name: "About Ananya" }).click();
    await expect(page).toHaveURL("/people/p-ananya?from=discover");
    await expect(page.getByRole("heading", { level: 1, name: "Ananya, 28" })).toBeVisible();
    await expect(page.getByText("BTM Layout · 2.5 km away")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Interests · 2 shared" })).toBeVisible();
    await expect(page.getByText("1 mutual connection:")).toBeVisible();

    await page.getByRole("button", { name: "Connect" }).click();
    await expect(page.getByText("Request sent. We\u2019ll tell you when Ananya accepts.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Pending" })).toBeDisabled();
    await page.getByRole("button", { name: "Withdraw" }).click();
    await expect(page.getByRole("button", { name: "Connect" })).toBeVisible();

    await page.getByRole("link", { name: "Back to Discover" }).click();
    await expect(page).toHaveURL("/discover");
  });

  test("received request → Accept → Connected + Message", async ({ page }) => {
    await page.goto("/people/p-kabir?from=discover");
    await page.getByRole("button", { name: "Accept" }).click();
    await expect(page.getByText("Connected", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Message", exact: true })).toHaveAttribute("href", "/chats/with/p-kabir");
    expect((await getState()).people.connected).toContain("p-kabir");
  });

  test("report and block from More", async ({ page }) => {
    await page.goto("/people/p-meera?from=discover");
    await page.getByRole("button", { name: "More: report or block" }).click();
    await page.getByRole("button", { name: "Report Meera" }).click();
    const report = page.getByRole("dialog", { name: "Report Meera" });
    await report.getByLabel("Fake profile").check();
    await report.getByRole("button", { name: "Send report" }).click();
    await expect(page.getByText("Thanks. We\u2019ll review your report.")).toBeVisible();

    await page.getByRole("button", { name: "More: report or block" }).click();
    await page.getByRole("button", { name: "Block Meera" }).click();
    await page.getByRole("dialog", { name: "Block Meera?" }).getByRole("button", { name: "Block" }).click();
    await expect(page).toHaveURL("/discover");
    const state = (await getState()).people;
    expect(state.blocked).toEqual(["p-meera"]);
    expect(state.reports).toEqual([expect.objectContaining({ p_id: "p-meera", p_reason: "fake_profile" })]);
    await page.goto("/people/p-meera");
    await expect(page.getByRole("heading", { name: "We couldn\u2019t find that" })).toBeVisible();
  });
});

// ---------- Layout at the four required widths ----------

const widths = [
  { width: 1440, height: 900, desktop: true, mobile: false },
  { width: 1024, height: 768, desktop: true, mobile: false },
  { width: 768, height: 1024, desktop: false, mobile: false },
  { width: 390, height: 844, desktop: false, mobile: true },
];

async function checkChrome(page: Page, w: (typeof widths)[number], detailPage = false) {
  await expectNoHorizontalScroll(page, w.width);
  const topNav = page.getByRole("navigation", { name: "Main" });
  await expect(topNav.getByRole("link", { name: "Discover" })).toHaveAttribute("aria-current", "page");
  await expect(topNav.getByRole("link")).toHaveCount(4);
  if (w.mobile) {
    const bar = (await topNav.boundingBox())!;
    expect(bar.y + bar.height).toBeCloseTo(w.height, 0);
  } else {
    expect((await topNav.boundingBox())!.y).toBeLessThan(72);
  }
  // Mobile detail pages show back + name instead of bell/messages (§5).
  if (!(w.mobile && detailPage)) await expect(page.locator("[data-testid=unread-dot]:visible")).toHaveCount(1);
}

for (const w of widths) {
  test.describe(`S08/S09 layout @ ${w.width}px`, () => {
    test.use({ viewport: { width: w.width, height: w.height } });
    test.beforeEach(async ({ context }) => {
      await seedOnboardedWithPeople();
      await signIn(context);
    });

    test("S08 Discover", async ({ page }) => {
      await page.goto("/discover");
      await expect(page.getByTestId("discover-card")).toBeVisible();
      await checkChrome(page, w);
      const card = page.getByTestId("discover-card");
      await expect(card).toBeVisible();
      const photo = card.getByRole("link", { name: "Open Ananya's profile" });
      expect((await photo.boundingBox())!.height).toBe(360);
      const cardBox = (await card.boundingBox())!;
      expect(cardBox.width).toBeLessThanOrEqual(480);

      const about = page.getByRole("region", { name: "About Ananya" });
      const aboutBox = (await about.boundingBox())!;
      if (w.mobile) {
        await expect(page.getByRole("heading", { level: 1, name: "Discover people" })).toBeAttached();
        expect(aboutBox.y).toBeGreaterThan(cardBox.y + cardBox.height); // inline below
      } else {
        await expect(page.getByRole("heading", { level: 1, name: "Discover people" })).toBeVisible();
        expect(aboutBox.x).toBeGreaterThan(cardBox.x + cardBox.width - 1); // side panel
      }

      for (const name of ["Skip", "Connect"]) {
        const b = (await page.getByRole("button", { name }).boundingBox())!;
        expect(b.width).toBeGreaterThanOrEqual(44);
        expect(b.x + b.width).toBeLessThanOrEqual(w.width);
      }
      if (w.mobile) {
        // Skip/Connect must not end up hidden behind the bottom bar once scrolled to.
        await page.getByRole("button", { name: "Connect" }).scrollIntoViewIfNeeded();
        const bar = (await page.getByRole("navigation", { name: "Main" }).boundingBox())!;
        const btn = (await page.getByRole("button", { name: "Connect" }).boundingBox())!;
        expect(btn.y + btn.height).toBeLessThanOrEqual(bar.y);
      }
      await page.screenshot({ path: `test-results/s08-${w.width}.png`, fullPage: true });
    });

    test("S09 Person profile", async ({ page }) => {
      await page.goto("/people/p-meera?from=discover");
      await expect(page.getByRole("heading", { level: 1, name: "Meera, 27" })).toBeVisible();
      await checkChrome(page, w, true);
      const photo = page.getByTestId("person-photo");
      const photoBox = (await photo.boundingBox())!;
      expect(photoBox.height).toBe(380);
      const details = page.getByRole("heading", { level: 1 });
      const detailsBox = (await details.boundingBox())!;
      if (w.mobile) {
        expect(detailsBox.y).toBeGreaterThan(photoBox.y + photoBox.height);
        await expect(page.getByRole("link", { name: "Back to Discover" })).toHaveCount(1); // header circle
      } else {
        expect(detailsBox.x).toBeGreaterThan(photoBox.x + photoBox.width - 1);
        await expect(page.getByRole("link", { name: "Back to Discover" })).toBeVisible();
      }
      const connect = (await page.getByRole("button", { name: "Connect" }).boundingBox())!;
      expect(connect.height).toBeGreaterThanOrEqual(52);
      const more = (await page.getByRole("button", { name: "More: report or block" }).boundingBox())!;
      expect(more.width).toBeGreaterThanOrEqual(44);
      expect(more.x + more.width).toBeLessThanOrEqual(w.width);
      await expect(page.getByTestId("mutual")).toContainText("2 mutual connections: Rohan, Sneha");
      await page.screenshot({ path: `test-results/s09-${w.width}.png`, fullPage: true });
    });
  });
}
