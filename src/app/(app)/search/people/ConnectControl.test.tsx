import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";

type R = { state?: string; error?: string };
const actions = {
  connect: vi.fn(async (): Promise<R> => ({ state: "sent" })),
  withdrawRequest: vi.fn(async (): Promise<R> => ({ state: "none" })),
  respondToRequest: vi.fn(async (_id: string, accept: boolean): Promise<R> => ({ state: accept ? "connected" : "none" })),
};
vi.mock("@/app/(app)/people/actions", () => actions);

const { ConnectControl } = await import("./ConnectControl");

beforeEach(() => vi.clearAllMocks());

function renderControl(initial: "none" | "sent" | "received" | "connected") {
  return render(
    <ToastProvider>
      <ConnectControl personId="k" name="Kabir" initial={initial} />
    </ToastProvider>,
  );
}

describe("S18 card control", () => {
  it("Connect → Pending · tap to withdraw → Connect", async () => {
    const user = userEvent.setup();
    renderControl("none");
    await user.click(screen.getByRole("button", { name: "Connect with Kabir" }));
    expect(actions.connect).toHaveBeenCalledWith("k");
    const pending = await screen.findByRole("button", { name: "Pending. Withdraw request to Kabir" });
    expect(pending).toHaveTextContent("Pending · tap to withdraw");
    await user.click(pending);
    expect(actions.withdrawRequest).toHaveBeenCalledWith("k");
    expect(await screen.findByRole("button", { name: "Connect with Kabir" })).toBeEnabled();
  });

  it("rolls back with an error toast", async () => {
    actions.connect.mockResolvedValueOnce({ error: "You've sent 20 requests today. Try again tomorrow." });
    const user = userEvent.setup();
    renderControl("none");
    await user.click(screen.getByRole("button", { name: "Connect with Kabir" }));
    expect(await screen.findByText("You've sent 20 requests today. Try again tomorrow.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect with Kabir" })).toBeInTheDocument();
  });

  it("when they already asked, Connect accepts", async () => {
    const user = userEvent.setup();
    renderControl("received");
    await user.click(screen.getByRole("button", { name: "Connect with Kabir" }));
    expect(actions.respondToRequest).toHaveBeenCalledWith("k", true);
    expect(await screen.findByRole("link", { name: "Connected. Message Kabir" })).toHaveAttribute("href", "/chats/with/k");
  });

  it("connected → Connected · message opens the direct chat", () => {
    renderControl("connected");
    const link = screen.getByRole("link", { name: "Connected. Message Kabir" });
    expect(link).toHaveTextContent("Connected · message");
    expect(link).toHaveAttribute("href", "/chats/with/k");
  });
});
