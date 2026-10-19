import { CallToAction, CallToActionTable, ManageLink } from "../components";
import { AttendeeScheduledEmail } from "./AttendeeScheduledEmail";

type AttendeeReminderEmailProps = React.ComponentProps<typeof AttendeeScheduledEmail> & {
  confirmUrl: string | null;
};

function ReminderActions({ confirmUrl, ...props }: AttendeeReminderEmailProps) {
  const t = props.attendee.language.translate;
  return (
    <>
      {confirmUrl && (
        <CallToActionTable>
          <CallToAction label={t("confirm_attendance")} href={confirmUrl} />
        </CallToActionTable>
      )}
      <ManageLink attendee={props.attendee} calEvent={props.calEvent} />
    </>
  );
}

export const AttendeeReminderEmail = (props: AttendeeReminderEmailProps) => {
  const t = props.attendee.language.translate;
  return (
    <AttendeeScheduledEmail
      title="attendee_reminder_title"
      headerType="calendarCircle"
      subject="reminder_email"
      subtitle={
        <>{t(props.confirmUrl ? "attendee_reminder_subtitle" : "attendee_reminder_confirmed_subtitle")}</>
      }
      callToAction={<ReminderActions {...props} />}
      {...props}
    />
  );
};
