import type { FormValues } from "@calcom/features/eventtypes/lib/types";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { fireEvent, render, screen } from "@testing-library/react";
import type { TFunction } from "i18next";
import type { ReactNode } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import AttendeeRemindersController, { formatReminderOffset } from "./AttendeeRemindersController";

const t = ((key: string, vars?: { count?: number }) =>
  vars?.count === undefined ? key : `${key}:${vars.count}`) as unknown as TFunction;

vi.mock("@formkit/auto-animate/react", () => ({ useAutoAnimate: () => [null] }));
vi.mock("@calcom/lib/hooks/useLocale", () => ({ useLocale: () => ({ t }) }));

let latestValues: () => FormValues["metadata"];

function Wrapper({ metadata, children }: { metadata: FormValues["metadata"]; children: ReactNode }) {
  const methods = useForm<FormValues>({ defaultValues: { metadata } });
  latestValues = () => methods.getValues("metadata");
  return (
    <TooltipProvider>
      <FormProvider {...methods}>{children}</FormProvider>
    </TooltipProvider>
  );
}

const renderController = (metadata: FormValues["metadata"]) =>
  render(
    <Wrapper metadata={metadata}>
      <AttendeeRemindersController />
    </Wrapper>
  );

describe("formatReminderOffset", () => {
  it("uses minutes below an hour and hours otherwise", () => {
    expect(formatReminderOffset(30, t)).toBe("attendee_reminder_minutes_before:30");
    expect(formatReminderOffset(60, t)).toBe("attendee_reminder_hours_before:1");
    expect(formatReminderOffset(1440, t)).toBe("attendee_reminder_hours_before:24");
  });
});

describe("AttendeeRemindersController", () => {
  it("is on with 24 h and 1 h selected when the event type has no setting", () => {
    renderController({});

    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("attendee_reminder_hours_before:24")).toBeInTheDocument();
    expect(screen.getByText("attendee_reminder_hours_before:1")).toBeInTheDocument();
  });

  it("stores enabled: false when turned off", () => {
    renderController({});

    fireEvent.click(screen.getByRole("switch"));

    expect(latestValues()?.attendeeReminders).toEqual({ enabled: false });
    expect(screen.queryByText("attendee_reminders_send")).not.toBeInTheDocument();
  });

  it("shows as off when the event type turned reminders off", () => {
    renderController({ attendeeReminders: { enabled: false } });

    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });
});
