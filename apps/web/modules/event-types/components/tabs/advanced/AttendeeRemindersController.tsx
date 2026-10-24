import {
  ATTENDEE_REMINDER_OFFSET_OPTIONS_MINUTES,
  DEFAULT_ATTENDEE_REMINDER_OFFSETS_MINUTES,
} from "@calcom/features/bookings/lib/attendeeReminders";
import type { FormValues } from "@calcom/features/eventtypes/lib/types";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Label, Select, SettingsToggle } from "@calcom/ui/components/form";
import type { TFunction } from "i18next";
import { Controller } from "react-hook-form";

type AttendeeRemindersSetting = NonNullable<NonNullable<FormValues["metadata"]>["attendeeReminders"]>;

export const formatReminderOffset = (offsetMinutes: number, t: TFunction) =>
  offsetMinutes < 60
    ? t("attendee_reminder_minutes_before", { count: offsetMinutes })
    : t("attendee_reminder_hours_before", { count: offsetMinutes / 60 });

export default function AttendeeRemindersController() {
  const { t } = useLocale();
  const options = ATTENDEE_REMINDER_OFFSET_OPTIONS_MINUTES.map((offset) => ({
    value: offset,
    label: formatReminderOffset(offset, t),
  }));

  return (
    <Controller
      name="metadata.attendeeReminders"
      render={({ field: { value, onChange } }) => {
        const setting: AttendeeRemindersSetting = value ?? {};
        const selectedOffsets = setting.offsetsMinutes ?? DEFAULT_ATTENDEE_REMINDER_OFFSETS_MINUTES;

        return (
          <SettingsToggle
            labelClassName="text-sm"
            toggleSwitchAtTheEnd={true}
            switchContainerClassName="border-subtle rounded-lg border py-6 px-4 sm:px-6"
            childrenClassName="lg:ml-0"
            title={t("attendee_reminders_title")}
            description={t("attendee_reminders_description")}
            data-testid="attendee-reminders-toggle"
            checked={setting.enabled !== false}
            onCheckedChange={(enabled) => onChange({ ...setting, enabled })}>
            <div className="border-subtle rounded-b-lg border border-t-0 p-6">
              <Label>{t("attendee_reminders_send")}</Label>
              <Select
                isMulti
                isSearchable={false}
                data-testid="attendee-reminders-offsets"
                className="h-auto min-h-[36px]! text-sm"
                options={options}
                value={options.filter((option) => selectedOffsets.includes(option.value))}
                onChange={(selected) => {
                  const offsetsMinutes = selected.map((option) => option.value).sort((a, b) => b - a);
                  // Clearing every time is the same as turning reminders off.
                  onChange(
                    offsetsMinutes.length
                      ? { ...setting, enabled: true, offsetsMinutes }
                      : { ...setting, enabled: false, offsetsMinutes: undefined }
                  );
                }}
              />
            </div>
          </SettingsToggle>
        );
      }}
    />
  );
}
