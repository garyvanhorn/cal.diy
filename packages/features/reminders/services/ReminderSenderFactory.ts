import { ErrorWithCode } from "@calcom/lib/errors";
import type { IReminderSender, ReminderChannelDto } from "../lib/types";

export interface IReminderSenderFactoryDeps {
  emailReminderSender: IReminderSender;
}

export class ReminderSenderFactory {
  constructor(private readonly deps: IReminderSenderFactoryDeps) {}

  getSender(channel: ReminderChannelDto): IReminderSender {
    switch (channel) {
      case "EMAIL":
        return this.deps.emailReminderSender;
      case "SMS":
        throw ErrorWithCode.Factory.BadRequest("SMS reminders are not available yet");
    }
  }
}
