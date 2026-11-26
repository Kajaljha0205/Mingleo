import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

let query = "";
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(query) }));
const { default: WelcomePage } = await import("./page");

describe("S01 Welcome", () => {
  it("shows the animated brand headline, subline, Bengaluru map and sign-in card", () => {
    render(<WelcomePage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Real people. Real plans." }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Less scrolling, more strolling\. Meet people nearby/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /Stylised map of Bengaluru/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: /Find people\.\s*Do things together\./ }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Meet people nearby who share your interests, and turn plans into real meetups.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Friends meeting in a park/ })).toHaveAttribute("src");
  });

  it("shows the wordmark, Piloting in Bengaluru, and removes the old 1–5 steps list", () => {
    render(<WelcomePage />);
    expect(screen.getByText("mingleo")).toBeInTheDocument();
    expect(screen.getByTestId("brand-panel")).toBeInTheDocument();
    expect(screen.getAllByText("Piloting in Bengaluru").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole("list", { name: "Sign-up steps" })).not.toBeInTheDocument();
  });

  it("has a single Continue with Google action that posts to /auth/google", () => {
    render(<WelcomePage />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
    const google = screen.getByRole("button", { name: "Continue with Google" });
    expect(google).toHaveAttribute("type", "submit");
    const form = google.closest("form")!;
    expect(form).toHaveAttribute("action", "/auth/google");
    expect(form).toHaveAttribute("method", "post");
    expect(screen.queryByText(/I already have an account/)).not.toBeInTheDocument();
  });

  it("shows the terms footer and no onboarding progress", () => {
    render(<WelcomePage />);
    expect(
      screen.getByText("By continuing you agree to our Terms and Privacy Policy."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Back" })).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("explains when an under-18 account was deleted", () => {
    query = "account=deleted";
    render(<WelcomePage />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Your account has been deleted. You need to be 18 or older to use Mingleo.",
    );
    query = "";
  });
});
