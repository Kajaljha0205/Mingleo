import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { Settings } from "@/lib/settings";

const actions = {
  updateSetting: vi.fn(async (): Promise<{ error?: string }> => ({})),
  unblockPerson: vi.fn(async (): Promise<{ error?: string }> => ({})),
};
vi.mock("./actions", () => actions);
vi.mock("@/app/auth/actions", () => ({ signOut: vi.fn() }));

const { SettingsForm } = await import("./SettingsForm");

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
beforeEach(() => vi.clearAllMocks());

const initial: Settings = {
  radiusKm: 5, discoverable: true, showAge: true, historyVisibility: "connections",
  notifyConnectionRequests: true, notifyNewActivities: true, notifyJoinDecisions: true, notifyRequestDeclined: false,
};

function renderForm(blocked = [{ id: "m", firstName: "Meera", photoUrl: null }]) {
  return render(
    <ToastProvider>
      <SettingsForm initial={initial} place="HSR Layout, Bengaluru" blocked={blocked} />
    </ToastProvider>,
  );
}

describe("S22 settings form", () => {
  it("saves each change immediately with the right key and value", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: "25 km" }));
    expect(actions.updateSetting).toHaveBeenCalledWith("radiusKm", 25);
    await user.click(screen.getByRole("switch", { name: "Show me in Discover" }));
    expect(actions.updateSetting).toHaveBeenCalledWith("discoverable", false);
    expect(screen.getByText("Hidden. Existing connections are unaffected")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Who sees my activity history"), "nearby");
    expect(actions.updateSetting).toHaveBeenCalledWith("historyVisibility", "nearby");
    await user.click(screen.getByRole("switch", { name: "When a request is declined" }));
    expect(actions.updateSetting).toHaveBeenCalledWith("notifyRequestDeclined", true);
  });

  it("rolls back with an error toast when saving fails", async () => {
    actions.updateSetting.mockResolvedValueOnce({ error: "Couldn't save. Please try again." });
    const user = userEvent.setup();
    renderForm();
    const sw = screen.getByRole("switch", { name: "Show my age on profile" });
    await user.click(sw);
    expect(await screen.findByText("Couldn't save. Please try again.")).toBeInTheDocument();
    expect(sw).toHaveAttribute("aria-checked", "true");
  });

  it("blocked people: count, Unblock asks to confirm, then removes them", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: /Blocked people.*1 person/ }));
    await user.click(screen.getByRole("button", { name: "Unblock Meera" }));
    const confirm = screen.getByRole("group", { name: "Unblock Meera?" });
    await user.click(within(confirm).getByRole("button", { name: "Cancel" }));
    expect(actions.unblockPerson).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Unblock Meera" }));
    await user.click(within(screen.getByRole("group", { name: "Unblock Meera?" })).getByRole("button", { name: "Unblock" }));
    expect(actions.unblockPerson).toHaveBeenCalledWith("m");
    expect(await screen.findByText("Meera is unblocked.")).toBeInTheDocument();
    expect(screen.getByText("You haven't blocked anyone.")).toBeInTheDocument();
  });
});
