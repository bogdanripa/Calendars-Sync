import { google, calendar_v3 } from "googleapis";
import { Credentials, OAuth2Client } from "google-auth-library";
import { v4 as uuidv4 } from "uuid";

export type CalendarEvent = calendar_v3.Schema$Event;
export type EventAttendee = calendar_v3.Schema$EventAttendee;
export type CalendarEntry = calendar_v3.Schema$CalendarListEntry;
export type GCredentials = Credentials;

const CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/calendar.events",
];
const LOGIN_SCOPES = ["openid", "email", "profile"];

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

export function publicUrl(): string {
  return (process.env.PUBLIC_URL || "http://localhost:5173").replace(/\/$/, "");
}

export function redirectUri(): string {
  return `${publicUrl()}/auth/google/callback`;
}

// A fresh client per call: the old code shared one client and swapped
// credentials on it, which races when several users sync at once.
function client(credentials?: Credentials): OAuth2Client {
  const c = new google.auth.OAuth2(env("GOOGLE_CLIENT_ID"), env("GOOGLE_CLIENT_SECRET"), redirectUri());
  if (credentials) c.setCredentials(credentials);
  return c;
}

function calendarApi(access_token: string) {
  return google.calendar({ version: "v3", auth: client({ access_token }) });
}

// Sign-in only asks for identity; calendar access is requested per calendar.
const getLoginUrl = (state: string): string =>
  client().generateAuthUrl({ scope: LOGIN_SCOPES, prompt: "select_account", state });

const getAuthUrl = (state: string): string =>
  client().generateAuthUrl({
    access_type: "offline",
    scope: CALENDAR_SCOPES,
    prompt: "consent",
    state,
  });

const getTokens = async (code: string): Promise<Credentials> => {
  const { tokens } = await client().getToken(code);
  return tokens;
};

const getIdentity = async (idToken: string): Promise<{ email: string; name?: string; sub: string }> => {
  const ticket = await client().verifyIdToken({ idToken, audience: env("GOOGLE_CLIENT_ID") });
  const p = ticket.getPayload();
  if (!p?.email || !p.email_verified) throw new Error("Google account has no verified email");
  return { email: p.email, name: p.name, sub: p.sub };
};

const refreshTokens = async (refresh_token: string): Promise<Credentials> => {
  const c = client({ refresh_token });
  const { credentials } = await c.refreshAccessToken();
  return credentials;
};

const listUserCalendars = async (accessToken: string): Promise<CalendarEntry[]> => {
  const response = await calendarApi(accessToken).calendarList.list();
  return response.data.items || [];
};

const listCalendarEvents = async (calendarId: string, access_token: string): Promise<CalendarEvent[]> => {
  const now = new Date();
  const timeMin = now.toISOString();
  const timeMax = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(); // 14 days from now

  const events: CalendarEvent[] = [];
  let pageToken: string | undefined;
  do {
    const response = await calendarApi(access_token).events.list({
      calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 2500,
      pageToken,
    });
    events.push(...(response.data.items || []));
    pageToken = response.data.nextPageToken || undefined;
  } while (pageToken);
  return events;
};

const revokeToken = async (token: string) => {
  try {
    await client().revokeToken(token);
    console.log("The token has been revoked.");
  } catch (error) {
    console.error("Failed to revoke the token:", (error as Error).message);
  }
};

const createEvent = async (event: CalendarEvent, accessToken: string, calendarId: string) => {
  // Same iCalUID domain as the original deployment.
  if (!event.iCalUID) {
    event.iCalUID = uuidv4() + "@calendars-sync.app.genez.io";
  }

  if (event.status == "tentative") {
    event.attendees = [
      {
        email: calendarId,
        responseStatus: "needsAction",
        self: true,
      },
    ];
  }

  await calendarApi(accessToken).events.insert({
    calendarId,
    requestBody: event,
  });
};

const deleteEvent = async (access_token: string, calendarId: string, eventId: string) => {
  await calendarApi(access_token).events.delete({
    calendarId,
    eventId,
  });
};

// Every event overlapping [timeMin, timeMax), recurring ones expanded, in full.
const listEventsInRange = async (
  calendarId: string,
  access_token: string,
  timeMin: string,
  timeMax: string,
): Promise<CalendarEvent[]> => {
  const events: CalendarEvent[] = [];
  let pageToken: string | undefined;
  do {
    const response = await calendarApi(access_token).events.list({
      calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 2500,
      pageToken,
    });
    events.push(...(response.data.items || []));
    pageToken = response.data.nextPageToken || undefined;
  } while (pageToken);
  return events;
};

const getEvent = async (access_token: string, calendarId: string, eventId: string): Promise<CalendarEvent> =>
  (await calendarApi(access_token).events.get({ calendarId, eventId })).data;

// RSVP "no" as an attendee. The organizer is notified, with the comment.
const declineEvent = async (access_token: string, calendarId: string, event: CalendarEvent, comment: string) => {
  const attendees = (event.attendees || []).map((a) =>
    a.self ? { ...a, responseStatus: "declined", comment: comment || undefined } : a,
  );
  await calendarApi(access_token).events.patch({
    calendarId,
    eventId: event.id!,
    sendUpdates: "all",
    requestBody: { attendees },
  });
};

// Cancel a meeting you organize: guests get a cancellation that includes the
// note, which is put at the top of the description first (silently).
const cancelEvent = async (access_token: string, calendarId: string, event: CalendarEvent, note: string) => {
  const api = calendarApi(access_token);
  if (note) {
    await api.events.patch({
      calendarId,
      eventId: event.id!,
      sendUpdates: "none",
      requestBody: { description: event.description ? `${note}\n\n${event.description}` : note },
    });
  }
  await api.events.delete({ calendarId, eventId: event.id!, sendUpdates: "all" });
};

// Marks the OOO blocks this app creates, so the sync never copies them.
export const OOO_MARKER = { calendarsSync: "ooo" };

export function isOurOutOfOffice(event: CalendarEvent): boolean {
  return event.extendedProperties?.private?.calendarsSync == "ooo";
}

// A multi-day "OOO" block. Prefers Google's native Out of office event, which
// also auto-declines NEW invites in the range with the message (existing ones
// are handled one by one in the review). That type exists only on Workspace
// calendars, so anything else gets a plain all-day busy event instead.
const createOutOfOffice = async (
  access_token: string,
  calendarId: string,
  range: { start: string; end: string; startDate: string; endDate: string; timeZone: string },
  declineMessage: string,
): Promise<"native" | "all-day"> => {
  const api = calendarApi(access_token);
  try {
    await api.events.insert({
      calendarId,
      requestBody: {
        eventType: "outOfOffice",
        summary: "OOO",
        start: { dateTime: range.start, timeZone: range.timeZone },
        end: { dateTime: range.end, timeZone: range.timeZone },
        transparency: "opaque",
        extendedProperties: { private: OOO_MARKER },
        outOfOfficeProperties: {
          autoDeclineMode: "declineOnlyNewConflictingInvitations",
          declineMessage,
        },
      },
    });
    return "native";
  } catch (error: any) {
    if (error.response?.status != 400) throw error;
    console.log(`${calendarId}: native out-of-office not supported, using an all-day event`);
  }
  await api.events.insert({
    calendarId,
    requestBody: {
      summary: "OOO",
      description: declineMessage || undefined,
      start: { date: range.startDate },
      end: { date: range.endDate },
      transparency: "opaque",
      extendedProperties: { private: OOO_MARKER },
    },
  });
  return "all-day";
};

export const GoogleAuth = {
  listEventsInRange,
  getEvent,
  declineEvent,
  cancelEvent,
  createOutOfOffice,
  getLoginUrl,
  getAuthUrl,
  getTokens,
  getIdentity,
  refreshTokens,
  listUserCalendars,
  listCalendarEvents,
  createEvent,
  deleteEvent,
  revokeToken,
};
