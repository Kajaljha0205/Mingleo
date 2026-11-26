import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { Phase, ViewerState } from "@/server/activities";

type R = { state?: ViewerState; error?: string };
const actions = {
  requestToJoin: vi.fn(async (): Promise<R> => ({ state: "requested" })),
  withdrawJoinRequest: vi.fn(async (): Promise<R> => ({ state: "none" })),
  withdrawFromActivity: vi.fn(async (): Promise<R> => ({ state: "withdrawn" })),
};
vi.mock("../actions", () => actions);

const { JoinControl } = await import("./JoinControl");

beforeEach(() => vi.clearAllMocks());

function renderControl(initial: ViewerState, opts: { full?: boolean; phase?: Phase } = {}) {
  return render(
    <ToastProvider>
      <JoinControl activityId="a1" hostName="Tanvi" initial={initial} full={opts.full ?? false} phase={opts.phase ?? "open"} />
    </ToastProvider>,
  );
}

const NOTE = "Tanvi approves every request. Joining doesn't make you connections.";

describe("S11 join control (ST-103, all viewer states)", () => {
  it("not requested + spots → Count me in → Requested · waiting for host + Withdraw request", async () => {
    const user = userEvent.setup();
    renderControl("none");
    expect(screen.getByText(NOTE)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Count me in" }));
    expect(actions.requestToJoin).toHaveBeenCalledWith("a1");
    expect(await screen.findByText("Requested · waiting for Tanvi")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Withdraw request" }));
    expect(actions.withdrawJoinRequest).toHaveBeenCalledWith("a1");
    expect(await screen.findByRole("button", { name: "Count me in" })).toBeEnabled();
  });

  it("rolls back with an error toast when the server refuses", async () => {
    actions.requestToJoin.mockResolvedValueOnce({ error: "This activity is full." });
    const user = userEvent.setup();
    renderControl("none");
    await user.click(screen.getByRole("button", { name: "Count me in" }));
    expect(await screen.findByText("This activity is full.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Count me in" })).toBeInTheDocument();
  });

  it("accepted → You're in, Open chat → S16, Withdraw from activity", async () => {
    const user = userEvent.setup();
    renderControl("accepted");
    expect(screen.getByText("You're in")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open chat" })).toHaveAttribute("href", "/activities/a1/chat");
    await user.click(screen.getByRole("button", { name: "Withdraw from activity" }));
    expect(actions.withdrawFromActivity).toHaveBeenCalledWith("a1");
  });

  it("declined → polite line, no request button", () => {
    renderControl("declined");
    expect(screen.getByText("Tanvi couldn't fit you in this time")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("full → disabled Full · requests closed", () => {
    renderControl("none", { full: true });
    expect(screen.getByRole("button", { name: "Full · requests closed" })).toBeDisabled();
  });

  it("cancelled → no actions (the page shows the Cancelled by host banner)", () => {
    renderControl("closed", { phase: "cancelled" });
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText(NOTE)).toBeNull();
  });

  it("host → Manage activity link to S14, no join note", () => {
    renderControl("host");
    expect(screen.getByRole("link", { name: "Manage activity" })).toHaveAttribute("href", "/activities/a1/manage");
    expect(screen.queryByText(NOTE)).toBeNull();
  });

  it("completed → non-participants see Requests closed (participants redirect to S17)", () => {
    renderControl("none", { phase: "completed" });
    expect(screen.getByRole("button", { name: "Requests closed" })).toBeDisabled();
    expect(screen.queryByRole("link", { name: "After the activity" })).toBeNull();
  });
});
