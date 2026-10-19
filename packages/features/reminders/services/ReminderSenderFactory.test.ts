import { describe, expect, it } from "vitest";
import { ReminderSenderFactory } from "./ReminderSenderFactory";

describe("ReminderSenderFactory", () => {
  const emailReminderSender = { send: async () => undefined };
  const factory = new ReminderSenderFactory({ emailReminderSender });

  it("returns the email sender for EMAIL", () => {
    expect(factory.getSender("EMAIL")).toBe(emailReminderSender);
  });

  it("rejects SMS until a provider is added", () => {
    expect(() => factory.getSender("SMS")).toThrow("SMS reminders are not available yet");
  });
});
