import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const saveInterests = vi.fn(async () => ({ error: "" }));
vi.mock("../actions", () => ({ saveInterests }));
const { InterestsStep } = await import("./InterestsStep");

const catalogue = [
  "Badminton", "Swimming", "Poker", "Board games", "PS5 / Gaming", "Hiking", "Cycling",
  "Cafe exploration", "Shopping", "Concerts", "Music", "Movies", "Road trips", "Food exploration",
].map((name, i) => ({ id: i + 1, slug: `s${i}`, name }));

describe("S05 InterestsStep", () => {
  it("shows 14 toggle chips and the pick-3 footer", async () => {
    const user = userEvent.setup();
    render(<InterestsStep interests={catalogue} initialSelected={[]} />);
    expect(screen.getAllByRole("button", { pressed: false })).toHaveLength(14);
    expect(screen.getByText("0 selected")).toBeInTheDocument();
    expect(screen.getByText("Pick 3 more")).toHaveClass("text-sunshine-text");
    const cont = screen.getByRole("button", { name: "Continue" });
    expect(cont).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Badminton" }));
    await user.click(screen.getByRole("button", { name: "Poker" }));
    expect(screen.getByText("Pick 1 more")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Hiking" }));
    expect(screen.getByText("3 selected")).toBeInTheDocument();
    expect(screen.getByText("Great, that's enough")).toHaveClass("text-sage-text");
    expect(screen.getByRole("button", { name: "Hiking" })).toHaveAttribute("aria-pressed", "true");

    await user.click(cont);
    expect(saveInterests).toHaveBeenCalledWith([1, 3, 6], undefined);
  });

  it("deselects on second tap", async () => {
    const user = userEvent.setup();
    render(<InterestsStep interests={catalogue} initialSelected={[1, 2, 3]} from="review" />);
    await user.click(screen.getByRole("button", { name: "Swimming" }));
    expect(screen.getByText("2 selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });
});
