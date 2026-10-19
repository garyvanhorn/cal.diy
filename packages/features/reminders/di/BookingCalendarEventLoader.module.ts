import { bindModuleToClassOnToken, createModule, type ModuleLoader } from "@calcom/features/di/di";
import { BookingCalendarEventLoader } from "../services/BookingCalendarEventLoader";
import { REMINDERS_DI_TOKENS } from "./tokens";

const thisModule = createModule();
const token = REMINDERS_DI_TOKENS.BOOKING_CALENDAR_EVENT_LOADER;
const moduleToken = REMINDERS_DI_TOKENS.BOOKING_CALENDAR_EVENT_LOADER_MODULE;
const loadModule = bindModuleToClassOnToken({
  module: thisModule,
  moduleToken,
  token,
  classs: BookingCalendarEventLoader,
  depsMap: {},
});

export const moduleLoader: ModuleLoader = {
  token,
  loadModule,
};

export type { BookingCalendarEventLoader };
