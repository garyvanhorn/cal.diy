import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventRemindersSection } from "./EventRemindersSection";

const { state, mutate } = vi.hoisted(() => ({
  state: { minutesBefore: [] as number[] },
  mutate: vi.fn(),
}));

vi.mock("@calcom/trpc/react", () => ({
  trpc: {
    useUtils: () => ({ viewer: { eventTypes: { getReminders: { setData: vi.fn() } } } }),
    viewer: {
      eventTypes: {
        getReminders: {
          useQuery: () => ({ data: { minutesBefore: state.minutesBefore }, isPending: false }),
        },
        updateReminders: { useMutation: () => ({ mutate, isPending: false }) },
      },
    },
  },
}));

vi.mock("@calcom/ui/components/toast", () => ({ showToast: vi.fn() }));

vi.mock("@calcom/lib/hooks/useLocale", () => ({
  useLocale: () => ({
    t: (key: string, vars?: Record<string, unknown>) => {
      if (vars && "count" in vars) return `${key}:${vars.count}`;
      if (vars && "offset" in vars) return `${key}:${vars.offset}`;
      return key;
    },
  }),
}));

describe("EventRemindersSection", () => {
  beforeEach(() => {
    mutate.mockReset();
    state.minutesBefore = [];
  });

  afterEach(() => {
    cleanup();
  });

  it("turns reminders on with a 24 hour default", () => {
    render(<EventRemindersSection eventTypeId={7} />);

    fireEvent.click(screen.getByRole("switch"));

    expect(mutate).toHaveBeenCalledWith({ eventTypeId: 7, minutesBefore: [1440] });
  });

  it("adds a preset next to existing reminders", () => {
    state.minutesBefore = [1440];
    render(<EventRemindersSection eventTypeId={7} />);

    expect(screen.queryByRole("button", { name: "reminder_days_before:1" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "reminder_hours_before:2" }));

    expect(mutate).toHaveBeenCalledWith({ eventTypeId: 7, minutesBefore: [1440, 120] });
  });

  it("adds a custom reminder in the chosen unit", () => {
    state.minutesBefore = [1440];
    render(<EventRemindersSection eventTypeId={7} />);

    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "add" }));

    expect(mutate).toHaveBeenCalledWith({ eventTypeId: 7, minutesBefore: [1440, 180] });
  });

  it("removes a reminder", () => {
    state.minutesBefore = [1440, 120];
    render(<EventRemindersSection eventTypeId={7} />);

    fireEvent.click(screen.getByRole("button", { name: "remove_reminder:reminder_days_before:1" }));

    expect(mutate).toHaveBeenCalledWith({ eventTypeId: 7, minutesBefore: [120] });
  });

  it("hides the add controls at the limit", () => {
    state.minutesBefore = [1440, 120, 60];
    render(<EventRemindersSection eventTypeId={7} />);

    expect(screen.getByText("reminders_limit_reached")).toBeTruthy();
    expect(screen.queryByRole("spinbutton")).toBeNull();
  });
});
