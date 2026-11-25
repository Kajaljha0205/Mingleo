import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const saveLocation = vi.fn(async () => ({ error: "" }));
vi.mock("../actions", () => ({ saveLocation }));
const { LocationStep } = await import("./LocationStep");

function mockGeolocation(impl: (ok: PositionCallback, fail: PositionErrorCallback) => void) {
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition: vi.fn(impl) },
  });
}

afterEach(() => vi.clearAllMocks());

describe("S06 LocationStep", () => {
  it("explains before asking, then snaps current location to a neighbourhood", async () => {
    const user = userEvent.setup();
    mockGeolocation((ok) =>
      ok({ coords: { latitude: 12.912, longitude: 77.645 } } as GeolocationPosition),
    );
    render(<LocationStep initialAreaSlug={null} initialRadius={5} />);
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Use current location" }));
    expect(navigator.geolocation.getCurrentPosition).not.toHaveBeenCalled();
    expect(screen.getByText(/never your exact location/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Allow location" }));
    expect(screen.getByRole("img", { name: "HSR Layout, Bengaluru, within 5 km" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  it("falls back to Choose an area when permission is denied", async () => {
    const user = userEvent.setup();
    mockGeolocation((_ok, fail) => fail({ code: 1 } as GeolocationPositionError));
    render(<LocationStep initialAreaSlug={null} initialRadius={5} />);
    await user.click(screen.getByRole("button", { name: "Use current location" }));
    await user.click(screen.getByRole("button", { name: "Allow location" }));

    expect(screen.getByRole("status")).toHaveTextContent("Location is off. Choose an area instead.");
    await user.type(screen.getByLabelText("Choose an area"), "indira");
    await user.click(screen.getByRole("button", { name: "Indiranagar" }));
    expect(screen.getByText("Indiranagar, Bengaluru")).toBeInTheDocument();
  });

  it("radius chips default to 5 km and save the chosen area + radius", async () => {
    const user = userEvent.setup();
    render(<LocationStep initialAreaSlug="hsr-layout" initialRadius={5} from="review" />);
    expect(screen.getByRole("button", { name: "5 km" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "10 km" }));
    expect(screen.getByRole("button", { name: "5 km" })).toHaveAttribute("aria-pressed", "false");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(saveLocation).toHaveBeenCalledWith("hsr-layout", 10, "review");
  });
});
