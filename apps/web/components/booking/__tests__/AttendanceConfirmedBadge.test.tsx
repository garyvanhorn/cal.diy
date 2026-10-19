import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AttendanceConfirmedBadge } from "../AttendanceConfirmedBadge";

vi.mock("@calcom/lib/hooks/useLocale", () => ({
  useLocale: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key}:${vars.confirmed}/${vars.total}` : key,
  }),
}));

describe("AttendanceConfirmedBadge", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders nothing until someone confirms", () => {
    render(<AttendanceConfirmedBadge attendees={[{ confirmedAt: null }, {}]} />);

    expect(screen.queryByTestId("attendance_confirmed_badge")).toBeNull();
  });

  it("shows a simple label for a single attendee", () => {
    render(<AttendanceConfirmedBadge attendees={[{ confirmedAt: "2026-10-20T00:00:00.000Z" }]} />);

    expect(screen.getByTestId("attendance_confirmed_badge").textContent).toContain("attendee_confirmed");
  });

  it("shows how many of several attendees confirmed", () => {
    render(
      <AttendanceConfirmedBadge
        attendees={[{ confirmedAt: new Date() }, { confirmedAt: null }, { confirmedAt: new Date() }]}
      />
    );

    expect(screen.getByTestId("attendance_confirmed_badge").textContent).toContain(
      "attendees_confirmed_count:2/3"
    );
  });
});
