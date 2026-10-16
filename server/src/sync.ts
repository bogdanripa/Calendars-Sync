import { Calendar, CalendarDocument, Users } from "./db.js";
import { GoogleAuth, CalendarEvent, EventAttendee } from "./google.js";

// Copies carry "Copied from <original event id>" in their description (very
// old copies had it in the summary). This marker is unchanged from the
// original app, so copies it created are still recognised.
const MARKER = "Copied from ";

function copiedFrom(event: CalendarEvent): string | null {
  let text = event.summary || "";
  if (text.indexOf(MARKER) == -1) text = event.description || "";
  return text.indexOf(MARKER) == 0 ? text.replace(MARKER, "") : null;
}

function mapResponseStatusToEventStatus(event: CalendarEvent): string {
  // Find the attendee representing the authenticated user
  const selfAttendee = event.attendees?.find((attendee: EventAttendee) => attendee.self);
  if (!selfAttendee || !selfAttendee.responseStatus) {
    return event.status || "";
  }
  switch (selfAttendee.responseStatus) {
    case "accepted":
      return "confirmed";
    case "tentative":
      return "tentative";
    case "declined":
      return "cancelled";
    case "needsAction":
      return "tentative";
    default:
      return event.status || "";
  }
}

function isInvalidGrant(error: any): boolean {
  return error?.message == "invalid_grant" || error?.response?.data?.error == "invalid_grant";
}

async function refreshToken(c: CalendarDocument) {
  const tokens = await GoogleAuth.refreshTokens(c.refresh_token);
  if (!tokens.access_token || !tokens.expiry_date) {
    throw new Error(`${c.calendar_id}: Failed to refresh token`);
  }
  c.access_token = tokens.access_token;
  c.expiry_date = tokens.expiry_date;
  if (tokens.refresh_token) c.refresh_token = tokens.refresh_token;
  await c.save();
  console.log(c.calendar_id + ": token refreshed");
}

// Returns the calendar's events, or null if its access was revoked (in which
// case the calendar is removed, as the original app did).
async function processCalendar(c: CalendarDocument): Promise<CalendarEvent[] | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (attempt > 0 || c.expiry_date < Date.now() + 60_000) {
        await refreshToken(c);
      }
      const ce = await GoogleAuth.listCalendarEvents(c.calendar_id, c.access_token);
      const events: CalendarEvent[] = [];
      for (const event of ce) {
        event.status = mapResponseStatusToEventStatus(event);
        if (event.status == "cancelled") continue;
        events.push({
          id: event.id,
          summary: event.summary,
          description: event.description,
          status: event.status,
          start: event.start,
          end: event.end,
        });
      }
      return events;
    } catch (error: any) {
      if (isInvalidGrant(error)) {
        console.error(`${c.calendar_id}: token is invalid, deleting the calendar`);
        await c.deleteOne();
        return null;
      }
      if (error.response?.status == 401 && attempt == 0) {
        console.log(`${c.calendar_id}: token expired`);
        continue;
      }
      throw error;
    }
  }
  throw new Error(`${c.calendar_id}: Failed to refresh token`);
}

async function ignoreGone(p: Promise<unknown>) {
  try {
    await p;
  } catch (error: any) {
    const status = error.response?.status;
    if (status != 404 && status != 410) throw error;
  }
}

const running = new Map<string, Promise<string>>();

// One sync per user at a time: the hourly job and a manual "Sync now" must
// not both clone the same event.
export function processUser(email: string): Promise<string> {
  const existing = running.get(email);
  if (existing) return existing;
  const p = doProcessUser(email).finally(() => running.delete(email));
  running.set(email, p);
  return p;
}

async function doProcessUser(email: string): Promise<string> {
  const all: CalendarDocument[] = await Calendar.find({ email });
  const cl: CalendarDocument[] = [];
  const events: CalendarEvent[][] = [];
  const existingIds: { [key: string]: string } = {};
  for (const c of all) {
    if (!c.calendar_id || !c.access_token) continue;
    const ev = await processCalendar(c);
    if (!ev) continue;
    cl.push(c);
    events.push(ev);
    for (const event of ev) {
      if (event.id && event.status) existingIds[event.id] = event.status;
    }
  }

  // Copies whose original went away or changed status get removed (and are
  // re-cloned below with the new status if the original still exists).
  const eventsToDelete: { id: string; accountIdx: number }[] = [];
  for (let i = 0; i < events.length; i++) {
    events[i] = events[i].filter((e) => {
      const originalId = copiedFrom(e);
      if (originalId === null) return true;
      const originalEventStatus = existingIds[originalId];
      if (!originalEventStatus || originalEventStatus != e.status) {
        eventsToDelete.push({ id: e.id || "", accountIdx: i });
        return false;
      }
      return true;
    });
  }

  let cntDeleted = 0;
  for (const d of eventsToDelete) {
    const c = cl[d.accountIdx];
    console.log(c.calendar_id + ": Deleting " + d.id);
    await ignoreGone(GoogleAuth.deleteEvent(c.access_token, c.calendar_id, d.id));
    cntDeleted++;
  }

  let cntCloned = 0;
  for (let i = 0; i < events.length; i++) {
    if (!cl[i].source) continue;
    console.log(`${cl[i].calendar_id}: found ${events[i].length} events`);
    for (const event of events[i]) {
      if (copiedFrom(event) !== null) continue;
      const eventId = event.id;
      for (let k = 0; k < events.length; k++) {
        if (i == k || !cl[k].destination) continue;
        const found = events[k].find((e) => copiedFrom(e) == eventId);
        if (found) continue;
        console.log(cl[k].calendar_id + ": Cloning " + eventId);
        await GoogleAuth.createEvent(
          {
            summary: `Busy (${event.status})`,
            description: MARKER + eventId,
            start: event.start,
            end: event.end,
            status: event.status,
          },
          cl[k].access_token,
          cl[k].calendar_id,
        );
        cntCloned++;
      }
    }
  }
  return `Deleted ${cntDeleted} events and cloned ${cntCloned} events`;
}

let allRunning = false;

export async function processAllUsers(): Promise<{ users: number; skipped?: boolean }> {
  if (allRunning) {
    console.log("Processing - already running, skipping");
    return { users: 0, skipped: true };
  }
  allRunning = true;
  try {
    const emails = new Set<string>();
    for (const u of await Users.find({}, { email: 1 })) if (u.email) emails.add(u.email);
    for (const e of await Calendar.distinct("email")) if (e) emails.add(e);

    for (const email of emails) {
      console.log("Processing " + email);
      try {
        console.log(email + ": " + (await processUser(email)));
      } catch (error: unknown) {
        console.error(
          "Error processing " + email + ": " + (error instanceof Error ? error.message : JSON.stringify(error)),
        );
      }
    }
    console.log("Processing - done");
    return { users: emails.size };
  } finally {
    allRunning = false;
  }
}
