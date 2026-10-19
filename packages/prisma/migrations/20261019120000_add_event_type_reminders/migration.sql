-- CreateEnum
CREATE TYPE "public"."ReminderChannel" AS ENUM ('email', 'sms');

-- AlterTable
ALTER TABLE "public"."Attendee" ADD COLUMN     "confirmedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "public"."EventTypeReminder" (
    "id" SERIAL NOT NULL,
    "eventTypeId" INTEGER NOT NULL,
    "channel" "public"."ReminderChannel" NOT NULL DEFAULT 'email',
    "minutesBefore" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventTypeReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventTypeReminder_eventTypeId_channel_minutesBefore_key" ON "public"."EventTypeReminder"("eventTypeId", "channel", "minutesBefore");

-- AddForeignKey
ALTER TABLE "public"."EventTypeReminder" ADD CONSTRAINT "EventTypeReminder_eventTypeId_fkey" FOREIGN KEY ("eventTypeId") REFERENCES "public"."EventType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

