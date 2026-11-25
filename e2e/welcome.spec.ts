import { expect, test } from "@playwright/test";
import { MOCK_URL } from "./helpers";

const widths = [
  { width: 1440, height: 900, headline: 36, panel: true, card: true },
  { width: 1280, height: 800, headline: 36, panel: true, card: true },
  { width: 1024, height: 768, headline: 36, panel: true, card: true },
  { width: 768, height: 1024, headline: 30, panel: false, card: true },
  { width: 390, height: 844, headline: 26, panel: false, card: false },
  { width: 375, height: 667, headline: 26, panel: false, card: false },
];

for (const w of widths) {
  test.describe(`S01 Welcome @ ${w.width}px`, () => {
    test.use({ viewport: { width: w.width, height: w.height } });

    test("layout matches V4 artboard rules", async ({ page }) => {
      await page.goto("/");

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth, "no horizontal scroll").toBeLessThanOrEqual(w.width);

      const panel = page.getByTestId("brand-panel");
      if (w.panel) {
        await expect(panel).toBeVisible();
        const box = (await panel.boundingBox())!;
        expect(box.width).toBeCloseTo(Math.min(w.width * 0.42, 580), 0);
        await expect(panel.getByText("Real people.")).toBeVisible();
        await expect(panel.getByText("Piloting in Bengaluru")).toBeVisible();
      } else {
        await expect(panel).toBeHidden();
      }

      const card = page.getByTestId("onboarding-card");
      const cardBox = (await card.boundingBox())!;
      const cardBg = await card.evaluate((el) => getComputedStyle(el).backgroundColor);
      if (w.card) {
        expect(cardBg).toBe("rgb(255, 255, 255)");
        expect(cardBox.width).toBeLessThanOrEqual(560);
        expect(cardBox.y).toBeGreaterThan(0);
      } else {
        expect(cardBox.width).toBe(w.width);
      }

      const h1 = page.getByRole("heading", { level: 1 });
      await expect(h1).toHaveText(/Find people\.\s*Do things together\./);
      const size = await h1.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      expect(size).toBe(w.headline);
      expect(await h1.evaluate((el) => getComputedStyle(el).fontWeight)).toBe("800");

      const img = page.getByRole("img", { name: /Friends meeting in a park/ });
      await expect(img).toBeVisible();
      expect((await img.boundingBox())!.height).toBe(260);
      expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);

      await expect(page.getByRole("button")).toHaveCount(1);
      const cta = page.getByRole("button", { name: "Continue with Google" });
      await expect(cta).toBeInViewport();
      const ctaBox = (await cta.boundingBox())!;
      expect(ctaBox.height).toBeGreaterThanOrEqual(52);
      expect(ctaBox.x).toBeGreaterThanOrEqual(0);
      expect(ctaBox.x + ctaBox.width).toBeLessThanOrEqual(w.width);
      expect(await cta.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
        "rgb(30, 121, 164)",
      );

      await expect(
        page.getByText("By continuing you agree to our Terms and Privacy Policy."),
      ).toBeInViewport();

      await page.screenshot({ path: `test-results/s01-${w.width}.png`, fullPage: true });
    });

    test("Continue with Google starts Supabase Google OAuth", async ({ page }) => {
      // Redirect targets aren't routable in Playwright, so assert on the 303 itself.
      await page.route(`${MOCK_URL}/**`, (route) => route.abort());
      await page.goto("/");
      const [response] = await Promise.all([
        page.waitForResponse(
          (r) => r.url().endsWith("/auth/google") && r.request().method() === "POST",
        ),
        page.getByRole("button", { name: "Continue with Google" }).click(),
      ]);
      expect(response.status()).toBe(303);
      const authorizeUrl = new URL(response.headers()["location"]);
      expect(authorizeUrl.origin + authorizeUrl.pathname).toBe(
        `${MOCK_URL}/auth/v1/authorize`,
      );
      expect(authorizeUrl.searchParams.get("provider")).toBe("google");
      expect(authorizeUrl.searchParams.get("redirect_to")).toMatch(/\/auth\/google\/callback$/);
      expect(authorizeUrl.searchParams.get("code_challenge")).toBeTruthy();
    });

    test("keyboard focus shows a visible ring on the CTA", async ({ page }) => {
      await page.goto("/");
      await page.keyboard.press("Tab");
      const cta = page.getByRole("button", { name: "Continue with Google" });
      await expect(cta).toBeFocused();
      expect(await cta.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe("solid");
    });
  });
}
