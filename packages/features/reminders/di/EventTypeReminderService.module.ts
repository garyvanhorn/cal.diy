import { bindModuleToClassOnToken, createModule, type ModuleLoader } from "@calcom/features/di/di";
import { EventTypeReminderService } from "../services/EventTypeReminderService";
import { moduleLoader as eventTypeReminderRepositoryModuleLoader } from "./EventTypeReminderRepository.module";
import { REMINDERS_DI_TOKENS } from "./tokens";

const thisModule = createModule();
const token = REMINDERS_DI_TOKENS.EVENT_TYPE_REMINDER_SERVICE;
const moduleToken = REMINDERS_DI_TOKENS.EVENT_TYPE_REMINDER_SERVICE_MODULE;
const loadModule = bindModuleToClassOnToken({
  module: thisModule,
  moduleToken,
  token,
  classs: EventTypeReminderService,
  depsMap: {
    eventTypeReminderRepository: eventTypeReminderRepositoryModuleLoader,
  },
});

export const moduleLoader: ModuleLoader = {
  token,
  loadModule,
};

export type { EventTypeReminderService };
