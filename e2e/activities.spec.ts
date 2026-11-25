import { expect, test, type Page } from "@playwright/test";
import { expectNoHorizontalScroll, getState, seedOnboardedWithPeople, signIn } from "./helpers";

test.beforeEach(async ({ context }) => {
  await seedOnboardedWithPeople();
  await signIn(context);
});

test.describe("S10 Activities home", () => {
  test("signed-in users land on Activities", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/activities");
  });

  test("header, sections and interest filter", async ({ page }) => {
    await page.goto("/activities");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^Good (morning|afternoon|evening), Aarav$/);
    await expect(page.getByTestId("count-line")).toHaveText("5 activities near you this week");
    await expect(page.getByRole("link", { name: "Location: HSR Layout, Bengaluru, 5 km. Change" })).toHaveAttribute(
      "href",
      "/location?from=activities",
    );
    await expect(page.getByRole("link", { name: "Create activity" })).toHaveAttribute("href", "/activities/new");

    const people = page.getByRole("list", { name: "From your people" });
    await expect(people.getByTestId("activity-card")).toHaveText([/Early swim at the club/, /Nandi Hills sunrise hike/]);
    const nearby = page.getByRole("list", { name: "Nearby activities" });
    // Soonest first; Full still shows; other interests and my own activity don't.
    await expect(nearby.getByTestId("activity-card")).toHaveText([/Sunrise trek.*Full/, /Saturday morning doubles/, /Coffee exploration/]);
    await expect(page.getByText("From people you're not connected with yet. Hosts approve each request.")).toBeVisible();
    await expect(page.getByRole("link", { name: "See all" })).toHaveAttribute("href", "/search/activities?from=people");

    const filters = page.getByRole("navigation", { name: "Filter by interest" });
    await expect(filters.getByRole("link")).toHaveText(["All", "Badminton", "Swimming", "Hiking", "Cafe exploration"]);
    await filters.getByRole("link", { name: "Badminton" }).click();
    await expect(page).toHaveURL("/activities?interest=badminton");
    await expect(filters.getByRole("link", { name: "Badminton" })).toHaveAttribute("aria-current", "true");
    await expect(page.getByTestId("count-line")).toHaveText("1 Badminton activity near you this week");
    await expect(page.getByText("None of your connections have a Badminton activity this week.")).toBeVisible();
    await expect(nearby.getByTestId("activity-card")).toHaveCount(1);

    await nearby.getByTestId("activity-card").click();
    await expect(page).toHaveURL("/activities/a-doubles");
  });

  test("request to join straight from a card", async ({ page }) => {
    await page.goto("/activities");
    const nearby = page.getByRole("list", { name: "Nearby activities" });
    // Full activities have no button.
    await expect(nearby.getByTestId("activity-card").filter({ hasText: "Sunrise trek" }).getByRole("button")).toHaveCount(0);
    const card = nearby.getByTestId("activity-card").filter({ hasText: "Saturday morning doubles" });
    await card.getByRole("button", { name: "Request to join Saturday morning doubles" }).click();
    await expect(page).toHaveURL("/activities");
    await expect(card.getByText("Requested · waiting for Meera")).toBeVisible();
    await expect(page.getByText("Request sent. Meera will let you know.")).toBeVisible();
    await expect
      .poll(async () => (await getState()).activities.parts)
      .toContainEqual(expect.objectContaining({ activityId: "a-doubles", userId: "u1", status: "requested" }));
    await page.reload();
    await expect(card.getByText("Requested · waiting for Meera")).toBeVisible();
  });

  test("both sections respect the discovery radius", async ({ page }) => {
    await seedOnboardedWithPeople(2);
    await page.goto("/activities");
    // Connections' activities are 3.7 and 4.1 km away; nearby ones 2.5–3.6 km.
    await expect(page.getByText("None of your connections have an activity this week.")).toBeVisible();
    await expect(page.getByText("No activities nearby right now.", { exact: false })).toBeVisible();
    await expect(page.getByTestId("count-line")).toHaveText("0 activities near you this week");
  });

  test("card and details stay in sync when requesting / withdrawing on S11", async ({ page }) => {
    await page.goto("/activities");
    const card = page.getByTestId("activity-card").filter({ hasText: "Saturday morning doubles" });
    await expect(card.getByRole("button", { name: /Request to join/ })).toBeVisible();

    await card.getByRole("link").click();
    const s11Request = page.getByRole("button", { name: "Request to join", exact: true }).filter({ visible: true });
    await s11Request.click();
    await expect(page.getByText("Requested · waiting for Meera")).toBeVisible();
    await page.getByRole("link", { name: "Back to Activities" }).click();
    await expect(card.getByText("Requested · waiting for Meera")).toBeVisible();

    await card.getByRole("link").click();
    await page.getByRole("button", { name: "Withdraw request" }).click();
    await expect(s11Request).toBeVisible();
    await page.getByRole("link", { name: "Back to Activities" }).click();
    await expect(card.getByRole("button", { name: /Request to join/ })).toBeVisible();

    // Request from the card, withdraw inside, back again.
    await card.getByRole("button", { name: /Request to join/ }).click();
    await expect(card.getByText("Requested · waiting for Meera")).toBeVisible();
    await card.getByRole("link").click();
    await page.getByRole("button", { name: "Withdraw request" }).click();
    await expect(s11Request).toBeVisible();
    await page.goBack();
    await expect(card.getByRole("button", { name: /Request to join/ })).toBeVisible();
  });

  test("location chip opens S06 edit mode and Save returns to Activities", async ({ page }) => {
    await page.goto("/activities");
    await page.getByRole("link", { name: /Location: HSR Layout/ }).click();
    await expect(page).toHaveURL("/location?from=activities");
    await page.getByRole("button", { name: "10 km" }).click();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL("/activities");
    await expect(page.getByRole("link", { name: /Location: HSR Layout, Bengaluru, 10 km/ })).toBeVisible();
  });
});

test.describe("S11 Activity details", () => {
  test("facts, host card, who's going, and request → withdraw", async ({ page }) => {
    await page.goto("/activities/a-doubles");
    await expect(page.getByRole("heading", { level: 1, name: "Saturday morning doubles" })).toBeVisible();
    await expect(page.getByText("Open to everyone nearby · host approves each request")).toBeVisible();
    await expect(page.getByText("Exact location shared once you're accepted")).toBeVisible();
    await expect(page.getByText("Court 3")).toHaveCount(0);
    await expect(page.getByText("3 of 4 going")).toBeVisible();
    await expect(page.getByRole("meter", { name: "Spots filled" })).toHaveAttribute("aria-valuenow", "3");
    const host = page.getByTestId("host-card");
    await expect(host).toContainText("Hosted by Meera");
    await expect(host).toContainText("Not connected · 3 shared interests · hosted 2 activities");
    await expect(host.getByRole("link", { name: "View profile" })).toHaveAttribute("href", "/people/p-meera?from=activities");
    const going = page.getByRole("list", { name: "Who's going" });
    await expect(going.getByRole("listitem")).toHaveText([/Meera.*Host/, /Rohan/, /Sneha/, /1 spot open/]);

    await page.getByRole("button", { name: "Request to join" }).first().click();
    await expect(page.getByText("Requested · waiting for Meera")).toBeVisible();
    await expect
      .poll(async () => (await getState()).activities.parts)
      .toContainEqual(expect.objectContaining({ activityId: "a-doubles", userId: "u1", status: "requested" }));
    await page.getByRole("button", { name: "Withdraw request" }).click();
    await expect(page.getByRole("button", { name: "Request to join" }).first()).toBeVisible();
  });

  test("full activity can't be requested; unknown ids 404; host sees Manage activity", async ({ page }) => {
    await page.goto("/activities/a-trek");
    await expect(page.getByRole("button", { name: "Full · requests closed" })).toBeDisabled();
    await page.goto("/activities/a-poker-far");
    await expect(page.getByRole("heading", { name: "We couldn\u2019t find that" })).toBeVisible();
    await page.goto("/activities/a-mine");
    await expect(page.getByRole("link", { name: "Manage activity" })).toHaveAttribute("href", "/activities/a-mine/manage");
    await expect(page.getByTestId("exact-address")).toHaveText("Flat 4B, 27th Main");
  });
});

test.describe("S12–S13 Create activity", () => {
  test("two steps with live preview, draft kept between steps, publish → S14", async ({ page }) => {
    await page.goto("/activities/new");
    await expect(page.getByText("Step 1 of 2")).toBeVisible();
    const next = page.getByRole("button", { name: "Next: where, when, who" });
    await expect(next).toBeDisabled();
    // My interests + All interests (full catalogue).
    await expect(page.getByRole("group", { name: /Interest/ }).getByRole("button")).toHaveText(["Badminton", "Hiking", "Cafe exploration", "All interests"]);
    await page.getByRole("button", { name: "All interests" }).click();
    await page.getByRole("dialog", { name: "All interests" }).getByRole("button", { name: "Poker" }).click();
    await expect(page.getByRole("button", { name: "Poker" })).toHaveAttribute("aria-pressed", "true");
    await page.getByLabel("Title").fill("Poker Night");
    await expect(page.getByTestId("preview").filter({ visible: true })).toContainText("Poker Night");
    await expect(page.getByTestId("preview").filter({ visible: true })).toContainText("Date and time in step 2");
    await next.click();

    await expect(page).toHaveURL("/activities/new/details");
    const publish = page.getByRole("button", { name: "Publish activity" });
    await expect(publish).toBeDisabled();
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByLabel("Title")).toHaveValue("Poker Night");
    await next.click();

    await page.getByRole("combobox", { name: "Where" }).fill("hsr");
    await page.getByRole("option", { name: "HSR Layout" }).click();
    await page.getByLabel("Venue or exact address (optional)").fill("Flat 4B");
    await page.getByRole("group", { name: "When" }).getByRole("button").nth(2).click();
    await page.getByLabel("Starts").fill("19:00");
    await page.getByLabel("Ends (optional)").fill("18:00");
    await expect(page.getByText("End time must be after the start.")).toBeVisible();
    await page.getByLabel("Ends (optional)").fill("");
    await page.getByRole("button", { name: "More people" }).click();
    await expect(page.getByTestId("preview").filter({ visible: true })).toContainText("1/6");
    await expect(page.getByTestId("preview").filter({ visible: true })).toContainText("5 spots left");
    await expect(page.getByTestId("preview").filter({ visible: true })).toContainText("HSR Layout");
    await expect(page.getByTestId("visibility-note")).toHaveText(
      "Your connections and nearby poker fans will see this. Connections who like poker get a notification.",
    );
    await page.getByText("Connections only", { exact: true }).click();
    await expect(page.getByTestId("visibility-note")).toHaveText("Only your connections will see this activity.");

    await publish.click();
    await expect(page).toHaveURL("/activities/a-new-1/manage");
    await expect(page.getByRole("heading", { level: 1, name: "Poker Night" })).toBeVisible();
    const created = (await getState()).activities.list.find((a: { id: string }) => a.id === "a-new-1");
    expect(created).toEqual(expect.objectContaining({ interest_id: 3, limit: 6, visibility: "connections", address: "Flat 4B", area_name: "HSR Layout" }));

    // The draft is gone after publishing.
    await page.goto("/activities/new");
    await expect(page.getByLabel("Title")).toHaveValue("");
  });

  test("Cancel discards the draft and returns to Activities", async ({ page }) => {
    await page.goto("/activities/new");
    await page.getByLabel("Title").fill("Something");
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page).toHaveURL("/activities");
    await page.goto("/activities/new");
    await expect(page.getByLabel("Title")).toHaveValue("");
  });
});

test.describe("S14 Host: manage + S15 Cancel", () => {
  test("accept, decline with Undo, edit details (locked fields), cancel with a note", async ({ page }) => {
    await page.goto("/activities/a-mine/manage");
    await expect(page.getByRole("heading", { name: /Requests · 2/ })).toBeVisible();
    const kabir = page.getByTestId("request-card").filter({ hasText: "Kabir" });
    await expect(kabir).toContainText("Kabir, 30");
    await expect(kabir).toContainText("Not connected · 3.4 km");
    await kabir.getByRole("button", { name: "Accept" }).click();
    await expect(page.getByText("Kabir is in. They can now see the group chat.")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Going · 3/ })).toBeVisible();
    await expect(page.getByRole("list", { name: "Going" }).getByRole("listitem")).toHaveText([/You.*Host/, /Rohan.*Connected/, /Kabir.*Not connected/]);

    const meera = page.getByTestId("request-card").filter({ hasText: "Meera" });
    await meera.getByRole("button", { name: "Decline" }).click();
    await expect(page.getByText("Declined. Meera gets a polite notification.")).toBeVisible();
    await expect(meera).toHaveCount(0);
    await page.getByRole("button", { name: /Undo/ }).click();
    await expect(page.getByTestId("request-card").filter({ hasText: "Meera" })).toBeVisible();
    expect((await getState()).activities.parts.find((p: { id: string }) => p.id === "pid-a-mine-p-meera")).toEqual(
      expect.objectContaining({ declineAt: null, effective: "requested" }),
    );

    await page.getByRole("link", { name: "Edit details" }).click();
    await expect(page).toHaveURL("/activities/a-mine/edit");
    await expect(page.getByRole("button", { name: "Poker" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "All interests" })).toHaveCount(0);
    await page.getByLabel("Title").fill("Poker Night v2");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL("/activities/a-mine/manage");
    await expect(page.getByRole("heading", { level: 1, name: "Poker Night v2" })).toBeVisible();

    await page.getByRole("button", { name: "Cancel activity" }).click();
    const dialog = page.getByRole("dialog", { name: "Cancel Poker Night v2?" });
    await expect(dialog).toContainText("Rohan, Kabir and the 1 person waiting on a reply will be notified.");
    await dialog.getByRole("button", { name: "Keep it" }).click();
    await expect(dialog).toBeHidden();
    await page.getByRole("button", { name: "Cancel activity" }).click();
    await dialog.getByLabel("Note to participants").fill("Rain, sorry!");
    await dialog.getByRole("button", { name: "Cancel activity" }).click();
    await expect(page.getByText("You cancelled this activity. Everyone involved was told.")).toBeVisible();
    await expect(page.getByText("Your note: “Rain, sorry!”")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel activity" })).toHaveCount(0);
    const parts = (await getState()).activities.parts.filter((p: { activityId: string; role: string }) => p.activityId === "a-mine" && p.role === "participant");
    expect(parts.map((p: { status: string }) => p.status)).toEqual(["closed", "closed", "closed"]);
  });

  test("non-hosts get the same 404 on S14", async ({ page }) => {
    await page.goto("/activities/a-doubles/manage");
    await expect(page.getByRole("heading", { name: "We couldn\u2019t find that" })).toBeVisible();
  });
});

// ---------- Layout at the four required widths ----------

const widths = [
  { width: 1440, height: 900, cols: 3, mobile: false },
  { width: 1024, height: 768, cols: 3, mobile: false },
  { width: 768, height: 1024, cols: 2, mobile: false },
  { width: 390, height: 844, cols: 1, mobile: true },
];

async function checkChrome(page: Page, w: (typeof widths)[number]) {
  await expectNoHorizontalScroll(page, w.width);
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link", { name: "Activities" })).toHaveAttribute("aria-current", "page");
}

async function columns(page: Page, list: string) {
  const xs = await page.getByRole("list", { name: list }).getByTestId("activity-card").evaluateAll((els) =>
    els.map((e) => Math.round(e.getBoundingClientRect().x)),
  );
  return new Set(xs).size;
}

for (const w of widths) {
  test.describe(`S10–S15 layout @ ${w.width}px`, () => {
    test.use({ viewport: { width: w.width, height: w.height } });

    test("S10 grid, chips and header", async ({ page }) => {
      await page.goto("/activities");
      await expect(page.getByTestId("activity-card").first()).toBeVisible();
      await checkChrome(page, w);
      expect(await columns(page, "Nearby activities")).toBe(w.cols);
      const row = page.getByRole("navigation", { name: "Filter by interest" }).getByRole("list");
      const wraps = await row.evaluate((el) => getComputedStyle(el).flexWrap);
      expect(wraps).toBe(w.mobile ? "nowrap" : "wrap");
      const cover = page.getByTestId("activity-card").first().locator("div").first();
      expect((await cover.boundingBox())!.height).toBe(150);
      for (const name of ["Create activity", "See all"]) {
        const b = (await page.getByRole("link", { name }).boundingBox())!;
        expect(b.x + b.width).toBeLessThanOrEqual(w.width);
      }
      await page.screenshot({ path: `test-results/s10-${w.width}.png`, fullPage: true });
    });

    test("S11 split with join card", async ({ page }) => {
      await page.goto("/activities/a-doubles");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await checkChrome(page, w);
      const cover = (await page.getByRole("heading", { level: 1 }).boundingBox())!;
      const side = (await page.getByRole("complementary", { name: "When, where and joining" }).boundingBox())!;
      if (w.mobile) {
        expect(side.y).toBeGreaterThan(cover.y); // inline below the title
        await expect(page.getByTestId("sticky-action")).toBeHidden();
        // Q-08: once the inline card is off-screen, the primary action sits above the bottom bar.
        await page.setViewportSize({ width: w.width, height: 480 });
        await expect(page.getByTestId("sticky-action")).toBeVisible();
        const bar = (await page.getByRole("navigation", { name: "Main" }).boundingBox())!;
        const sticky = (await page.getByTestId("sticky-action").boundingBox())!;
        expect(sticky.y + sticky.height).toBeLessThanOrEqual(bar.y + 1);
        await page.setViewportSize({ width: w.width, height: w.height });
      } else {
        expect(side.x).toBeGreaterThan(cover.x + 100); // side card
        await expect(page.getByTestId("sticky-action")).toBeHidden();
      }
      await page.screenshot({ path: `test-results/s11-${w.width}.png`, fullPage: true });
    });

    test("S12/S13 form + preview; bottom bar hidden while creating", async ({ page }) => {
      await page.goto("/activities/new");
      await page.getByLabel("Title").fill("Poker Night");
      await page.getByRole("button", { name: "Badminton" }).click();
      await expectNoHorizontalScroll(page, w.width);
      const form = (await page.getByLabel("Title").boundingBox())!;
      const preview = (await page.getByTestId("preview").filter({ visible: true }).boundingBox())!;
      if (w.width >= 1024) expect(preview.x).toBeGreaterThan(form.x + form.width - 1);
      else expect(preview.y).toBeGreaterThan(form.y);
      if (w.mobile) {
        await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);
        const next = (await page.getByRole("button", { name: "Next: where, when, who" }).boundingBox())!;
        expect(next.y + next.height).toBeLessThanOrEqual(w.height);
        expect(next.height).toBeGreaterThanOrEqual(44);
      }
      await page.screenshot({ path: `test-results/s12-${w.width}.png`, fullPage: true });
      await page.getByRole("button", { name: "Next: where, when, who" }).click();
      await expect(page.getByRole("heading", { level: 1, name: "Where, when and who" })).toBeVisible();
      await expectNoHorizontalScroll(page, w.width);
      for (const name of ["Fewer people", "More people"]) {
        const b = (await page.getByRole("button", { name }).boundingBox())!;
        expect(b.width).toBeGreaterThanOrEqual(44);
      }
      await page.screenshot({ path: `test-results/s13-${w.width}.png`, fullPage: true });
    });

    test("S14 two columns + S15 sheet / dialog", async ({ page }) => {
      await page.goto("/activities/a-mine/manage");
      await expect(page.getByRole("heading", { name: /Requests/ })).toBeVisible();
      await checkChrome(page, w);
      const summary = (await page.getByRole("region", { name: "Summary" }).boundingBox())!;
      const requests = (await page.getByRole("heading", { name: /Requests/ }).boundingBox())!;
      if (w.mobile) expect(requests.y).toBeGreaterThan(summary.y + summary.height - 1);
      else expect(requests.x).toBeGreaterThan(summary.x + summary.width - 1);
      for (const b of await page.getByTestId("request-card").getByRole("button").all()) {
        expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      await page.screenshot({ path: `test-results/s14-${w.width}.png`, fullPage: true });

      await page.getByRole("button", { name: "Cancel activity" }).click();
      const dialog = page.getByRole("dialog", { name: "Cancel Poker Night?" });
      await expect(dialog).toBeVisible();
      const box = (await dialog.boundingBox())!;
      if (w.mobile) {
        expect(box.y + box.height).toBeCloseTo(w.height, 0); // bottom sheet
        expect(box.width).toBe(w.width);
      } else {
        expect(box.width).toBe(520); // centred dialog
      }
      await page.screenshot({ path: `test-results/s15-${w.width}.png` });
    });
  });
}
