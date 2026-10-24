import { bindModuleToClassOnToken, createModule, type ModuleLoader } from "@calcom/features/di/di";
import { DI_TOKENS } from "@calcom/features/di/tokens";
import { AttendeeReminderService } from "../services/AttendeeReminderService";
import { moduleLoader as attendeeReminderRepositoryModuleLoader } from "./AttendeeReminderRepository.module";

const thisModule = createModule();
const token = DI_TOKENS.ATTENDEE_REMINDER_SERVICE;
const moduleToken = DI_TOKENS.ATTENDEE_REMINDER_SERVICE_MODULE;

const loadModule = bindModuleToClassOnToken({
  module: thisModule,
  moduleToken,
  token,
  classs: AttendeeReminderService,
  depsMap: {
    attendeeReminderRepository: attendeeReminderRepositoryModuleLoader,
  },
});

export const moduleLoader: ModuleLoader = {
  token,
  loadModule,
};

export type { AttendeeReminderService };
