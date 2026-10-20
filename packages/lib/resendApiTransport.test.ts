import { createTransport } from "nodemailer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createResendApiTransport } from "./resendApiTransport";

type CapturedRequest = { url: string; init: RequestInit; body: Record<string, unknown> };

const fetchMock = vi.fn();

function lastRequest(): CapturedRequest {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return { url, init, body: JSON.parse(init.body as string) };
}

function respondWith(status: number, json: unknown) {
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify(json), { status, headers: { "Content-Type": "application/json" } })
  );
}

function send(options: Parameters<ReturnType<typeof createTransport>["sendMail"]>[0]) {
  return createTransport(createResendApiTransport("re_test_key")).sendMail(options);
}

const decode = (base64: string) => Buffer.from(base64, "base64").toString("utf8");

describe("createResendApiTransport", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the email to the Resend API with the API key", async () => {
    respondWith(200, { id: "email_123" });

    const info = await send({
      from: "CronSlot <notifications@cronslot.com>",
      to: "Jane Doe <jane@example.com>",
      subject: "Reset password",
      html: "<p>Hello</p>",
      text: "Hello",
    });

    const { url, init, body } = lastRequest();
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_test_key");
    expect(body).toEqual({
      from: "CronSlot <notifications@cronslot.com>",
      to: ["Jane Doe <jane@example.com>"],
      subject: "Reset password",
      html: "<p>Hello</p>",
      text: "Hello",
    });
    expect(info.messageId).toBe("email_123");
    expect(info.accepted).toEqual(["jane@example.com"]);
  });

  it("splits comma separated recipients and reply-to addresses into arrays", async () => {
    respondWith(200, { id: "email_123" });

    await send({
      from: "notifications@cronslot.com",
      to: "a@example.com, B Person <b@example.com>",
      cc: ["c@example.com"],
      bcc: "d@example.com",
      replyTo: "host@example.com, guest@example.com",
      subject: "Booking",
      text: "Hi",
    });

    const { body } = lastRequest();
    expect(body.to).toEqual(["a@example.com", "B Person <b@example.com>"]);
    expect(body.cc).toEqual(["c@example.com"]);
    expect(body.bcc).toEqual(["d@example.com"]);
    expect(body.reply_to).toEqual(["host@example.com", "guest@example.com"]);
  });

  it("quotes display names that contain special characters", async () => {
    respondWith(200, { id: "email_123" });

    await send({
      from: { name: "Doe, Jane", address: "jane@example.com" },
      to: "x@example.com",
      subject: "Hi",
      text: "Hi",
    });

    expect(lastRequest().body.from).toBe('"Doe, Jane" <jane@example.com>');
  });

  it("sends the calendar invite as a base64 .ics attachment with its method", async () => {
    respondWith(200, { id: "email_123" });
    const ics = "BEGIN:VCALENDAR\r\nMETHOD:REQUEST\r\nEND:VCALENDAR";

    await send({
      from: "notifications@cronslot.com",
      to: "jane@example.com",
      subject: "Booking confirmed",
      html: "<p>Booked</p>",
      icalEvent: { filename: "event.ics", content: ics, method: "REQUEST" },
    });

    const attachments = lastRequest().body.attachments as Array<Record<string, string>>;
    expect(attachments).toHaveLength(1);
    expect(attachments[0].filename).toBe("event.ics");
    expect(attachments[0].content_type).toBe("text/calendar; charset=utf-8; method=REQUEST");
    expect(decode(attachments[0].content)).toBe(ics);
  });

  it("sends buffer and string attachments base64 encoded", async () => {
    respondWith(200, { id: "email_123" });

    await send({
      from: "notifications@cronslot.com",
      to: "jane@example.com",
      subject: "Transcript",
      text: "Attached",
      attachments: [
        { filename: "transcript-1.vtt", content: Buffer.from("WEBVTT"), contentType: "text/vtt" },
        { filename: "notes.txt", content: "plain notes" },
      ],
    });

    const attachments = lastRequest().body.attachments as Array<Record<string, string>>;
    expect(attachments.map((a) => a.filename)).toEqual(["transcript-1.vtt", "notes.txt"]);
    expect(attachments[0].content_type).toBe("text/vtt");
    expect(decode(attachments[0].content)).toBe("WEBVTT");
    expect(decode(attachments[1].content)).toBe("plain notes");
  });

  it("passes custom headers through", async () => {
    respondWith(200, { id: "email_123" });

    await send({
      from: "notifications@cronslot.com",
      to: "jane@example.com",
      subject: "Hi",
      text: "Hi",
      headers: { "X-Entity-Ref-ID": "abc" },
    });

    expect(lastRequest().body.headers).toEqual({ "X-Entity-Ref-ID": "abc" });
  });

  it("rejects with Resend's error message when the API call fails", async () => {
    respondWith(403, { message: "The cronslot.com domain is not verified" });

    await expect(
      send({ from: "notifications@cronslot.com", to: "jane@example.com", subject: "Hi", text: "Hi" })
    ).rejects.toThrow("Resend API request failed with status 403: The cronslot.com domain is not verified");
  });

  it("rejects when the network request fails", async () => {
    fetchMock.mockRejectedValueOnce(new Error("socket hang up"));

    await expect(
      send({ from: "notifications@cronslot.com", to: "jane@example.com", subject: "Hi", text: "Hi" })
    ).rejects.toThrow("socket hang up");
  });

  it("rejects without calling the API when there is no recipient", async () => {
    await expect(send({ from: "notifications@cronslot.com", subject: "Hi", text: "Hi" })).rejects.toThrow(
      "missing from or to address"
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
