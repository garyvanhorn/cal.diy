import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { confirm, parseRequestData } = vi.hoisted(() => ({
  confirm: vi.fn(),
  parseRequestData: vi.fn(),
}));

vi.mock("app/api/defaultResponderForAppDir", () => ({
  defaultResponderForAppDir:
    (handler: (req: NextRequest) => Promise<Response>) =>
    (req: NextRequest, _context: { params: Promise<Record<string, string>> }) =>
      handler(req),
}));

vi.mock("app/api/parseRequestData", () => ({ parseRequestData }));

vi.mock("@calcom/features/reminders/di/AttendanceConfirmationService.container", () => ({
  getAttendanceConfirmationService: () => ({ confirm }),
}));

import { POST } from "../route";

const callPost = () =>
  POST({} as NextRequest, { params: Promise.resolve({}) }) as unknown as Promise<Response>;

describe("POST /api/attendance/confirm", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("confirms with the posted token and redirects back to the page on the same host", async () => {
    parseRequestData.mockResolvedValue({ token: "abc.def" });
    confirm.mockResolvedValue({ status: "confirmed" });

    const res = await callPost();

    expect(confirm).toHaveBeenCalledWith("abc.def");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/attendance/confirm?token=abc.def");
  });

  it("redirects without confirming when the token is missing", async () => {
    parseRequestData.mockResolvedValue({});

    const res = await callPost();

    expect(confirm).not.toHaveBeenCalled();
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/attendance/confirm?token=");
  });

  it("encodes the token in the redirect", async () => {
    parseRequestData.mockResolvedValue({ token: "a&b=c" });
    confirm.mockResolvedValue({ status: "invalid" });

    const res = await callPost();

    expect(res.headers.get("location")).toBe("/attendance/confirm?token=a%26b%3Dc");
  });
});
