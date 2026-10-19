import { createContainer } from "@calcom/features/di/di";
import { moduleLoader as prismaModuleLoader } from "@calcom/features/di/modules/Prisma";
import {
  type AttendanceConfirmationService,
  moduleLoader as attendanceConfirmationServiceModuleLoader,
} from "./AttendanceConfirmationService.module";

const attendanceConfirmationServiceContainer = createContainer();

export function getAttendanceConfirmationService(): AttendanceConfirmationService {
  // The Attendee repository module binds to the Prisma token without loading it.
  prismaModuleLoader.loadModule(attendanceConfirmationServiceContainer);
  attendanceConfirmationServiceModuleLoader.loadModule(attendanceConfirmationServiceContainer);
  return attendanceConfirmationServiceContainer.get<AttendanceConfirmationService>(
    attendanceConfirmationServiceModuleLoader.token
  );
}
