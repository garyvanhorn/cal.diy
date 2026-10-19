import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildAttendanceConfirmationUrl,
  createAttendanceConfirmationToken,
  verifyAttendanceConfirmationToken,
} from "./attendanceConfirmationToken";

describe("attendance confirmation token", () => {
  beforeEach(() => {
    vi.stubEnv("NEXTAUTH_SECRET", "test-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("round-trips the booking and attendee", () => {
    const token = createAttendanceConfirmationToken({ bookingUid: "abc123", attendeeId: 42 });

    expect(verifyAttendanceConfirmationToken(token)).toEqual({ bookingUid: "abc123", attendeeId: 42 });
  });

  it("rejects a token with altered claims", () => {
    const token = createAttendanceConfirmationToken({ bookingUid: "abc123", attendeeId: 42 });
    const [, signature] = token.split(".");
    const forgedClaims = Buffer.from(JSON.stringify(["abc123", 43])).toString("base64url");

    expect(verifyAttendanceConfirmationToken(`${forgedClaims}.${signature}`)).toBeNull();
  });

  it("rejects a token signed with another secret", () => {
    const token = createAttendanceConfirmationToken({ bookingUid: "abc123", attendeeId: 42 });
    vi.stubEnv("NEXTAUTH_SECRET", "other-secret");

    expect(verifyAttendanceConfirmationToken(token)).toBeNull();
  });

  it.each(["", "abc", "a.b.c", "!!!.???"])("rejects malformed token %j", (token) => {
    expect(verifyAttendanceConfirmationToken(token)).toBeNull();
  });

  it("throws when no secret is configured", () => {
    vi.stubEnv("NEXTAUTH_SECRET", "");

    expect(() => createAttendanceConfirmationToken({ bookingUid: "abc123", attendeeId: 42 })).toThrow(
      "NEXTAUTH_SECRET"
    );
  });

  it("builds the confirm URL on the tenant's booking domain", () => {
    const url = new URL(
      buildAttendanceConfirmationUrl("https://book.client.example", { bookingUid: "abc123", attendeeId: 42 })
    );

    expect(url.origin).toBe("https://book.client.example");
    expect(url.pathname).toBe("/attendance/confirm");
    expect(verifyAttendanceConfirmationToken(url.searchParams.get("token") ?? "")).toEqual({
      bookingUid: "abc123",
      attendeeId: 42,
    });
  });
});
