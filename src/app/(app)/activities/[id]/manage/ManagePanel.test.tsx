import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { JoinRequest } from "@/server/activities";

const actions = {
  acceptRequest: vi.fn(async (): Promise<{ error?: string }> => ({})),
  declineRequest: vi.fn(async (): Promise<{ error?: string }> => ({})),
  undoDecline: vi.fn(async (): Promise<{ error?: string }> => ({})),
  cancelActivity: vi.fn(async (): Promise<{ error?: string }> => ({})),
};
vi.mock("../../actions", () => actions);

const { RequestsPanel, HostActions } = await import("./ManagePanel");

const KABIR: JoinRequest = {
  participationId: "r1",
  id: "u-kabir",
  firstName: "Kabir",
  photoUrl: null,
  age: 30,
  connected: false,
  distanceKm: 0.8,
  sharedInterests: ["Poker", "PS5 / Gaming"],
};

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.useRealTimers());

function renderPanel(full = false) {
  return render(
    <ToastProvider>
      <RequestsPanel requests={[KABIR]} full={full} open />
    </ToastProvider>,
  );
}

describe("S14 requests (ST-121–123)", () => {
  it("shows the person and links to their profile", () => {
    renderPanel();
    const card = screen.getByTestId("request-card");
    expect(within(card).getByRole("link")).toHaveAttribute("href", "/people/u-kabir?from=activities");
    expect(card).toHaveTextContent("Kabir, 30");
    expect(card).toHaveTextContent("Not connected · 0.8 km · Poker, PS5 / Gaming");
  });

  it("Accept → spec toast", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole("button", { name: "Accept" }));
    expect(actions.acceptRequest).toHaveBeenCalledWith("r1");
    expect(await screen.findByText("Kabir is in. They can now see the group chat.")).toBeInTheDocument();
  });

  it("Accept is disabled when the activity is full", () => {
    renderPanel(true);
    expect(screen.getByRole("button", { name: "Accept" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Decline" })).toBeEnabled();
  });

  it("Decline hides the card and offers Undo with a countdown; Undo brings it back", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole("button", { name: "Decline" }));
    expect(actions.declineRequest).toHaveBeenCalledWith("r1");
    expect(screen.queryByTestId("request-card")).toBeNull();
    expect(await screen.findByText("Declined. Kabir gets a polite notification.")).toBeInTheDocument();
    const undo = screen.getByRole("button", { name: /Undo/ });
    expect(undo).toHaveTextContent("0:10");
    await user.click(undo);
    expect(actions.undoDecline).toHaveBeenCalledWith("r1");
    expect(await screen.findByTestId("request-card")).toBeInTheDocument();
  });

  it("the Undo toast disappears after 10 seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPanel();
    await user.click(screen.getByRole("button", { name: "Decline" }));
    expect(await screen.findByRole("button", { name: /Undo/ })).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(10_100);
    });
    expect(screen.queryByRole("button", { name: /Undo/ })).toBeNull();
    expect(actions.undoDecline).not.toHaveBeenCalled();
  });
});

describe("S15 cancel dialog (ST-125)", () => {
  it("names participants and the waiting count, sends the note, Keep it closes", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <HostActions activityId="a1" title="Poker Night" editable participantNames={["Rohan"]} waiting={2} />
      </ToastProvider>,
    );
    expect(screen.getByRole("link", { name: "Edit details" })).toHaveAttribute("href", "/activities/a1/edit");
    expect(screen.getByRole("link", { name: "Group chat" })).toHaveAttribute("href", "/activities/a1/chat");

    await user.click(screen.getByRole("button", { name: "Cancel activity" }));
    const dialog = screen.getByRole("dialog", { name: "Cancel Poker Night?" });
    expect(dialog).toHaveTextContent(
      "Rohan and the 2 people waiting on a reply will be notified. It stays in your activity history as Cancelled. This can’t be undone.",
    );
    await user.click(within(dialog).getByRole("button", { name: "Keep it" }));
    expect(dialog).not.toHaveAttribute("open");
    expect(actions.cancelActivity).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Cancel activity" }));
    await user.type(within(dialog).getByLabelText("Note to participants"), "Rain, sorry!");
    expect(within(dialog).getByLabelText("Note to participants")).toHaveAttribute("placeholder", "e.g. Something came up, sorry!");
    await user.click(within(dialog).getByRole("button", { name: "Cancel activity" }));
    expect(actions.cancelActivity).toHaveBeenCalledWith("a1", "Rain, sorry!");
    expect(await screen.findByText("Activity cancelled. Everyone involved has been told.")).toBeInTheDocument();
  });
});
