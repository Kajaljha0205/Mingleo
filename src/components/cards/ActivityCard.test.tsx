import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActivityCard, type ActivityCardData } from "./ActivityCard";

const A: ActivityCardData = {
  id: "a1",
  interest: { slug: "poker", name: "Poker" },
  title: "Poker Night with a really long title that should truncate",
  host: { id: "h1", firstName: "Rohan", photoUrl: null },
  startsAt: "2026-11-28T13:30:00Z",
  areaName: "HSR Layout",
  distanceKm: 1.84,
  limit: 5,
  going: 2,
};

describe("ActivityCard (ST-018.1)", () => {
  it("has one link (stretched over the card) plus cover chip, host, going/limit, date, place + distance and spots", () => {
    render(<ActivityCard activity={A} href="/activities/a1" action={<button type="button">Request to join</button>} />);
    const card = screen.getByTestId("activity-card");
    expect(screen.getByRole("link")).toHaveAttribute("href", "/activities/a1");
    expect(screen.getByRole("link")).toHaveClass("after:inset-0");
    expect(screen.getByRole("button", { name: "Request to join" }).parentElement).toHaveClass("relative", "z-10");
    expect(card).toHaveTextContent("Poker");
    expect(card).toHaveTextContent("Hosted by Rohan");
    expect(screen.getByLabelText("2 of 5 going")).toHaveTextContent("2 / 5");
    expect(card).toHaveTextContent("Sat, 28 Nov · 7:00 PM");
    expect(card).toHaveTextContent("HSR Layout · 1.8 km");
    expect(card).toHaveTextContent("3 spots left");
    expect(screen.getByRole("heading", { level: 3 })).toHaveClass("truncate");
  });

  it("shows Full when every spot is taken", () => {
    render(<ActivityCard activity={{ ...A, going: 5 }} href="/activities/a1" />);
    expect(screen.getByText("Full")).toBeInTheDocument();
    expect(screen.queryByText(/spots? left/)).toBeNull();
  });
});
