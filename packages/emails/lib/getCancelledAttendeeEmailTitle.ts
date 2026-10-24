import type { EventNameObjectType } from "@calcom/features/eventtypes/lib/eventNaming";
import { getEventName } from "@calcom/features/eventtypes/lib/eventNaming";

// A cancelled booking's title is already the final event name. Only a custom event name
// needs re-rendering for each attendee; running the default "X between A and B" template on
// the stored title would repeat the names.
export function getCancelledAttendeeEmailTitle(
  bookingTitle: string,
  eventNameObject: EventNameObjectType
): string {
  if (!eventNameObject.eventName) return bookingTitle;
  return getEventName(eventNameObject);
}
