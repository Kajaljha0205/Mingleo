import { expect, test } from "@playwright/test";
import { MOCK_URL } from "./helpers";

const widths = [
  { width: 1440, height: 900, mobile: false },
  { width: 1280, height: 800, mobile: false },
  { width: 1024, height: 768, mobile: false },
  { width: 768, height: 1024, mobile: false },
  { width: 390, height: 844, mobile: true },
  { width: 375, height: 667, mobile: true },
];

for (const w of widths) {
  test.describe(`S01 Welcome @ ${w.width}px`, () => {
    test.use({ viewport: { width: w.width, height: w.height } });

    test("layout matches redesigned brand panel and sign-in card", async ({ page }) => {
      await page.goto("/");

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth, "no horizontal scroll").toBeLessThanOrEqual(w.width);

      const panel = page.getByTestId("brand-panel");
      await expect(panel).toBeVisible();
      await expect(
        panel.getByRole("heading", { level: 1, name: "Real people. Real plans." }),
      ).toBeVisible();
      await expect(
        panel.getByRole("img", { name: /Stylised map of Bengaluru/ }),
      ).toBeVisible();
      await expect(panel.getByRole("list", { name: "Sign-up steps" })).toHaveCount(0);

      const card = page.getByTestId("onboarding-card");
      const cardBox = (await card.boundingBox())!;
      const img = page.getByRole("img", { name: /Friends meeting in a park/ });

      if (w.mobile) {
        expect(cardBox.width).toBe(w.width);
        await expect(img).toBeHidden();
        await expect(card.getByText("Piloting in Bengaluru")).toBeVisible();
      } else {
        const panelBox = (await panel.boundingBox())!;
        expect(panelBox.width).toBeCloseTo(w.width * 0.55, -1);
        await expect(panel.getByText("Piloting in Bengaluru")).toBeVisible();
        await expect(img).toBeVisible();
        expect(cardBox.width).toBeLessThanOrEqual(520);
      }

      const h2 = page.getByRole("heading", { level: 2 });
      await expect(h2).toHaveText(/Find people\.\s*Do things together\./);
      expect(await h2.evaluate((el) => getComputedStyle(el).fontWeight)).toBe("800");

      await expect(page.getByRole("button")).toHaveCount(1);
      const cta = page.getByRole("button", { name: "Continue with Google" });
      await expect(cta).toBeVisible();
      const ctaBox = (await cta.boundingBox())!;
      expect(ctaBox.height).toBeGreaterThanOrEqual(52);
      expect(ctaBox.x).toBeGreaterThanOrEqual(0);
      expect(ctaBox.x + ctaBox.width).toBeLessThanOrEqual(w.width);

      await expect(
        page.getByText("By continuing you agree to our Terms and Privacy Policy."),
      ).toBeVisible();

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
