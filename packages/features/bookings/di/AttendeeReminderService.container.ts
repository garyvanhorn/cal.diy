import { createContainer } from "@calcom/features/di/di";
import {
  type AttendeeReminderService,
  moduleLoader as attendeeReminderServiceModule,
} from "./AttendeeReminderService.module";

const attendeeReminderServiceContainer = createContainer();

export function getAttendeeReminderService(): AttendeeReminderService {
  attendeeReminderServiceModule.loadModule(attendeeReminderServiceContainer);

  return attendeeReminderServiceContainer.get<AttendeeReminderService>(attendeeReminderServiceModule.token);
}
