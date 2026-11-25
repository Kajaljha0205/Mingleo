import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";

type R = { state?: string; error?: string };
const actions = {
  respondToRequest: vi.fn(async (_id: string, accept: boolean): Promise<R> => ({ state: accept ? "connected" : "none" })),
  undoConnectionDecline: vi.fn(async (): Promise<R> => ({ state: "received" })),
};
vi.mock("../people/actions", () => actions);

const { ConnectionRequestCard } = await import("./ConnectionRequestCard");

beforeEach(() => vi.clearAllMocks());

const actor = { id: "n", firstName: "Nikhil", photoUrl: null, connected: false, distanceKm: 1.2, sharedCount: 3 };

function renderCard() {
  return render(
    <ToastProvider>
      <ConnectionRequestCard actor={actor} when="2h ago" />
    </ToastProvider>,
  );
}

describe("S20 connection request card", () => {
  it("shows who, shared interests, distance and time", () => {
    renderCard();
    expect(screen.getByRole("heading", { name: "Nikhil wants to connect" })).toBeInTheDocument();
    expect(screen.getByText("3 shared interests · 1.2 km · 2h ago")).toBeInTheDocument();
  });

  it("Accept → connected toast; card leaves", async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole("button", { name: "Accept Nikhil" }));
    expect(actions.respondToRequest).toHaveBeenCalledWith("n", true);
    expect(await screen.findByText("You\u2019re now connected with Nikhil.")).toBeInTheDocument();
    expect(screen.queryByTestId("connection-request")).toBeNull();
  });

  it("Decline → 'Request declined' + Undo brings the card back", async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole("button", { name: "Decline Nikhil" }));
    expect(actions.respondToRequest).toHaveBeenCalledWith("n", false);
    expect(await screen.findByText("Request declined.")).toBeInTheDocument();
    expect(screen.queryByTestId("connection-request")).toBeNull();
    await user.click(screen.getByRole("button", { name: /Undo/ }));
    expect(actions.undoConnectionDecline).toHaveBeenCalledWith("n");
    expect(await screen.findByTestId("connection-request")).toBeInTheDocument();
  });

  it("rolls back with an error toast", async () => {
    actions.respondToRequest.mockResolvedValueOnce({ error: "This person isn't available any more." });
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole("button", { name: "Accept Nikhil" }));
    expect(await screen.findByText("This person isn't available any more.")).toBeInTheDocument();
    expect(screen.getByTestId("connection-request")).toBeInTheDocument();
  });
});
