import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";

type R = { state?: string; error?: string };
const actions = {
  connect: vi.fn(async (): Promise<R> => ({ state: "sent" })),
  withdrawRequest: vi.fn(async (): Promise<R> => ({ state: "none" })),
  respondToRequest: vi.fn(async (_id: string, accept: boolean): Promise<R> => ({ state: accept ? "connected" : "none" })),
  blockPerson: vi.fn(async (): Promise<{ error?: string }> => ({})),
  reportPerson: vi.fn(async (): Promise<{ error?: string }> => ({})),
};
vi.mock("../actions", () => actions);
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

const { PersonActions } = await import("./PersonActions");

beforeAll(() => {
  // jsdom lacks <dialog> modal APIs.
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
beforeEach(() => vi.clearAllMocks());

function renderActions(initial: "none" | "sent" | "received" | "connected") {
  return render(
    <ToastProvider>
      <PersonActions personId="m" name="Meera" initial={initial} backHref="/discover" />
    </ToastProvider>,
  );
}

describe("S09 relationship control", () => {
  it("none → Connect → Pending (disabled, sunshine) + Withdraw, with the spec toast", async () => {
    const user = userEvent.setup();
    renderActions("none");
    await user.click(screen.getByRole("button", { name: "Connect" }));
    expect(actions.connect).toHaveBeenCalledWith("m");
    expect(await screen.findByText("Request sent. We\u2019ll tell you when Meera accepts.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pending" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Pending" })).toHaveClass("bg-sunshine!");

    await user.click(screen.getByRole("button", { name: "Withdraw" }));
    expect(actions.withdrawRequest).toHaveBeenCalledWith("m");
    expect(await screen.findByRole("button", { name: "Connect" })).toBeEnabled();
  });

  it("rolls back on error", async () => {
    actions.connect.mockResolvedValueOnce({ error: "This person isn't available any more." });
    const user = userEvent.setup();
    renderActions("none");
    await user.click(screen.getByRole("button", { name: "Connect" }));
    expect(await screen.findByText("This person isn't available any more.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect" })).toBeInTheDocument();
  });

  it("received → Accept / Decline", async () => {
    const user = userEvent.setup();
    renderActions("received");
    expect(screen.getByRole("button", { name: "Decline" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Accept" }));
    expect(actions.respondToRequest).toHaveBeenCalledWith("m", true);
    expect(await screen.findByText("Connected")).toBeInTheDocument();
  });

  it("connected → Connected pill + Message opens the direct chat", () => {
    renderActions("connected");
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Message" })).toHaveAttribute("href", "/chats/with/m");
  });

  it("More → Block → confirm blocks and goes back", async () => {
    const user = userEvent.setup();
    renderActions("none");
    await user.click(screen.getByRole("button", { name: "More: report or block" }));
    await user.click(screen.getByRole("button", { name: "Block Meera" }));
    const dialog = screen.getByRole("dialog", { name: "Block Meera?" });
    await user.click(within(dialog).getByRole("button", { name: "Block" }));
    expect(actions.blockPerson).toHaveBeenCalledWith("m");
    expect(push).toHaveBeenCalledWith("/discover");
  });

  it("More → Report needs a reason; note is optional", async () => {
    const user = userEvent.setup();
    renderActions("none");
    await user.click(screen.getByRole("button", { name: "More: report or block" }));
    await user.click(screen.getByRole("button", { name: "Report Meera" }));
    const dialog = screen.getByRole("dialog", { name: "Report Meera" });
    const send = within(dialog).getByRole("button", { name: "Send report" });
    expect(send).toBeDisabled();
    expect(within(dialog).getAllByRole("radio").map((r) => r.closest("label")?.textContent)).toEqual([
      "Fake profile",
      "Inappropriate photo or bio",
      "Harassment or hate",
      "Spam or scam",
      "Under 18",
      "Something else",
    ]);
    await user.click(within(dialog).getByRole("radio", { name: "Spam or scam" }));
    await user.type(within(dialog).getByLabelText("Anything else? (optional)"), "Asked for money");
    await user.click(send);
    expect(actions.reportPerson).toHaveBeenCalledWith("m", "spam", "Asked for money");
    expect(await screen.findByText("Thanks. We\u2019ll review your report.")).toBeInTheDocument();
  });
});
