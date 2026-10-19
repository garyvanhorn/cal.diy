import { getAttendanceConfirmationService } from "@calcom/features/reminders/di/AttendanceConfirmationService.container";
import { defaultResponderForAppDir } from "app/api/defaultResponderForAppDir";
import { parseRequestData } from "app/api/parseRequestData";
import type { NextRequest } from "next/server";
import { z } from "zod";

const bodySchema = z.object({ token: z.string().min(1).max(2048) });

// No CSRF token: the signed confirm token is the only credential, and a forged
// POST could at most confirm an appointment the sender already holds a link for.
async function postHandler(request: NextRequest) {
  const parsed = bodySchema.safeParse(await parseRequestData(request));
  const token = parsed.success ? parsed.data.token : "";
  if (token) await getAttendanceConfirmationService().confirm(token);

  // Relative Location keeps the attendee on the tenant's own booking domain.
  return new Response(null, {
    status: 303,
    headers: { Location: `/attendance/confirm?token=${encodeURIComponent(token)}` },
  });
}

export const POST = defaultResponderForAppDir(postHandler);
