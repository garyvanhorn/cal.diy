import { bindModuleToClassOnToken, createModule, type ModuleLoader } from "@calcom/features/di/di";
import { ReminderSenderFactory } from "../services/ReminderSenderFactory";
import { moduleLoader as emailReminderSenderModuleLoader } from "./EmailReminderSender.module";
import { REMINDERS_DI_TOKENS } from "./tokens";

const thisModule = createModule();
const token = REMINDERS_DI_TOKENS.REMINDER_SENDER_FACTORY;
const moduleToken = REMINDERS_DI_TOKENS.REMINDER_SENDER_FACTORY_MODULE;
const loadModule = bindModuleToClassOnToken({
  module: thisModule,
  moduleToken,
  token,
  classs: ReminderSenderFactory,
  depsMap: {
    emailReminderSender: emailReminderSenderModuleLoader,
  },
});

export const moduleLoader: ModuleLoader = {
  token,
  loadModule,
};

export type { ReminderSenderFactory };
