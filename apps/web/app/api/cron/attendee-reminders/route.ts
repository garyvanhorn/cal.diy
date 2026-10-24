import { defaultResponderForAppDir } from "app/api/defaultResponderForAppDir";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getAttendeeReminderService } from "@calcom/features/bookings/di/AttendeeReminderService.container";

function isAuthorized(request: NextRequest) {
  const apiKey = request.headers.get("authorization") || request.nextUrl.searchParams.get("apiKey");
  if (!apiKey) return false;
  // Guard against unset env vars, which would otherwise match "undefined" or "Bearer undefined".
  const validKeys = [
    process.env.CRON_API_KEY,
    process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : undefined,
  ].filter(Boolean);
  return validKeys.includes(apiKey);
}

async function handler(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const result = await getAttendeeReminderService().sendDueReminders();
  return NextResponse.json(result);
}

export const GET = defaultResponderForAppDir(handler);
export const POST = defaultResponderForAppDir(handler);
