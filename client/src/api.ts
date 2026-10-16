export type Calendar = {
  _id: string;
  calendar_id: string;
  source: boolean;
  destination: boolean;
};

export type User = { email: string; name?: string };

export class UnauthorizedError extends Error {}

async function call<T>(method: string, path: string): Promise<T> {
  const res = await fetch(path, { method, credentials: "same-origin" });
  if (res.status == 401) throw new UnauthorizedError("Not signed in");
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body as T;
}

const enc = encodeURIComponent;

export const api = {
  me: () => call<User>("GET", "/api/me"),
  logout: () => call("POST", "/api/logout"),
  calendars: () => call<Calendar[]>("GET", "/api/calendars"),
  deleteCalendar: (id: string) => call("DELETE", `/api/calendars/${enc(id)}`),
  toggleSource: (id: string) => call<Calendar>("POST", `/api/calendars/${enc(id)}/toggle-source`),
  toggleDestination: (id: string) => call<Calendar>("POST", `/api/calendars/${enc(id)}/toggle-destination`),
  sync: () => call<{ result: string }>("POST", "/api/sync"),
};

// Full-page redirects into Google's consent screens (handled by the server).
export const signIn = () => (window.location.href = "/auth/google/login");
export const connectCalendar = () => (window.location.href = "/auth/google/calendar");
