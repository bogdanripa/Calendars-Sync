// A range of whole local days: start at 00:00 of the first day, end at 00:00
// of the day after the last one (so it can be sent to the API as-is).
export type DayRange = { start: Date; end: Date };

const DAY = 86400_000;

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

// Monday-based week.
function startOfWeek(d: Date): Date {
  const day = (d.getDay() + 6) % 7;
  return addDays(startOfDay(d), -day);
}

function days(first: Date, last: Date): DayRange {
  const a = startOfDay(first);
  const b = startOfDay(last);
  return b < a ? { start: b, end: addDays(a, 1) } : { start: a, end: addDays(b, 1) };
}

// One-click ranges for the time-off picker.
export function presets(now = new Date()): { label: string; range: DayRange }[] {
  const today = startOfDay(now);
  const monday = startOfWeek(today);
  return [
    { label: "Today", range: days(today, today) },
    { label: "Tomorrow", range: days(addDays(today, 1), addDays(today, 1)) },
    { label: "Rest of this week", range: { start: today, end: addDays(monday, 7) } },
    { label: "Next week", range: { start: addDays(monday, 7), end: addDays(monday, 14) } },
    { label: "Next 2 weeks", range: { start: addDays(monday, 7), end: addDays(monday, 21) } },
  ];
}

export const sameRange = (a: DayRange, b: DayRange) => +a.start == +b.start && +a.end == +b.end;

export function toInputValue(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function fromInputValue(v: string): Date | null {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

const fmtDay = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" });

export function describeRange(r: DayRange): string {
  const last = addDays(r.end, -1);
  const n = Math.round((+r.end - +r.start) / DAY);
  return n <= 1 ? fmtDay.format(r.start) : `${fmtDay.format(r.start)} – ${fmtDay.format(last)}`;
}

export function dayCount(r: DayRange): number {
  return Math.round((+r.end - +r.start) / DAY);
}
