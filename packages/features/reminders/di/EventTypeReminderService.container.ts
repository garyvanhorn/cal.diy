import { createContainer } from "@calcom/features/di/di";
import {
  type EventTypeReminderService,
  moduleLoader as eventTypeReminderServiceModuleLoader,
} from "./EventTypeReminderService.module";

const eventTypeReminderServiceContainer = createContainer();

export function getEventTypeReminderService(): EventTypeReminderService {
  eventTypeReminderServiceModuleLoader.loadModule(eventTypeReminderServiceContainer);
  return eventTypeReminderServiceContainer.get<EventTypeReminderService>(
    eventTypeReminderServiceModuleLoader.token
  );
}
