import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("../actions", () => ({ saveAbout: vi.fn(async () => ({ errors: {} })) }));
const { AboutForm } = await import("./AboutForm");

const initial = { firstName: "Aarav", birthday: "", showAge: true, bio: "" };

describe("S03 AboutForm", () => {
  it("prefills the first name and blocks Continue until a valid birthday; under 18 offers deletion", async () => {
    const user = userEvent.setup();
    render(<AboutForm initial={initial} />);
    expect(screen.getByLabelText("First name")).toHaveValue("Aarav");
    const cont = screen.getByRole("button", { name: "Continue" });
    expect(cont).toBeDisabled();

    const birthday = screen.getByLabelText("Birthday");
    await user.type(birthday, "01012015");
    expect(birthday).toHaveValue("01 / 01 / 2015");
    expect(
      screen.getByText(
        "You need to be 18 or older to use Mingleo. If you continue, your account will be deleted.",
      ),
    ).toBeInTheDocument();
    expect(birthday).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
    expect(screen.getByRole("button", { name: "Delete my account" })).toBeEnabled();

    await user.clear(birthday);
    await user.type(birthday, "01011998");
    expect(screen.queryByText(/18 or older/)).toBeNull();
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  it("shows a live bio counter and the show-age switch (default on)", async () => {
    const user = userEvent.setup();
    render(<AboutForm initial={initial} />);
    const sw = screen.getByRole("switch", { name: "Show my age on profile" });
    expect(sw).toHaveAttribute("aria-checked", "true");
    await user.click(sw);
    expect(sw).toHaveAttribute("aria-checked", "false");

    expect(screen.getByText("0 / 150")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Short bio"), "Weekend badminton");
    expect(screen.getByText("17 / 150")).toBeInTheDocument();
    expect(screen.getByLabelText("Short bio")).toHaveAttribute("maxlength", "150");
  });
});
