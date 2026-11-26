import { expect, test, type Page } from "@playwright/test";
import { expectNoHorizontalScroll, getState, seedOnboardedWithPeople, signIn } from "./helpers";

test.beforeEach(async ({ context }) => {
  await seedOnboardedWithPeople();
  await signIn(context);
});

const log = (page: Page) => page.getByRole("log", { name: "Messages" });

test.describe("S16 Activity chat", () => {
  test("participant: header, system lines, messages, send + quick reply, side card", async ({ page }) => {
    await page.goto("/activities/a-hike");
    await page.getByRole("link", { name: "Open chat" }).click();
    await expect(page).toHaveURL("/activities/a-hike/chat");
    await expect(page.getByRole("heading", { level: 1, name: "Nandi Hills sunrise hike" })).toBeVisible();
    await expect(page.getByText(/· 3 going$/)).toBeVisible();
    await expect(log(page).getByText("Sneha accepted you. You're in!")).toBeVisible();
    await expect(log(page).getByText("Only accepted participants can see this chat")).toBeVisible();
    const items = log(page).getByTestId("message");
    await expect(items).toHaveText([/Sneha · host.*Pickup at Agara lake/, /Meera.*I'll bring snacks/, /See you there!.*Seen by 2/]);

    await page.getByPlaceholder("Message the group").fill("Is parking easy?");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(items.last()).toContainText("Is parking easy?");
    await expect(page.getByTestId("own-status")).toHaveText("Sent");
    await page.getByRole("button", { name: "On my way" }).click();
    await expect(items.last()).toContainText("On my way");
    await expect
      .poll(async () => (await getState()).activities.messages["c-a-hike"].map((m: { body: string }) => m.body).slice(-2))
      .toEqual(["Is parking easy?", "On my way"]);

    // Survives a reload (server copy).
    await page.reload();
    await expect(log(page).getByText("Is parking easy?")).toBeVisible();

    const side = page.getByRole("complementary", { name: "Activity details" });
    await expect(side).toContainText("3 of 5 going");
    await expect(side).toContainText("Sarjapur Road · 4.1 km");
    await side.getByRole("button", { name: "Withdraw from activity" }).click();
    await expect(page).toHaveURL("/activities/a-hike");
    await expect(page.getByRole("button", { name: "Count me in", exact: true }).filter({ visible: true })).toBeVisible();
    await page.goto("/activities/a-hike/chat");
    await expect(page.getByRole("heading", { name: "We couldn\u2019t find that" })).toBeVisible();
  });

  test("only host + accepted: others get 404; host opens it from S14 without the 'accepted you' line", async ({ page }) => {
    await page.goto("/activities/a-doubles/chat");
    await expect(page.getByRole("heading", { name: "We couldn\u2019t find that" })).toBeVisible();

    await page.goto("/activities/a-mine/manage");
    await page.getByRole("link", { name: "Group chat" }).click();
    await expect(page).toHaveURL("/activities/a-mine/chat");
    await expect(page.getByText("Only accepted participants can see this chat")).toBeVisible();
    await expect(page.getByText(/accepted you/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Withdraw from activity" })).toHaveCount(0);
  });

  test("cancelled activity → chat is read-only", async ({ page }) => {
    await page.goto("/activities/a-mine/manage");
    await page.getByRole("button", { name: "Cancel activity" }).click();
    await page.getByRole("dialog", { name: "Cancel Poker Night?" }).getByRole("button", { name: "Cancel activity" }).click();
    await expect(page.getByText("You cancelled this activity. Everyone involved was told.")).toBeVisible();
    await page.goto("/activities/a-mine/chat");
    await expect(page.getByRole("status").filter({ hasText: "read-only" })).toHaveText(
      "This activity was cancelled, so the chat is read-only.",
    );
    await expect(page.getByPlaceholder("Message the group")).toHaveCount(0);
  });
});

test.describe("S16-D Direct chat", () => {
  test("S09 Message opens the direct chat with a connection; others 404", async ({ page }) => {
    await page.goto("/people/p-rohan");
    await page.getByRole("link", { name: "Message", exact: true }).click();
    await expect(page).toHaveURL("/chats/d-p-rohan");
    await expect(page.getByRole("heading", { level: 1, name: "Rohan" })).toBeVisible();
    await expect(log(page).getByText("Hey! Up for a swim this week?")).toBeVisible();
    await expect(page.getByRole("button", { name: "On my way" })).toHaveCount(0); // no activity quick replies
    await page.getByPlaceholder("Message Rohan").fill("Yes! Thursday?");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(log(page).getByTestId("message").last()).toContainText("Yes! Thursday?");

    await page.goto("/chats/with/p-meera");
    await expect(page.getByRole("heading", { name: "We couldn\u2019t find that" })).toBeVisible();
  });
});

test.describe("S17 After the activity", () => {
  test("heading, people with Connect / Pending (tap to withdraw) / Connected, report, re-host prefill", async ({ page }) => {
    await page.goto("/activities/a-past");
    await page.getByRole("link", { name: "After the activity" }).click();
    await expect(page).toHaveURL("/activities/a-past/after");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hope you enjoyed Friday board games, Aarav!");
    await expect(page.getByText(/^Completed · /)).toBeVisible();
    const people = page.getByTestId("played-with");
    await expect(people).toHaveText([
      /Meera.*Host · first activity together.*Connect/,
      /Ananya.*First activity together.*Connect/,
      /Kabir.*Connect/,
      /Sneha.*Connected/,
    ]);
    await expect(page.getByText("Playing together never connects you automatically. Both people have to agree.")).toBeVisible();

    await page.getByRole("button", { name: "Connect with Ananya" }).click();
    await expect(page.getByRole("button", { name: "Pending. Withdraw request to Ananya" })).toBeVisible();
    await expect.poll(async () => (await getState()).people.sent).toEqual(["p-ananya"]);
    await page.getByRole("button", { name: "Pending. Withdraw request to Ananya" }).click();
    await expect(page.getByRole("button", { name: "Connect with Ananya" })).toBeVisible();

    await page.getByRole("button", { name: "Report a problem with this activity" }).click();
    const dialog = page.getByRole("dialog", { name: "Report a problem" });
    await dialog.getByRole("radio", { name: "Spam or scam" }).check();
    await dialog.getByRole("button", { name: "Send report" }).click();
    await expect(page.getByText("Thanks. We\u2019ll review your report.")).toBeVisible();
    await expect.poll(async () => (await getState()).activities.reports).toEqual([
      expect.objectContaining({ p_id: "a-past", p_reason: "spam" }),
    ]);

    await expect(page.getByRole("link", { name: "Group chat stays open for 7 days" })).toHaveAttribute("href", "/activities/a-past/chat");
    await page.getByRole("link", { name: "Re-host this activity" }).click();
    await expect(page).toHaveURL("/activities/new");
    await expect(page.getByLabel("Title")).toHaveValue("Friday board games");
    await expect(page.getByRole("button", { name: "Board games" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Next: where, when, who" }).click();
    await expect(page.getByRole("combobox", { name: "Where" })).toHaveValue("Koramangala");
    await expect(page.getByLabel("Venue or exact address (optional)")).toHaveValue("Meera's place, 5th Cross");
    await expect(page.getByLabel("Starts")).toHaveValue("");
    await expect(page.getByTestId("preview").filter({ visible: true })).toContainText("1/6");
  });

  test("not completed yet → back to S11; outsiders 404", async ({ page }) => {
    await page.goto("/activities/a-hike/after");
    await expect(page).toHaveURL("/activities/a-hike");
    await page.goto("/activities/a-doubles/after");
    await expect(page.getByRole("heading", { name: "We couldn\u2019t find that" })).toBeVisible();
  });
});

// ---------- Layout at the four required widths ----------

const widths = [
  { width: 1440, height: 900, mobile: false },
  { width: 1024, height: 768, mobile: false },
  { width: 768, height: 1024, mobile: false },
  { width: 390, height: 844, mobile: true },
];

for (const w of widths) {
  test.describe(`S16/S17 layout @ ${w.width}px`, () => {
    test.use({ viewport: { width: w.width, height: w.height } });

    test("S16 chat + side card", async ({ page }) => {
      await page.goto("/activities/a-hike/chat");
      await expect(log(page).getByTestId("message").first()).toBeVisible();
      await expectNoHorizontalScroll(page, w.width);
      const chat = (await page.getByRole("region", { name: "Chat" }).boundingBox())!;
      const side = (await page.getByRole("complementary", { name: "Activity details" }).boundingBox())!;
      if (w.width >= 1024) expect(side.x).toBeGreaterThan(chat.x + chat.width - 1);
      else expect(side.y).toBeGreaterThan(chat.y + chat.height - 1);
      const send = page.getByRole("button", { name: "Send" });
      await send.scrollIntoViewIfNeeded();
      const s = (await send.boundingBox())!;
      expect(s.height).toBeGreaterThanOrEqual(44);
      expect(s.x + s.width).toBeLessThanOrEqual(w.width);
      if (w.mobile) {
        const bar = (await page.getByRole("navigation", { name: "Main" }).boundingBox())!;
        expect(s.y + s.height).toBeLessThanOrEqual(bar.y);
      }
      for (const b of await page.getByRole("button", { name: /On my way|Running 10 min late|See you there/ }).all()) {
        expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      await page.screenshot({ path: `test-results/s16-${w.width}.png`, fullPage: true });
    });

    test("S16-D direct chat", async ({ page }) => {
      await page.goto("/chats/d-p-rohan");
      await expect(log(page).getByTestId("message").first()).toBeVisible();
      await expectNoHorizontalScroll(page, w.width);
      await page.screenshot({ path: `test-results/s16d-${w.width}.png`, fullPage: true });
    });

    test("S17 grid + side card", async ({ page }) => {
      await page.goto("/activities/a-past/after");
      await expect(page.getByTestId("played-with").first()).toBeVisible();
      await expectNoHorizontalScroll(page, w.width);
      const xs = await page.getByTestId("played-with").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().x)));
      expect(new Set(xs).size).toBe(w.mobile ? 1 : 2);
      const main = (await page.getByRole("heading", { level: 1 }).boundingBox())!;
      const side = (await page.getByRole("complementary", { name: "What next" }).boundingBox())!;
      if (w.width >= 1024) expect(side.x).toBeGreaterThan(main.x + main.width - 1);
      else expect(side.y).toBeGreaterThan(main.y);
      for (const b of await page.getByTestId("played-with").getByRole("button").all()) {
        expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      await page.screenshot({ path: `test-results/s17-${w.width}.png`, fullPage: true });
    });
  });
}
