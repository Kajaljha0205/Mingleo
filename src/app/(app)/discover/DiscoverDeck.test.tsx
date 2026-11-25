import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { Candidate } from "@/server/discover";

const actions = {
  connect: vi.fn(async (): Promise<{ state?: string; error?: string }> => ({ state: "sent" })),
  skip: vi.fn(async (): Promise<{ error?: string }> => ({})),
  startOver: vi.fn(async (): Promise<{ error?: string }> => ({})),
};
vi.mock("../people/actions", () => actions);
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));

const { DiscoverDeck } = await import("./DiscoverDeck");

function person(id: string, firstName: string, extra: Partial<Candidate> = {}): Candidate {
  return {
    id,
    firstName,
    age: 28,
    photoUrl: null,
    areaName: "Koramangala",
    distanceKm: 2.5,
    bio: `${firstName}'s bio`,
    interests: [
      { name: "Hiking", shared: true },
      { name: "Concerts", shared: false },
    ],
    sharedCount: 1,
    mutual: [],
    hostedCount: 0,
    recentActivities: [],
    ...extra,
  };
}

function renderDeck(people: Candidate[]) {
  return render(
    <ToastProvider>
      <DiscoverDeck candidates={people} />
    </ToastProvider>,
  );
}

const currentName = () => screen.getByTestId("discover-card").getAttribute("aria-label");

beforeEach(() => vi.clearAllMocks());

describe("S08 DiscoverDeck", () => {
  it("shows one card with the next peeking, card details and the about panel", () => {
    renderDeck([
      person("a", "Ananya", { mutual: [{ id: "p", firstName: "Priya", photoUrl: null }, { id: "r", firstName: "Rohan", photoUrl: null }], hostedCount: 3 }),
      person("b", "Meera"),
    ]);
    expect(screen.getAllByTestId("discover-card")).toHaveLength(1);
    expect(screen.getByTestId("peek-card")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ananya, 28" })).toBeInTheDocument();
    expect(screen.getByText("1 shared interest")).toBeInTheDocument();
    expect(screen.getByText("2.5 km · Koramangala")).toBeInTheDocument();
    expect(screen.getByText("Hosted 3 activities · 2 mutual connections")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "About Ananya" })).toBeInTheDocument();
    expect(screen.getByText("You both know Priya and Rohan")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View full profile" })).toHaveAttribute("href", "/people/a?from=discover");
    expect(screen.getByRole("link", { name: "About Ananya" })).toHaveAttribute("href", "/people/a?from=discover");
    expect(screen.getByRole("link", { name: "Open Ananya's profile" })).toHaveAttribute("href", "/people/a?from=discover");
    expect(screen.getByText(/Swipe or use the buttons\. On a keyboard, Tab to Skip or Connect and press Enter\./)).toBeInTheDocument();
  });

  it("Connect sends a request, shows the toast and moves to the next card", async () => {
    const user = userEvent.setup();
    renderDeck([person("a", "Ananya"), person("b", "Meera")]);
    await user.click(screen.getByRole("button", { name: "Connect" }));
    expect(actions.connect).toHaveBeenCalledWith("a");
    expect(currentName()).toBe("Meera");
    expect(await screen.findByText("Request sent to Ananya. It shows as Pending until they accept.")).toBeInTheDocument();
  });

  it("rolls back and shows an error toast when Connect fails", async () => {
    actions.connect.mockResolvedValueOnce({ error: "You've sent 30 requests today. Try again tomorrow." });
    const user = userEvent.setup();
    renderDeck([person("a", "Ananya"), person("b", "Meera")]);
    await user.click(screen.getByRole("button", { name: "Connect" }));
    expect(await screen.findByText(/30 requests today/)).toBeInTheDocument();
    expect(currentName()).toBe("Ananya");
  });

  it("works from the keyboard: Tab to Skip, Enter", async () => {
    const user = userEvent.setup();
    renderDeck([person("a", "Ananya"), person("b", "Meera")]);
    const skip = screen.getByRole("button", { name: "Skip" });
    skip.focus();
    await user.keyboard("{Enter}");
    expect(actions.skip).toHaveBeenCalledWith("a");
    expect(currentName()).toBe("Meera");
  });

  it("swipe right connects, swipe left skips, a short swipe snaps back", async () => {
    renderDeck([person("a", "Ananya"), person("b", "Meera"), person("c", "Kabir")]);
    const swipe = (dx: number) => {
      const el = screen.getByTestId("swipe-surface");
      fireEvent.pointerDown(el, { clientX: 200, pointerType: "touch" });
      fireEvent.pointerMove(el, { clientX: 200 + dx / 2, pointerType: "touch" });
      fireEvent.pointerMove(el, { clientX: 200 + dx, pointerType: "touch" });
      fireEvent.pointerUp(el, { clientX: 200 + dx, pointerType: "touch" });
    };
    act(() => swipe(60));
    expect(currentName()).toBe("Ananya");
    expect(screen.getByTestId("swipe-surface").style.transform).toBe("");
    act(() => swipe(160));
    expect(actions.connect).toHaveBeenCalledWith("a");
    act(() => swipe(-160));
    expect(actions.skip).toHaveBeenCalledWith("b");
    expect(currentName()).toBe("Kabir");
  });

  it("follows fresh server results (request sent on S09, new radius) without bringing back handled people", async () => {
    const user = userEvent.setup();
    const view = renderDeck([person("a", "Ananya"), person("b", "Meera"), person("c", "Aarav")]);
    await user.click(screen.getByRole("button", { name: "Skip" }));
    expect(currentName()).toBe("Meera");

    // Server no longer returns Meera (e.g. requested from her profile); Ananya is still in a stale list.
    view.rerender(
      <ToastProvider>
        <DiscoverDeck candidates={[person("a", "Ananya"), person("c", "Aarav")]} />
      </ToastProvider>,
    );
    expect(currentName()).toBe("Aarav");

    // Smaller radius: nobody left.
    view.rerender(
      <ToastProvider>
        <DiscoverDeck candidates={[]} />
      </ToastProvider>,
    );
    expect(screen.getByRole("heading", { name: "You\u2019re all caught up" })).toBeInTheDocument();
  });

  it("shows the empty state and Start over reloads the queue", async () => {
    const user = userEvent.setup();
    renderDeck([]);
    expect(screen.getByRole("heading", { name: "You\u2019re all caught up" })).toBeInTheDocument();
    expect(screen.getByText("New people show up as they join. Skipped profiles can come back in a later round.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Start over" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(actions.startOver).toHaveBeenCalled();
  });
});
