import { bindModuleToClassOnToken, createModule, type ModuleLoader } from "@calcom/features/di/di";
import { moduleLoader as bookingRepositoryModuleLoader } from "@calcom/features/di/modules/Booking";
import { ReminderDeliveryService } from "../services/ReminderDeliveryService";
import { moduleLoader as eventTypeReminderRepositoryModuleLoader } from "./EventTypeReminderRepository.module";
import { moduleLoader as reminderSenderFactoryModuleLoader } from "./ReminderSenderFactory.module";
import { REMINDERS_DI_TOKENS } from "./tokens";

const thisModule = createModule();
const token = REMINDERS_DI_TOKENS.REMINDER_DELIVERY_SERVICE;
const moduleToken = REMINDERS_DI_TOKENS.REMINDER_DELIVERY_SERVICE_MODULE;
const loadModule = bindModuleToClassOnToken({
  module: thisModule,
  moduleToken,
  token,
  classs: ReminderDeliveryService,
  depsMap: {
    bookingRepository: bookingRepositoryModuleLoader,
    eventTypeReminderRepository: eventTypeReminderRepositoryModuleLoader,
    reminderSenderFactory: reminderSenderFactoryModuleLoader,
  },
});

export const moduleLoader: ModuleLoader = {
  token,
  loadModule,
};

export type { ReminderDeliveryService };
