import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import {
  COMPLETE_ABOUT,
  expectNoHorizontalScroll,
  getState,
  setState,
  signIn,
} from "./helpers";

test.describe("onboarding guards", () => {
  test("signed-out visitors are sent back to S01", async ({ page }) => {
    await page.goto("/onboarding/about");
    await expect(page).toHaveURL("/");
  });

  test("signed-in users land on their first incomplete step and can't skip ahead", async ({
    page,
    context,
  }) => {
    await setState({ ...COMPLETE_ABOUT });
    await signIn(context);
    await page.goto("/");
    await expect(page).toHaveURL("/onboarding/photo");
    await page.goto("/onboarding/review");
    await expect(page).toHaveURL("/onboarding/photo");
    await page.goto("/onboarding/about");
    await expect(page.getByLabel("First name")).toHaveValue("Aarav");
  });

  test("under-18 user can delete their account and is signed out (Q-25)", async ({ page, context }) => {
    await setState({ first_name: "Aarav" });
    await signIn(context);
    await page.goto("/onboarding/about");
    await page.getByLabel("Birthday").fill("01012015");
    await page.getByRole("button", { name: "Delete my account" }).click();
    await expect(page).toHaveURL("/?account=deleted");
    await expect(page.getByRole("status")).toHaveText(
      "Your account has been deleted. You need to be 18 or older to use Mingleo.",
    );
    expect((await getState()).row).toMatchObject({ deleted: true });
    await page.goto("/onboarding/about");
    await expect(page).toHaveURL("/");
  });

  test("Sign out on the first step returns to S01 (Q-27)", async ({ page, context }) => {
    await setState({ first_name: "Aarav" });
    await signIn(context);
    await page.goto("/onboarding/about");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL("/");
    await page.goto("/onboarding/about");
    await expect(page).toHaveURL("/");
  });
});

test("full sign-up journey S03 → S07 (390 px)", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setState({ first_name: "Aarav" });
  await signIn(context);

  // S03
  await page.goto("/");
  await expect(page).toHaveURL("/onboarding/about");
  await expect(page.getByText("1/5")).toBeVisible();
  await expect(page.getByLabel("First name")).toHaveValue("Aarav");
  const cont = page.getByRole("button", { name: "Continue" });
  await expect(cont).toBeDisabled();
  await page.getByLabel("Birthday").fill("01012012");
  await expect(page.getByText(/18 or older to use Mingleo\. If you continue, your account will be deleted\./)).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete my account" })).toBeVisible();
  await page.getByLabel("Birthday").fill("01021998");
  await page.getByLabel("Short bio").fill(COMPLETE_ABOUT.bio);
  await expect(page.getByText(`${COMPLETE_ABOUT.bio.length} / 150`)).toBeVisible();
  await cont.click();

  // S04
  await expect(page).toHaveURL("/onboarding/photo");
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  const png = await sharp({
    create: { width: 600, height: 800, channels: 3, background: "#f4dfa7" },
  })
    .png()
    .toBuffer();
  await page
    .getByTestId("gallery-input")
    .setInputFiles({ name: "me.png", mimeType: "image/png", buffer: png });
  await expect(page.getByRole("img", { name: "Your profile photo" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  // S05
  await expect(page).toHaveURL("/onboarding/interests");
  for (const name of ["Badminton", "Poker", "PS5 / Gaming"]) {
    await page.getByRole("button", { name }).click();
  }
  await expect(page.getByText("Great, that's enough")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  // S06
  await expect(page).toHaveURL("/onboarding/location");
  await page.getByRole("button", { name: "Choose an area" }).click();
  await page.getByLabel("Choose an area").fill("hsr");
  await page.getByRole("button", { name: "HSR Layout" }).click();
  await expect(page.getByText("HSR Layout, Bengaluru")).toBeVisible();
  await page.getByRole("button", { name: "10 km" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  // S07
  await expect(page).toHaveURL("/onboarding/review");
  await expect(page.getByRole("heading", { name: "Looking good, Aarav" })).toBeVisible();
  const card = page.getByTestId("profile-card");
  await expect(card.getByRole("heading", { name: /^Aarav, \d+$/ })).toBeVisible();
  await expect(card.getByText("Google verified")).toBeVisible();
  await expect(card.getByText("HSR Layout · discovering within 10 km")).toBeVisible();
  await expect(card.getByRole("listitem")).toHaveText(["Badminton", "Poker", "PS5 / Gaming"]);

  // Edit interests returns to review
  await page.getByRole("link", { name: "Edit interests" }).click();
  await expect(page).toHaveURL("/onboarding/interests?from=review");
  await page.getByRole("button", { name: "Hiking" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL("/onboarding/review");
  await expect(card.getByRole("listitem")).toHaveCount(4);

  await page.getByRole("button", { name: "Looks good, let\u2019s go" }).click();
  await expect(page).toHaveURL("/discover");
  const { row, interestIds, files } = await getState();
  expect(row.onboarding_completed_at).toBeTruthy();
  expect(row.birth_date).toBe("1998-02-01");
  expect(row.area_name).toBe("HSR Layout");
  expect(row.radius_km).toBe(10);
  expect(interestIds.sort((a, b) => a - b)).toEqual([1, 3, 5, 6]);
  expect(files).toHaveLength(1);
});

// ---------- Layout at the four required widths ----------

const widths = [
  { width: 1440, height: 900, title: 36, panel: true, card: true },
  { width: 1024, height: 768, title: 36, panel: true, card: true },
  { width: 768, height: 1024, title: 30, panel: false, card: true },
  { width: 390, height: 844, title: 26, panel: false, card: false },
];

const screens = [
  { path: "/onboarding/about", step: 1, title: "A little about you", cta: "Continue" },
  { path: "/onboarding/photo", step: 2, title: "Add a photo of you", cta: "Continue" },
  { path: "/onboarding/interests", step: 3, title: "What are you into?", cta: "Continue" },
  { path: "/onboarding/location", step: 4, title: "Where should we look?", cta: "Continue" },
  { path: "/onboarding/review", step: 5, title: "Looking good, Aarav", cta: "Looks good, let\u2019s go" },
];

async function checkLayout(page: Page, w: (typeof widths)[number], s: (typeof screens)[number]) {
  await page.goto(s.path);
  await expect(page).toHaveURL(s.path);
  const h1 = page.getByRole("heading", { level: 1, name: s.title });
  await expect(h1).toBeVisible();
  expect(await h1.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBe(w.title);
  await expectNoHorizontalScroll(page, w.width);

  await expect(page.getByText(`${s.step}/5`)).toBeVisible();
  const back = page.getByRole("link", { name: "Back" });
  if (s.step === 1) {
    await expect(back).toHaveCount(0);
    expect((await page.getByRole("button", { name: "Sign out" }).boundingBox())!.width).toBeGreaterThanOrEqual(44);
  } else expect((await back.boundingBox())!.width).toBeGreaterThanOrEqual(44);

  const panel = page.getByTestId("brand-panel");
  if (w.panel) {
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("listitem")).toHaveCount(5);
    await expect(panel.getByLabel("Completed")).toHaveCount(s.step - 1);
  } else {
    await expect(panel).toBeHidden();
  }

  const card = page.getByTestId("onboarding-card");
  const cardBox = (await card.boundingBox())!;
  if (w.card) expect(cardBox.width).toBeLessThanOrEqual(560);
  else expect(cardBox.width).toBe(w.width);

  const cta = page.getByRole("button", { name: s.cta });
  if (!w.card) await expect(cta).toBeInViewport(); // sticky on mobile
  else await cta.scrollIntoViewIfNeeded();
  const box = (await cta.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(52);
  expect(box.x + box.width).toBeLessThanOrEqual(w.width);

  await page.screenshot({
    path: `test-results/s0${s.step + 2}-${w.width}.png`,
    fullPage: true,
  });
}

for (const w of widths) {
  test.describe(`S03–S07 layout @ ${w.width}px`, () => {
    test.use({ viewport: { width: w.width, height: w.height } });

    for (const s of screens) {
      test(`${s.title}`, async ({ page, context }) => {
        // Seed everything up to (not including) this step so the guard lets us in.
        await setState(
          {
            first_name: "Aarav",
            ...(s.step > 1 ? COMPLETE_ABOUT : {}),
            photo_path: s.step > 2 ? "u1/seed.webp" : null,
            area_name: s.step > 4 ? "HSR Layout" : null,
            city: s.step > 4 ? "Bengaluru" : null,
          },
          s.step > 3 ? [1, 3, 5, 6] : [],
        );
        await signIn(context);
        await checkLayout(page, w, s);
      });
    }
  });
}
