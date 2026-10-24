import type { CalendarEvent, Person } from "@calcom/types/Calendar";
import { AttendeeScheduledEmail } from "./AttendeeScheduledEmail";

export const AttendeeReminderEmail = (props: { calEvent: CalendarEvent; attendee: Person }) => {
  const t = props.attendee.language.translate;

  return (
    <AttendeeScheduledEmail
      {...props}
      headerType="calendarCircle"
      title="attendee_reminder_email_title"
      subtitle={<>{t("attendee_reminder_email_subtitle")}</>}
    />
  );
};
