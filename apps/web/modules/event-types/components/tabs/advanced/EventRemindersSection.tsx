import {
  MAX_REMINDER_MINUTES,
  MAX_REMINDERS_PER_EVENT_TYPE,
  MIN_REMINDER_MINUTES,
  REMINDER_PRESET_MINUTES,
} from "@calcom/features/reminders/lib/reminderSettings";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import { Badge } from "@calcom/ui/components/badge";
import { Button } from "@calcom/ui/components/button";
import { Select, SettingsToggle, TextField } from "@calcom/ui/components/form";
import { showToast } from "@calcom/ui/components/toast";
import { useState } from "react";
import {
  getReminderLabelKey,
  type ReminderUnit,
  splitReminderMinutes,
  toReminderMinutes,
} from "./reminderOffsets";

export function EventRemindersSection({ eventTypeId }: { eventTypeId: number }) {
  const { t } = useLocale();
  const utils = trpc.useUtils();
  const remindersQuery = trpc.viewer.eventTypes.getReminders.useQuery({ eventTypeId });
  const updateReminders = trpc.viewer.eventTypes.updateReminders.useMutation({
    onSuccess: (data) => {
      utils.viewer.eventTypes.getReminders.setData({ eventTypeId }, data);
      showToast(t("reminders_saved"), "success");
    },
    onError: (error) => showToast(error.message, "error"),
  });
  const [customAmount, setCustomAmount] = useState("");
  const [customUnit, setCustomUnit] = useState<ReminderUnit>("hours");

  const minutesBefore = remindersQuery.data?.minutesBefore ?? [];
  const isBusy = remindersQuery.isPending || updateReminders.isPending;
  const isFull = minutesBefore.length >= MAX_REMINDERS_PER_EVENT_TYPE;

  const save = (next: number[]) => updateReminders.mutate({ eventTypeId, minutesBefore: next });
  const add = (minutes: number) => {
    if (minutesBefore.includes(minutes)) return;
    save([...minutesBefore, minutes]);
  };
  const formatOffset = (minutes: number) => {
    const { amount, unit } = splitReminderMinutes(minutes);
    return t(getReminderLabelKey(unit), { count: amount });
  };

  const customMinutes = toReminderMinutes(Number(customAmount), customUnit);
  const isCustomValid =
    customAmount !== "" && customMinutes >= MIN_REMINDER_MINUTES && customMinutes <= MAX_REMINDER_MINUTES;
  const unitOptions = (["minutes", "hours", "days"] as const).map((unit) => ({
    value: unit,
    label: t(`reminder_unit_${unit}`),
  }));

  return (
    <SettingsToggle
      labelClassName="text-sm"
      toggleSwitchAtTheEnd={true}
      switchContainerClassName="border-subtle rounded-lg border py-6 px-4 sm:px-6"
      childrenClassName="lg:ml-0"
      title={t("email_reminders")}
      description={t("email_reminders_description")}
      data-testid="email-reminders-toggle"
      checked={minutesBefore.length > 0}
      disabled={isBusy}
      onCheckedChange={(checked) => save(checked ? [REMINDER_PRESET_MINUTES[0]] : [])}>
      <div className="border-subtle stack-y-4 rounded-b-lg border border-t-0 p-6">
        <div className="flex flex-wrap gap-2" data-testid="email-reminders-list">
          {minutesBefore.map((minutes) => (
            <Badge key={minutes} variant="gray" size="lg">
              {formatOffset(minutes)}
              <button
                type="button"
                className="ml-2"
                aria-label={t("remove_reminder", { offset: formatOffset(minutes) })}
                disabled={isBusy}
                onClick={() => save(minutesBefore.filter((value) => value !== minutes))}>
                ×
              </button>
            </Badge>
          ))}
        </div>
        {isFull ? (
          <p className="text-subtle text-sm">
            {t("reminders_limit_reached", { max: MAX_REMINDERS_PER_EVENT_TYPE })}
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {REMINDER_PRESET_MINUTES.filter((minutes) => !minutesBefore.includes(minutes)).map(
                (minutes) => (
                  <Button
                    key={minutes}
                    color="secondary"
                    size="sm"
                    disabled={isBusy}
                    onClick={() => add(minutes)}>
                    {formatOffset(minutes)}
                  </Button>
                )
              )}
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <TextField
                id="custom-reminder-amount"
                name="customReminderAmount"
                type="number"
                min={1}
                label={t("custom_reminder")}
                containerClassName="w-28"
                value={customAmount}
                onChange={(event) => setCustomAmount(event.target.value)}
              />
              <Select<{ label: string; value: ReminderUnit }>
                className="w-36"
                options={unitOptions}
                value={unitOptions.find((option) => option.value === customUnit)}
                onChange={(option) => option && setCustomUnit(option.value)}
              />
              <Button
                color="secondary"
                disabled={isBusy || !isCustomValid || minutesBefore.includes(customMinutes)}
                onClick={() => {
                  add(customMinutes);
                  setCustomAmount("");
                }}>
                {t("add")}
              </Button>
            </div>
          </>
        )}
      </div>
    </SettingsToggle>
  );
}
