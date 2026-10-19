import { getAttendanceConfirmationService } from "@calcom/features/reminders/di/AttendanceConfirmationService.container";
import type { AttendanceConfirmationDetails } from "@calcom/features/reminders/services/AttendanceConfirmationService";
import { getTranslation } from "@calcom/i18n/server";
import { Button } from "@calcom/ui/components/button";
import type { PageProps } from "app/_types";
import { getTranslate } from "app/_utils";
import type { Metadata } from "next";

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslate();
  return { title: t("confirm_attendance_title"), robots: { index: false, follow: false } };
};

function formatWhen(details: AttendanceConfirmationDetails): string {
  // dateStyle/timeStyle can't be combined with timeZoneName, so the parts are spelled out.
  return new Intl.DateTimeFormat(details.locale ?? "en", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone: details.timeZone,
  }).format(details.startTime);
}

const ConfirmAttendancePage = async ({ searchParams }: PageProps) => {
  const { token } = await searchParams;
  const tokenValue = typeof token === "string" ? token : "";
  const state = await getAttendanceConfirmationService().getState(tokenValue);
  const t =
    state.status === "invalid"
      ? await getTranslate()
      : await getTranslation(state.details.locale ?? "en", "common");

  return (
    <main className="bg-default flex min-h-screen items-center justify-center px-4 py-12">
      <div className="bg-default border-subtle w-full max-w-md rounded-xl border p-8 text-center">
        {state.status === "invalid" ? (
          <>
            <h1 className="text-emphasis text-xl font-semibold">{t("attendance_link_invalid_title")}</h1>
            <p className="text-subtle mt-2">{t("attendance_link_invalid_description")}</p>
          </>
        ) : (
          <>
            <h1 className="text-emphasis text-xl font-semibold">
              {state.status === "confirmed"
                ? t("attendance_confirmed_title")
                : state.status === "unavailable"
                  ? t("attendance_unavailable_title")
                  : t("confirm_attendance_title")}
            </h1>
            <p className="text-emphasis mt-4 font-medium">{state.details.title}</p>
            <p className="text-subtle mt-1">{formatWhen(state.details)}</p>
            {state.status === "ready" && (
              <form method="post" action="/api/attendance/confirm" className="mt-6">
                <input type="hidden" name="token" value={tokenValue} />
                <Button type="submit" className="w-full justify-center" size="lg">
                  {t("confirm_attendance")}
                </Button>
              </form>
            )}
            {state.status === "confirmed" && (
              <p className="text-subtle mt-6">{t("attendance_confirmed_description")}</p>
            )}
            {state.status === "unavailable" && (
              <p className="text-subtle mt-6">{t("attendance_unavailable_description")}</p>
            )}
          </>
        )}
      </div>
    </main>
  );
};

export default ConfirmAttendancePage;
