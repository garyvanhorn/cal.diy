import { beforeEach, describe, expect, it, vi } from "vitest";

const sendDueReminders = vi.fn();

vi.mock("next/server", () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({ body, status: init?.status ?? 200 })),
  },
}));
vi.mock("app/api/defaultResponderForAppDir", () => ({
  defaultResponderForAppDir: vi.fn((handler) => handler),
}));
vi.mock("@calcom/features/bookings/di/AttendeeReminderService.container", () => ({
  getAttendeeReminderService: () => ({ sendDueReminders }),
}));

import type { NextRequest } from "next/server";

import { GET } from "../route";

type RouteHandler = (request: NextRequest) => Promise<{ body: unknown; status: number }>;
const callRoute = GET as unknown as RouteHandler;

const buildRequest = ({ authorization, apiKey }: { authorization?: string; apiKey?: string }) =>
  ({
    headers: { get: (name: string) => (name === "authorization" ? (authorization ?? null) : null) },
    nextUrl: { searchParams: new URLSearchParams(apiKey ? { apiKey } : {}) },
  }) as unknown as NextRequest;

describe("/api/cron/attendee-reminders", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_API_KEY", "api-key");
    vi.stubEnv("CRON_SECRET", "cron-secret");
    sendDueReminders.mockReset().mockResolvedValue({ remindersSent: 2 });
  });

  it("accepts CRON_API_KEY in the authorization header or apiKey query", async () => {
    expect(await callRoute(buildRequest({ authorization: "api-key" }))).toEqual({
      body: { remindersSent: 2 },
      status: 200,
    });
    expect((await callRoute(buildRequest({ apiKey: "api-key" }))).status).toBe(200);
  });

  it("accepts Bearer CRON_SECRET", async () => {
    expect((await callRoute(buildRequest({ authorization: "Bearer cron-secret" }))).status).toBe(200);
  });

  it("rejects a wrong or missing key without sending anything", async () => {
    expect((await callRoute(buildRequest({ authorization: "Bearer wrong" }))).status).toBe(401);
    expect((await callRoute(buildRequest({}))).status).toBe(401);
    expect(sendDueReminders).not.toHaveBeenCalled();
  });

  it("rejects 'Bearer undefined' when CRON_SECRET is not set", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await callRoute(buildRequest({ authorization: "Bearer undefined" }))).status).toBe(401);
    expect((await callRoute(buildRequest({ authorization: "Bearer " }))).status).toBe(401);
  });
});
