import { createContainer } from "@calcom/features/di/di";
import { moduleLoader as prismaModuleLoader } from "@calcom/features/di/modules/Prisma";
import {
  type ReminderDeliveryService,
  moduleLoader as reminderDeliveryServiceModuleLoader,
} from "./ReminderDeliveryService.module";

const reminderDeliveryServiceContainer = createContainer();

export function getReminderDeliveryService(): ReminderDeliveryService {
  // The Booking and Attendee repository modules bind to the Prisma token without loading it.
  prismaModuleLoader.loadModule(reminderDeliveryServiceContainer);
  reminderDeliveryServiceModuleLoader.loadModule(reminderDeliveryServiceContainer);
  return reminderDeliveryServiceContainer.get<ReminderDeliveryService>(
    reminderDeliveryServiceModuleLoader.token
  );
}
