import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OnboardingActions, OnboardingShell } from "./OnboardingShell";

describe("OnboardingShell", () => {
  it("shows n/5 progress, a back link and ticks completed steps", () => {
    render(
      <OnboardingShell step={3} backHref="/onboarding/photo">
        <p>content</p>
      </OnboardingShell>,
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "3");
    expect(screen.getByText("3/5")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute(
      "href",
      "/onboarding/photo",
    );
    const steps = within(screen.getByRole("list", { name: "Sign-up steps" }));
    expect(steps.getAllByRole("listitem").map((li) => li.textContent?.replace(/^\d/, ""))).toEqual(
      ["About you", "Photo", "Interests", "Location", "Review"],
    );
    expect(steps.getAllByLabelText("Completed")).toHaveLength(2);
    expect(steps.getByText("Interests").closest("li")).toHaveAttribute("aria-current", "step");
    expect(within(screen.getByTestId("onboarding-card")).queryByText("mingleo")).toBeNull();
  });

  it("offers Sign out instead of Back on the first step", () => {
    render(
      <OnboardingShell step={1}>
        <p>content</p>
      </OnboardingShell>,
    );
    expect(screen.getByText("1/5")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Back" })).toBeNull();
    expect(screen.getByRole("button", { name: "Sign out" })).toHaveAttribute("type", "submit");
  });

  it("renders actions in a sticky bar that becomes inline from md", () => {
    render(
      <OnboardingShell>
        <OnboardingActions>
          <button>Continue</button>
        </OnboardingActions>
      </OnboardingShell>,
    );
    const bar = screen.getByRole("button", { name: "Continue" }).parentElement!;
    expect(bar).toHaveClass("sticky", "bottom-0", "md:static");
  });
});
