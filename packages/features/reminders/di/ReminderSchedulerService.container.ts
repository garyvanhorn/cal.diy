import { createContainer } from "@calcom/features/di/di";
import { moduleLoader as prismaModuleLoader } from "@calcom/features/di/modules/Prisma";
import {
  type ReminderSchedulerService,
  moduleLoader as reminderSchedulerServiceModuleLoader,
} from "./ReminderSchedulerService.module";

const reminderSchedulerServiceContainer = createContainer();

export function getReminderSchedulerService(): ReminderSchedulerService {
  // The Booking repository module binds to the Prisma token without loading it.
  prismaModuleLoader.loadModule(reminderSchedulerServiceContainer);
  reminderSchedulerServiceModuleLoader.loadModule(reminderSchedulerServiceContainer);
  return reminderSchedulerServiceContainer.get<ReminderSchedulerService>(
    reminderSchedulerServiceModuleLoader.token
  );
}
