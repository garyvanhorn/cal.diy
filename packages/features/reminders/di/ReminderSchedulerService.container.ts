import { createContainer } from "@calcom/features/di/di";
import {
  type ReminderSchedulerService,
  moduleLoader as reminderSchedulerServiceModuleLoader,
} from "./ReminderSchedulerService.module";

const reminderSchedulerServiceContainer = createContainer();

export function getReminderSchedulerService(): ReminderSchedulerService {
  reminderSchedulerServiceModuleLoader.loadModule(reminderSchedulerServiceContainer);
  return reminderSchedulerServiceContainer.get<ReminderSchedulerService>(
    reminderSchedulerServiceModuleLoader.token
  );
}
