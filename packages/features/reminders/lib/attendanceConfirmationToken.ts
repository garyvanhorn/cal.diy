import { createHmac, timingSafeEqual } from "node:crypto";
import process from "node:process";
import { ErrorWithCode } from "@calcom/lib/errors";

// Namespacing the HMAC keeps a token from this flow from validating anywhere else NEXTAUTH_SECRET signs.
const PURPOSE = "cronslot:attendee-confirm:v1";

export type AttendanceConfirmationClaims = {
  bookingUid: string;
  attendeeId: number;
};

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw ErrorWithCode.Factory.InternalServerError("NEXTAUTH_SECRET is required to sign confirm links");
  }
  return secret;
}

function sign(encodedClaims: string): string {
  return createHmac("sha256", getSecret()).update(`${PURPOSE}.${encodedClaims}`).digest("base64url");
}

export function createAttendanceConfirmationToken(claims: AttendanceConfirmationClaims): string {
  const encodedClaims = Buffer.from(JSON.stringify([claims.bookingUid, claims.attendeeId])).toString(
    "base64url"
  );
  return `${encodedClaims}.${sign(encodedClaims)}`;
}

export function verifyAttendanceConfirmationToken(token: string): AttendanceConfirmationClaims | null {
  const [encodedClaims, signature, ...rest] = token.split(".");
  if (!encodedClaims || !signature || rest.length > 0) return null;

  const expected = Buffer.from(sign(encodedClaims));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  try {
    const claims: unknown = JSON.parse(Buffer.from(encodedClaims, "base64url").toString("utf8"));
    if (!Array.isArray(claims) || claims.length !== 2) return null;
    const [bookingUid, attendeeId] = claims;
    if (typeof bookingUid !== "string" || !Number.isInteger(attendeeId)) return null;
    return { bookingUid, attendeeId };
  } catch {
    return null;
  }
}

export function buildAttendanceConfirmationUrl(
  baseUrl: string,
  claims: AttendanceConfirmationClaims
): string {
  const url = new URL("/attendance/confirm", baseUrl);
  url.searchParams.set("token", createAttendanceConfirmationToken(claims));
  return url.toString();
}
