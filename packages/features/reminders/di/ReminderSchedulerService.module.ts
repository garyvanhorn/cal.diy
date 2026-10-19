import { bindModuleToClassOnToken, createModule, type ModuleLoader } from "@calcom/features/di/di";
import { ReminderSchedulerService } from "../services/ReminderSchedulerService";
import { moduleLoader as eventTypeReminderRepositoryModuleLoader } from "./EventTypeReminderRepository.module";
import { moduleLoader as reminderTaskRepositoryModuleLoader } from "./ReminderTaskRepository.module";
import { REMINDERS_DI_TOKENS } from "./tokens";

const thisModule = createModule();
const token = REMINDERS_DI_TOKENS.REMINDER_SCHEDULER_SERVICE;
const moduleToken = REMINDERS_DI_TOKENS.REMINDER_SCHEDULER_SERVICE_MODULE;
const loadModule = bindModuleToClassOnToken({
  module: thisModule,
  moduleToken,
  token,
  classs: ReminderSchedulerService,
  depsMap: {
    eventTypeReminderRepository: eventTypeReminderRepositoryModuleLoader,
    reminderTaskRepository: reminderTaskRepositoryModuleLoader,
  },
});

export const moduleLoader: ModuleLoader = {
  token,
  loadModule,
};

export type { ReminderSchedulerService };
