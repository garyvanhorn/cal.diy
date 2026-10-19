import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Badge } from "@calcom/ui/components/badge";

export const AttendanceConfirmedBadge = ({
  attendees,
  className,
}: {
  attendees: { confirmedAt?: Date | string | null }[];
  className?: string;
}) => {
  const { t } = useLocale();
  const confirmed = attendees.filter((attendee) => attendee.confirmedAt).length;
  if (confirmed === 0) return null;

  return (
    <Badge className={className} variant="green" startIcon="check" data-testid="attendance_confirmed_badge">
      {attendees.length === 1
        ? t("attendee_confirmed")
        : t("attendees_confirmed_count", { confirmed, total: attendees.length })}
    </Badge>
  );
};
