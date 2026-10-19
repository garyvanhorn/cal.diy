import { bindModuleToClassOnToken, createModule, type ModuleLoader } from "@calcom/features/di/di";
import { moduleLoader as bookingRepositoryModuleLoader } from "@calcom/features/di/modules/Booking";
import { ReminderSchedulerService } from "../services/ReminderSchedulerService";
import { moduleLoader as eventTypeReminderServiceModuleLoader } from "./EventTypeReminderService.module";
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
    bookingRepository: bookingRepositoryModuleLoader,
    eventTypeReminderService: eventTypeReminderServiceModuleLoader,
    reminderTaskRepository: reminderTaskRepositoryModuleLoader,
  },
});

export const moduleLoader: ModuleLoader = {
  token,
  loadModule,
};

export type { ReminderSchedulerService };
