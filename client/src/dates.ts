import * as chrono from "chrono-node";

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

const NUMBERS: Record<string, number> = { a: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, ten: 10 };

// "I'm OOO on Friday", "vacation next week", "off from Oct 20 to 24",
// "out the next 3 days", "OOO tomorrow". Returns null if nothing parses.
export function parseTimeOff(text: string, now = new Date()): DayRange | null {
  const t = text.toLowerCase();
  const today = startOfDay(now);

  if (/\bnext week\b/.test(t)) {
    const mon = addDays(startOfWeek(today), 7);
    return { start: mon, end: addDays(mon, 7) };
  }
  if (/\b(this|rest of the) week\b/.test(t)) {
    return { start: today, end: addDays(startOfWeek(today), 7) };
  }
  const nextN = t.match(/\b(?:next|coming)\s+(\d+|a|one|two|three|four|five|six|seven|ten)\s+(day|week)s?\b/);
  if (nextN) {
    const n = Number(nextN[1]) || NUMBERS[nextN[1]] || 1;
    return { start: today, end: addDays(today, nextN[2] == "week" ? n * 7 : n) };
  }
  const weekOf = t.match(/\bweek of (.+)/);
  if (weekOf) {
    const d = chrono.parseDate(weekOf[1], now, { forwardDate: true });
    if (d) {
      const mon = startOfWeek(d);
      return { start: mon, end: addDays(mon, 7) };
    }
  }

  const results = chrono.parse(text, now, { forwardDate: true });
  if (!results.length) return null;
  const first = results[0];
  const last = results.length > 1 && !first.end ? results[results.length - 1] : null;
  const end = first.end?.date() || last?.start.date() || first.start.date();
  return days(first.start.date(), end);
}

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
