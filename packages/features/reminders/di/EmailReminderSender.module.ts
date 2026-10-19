import { moduleLoader as attendeeRepositoryModuleLoader } from "@calcom/features/bookings/di/Attendee.module";
import { bindModuleToClassOnToken, createModule, type ModuleLoader } from "@calcom/features/di/di";
import { EmailReminderSender } from "../services/EmailReminderSender";
import { moduleLoader as bookingCalendarEventLoaderModuleLoader } from "./BookingCalendarEventLoader.module";
import { REMINDERS_DI_TOKENS } from "./tokens";

const thisModule = createModule();
const token = REMINDERS_DI_TOKENS.EMAIL_REMINDER_SENDER;
const moduleToken = REMINDERS_DI_TOKENS.EMAIL_REMINDER_SENDER_MODULE;
const loadModule = bindModuleToClassOnToken({
  module: thisModule,
  moduleToken,
  token,
  classs: EmailReminderSender,
  depsMap: {
    attendeeRepository: attendeeRepositoryModuleLoader,
    bookingCalendarEventLoader: bookingCalendarEventLoaderModuleLoader,
  },
});

export const moduleLoader: ModuleLoader = {
  token,
  loadModule,
};

export type { EmailReminderSender };
