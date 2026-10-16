export type Calendar = {
  _id: string;
  calendar_id: string;
  source: boolean;
  destination: boolean;
  kind: Kind;
};

export type Kind = "work" | "personal";
export type Role = "attendee" | "organizer" | "solo" | "readonly";
export type Action = "decline" | "cancel" | "delete" | "keep";

export type EventTime = { date?: string; dateTime?: string; timeZone?: string };

export type TimeOffItem = {
  calendarId: string;
  kind: Kind;
  eventId: string;
  summary: string;
  start: EventTime;
  end: EventTime;
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

export type TimeOffList = {
  calendars: { calendarId: string; kind: Kind }[];
  items: TimeOffItem[];
  alreadyDeclined: number;
  errors: string[];
};

export type ApplyResult = {
  calendarId: string;
  eventId?: string;
  action: string;
  ok: boolean;
  error?: string;
  detail?: string;
};

export type User = { email: string; name?: string };

export class UnauthorizedError extends Error {}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status == 401) throw new UnauthorizedError("Not signed in");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

const enc = encodeURIComponent;

export const api = {
  me: () => call<User>("GET", "/api/me"),
  logout: () => call("POST", "/api/logout"),
  calendars: () => call<Calendar[]>("GET", "/api/calendars"),
  deleteCalendar: (id: string) => call("DELETE", `/api/calendars/${enc(id)}`),
  toggleSource: (id: string) => call<Calendar>("POST", `/api/calendars/${enc(id)}/toggle-source`),
  toggleDestination: (id: string) => call<Calendar>("POST", `/api/calendars/${enc(id)}/toggle-destination`),
  setKind: (id: string, kind: Kind) => call<Calendar>("POST", `/api/calendars/${enc(id)}/kind`, { kind }),
  sync: () => call<{ result: string }>("POST", "/api/sync"),
  timeOffEvents: (start: Date, end: Date) =>
    call<TimeOffList>("GET", `/api/timeoff/events?start=${enc(start.toISOString())}&end=${enc(end.toISOString())}`),
  applyTimeOff: (body: {
    message: string;
    actions: { calendarId: string; eventId: string; action: Action; message?: string }[];
    outOfOffice?: { calendarIds: string[]; start: string; end: string; startDate: string; endDate: string; timeZone: string };
  }) => call<{ results: ApplyResult[] }>("POST", "/api/timeoff/apply", body),
};

// Full-page redirects into Google's consent screens (handled by the server).
export const signIn = () => (window.location.href = "/auth/google/login");
export const connectCalendar = () => (window.location.href = "/auth/google/calendar");
