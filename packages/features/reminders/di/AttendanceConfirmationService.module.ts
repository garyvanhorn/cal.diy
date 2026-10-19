import { moduleLoader as attendeeRepositoryModuleLoader } from "@calcom/features/bookings/di/Attendee.module";
import { bindModuleToClassOnToken, createModule, type ModuleLoader } from "@calcom/features/di/di";
import { AttendanceConfirmationService } from "../services/AttendanceConfirmationService";
import { REMINDERS_DI_TOKENS } from "./tokens";

const thisModule = createModule();
const token = REMINDERS_DI_TOKENS.ATTENDANCE_CONFIRMATION_SERVICE;
const moduleToken = REMINDERS_DI_TOKENS.ATTENDANCE_CONFIRMATION_SERVICE_MODULE;
const loadModule = bindModuleToClassOnToken({
  module: thisModule,
  moduleToken,
  token,
  classs: AttendanceConfirmationService,
  depsMap: {
    attendeeRepository: attendeeRepositoryModuleLoader,
  },
});

export const moduleLoader: ModuleLoader = {
  token,
  loadModule,
};

export type { AttendanceConfirmationService };
