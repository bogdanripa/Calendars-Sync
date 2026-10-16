import { Calendar, CalendarDocument, calendarKind } from "./db.js";
import { GoogleAuth, CalendarEvent, isOurOutOfOffice } from "./google.js";
import { copiedFrom, ignoreGone, isInvalidGrant, processUser, withAccess } from "./sync.js";

// What you can do about an event depends on your part in it:
//   attendee  - someone invited you: decline (RSVP no, with a note) or keep
//   organizer - your meeting, with guests: cancel it for everyone or keep
//   solo      - your own block, no guests: delete or keep
//   readonly  - nothing the API lets you change (subscribed/imported): keep
export type Role = "attendee" | "organizer" | "solo" | "readonly";
export type Action = "decline" | "cancel" | "delete" | "keep";

export type TimeOffItem = {
  calendarId: string;
  kind: "work" | "personal";
  eventId: string;
  summary: string;
  start: CalendarEvent["start"];
  end: CalendarEvent["end"];
  allDay: boolean;
  role: Role;
  organizer?: string;
  guests: number;
  response?: string;
  recurring: boolean;
  htmlLink?: string;
  actions: Action[];
  defaultAction: Action;
};

const SKIPPED_TYPES = ["workingLocation", "outOfOffice", "birthday"];
const MAX_DAYS = 62;

export function roleOf(event: CalendarEvent): Role {
  const self = event.attendees?.find((a) => a.self);
  const organizerIsSelf = !!event.organizer?.self || (!event.organizer && !!event.creator?.self);
  if (self && !organizerIsSelf) return "attendee";
  if (organizerIsSelf) {
    const guests = (event.attendees || []).filter((a) => !a.self && !a.resource);
    return guests.length > 0 ? "organizer" : "solo";
  }
  return "readonly";
}

const ACTIONS: Record<Role, Action[]> = {
  attendee: ["decline", "keep"],
  organizer: ["cancel", "keep"],
  solo: ["delete", "keep"],
  readonly: ["keep"],
};

// Work invites and meetings get declined/cancelled; personal events, your own
// blocks and anything read-only are kept unless you say otherwise.
export function defaultAction(role: Role, kind: "work" | "personal"): Action {
  if (kind == "work" && role == "attendee") return "decline";
  if (kind == "work" && role == "organizer") return "cancel";
  return "keep";
}

export function parseRange(startIso: unknown, endIso: unknown): { start: Date; end: Date } {
  const start = new Date(String(startIso));
  const end = new Date(String(endIso));
  if (isNaN(+start) || isNaN(+end)) throw new Error("start and end must be ISO dates");
  if (end <= start) throw new Error("end must be after start");
  if (+end - +start > MAX_DAYS * 86400_000) throw new Error(`Pick a range of at most ${MAX_DAYS} days`);
  return { start, end };
}

function errorMessage(c: CalendarDocument, e: any): string {
  if (isInvalidGrant(e)) return `${c.calendar_id}: access was revoked, reconnect this calendar`;
  return `${c.calendar_id}: ${e?.response?.data?.error?.message || e?.message || "failed"}`;
}

export async function listTimeOff(email: string, start: Date, end: Date) {
  const calendars = await Calendar.find({ email });
  const items: TimeOffItem[] = [];
  const errors: string[] = [];
  let alreadyDeclined = 0;

  await Promise.all(
    calendars.map(async (c) => {
      const kind = calendarKind(c);
      let events: CalendarEvent[];
      try {
        events = await withAccess(c, (t) =>
          GoogleAuth.listEventsInRange(c.calendar_id, t, start.toISOString(), end.toISOString()),
        );
      } catch (e) {
        errors.push(errorMessage(c, e));
        return;
      }
      for (const e of events) {
        if (!e.id || e.status == "cancelled") continue;
        if (copiedFrom(e) !== null) continue; // our busy copies follow their originals
        if (SKIPPED_TYPES.includes(e.eventType || "") || isOurOutOfOffice(e)) continue;
        const response = e.attendees?.find((a) => a.self)?.responseStatus || undefined;
        if (response == "declined") {
          alreadyDeclined++;
          continue;
        }
        const role = roleOf(e);
        items.push({
          calendarId: c.calendar_id,
          kind,
          eventId: e.id,
          summary: e.summary || "(no title)",
          start: e.start,
          end: e.end,
          allDay: !!e.start?.date,
          role,
          organizer: e.organizer?.self ? undefined : e.organizer?.displayName || e.organizer?.email || undefined,
          guests: (e.attendees || []).filter((a) => !a.self && !a.resource).length,
          response,
          recurring: !!e.recurringEventId,
          htmlLink: e.htmlLink || undefined,
          actions: ACTIONS[role],
          defaultAction: defaultAction(role, kind),
        });
      }
    }),
  );

  const startOf = (i: TimeOffItem) => i.start?.dateTime || i.start?.date || "";
  items.sort((a, b) => startOf(a).localeCompare(startOf(b)) || a.calendarId.localeCompare(b.calendarId));

  return {
    calendars: calendars.map((c) => ({ calendarId: c.calendar_id, kind: calendarKind(c) })),
    items,
    alreadyDeclined,
    errors,
  };
}

export type ApplyRequest = {
  message: string;
  actions: { calendarId: string; eventId: string; action: Action; message?: string }[];
  // start/end: local midnights as ISO instants; startDate/endDate: the same
  // days as YYYY-MM-DD (end exclusive), for the all-day fallback.
  outOfOffice?: { calendarIds: string[]; start: string; end: string; startDate: string; endDate: string; timeZone: string };
};

export type ApplyResult = {
  calendarId: string;
  eventId?: string;
  action: string;
  ok: boolean;
  error?: string;
  detail?: string;
};

// Instant from an event time; all-day dates widen by a day either side so the
// search window covers every timezone the copy could have been read in.
function bound(t: CalendarEvent["start"], edge: "start" | "end"): string {
  if (t?.dateTime) return new Date(+new Date(t.dateTime) + (edge == "start" ? -60_000 : 60_000)).toISOString();
  const d = new Date(`${t?.date}T00:00:00Z`);
  return new Date(+d + (edge == "start" ? -86400_000 : 86400_000)).toISOString();
}

// Removes the busy copies of `event` from the user's other calendars right
// away, instead of leaving them for the next sync. Returns how many went.
async function removeCopies(
  calendars: Map<string, CalendarDocument>,
  sourceId: string,
  event: CalendarEvent,
): Promise<number> {
  let removed = 0;
  const timeMin = bound(event.start, "start");
  const timeMax = bound(event.end, "end");
  for (const c of calendars.values()) {
    if (c.calendar_id == sourceId) continue;
    await withAccess(c, async (t) => {
      const events = await GoogleAuth.listEventsInRange(c.calendar_id, t, timeMin, timeMax);
      for (const copy of events) {
        if (!copy.id || copiedFrom(copy) != event.id) continue;
        await ignoreGone(GoogleAuth.deleteEvent(t, c.calendar_id, copy.id));
        console.log(`${c.calendar_id}: removed busy copy of ${event.id}`);
        removed++;
      }
    });
  }
  return removed;
}

export async function applyTimeOff(email: string, req: ApplyRequest): Promise<ApplyResult[]> {
  const calendars = new Map((await Calendar.find({ email })).map((c) => [c.calendar_id, c]));
  const results: ApplyResult[] = [];

  for (const a of req.actions || []) {
    if (a.action == "keep") continue;
    const c = calendars.get(a.calendarId);
    const result: ApplyResult = { calendarId: a.calendarId, eventId: a.eventId, action: a.action, ok: false };
    results.push(result);
    if (!c) {
      result.error = "Calendar not found";
      continue;
    }
    const note = (a.message ?? req.message ?? "").trim();
    let event: CalendarEvent;
    try {
      event = await withAccess(c, async (t) => {
        // Re-read the event: its guest list or RSVP may have changed since review.
        const event = await GoogleAuth.getEvent(t, c.calendar_id, a.eventId);
        const role = roleOf(event);
        if (!ACTIONS[role].includes(a.action)) throw new Error(`can't ${a.action} an event where you are ${role}`);
        if (a.action == "decline") await GoogleAuth.declineEvent(t, c.calendar_id, event, note);
        else if (a.action == "cancel") await GoogleAuth.cancelEvent(t, c.calendar_id, event, note);
        else if (a.action == "delete") await ignoreGone(GoogleAuth.deleteEvent(t, c.calendar_id, a.eventId));
        return event;
      });
      result.ok = true;
      console.log(`${c.calendar_id}: time off ${a.action} ${a.eventId}`);
    } catch (e) {
      result.error = errorMessage(c, e);
      console.error(`time off ${a.action} failed: ${result.error}`);
      continue;
    }

    // The action itself succeeded; a failure here only delays the cleanup to
    // the sync that follows, so it is reported but does not fail the item.
    try {
      const n = await removeCopies(calendars, c.calendar_id, event);
      if (n) result.detail = `Removed ${n} busy cop${n == 1 ? "y" : "ies"} from your other calendars`;
    } catch (e) {
      result.detail = `Busy copies will be removed on the next sync (${errorMessage(c, e)})`;
    }
  }

  const ooo = req.outOfOffice;
  if (ooo) {
    const { start, end } = parseRange(ooo.start, ooo.end);
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRe.test(ooo.startDate) || !dateRe.test(ooo.endDate)) throw new Error("startDate/endDate must be YYYY-MM-DD");
    for (const id of ooo.calendarIds || []) {
      const c = calendars.get(id);
      const result: ApplyResult = { calendarId: id, action: "out-of-office", ok: false };
      results.push(result);
      if (!c) {
        result.error = "Calendar not found";
        continue;
      }
      try {
        const how = await withAccess(c, (t) =>
          GoogleAuth.createOutOfOffice(
            t,
            c.calendar_id,
            {
              start: start.toISOString(),
              end: end.toISOString(),
              startDate: ooo.startDate,
              endDate: ooo.endDate,
              timeZone: ooo.timeZone || "UTC",
            },
            (req.message || "").trim(),
          ),
        );
        result.ok = true;
        result.detail = how == "native" ? "Out of office, auto-declines new invites" : "All-day OOO event";
      } catch (e) {
        result.error = errorMessage(c, e);
      }
    }
  }

  // Copies were removed above; a sync now also catches anything that moved.
  processUser(email).catch((e) => console.error(`post time-off sync for ${email} failed:`, e.message));
  return results;
}
