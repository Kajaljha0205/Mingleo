import { expect, test, type Page } from "@playwright/test";
import { expectNoHorizontalScroll, getState, seedOnboardedWithPeople, signIn } from "./helpers";

// Viewer Aarav (HSR Layout, 5 km). Rohan + Sneha connected; Kabir asked to connect; Kabir + Meera asked to join Poker Night.
test.beforeEach(async ({ context }) => {
  await seedOnboardedWithPeople();
  await signIn(context);
});

const seg = (page: Page, name: RegExp) =>
  page.getByRole("navigation", { name: "Inbox" }).filter({ visible: true }).getByRole("link", { name });

test.describe("S20 Inbox", () => {
  test("bell → Notifications: Needs your reply + Earlier; viewing marks them read", async ({ page }) => {
    await page.goto("/discover");
    await expect(page.locator("[data-testid=unread-dot]:visible")).toHaveCount(1);
    await page.getByRole("link", { name: "Notifications, 3 unread" }).filter({ visible: true }).click();
    await expect(page).toHaveURL("/inbox");
    await expect(page.getByRole("heading", { level: 1, name: "Inbox" })).toBeAttached();
    await expect(seg(page, /^Notifications · 3$/)).toHaveAttribute("aria-current", "page");
    await expect(seg(page, /^Chats · 1$/)).toBeVisible();

    const reply = page.getByRole("region", { name: "Needs your reply" });
    await expect(reply.getByTestId("connection-request")).toContainText("Kabir wants to connect");
    await expect(reply.getByTestId("connection-request")).toContainText("3.4 km · 2h ago");
    await expect(reply.getByRole("heading", { name: /asked to join/ })).toHaveText([
      "Kabir asked to join Poker Night",
      "Meera asked to join Poker Night",
    ]);
    await expect(reply.getByRole("link", { name: "Review Kabir's request to join Poker Night" })).toHaveAttribute(
      "href",
      "/activities/a-mine/manage",
    );

    const earlier = page.getByRole("region", { name: "Earlier" });
    await expect(earlier.getByRole("link")).toHaveText([
      /Sneha accepted your connection request/,
      /You’re in Nandi Hills sunrise hike.*Sneha accepted/,
      /Rohan created Early swim at the club.*Matches your interests/,
    ]);
    await expect(earlier.getByRole("link", { name: /Rohan created/ })).toHaveAttribute("href", "/activities/a-swim?from=inbox");
    await expect(earlier.getByRole("link", { name: /You’re in/ })).toHaveAttribute("href", "/activities/a-hike/chat");

    await expect(async () => {
      await page.reload();
      await expect(seg(page, /^Notifications · 0$/)).toBeVisible({ timeout: 1000 });
    }).toPass();
    await expect(page.locator("[data-testid=unread-dot]:visible")).toHaveCount(0);
  });

  test("Accept inline → connected; Decline → Undo brings the request back", async ({ page }) => {
    await page.goto("/inbox");
    const card = page.getByTestId("connection-request").filter({ visible: true });
    await card.getByRole("button", { name: "Decline Kabir" }).click();
    await expect(page.getByText("Request declined.")).toBeVisible();
    await expect(card).toHaveCount(0);
    await page.getByRole("button", { name: /Undo/ }).click();
    await expect(card).toContainText("Kabir wants to connect");
    await expect.poll(async () => (await getState()).people.received).toContain("p-kabir");

    await card.getByRole("button", { name: "Accept Kabir" }).click();
    await expect(page.getByText("You’re now connected with Kabir.")).toBeVisible();
    await expect(card).toHaveCount(0);
    await expect.poll(async () => (await getState()).people.connected).toContain("p-kabir");
  });

  test("Chats tab: rows by latest message, previews, unread badge; opening a chat clears it", async ({ page }) => {
    await page.goto("/activities");
    await expect(page.locator("[data-testid=unread-chats-dot]:visible")).toHaveCount(1);
    await page.getByRole("link", { name: "Messages, 1 unread" }).filter({ visible: true }).click();
    await expect(page).toHaveURL("/inbox?tab=chats");
    await expect(seg(page, /^Chats · 1$/)).toHaveAttribute("aria-current", "page");
    await expect(page.getByText("You can message connections directly, and anyone you're doing an activity with in its group chat.")).toBeVisible();
    const rows = page.getByTestId("chat-row").filter({ visible: true });
    await expect(rows.first()).toContainText("Rohan");
    await expect(rows.first()).toContainText("Hey! Up for a swim this week?");
    await expect(rows.first().getByLabel("1 unread")).toBeVisible();
    await expect(rows.filter({ hasText: "Nandi Hills sunrise hike" })).toContainText("You: See you there!");
    await expect(rows.filter({ hasText: "Friday board games" })).toContainText("Meera: Thanks for coming, everyone!");
    await expect(rows.filter({ hasText: "Sneha" })).toContainText("No messages yet");

    await rows.first().click();
    await expect(page).toHaveURL("/chats/d-p-rohan");
    await expect(page.getByTestId("message").filter({ visible: true })).toContainText(["Hey! Up for a swim this week?"]);
    await page.waitForTimeout(1200); // ChatRoom marks read 800 ms after opening
    await expect(async () => {
      await page.goto("/inbox?tab=chats");
      await expect(seg(page, /^Chats · 0$/)).toBeVisible({ timeout: 1000 });
    }).toPass();
    await expect(page.locator("[data-testid=unread-chats-dot]:visible")).toHaveCount(0);
  });
});

test.describe("S21 My profile", () => {
  test("card, about, interests, stats, connections row and My activities tabs", async ({ page }) => {
    await page.goto("/activities");
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Profile" }).click();
    await expect(page).toHaveURL("/profile");
    await expect(page.getByRole("heading", { level: 1, name: "Aarav, 28" })).toBeVisible();
    await expect(page.getByRole("img", { name: "Google verified" }).first()).toBeVisible();
    await expect(page.getByText("HSR Layout, Bengaluru", { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(page.getByText("New to Bengaluru, product designer.", { exact: false })).toBeVisible();
    await expect(page.getByRole("list", { name: "Your interests" }).getByRole("listitem")).toHaveText(["Badminton", "Hiking", "Cafe exploration"]);
    await expect(page.getByRole("link", { name: "Edit interests" })).toHaveAttribute("href", "/edit/interests");
    await expect(page.getByRole("list", { name: "Stats" }).getByRole("listitem")).toHaveText(["2Connections", "1Activities created", "2Activities joined"]);
    await expect(page.getByRole("link", { name: /My connections/ })).toContainText("1 pending request waiting for you");
    await expect(page.getByRole("link", { name: "Settings", exact: true })).toHaveAttribute("href", "/settings");

    const tabs = page.getByRole("navigation", { name: "My activities" });
    await expect(tabs.getByRole("link")).toHaveText(["Created · 1", "Joined · 1", "Past · 1"]);
    const rows = page.getByTestId("my-activity").filter({ visible: true });
    await expect(rows).toHaveText([/Poker Night.*2 of 5 going.*Hosting/]);
    await expect(rows.first()).toHaveAttribute("href", "/activities/a-mine/manage");
    await tabs.getByRole("link", { name: "Joined · 1" }).click();
    await expect(page).toHaveURL("/profile?tab=joined");
    await expect(rows).toHaveText([/Nandi Hills sunrise hike.*Hosted by Sneha.*Going/]);
    await expect(rows.first()).toHaveAttribute("href", "/activities/a-hike/chat");
    await tabs.getByRole("link", { name: "Past · 1" }).click();
    await expect(rows).toHaveText([/Friday board games.*With 4 people.*Completed/]);
    await rows.first().click();
    await expect(page).toHaveURL("/activities/a-past/after");
  });

  test("Edit profile opens S03–S06 in edit mode; Save returns to S21", async ({ page }) => {
    await page.goto("/profile");
    await page.getByRole("button", { name: "Edit profile" }).click();
    const sheet = page.getByRole("dialog", { name: "Edit profile" });
    await expect(sheet.getByRole("link")).toHaveText(["Name, birthday and bio", "Photo", "Interests", "Location"]);
    await expect(sheet.getByRole("link", { name: "Location" })).toHaveAttribute("href", "/location?from=profile");
    await sheet.getByRole("link", { name: "Name, birthday and bio" }).click();

    await expect(page).toHaveURL("/edit/about");
    await expect(page.getByRole("progressbar")).toHaveCount(0);
    await page.getByLabel("Short bio").fill("Weekend shuttler.");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL("/profile");
    await expect(page.getByRole("region", { name: "About" })).toContainText("Weekend shuttler.");

    await page.getByRole("link", { name: "Edit interests" }).click();
    await expect(page).toHaveURL("/edit/interests");
    await page.getByRole("button", { name: "Poker" }).click();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL("/profile");
    await expect(page.getByRole("list", { name: "Your interests" })).toContainText("Poker");

    await page.goto("/edit/photo");
    await expect(page.getByRole("link", { name: "Back to Profile" })).toHaveAttribute("href", "/profile");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL("/profile");

    await page.goto("/location?from=profile");
    await expect(page.getByRole("link", { name: "Back to Profile" })).toHaveAttribute("href", "/profile");
  });
});

test.describe("S21-C Connections list", () => {
  test("pending on top with Accept / Decline; rows with Message and Remove (confirm)", async ({ page }) => {
    await page.goto("/profile");
    await page.getByRole("link", { name: /My connections/ }).click();
    await expect(page).toHaveURL("/profile/connections");
    const pending = page.getByRole("region", { name: "Waiting for you" });
    await expect(pending.getByTestId("connection-request")).toContainText("Kabir wants to connect");

    const rows = page.getByTestId("connection-row").filter({ visible: true });
    await expect(page.getByRole("heading", { name: "2 connections" })).toBeVisible();
    await expect(rows).toHaveText([/Rohan.*BTM Layout/, /Sneha.*Sarjapur Road/]);
    await expect(rows.nth(1).getByRole("link", { name: "Message Sneha" })).toHaveAttribute("href", "/chats/with/p-sneha");

    await rows.first().getByRole("button", { name: "Remove Rohan" }).click();
    const dialog = page.getByRole("dialog", { name: "Remove Rohan?" });
    await expect(dialog).toContainText("Rohan won't be told.");
    await dialog.getByRole("button", { name: "Remove connection" }).click();
    await expect(page.getByText("Rohan was removed from your connections.")).toBeVisible();
    await expect.poll(async () => (await getState()).people.connected).not.toContain("p-rohan");

    await pending.getByRole("button", { name: "Accept Kabir" }).click();
    await expect(page.getByText("You’re now connected with Kabir.")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("region", { name: "Waiting for you" })).toHaveCount(0);
    await expect(rows).toHaveText([/Kabir/, /Sneha/]);
  });
});

const widths = [
  { width: 1440, height: 900, side: true, mobile: false },
  { width: 1024, height: 768, side: true, mobile: false },
  { width: 768, height: 1024, side: false, mobile: false },
  { width: 390, height: 844, side: false, mobile: true },
];

for (const w of widths) {
  test.describe(`S20/S21 layout @ ${w.width}px`, () => {
    test.use({ viewport: { width: w.width, height: w.height } });

    test("S20 Inbox", async ({ page }) => {
      await page.goto("/inbox");
      await expect(page.getByTestId("connection-request").filter({ visible: true })).toBeVisible();
      await expectNoHorizontalScroll(page, w.width);
      const nav = page.getByRole("navigation", { name: "Main" });
      await expect(nav.locator("[aria-current=page]")).toHaveCount(0); // Inbox highlights no section
      for (const name of ["Decline Kabir", "Accept Kabir"]) {
        const b = (await page.getByRole("button", { name }).boundingBox())!;
        expect(b.height).toBeGreaterThanOrEqual(44);
        expect(b.x + b.width).toBeLessThanOrEqual(w.width);
      }
      if (w.mobile) {
        await expect(page.getByRole("link", { name: "Back" })).toBeVisible();
        await expect(page.getByRole("heading", { level: 1, name: "Inbox" })).toBeAttached(); // header carries the title
      } else {
        await expect(page.getByRole("heading", { level: 1, name: "Inbox" })).toBeVisible();
      }
      await page.screenshot({ path: `test-results/s20-${w.width}.png`, fullPage: true });
      await page.goto("/inbox?tab=chats");
      await expect(page.getByTestId("chat-row").filter({ visible: true }).first()).toBeVisible();
      await expectNoHorizontalScroll(page, w.width);
    });

    test("S21 My profile", async ({ page }) => {
      await page.goto("/profile");
      const card = page.getByRole("region", { name: "Your profile" });
      await expect(card).toBeVisible();
      await expectNoHorizontalScroll(page, w.width);
      const nav = page.getByRole("navigation", { name: "Main" });
      await expect(nav.getByRole("link", { name: "Profile" })).toHaveAttribute("aria-current", "page");
      const cardBox = (await card.boundingBox())!;
      const about = (await page.getByRole("region", { name: "About" }).boundingBox())!;
      if (w.side) {
        expect(cardBox.width).toBe(260);
        expect(about.x).toBeGreaterThan(cardBox.x + cardBox.width);
      } else {
        expect(about.y).toBeGreaterThan(cardBox.y + cardBox.height); // stacked
      }
      const tiles = page.getByRole("list", { name: "Stats" }).getByRole("listitem");
      const [t1, t2] = [(await tiles.nth(0).boundingBox())!, (await tiles.nth(1).boundingBox())!];
      if (w.mobile) expect(t2.y).toBeGreaterThan(t1.y);
      else expect(Math.round(t2.y)).toBe(Math.round(t1.y));
      for (const target of [page.getByRole("button", { name: "Edit profile" }), page.getByRole("link", { name: "Settings", exact: true })]) {
        const b = (await target.boundingBox())!;
        expect(b.height).toBeGreaterThanOrEqual(44);
        expect(b.height).toBeLessThanOrEqual(48); // one line, even in the 260 px column
        expect(b.x + b.width).toBeLessThanOrEqual(cardBox.x + cardBox.width);
      }
      await page.screenshot({ path: `test-results/s21-${w.width}.png`, fullPage: true });
    });

    test("S21-C Connections list", async ({ page }) => {
      await page.goto("/profile/connections");
      await expect(page.getByTestId("connection-row").filter({ visible: true }).first()).toBeVisible();
      await expectNoHorizontalScroll(page, w.width);
      const remove = (await page.getByRole("button", { name: "Remove Rohan" }).boundingBox())!;
      expect(remove.height).toBeGreaterThanOrEqual(44);
      expect(remove.x + remove.width).toBeLessThanOrEqual(w.width);
      await page.screenshot({ path: `test-results/s21c-${w.width}.png`, fullPage: true });
    });
  });
}
