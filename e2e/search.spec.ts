import { expect, test, type Page } from "@playwright/test";
import { expectNoHorizontalScroll, getState, seedOnboardedWithPeople, signIn } from "./helpers";

// Viewer: HSR Layout, 5 km, likes Badminton, Hiking, Cafe exploration. Rohan + Sneha connected, Kabir asked us.
test.beforeEach(async ({ context }) => {
  await seedOnboardedWithPeople();
  await signIn(context);
});

const visible = (page: Page) => page.getByTestId("person-card").filter({ visible: true });
const cards = (page: Page) => page.getByTestId("activity-card").filter({ visible: true });
const countLine = (page: Page) => page.getByTestId("count-line").filter({ visible: true });
const input = (page: Page) => page.getByRole("searchbox").filter({ visible: true });

test.describe("S18 Search people", () => {
  test("nav, header, results nearest first with labels", async ({ page }) => {
    await page.goto("/activities");
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Search" }).click();
    await expect(page).toHaveURL("/search/people");
    await expect(page.getByRole("heading", { level: 1, name: "Search" })).toBeVisible();
    await expect(page.getByText("Find people and activities with plain filters. No ranking tricks.")).toBeVisible();
    await expect(input(page)).toHaveAttribute("placeholder", "Name or interest, e.g. poker");
    const seg = page.getByRole("navigation", { name: "Search for" });
    await expect(seg.getByRole("link", { name: "People" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: "Location: HSR Layout, Bengaluru, 5 km. Change" })).toHaveAttribute("href", "/location?from=search");
    await expect(page.getByRole("navigation", { name: "Distance" })).toHaveCount(0);
    // Q-07 / Q-52: one row — location/distance chip + interest filter (viewer's own interests).
    const location = (await page.getByRole("link", { name: /^Location:/ }).filter({ visible: true }).boundingBox())!;
    const filter = page.getByRole("button", { name: "All my interests" }).filter({ visible: true });
    expect(Math.abs((await filter.boundingBox())!.y - location.y)).toBeLessThan(2);
    await filter.click();
    const sheet = page.getByRole("dialog", { name: "Show people who like" });
    await expect(sheet.getByRole("link")).toHaveText(["All my interests", "Badminton", "Hiking", "Cafe exploration"]);
    await page.keyboard.press("Escape");

    await expect(countLine(page)).toHaveText("6 people within 5 km, nearest first");
    await expect(visible(page).getByRole("heading")).toHaveText(["Aarav", "Ananya, 28", "Kabir, 30", "Meera, 27", "Rohan, 29", "Sneha, 31"]);
    const meera = visible(page).filter({ hasText: "Meera" });
    await expect(meera).toContainText("3.6 km · Koramangala");
    await expect(meera).toContainText("2 mutual");
    await expect(visible(page).filter({ hasText: "Aarav" })).toContainText("No mutuals yet");
    await expect(visible(page).filter({ hasText: "Rohan" })).toContainText("Connected");
    await expect(visible(page).filter({ hasText: "Rohan" }).getByRole("link", { name: "Connected. Message Rohan" })).toHaveAttribute(
      "href",
      "/chats/with/p-rohan",
    );
    // Shared interests are tinted and listed first.
    await expect(meera.getByRole("list", { name: "Interests" }).getByRole("listitem")).toHaveText(["Badminton", "Hiking", "Cafe exploration"]);
  });

  test("filters combine (AND) and live in the URL", async ({ page }) => {
    await page.goto("/search/people");
    await page.getByRole("button", { name: "All my interests" }).filter({ visible: true }).click();
    await page.getByRole("dialog", { name: "Show people who like" }).getByRole("link", { name: "Badminton" }).click();
    await expect(page).toHaveURL("/search/people?interest=badminton");
    await expect(page.getByRole("button", { name: "Badminton" }).filter({ visible: true })).toHaveClass(/bg-blue-600/);
    await expect(countLine(page)).toHaveText("3 people into badminton within 5 km, nearest first");

    // Q-50: distance is the saved radius (changed on S06), same as S19.
    await seedOnboardedWithPeople(2);
    await page.reload();
    await expect(countLine(page)).toHaveText("1 person into badminton within 2 km, nearest first");
    await seedOnboardedWithPeople();

    await page.goto("/search/people");
    await input(page).fill("POKER");
    await expect(page).toHaveURL("/search/people?q=POKER");
    await expect(visible(page).getByRole("heading")).toHaveText(["Kabir, 30"]);
    await input(page).fill("mee");
    await expect(page).toHaveURL("/search/people?q=mee");
    await expect(visible(page).getByRole("heading")).toHaveText(["Meera, 27"]);
    await page.reload();
    await expect(input(page)).toHaveValue("mee");
  });

  test("empty state", async ({ page }) => {
    await page.goto("/search/people?q=zzz");
    await expect(countLine(page)).toHaveText("0 people within 5 km, nearest first");
    await expect(page.getByRole("heading", { name: "No one matches yet" })).toBeVisible();
    await expect(page.getByText("Try a wider distance or another interest. You can also create an activity and let people find you.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Create an activity" })).toHaveAttribute("href", "/activities/new");
  });

  test("Connect → Pending · tap to withdraw; Connect accepts a request they sent", async ({ page }) => {
    await page.goto("/search/people");
    const aarav = visible(page).filter({ hasText: "Aarav" });
    await aarav.getByRole("button", { name: "Connect with Aarav" }).click();
    await expect(aarav.getByRole("button", { name: "Pending. Withdraw request to Aarav" })).toHaveText("Pending · tap to withdraw");
    await expect.poll(async () => (await getState()).people.sent).toContain("p-aarav");
    await aarav.getByRole("button", { name: "Pending. Withdraw request to Aarav" }).click();
    await expect(aarav.getByRole("button", { name: "Connect with Aarav" })).toBeVisible();
    await expect.poll(async () => (await getState()).people.sent).not.toContain("p-aarav");

    const kabir = visible(page).filter({ hasText: "Kabir" });
    await kabir.getByRole("button", { name: "Connect with Kabir" }).click();
    await expect(kabir.getByRole("link", { name: "Connected. Message Kabir" })).toBeVisible();
    await expect(page.getByText("You\u2019re now connected with Kabir.")).toBeVisible();
    await expect.poll(async () => (await getState()).people.connected).toContain("p-kabir");
  });

  test("card opens S09 with Back to Search", async ({ page }) => {
    await page.goto("/search/people?q=mee");
    await visible(page).getByRole("link", { name: "Meera, 27" }).click();
    await expect(page).toHaveURL("/people/p-meera?from=search");
    await page.getByRole("link", { name: "Back to Search" }).filter({ visible: true }).click();
    await expect(page).toHaveURL("/search/people");
  });

  test("People | Activities: each tab has its own query; clearing sticks across switches (Q-57)", async ({ page }) => {
    const seg = (name: string) =>
      page.getByRole("navigation", { name: "Search for" }).filter({ visible: true }).getByRole("link", { name, exact: true });
    await page.goto("/search/people");
    await input(page).fill("Kabir");
    await input(page).press("Enter");
    await expect(page).toHaveURL("/search/people?q=Kabir");
    await expect(visible(page).getByRole("heading")).toHaveText(["Kabir, 30"]);

    await seg("Activities").click();
    await expect(page).toHaveURL("/search/activities");
    await expect(input(page)).toHaveValue("");
    await expect(input(page)).toHaveAttribute("placeholder", "Activity name, e.g. doubles");
    await expect(cards(page)).toHaveCount(6);

    await input(page).fill("doubles");
    await expect(page).toHaveURL("/search/activities?q=doubles");
    await expect(cards(page)).toHaveText([/Saturday morning doubles/]);
    await input(page).fill("");
    await expect(page).toHaveURL("/search/activities");
    await expect(cards(page)).toHaveCount(6);

    // Back and forth between the kept-alive pages: nothing stale comes back.
    await seg("People").click();
    await expect(page).toHaveURL("/search/people");
    await expect(input(page)).toHaveValue("");
    await expect(visible(page)).toHaveCount(6);
    await input(page).fill("mee");
    await expect(page).toHaveURL("/search/people?q=mee");
    await seg("Activities").click();
    await expect(page).toHaveURL("/search/activities");
    await expect(input(page)).toHaveValue("");
    await page.waitForTimeout(500); // past the debounce: no stale query is pushed back
    await expect(page).toHaveURL("/search/activities");
    await expect(cards(page)).toHaveCount(6);

    await page.goBack();
    await expect(page).toHaveURL("/search/people?q=mee");
    await expect(input(page)).toHaveValue("mee");
  });
});

test.describe("S19 Search activities", () => {
  test("soonest first, only what the viewer may see; full ones greyed", async ({ page }) => {
    await page.goto("/search/activities");
    await expect(page.getByRole("navigation", { name: "Search for" }).getByRole("link", { name: "Activities" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.getByRole("link", { name: "Location: HSR Layout, 5 km. Change" })).toHaveAttribute("href", "/location?from=search-activities");
    await expect(countLine(page)).toHaveText("6 activities on any day within 5 km");
    // Connections-only (Rohan, connected) shows; Kabir's poker (not my interest, not connected) doesn't.
    await expect(cards(page)).toHaveText([
      /Early swim at the club/, /Sunrise trek/, /Saturday morning doubles/, /Coffee exploration/, /Poker Night/, /Nandi Hills sunrise hike/,
    ]);
    const trek = cards(page).filter({ hasText: "Sunrise trek" });
    await expect(trek).toContainText("Full · requests closed");
    await expect(trek).toHaveClass(/opacity-60/);
    await expect(trek.getByRole("button")).toHaveCount(0);
    await expect(cards(page).filter({ hasText: "Poker Night" }).getByRole("link")).toHaveAttribute("href", "/activities/a-mine/manage");

    await cards(page).filter({ hasText: "Saturday morning doubles" }).click();
    await expect(page).toHaveURL("/activities/a-doubles?from=search-activities");
    await page.getByRole("link", { name: "Back to Search" }).filter({ visible: true }).click();
    await expect(page).toHaveURL("/search/activities");
  });

  test("interest, day chips and calendar filter; count line names the day", async ({ page }) => {
    await page.goto("/search/activities");
    const dates = page.getByRole("navigation", { name: "Date" });
    await expect(dates.getByRole("link")).toHaveCount(4);
    await expect(dates.getByRole("link", { name: "Any day" })).toHaveAttribute("aria-current", "true");
    // Third day chip = today + 2 → the swim.
    await dates.getByRole("link").nth(3).click();
    await expect(page).toHaveURL(/\/search\/activities\?date=\d{4}-\d{2}-\d{2}$/);
    await expect(countLine(page)).toHaveText(/^1 activity on \w{3} \d{1,2} \w{3} within 5 km$/);
    await expect(cards(page)).toHaveText([/Early swim at the club/]);

    await page.getByLabel("Pick a date").fill(await page.evaluate(() => {
      const d = new Date(Date.now() + 5.5 * 3600_000 + 6 * 86_400_000);
      return d.toISOString().slice(0, 10);
    }));
    await expect(cards(page)).toHaveText([/Nandi Hills sunrise hike/]);
    await expect(page.getByLabel(/^Date: \w{3} \d{1,2} \w{3}\. Pick another date$/)).toBeVisible();
    await expect(dates.getByRole("link", { name: "Any day" })).not.toHaveAttribute("aria-current");

    await page.goto("/search/activities?interest=badminton");
    await expect(cards(page)).toHaveText([/Saturday morning doubles/]);
    await page.getByRole("button", { name: "Badminton" }).filter({ visible: true }).click();
    await page.getByRole("dialog", { name: "Show activities for" }).getByRole("link", { name: "All my interests" }).click();
    await expect(page).toHaveURL("/search/activities");
    // Unknown day / not-my-interest values fall back to Any day / All.
    await page.goto("/search/activities?interest=hike&date=2020-01-01");
    await expect(countLine(page)).toHaveText("2 activities on any day within 5 km");
    await page.goto("/search/activities?interest=poker");
    await expect(countLine(page)).toHaveText("6 activities on any day within 5 km");
  });

  test("Request to join straight from a card (Q-54)", async ({ page }) => {
    await page.goto("/search/activities");
    const card = cards(page).filter({ hasText: "Coffee exploration" });
    await card.getByRole("button", { name: "Request to join Coffee exploration" }).click();
    await expect(card.getByText("Requested · waiting for Ananya")).toBeVisible();
    await expect
      .poll(async () => (await getState()).activities.parts)
      .toContainEqual(expect.objectContaining({ activityId: "a-coffee", userId: "u1", status: "requested" }));
    await expect(cards(page).filter({ hasText: "Nandi Hills sunrise hike" })).toContainText("You're in");
  });

  test("S10 See all → From your people chip, removable", async ({ page }) => {
    await page.goto("/activities");
    await page.getByRole("link", { name: "See all" }).click();
    await expect(page).toHaveURL("/search/activities?from=people");
    await expect(cards(page)).toHaveText([/Early swim at the club/, /Nandi Hills sunrise hike/]);
    await page.getByRole("link", { name: "Remove filter: From your people" }).click();
    await expect(page).toHaveURL("/search/activities");
    await expect(cards(page)).toHaveCount(6);
  });

  test("empty state", async ({ page }) => {
    await page.goto("/search/activities?q=zzz");
    await expect(page.getByRole("heading", { name: "Nothing on that day yet" })).toBeVisible();
    await expect(page.getByText("Be the first. People nearby who share the interest will see it.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Create activity", exact: true })).toHaveAttribute("href", "/activities/new");
  });
});

const widths = [
  { width: 1440, height: 900, cols: 3, mobile: false },
  { width: 1024, height: 768, cols: 3, mobile: false },
  { width: 768, height: 1024, cols: 2, mobile: false },
  { width: 390, height: 844, cols: 1, mobile: true },
];

/** Cards sharing the first card's row (out of the first three). */
async function columns(list: ReturnType<typeof cards>) {
  const ys = await Promise.all((await list.all()).slice(0, 3).map(async (c) => Math.round((await c.boundingBox())!.y)));
  return ys.filter((y) => y === ys[0]).length;
}

for (const w of widths) {
  test.describe(`S18/S19 layout @ ${w.width}px`, () => {
    test.use({ viewport: { width: w.width, height: w.height } });

    for (const [path, testid, shot] of [
      ["/search/people?interest=badminton", "person-card", "s18"],
      ["/search/activities", "activity-card", "s19"],
    ] as const) {
      test(path, async ({ page }) => {
        await page.goto(path);
        const list = page.getByTestId(testid).filter({ visible: true });
        await expect(list.first()).toBeVisible();
        await expectNoHorizontalScroll(page, w.width);
        const nav = page.getByRole("navigation", { name: "Main" });
        await expect(nav.getByRole("link", { name: "Search" })).toHaveAttribute("aria-current", "page");
        expect(await columns(list)).toBe(w.cols);

        const search = (await input(page).boundingBox())!;
        expect(search.height).toBe(54);
        const seg = (await page.getByRole("navigation", { name: "Search for" }).boundingBox())!;
        // Q-07: location/distance and interest filter share one row.
        const loc = (await page.getByRole("link", { name: /^Location:/ }).filter({ visible: true }).boundingBox())!;
        const filter = (await page.getByRole("button", { name: /All my interests|Badminton/ }).filter({ visible: true }).boundingBox())!;
        expect(Math.abs(filter.y - loc.y)).toBeLessThan(2);
        if (w.mobile) {
          await expect(page.getByRole("heading", { level: 1, name: "Search" })).toBeAttached();
          expect(seg.y).toBeGreaterThan(search.y + search.height); // stacked
        } else {
          await expect(page.getByRole("heading", { level: 1, name: "Search" })).toBeVisible();
          expect(Math.abs(seg.y + seg.height / 2 - (search.y + search.height / 2))).toBeLessThan(4); // same row
        }
        if (testid === "person-card") {
          const photo = list.first().locator("div").first();
          expect((await photo.boundingBox())!.height).toBe(170);
          const btn = (await list.first().getByRole("button").boundingBox())!;
          expect(btn.height).toBeGreaterThanOrEqual(44);
        }
        await page.screenshot({ path: `test-results/${shot}-${w.width}.png`, fullPage: true });
      });
    }
  });
}
