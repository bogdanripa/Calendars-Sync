import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Action, api, ApplyResult, Role, TimeOffItem, TimeOffList, UnauthorizedError } from "./api.ts";
import {
  addDays,
  dayCount,
  DayRange,
  describeRange,
  fromInputValue,
  presets,
  sameRange,
  startOfDay,
  toInputValue,
} from "./dates.ts";
import { Footer, Nav } from "./Layout.tsx";

type Step = "when" | "review" | "done";


const ACTION_LABEL: Record<Action, string> = {
  decline: "Decline",
  cancel: "Cancel meeting",
  delete: "Delete",
  keep: "Keep",
};

const RESULT_LABEL: Record<string, string> = {
  decline: "Declined",
  cancel: "Cancelled",
  delete: "Deleted",
  "out-of-office": "OOO block added",
};

function defaultMessage(range: DayRange): string {
  const when = dayCount(range) <= 1 ? `on ${describeRange(range)}` : `from ${describeRange(range)}`;
  return `Hi! I'm out of office ${when} and won't be able to make it. I'll catch up when I'm back.`;
}

const key = (i: { calendarId: string; eventId: string }) => `${i.calendarId}|${i.eventId}`;

const fmtTime = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });
const fmtDayHeading = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" });

function itemDay(i: TimeOffItem, range: DayRange): Date {
  const d = i.start.date ? fromInputValue(i.start.date)! : startOfDay(new Date(i.start.dateTime!));
  return d < range.start ? range.start : d;
}

function timeLabel(i: TimeOffItem): string {
  if (i.allDay) {
    const s = fromInputValue(i.start.date || "");
    const e = fromInputValue(i.end.date || "");
    const days = s && e ? Math.round((+e - +s) / 86400_000) : 1;
    return days > 1 ? `All day · ${days} days` : "All day";
  }
  return `${fmtTime.format(new Date(i.start.dateTime!))} – ${fmtTime.format(new Date(i.end.dateTime!))}`;
}

function roleLabel(i: TimeOffItem): string {
  const guests = i.guests ? ` · ${i.guests} guest${i.guests == 1 ? "" : "s"}` : "";
  const r: Record<Role, string> = {
    attendee: `Invite${i.organizer ? ` from ${i.organizer}` : ""}${guests}`,
    organizer: `You organize${guests}`,
    solo: "Your event, no guests",
    readonly: "Read-only",
  };
  return r[i.role] + (i.recurring ? " · this occurrence only" : "");
}

export default function TimeOff() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("when");
  const [range, setRange] = useState<DayRange>(() => presets()[1].range);

  const [list, setList] = useState<TimeOffList | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [choices, setChoices] = useState<Record<string, Action>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [openNote, setOpenNote] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [messageEdited, setMessageEdited] = useState(false);
  const [oooCalendars, setOooCalendars] = useState<string[]>([]);

  const [applying, setApplying] = useState(false);
  const [results, setResults] = useState<ApplyResult[] | null>(null);

  const fail = (e: unknown) => {
    if (e instanceof UnauthorizedError) navigate("/");
    else setError((e as Error).message);
  };

  useEffect(() => {
    api.me().catch(fail);
  }, []);

  useEffect(() => {
    if (range && !messageEdited) setMessage(defaultMessage(range));
  }, [range, messageEdited]);

  const loadEvents = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!range) return;
    setLoading(true);
    setError("");
    try {
      const l = await api.timeOffEvents(range.start, range.end);
      setList(l);
      setChoices(Object.fromEntries(l.items.map((i) => [key(i), i.defaultAction])));
      setNotes({});
      setOooCalendars(l.calendars.filter((c) => c.kind == "work").map((c) => c.calendarId));
      setStep("review");
    } catch (err) {
      fail(err);
    }
    setLoading(false);
  };

  const groups = useMemo(() => {
    if (!list || !range) return [];
    const m = new Map<number, TimeOffItem[]>();
    for (const i of list.items) {
      const d = +itemDay(i, range);
      m.set(d, [...(m.get(d) || []), i]);
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([d, items]) => ({ day: new Date(d), items }));
  }, [list, range]);

  const counts = useMemo(() => {
    const c: Record<Action, number> = { decline: 0, cancel: 0, delete: 0, keep: 0 };
    for (const a of Object.values(choices)) c[a]++;
    return c;
  }, [choices]);

  const changes = counts.decline + counts.cancel + counts.delete;

  const setAll = (fn: (i: TimeOffItem) => Action) =>
    setChoices(Object.fromEntries((list?.items || []).map((i) => [key(i), fn(i)])));

  const apply = async () => {
    if (!list || !range) return;
    const parts = [
      counts.decline && `decline ${counts.decline} invite${counts.decline == 1 ? "" : "s"}`,
      counts.cancel && `cancel ${counts.cancel} meeting${counts.cancel == 1 ? "" : "s"} (guests are notified)`,
      counts.delete && `delete ${counts.delete} event${counts.delete == 1 ? "" : "s"}`,
      oooCalendars.length && `block ${oooCalendars.length} work calendar${oooCalendars.length == 1 ? "" : "s"} as OOO`,
    ].filter(Boolean);
    if (!parts.length) return;
    if (!confirm(`This will ${parts.join(", ")}. Continue?`)) return;

    setApplying(true);
    setError("");
    try {
      const { results } = await api.applyTimeOff({
        message,
        actions: list.items
          .filter((i) => choices[key(i)] != "keep")
          .map((i) => ({
            calendarId: i.calendarId,
            eventId: i.eventId,
            action: choices[key(i)],
            ...(notes[key(i)] !== undefined ? { message: notes[key(i)] } : {}),
          })),
        outOfOffice: oooCalendars.length
          ? {
              calendarIds: oooCalendars,
              start: range.start.toISOString(),
              end: range.end.toISOString(),
              startDate: toInputValue(range.start),
              endDate: toInputValue(range.end),
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            }
          : undefined,
      });
      setResults(results);
      setStep("done");
    } catch (err) {
      fail(err);
    }
    setApplying(false);
  };

  const byKey = useMemo(() => new Map((list?.items || []).map((i) => [key(i), i])), [list]);

  return (
    <div className="page">
      <Nav>
        <Link to="/calendars" className="btn btn-small">
          ← Calendars
        </Link>
      </Nav>

      <main className="section">
        <div className="container narrow">
          <h1 className="dash-title">Time off</h1>
          <ol className="stepper">
            <li className={step == "when" ? "active" : ""}>When</li>
            <li className={step == "review" ? "active" : ""}>Review</li>
            <li className={step == "done" ? "active" : ""}>Done</li>
          </ol>

          {error && <div className="alert alert-error">{error}</div>}

          {step == "when" && (
            <form className="card when" onSubmit={loadEvents}>
              <span className="label">When are you out?</span>
              <div className="chips">
                {presets().map((p) => (
                  <button
                    type="button"
                    key={p.label}
                    className={`chip ${sameRange(p.range, range) ? "chip-on" : ""}`}
                    onClick={() => setRange(p.range)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {range && (
                <div className="range">
                  <label>
                    <span className="label">First day out</span>
                    <input
                      type="date"
                      className="input"
                      value={toInputValue(range.start)}
                      onChange={(e) => {
                        const d = fromInputValue(e.target.value);
                        if (d) setRange({ start: d, end: d < range.end ? range.end : addDays(d, 1) });
                      }}
                    />
                  </label>
                  <label>
                    <span className="label">Last day out</span>
                    <input
                      type="date"
                      className="input"
                      value={toInputValue(addDays(range.end, -1))}
                      min={toInputValue(range.start)}
                      onChange={(e) => {
                        const d = fromInputValue(e.target.value);
                        if (d && d >= range.start) setRange({ start: range.start, end: addDays(d, 1) });
                      }}
                    />
                  </label>
                  <span className="range-summary">
                    {describeRange(range)} · {dayCount(range)} day{dayCount(range) == 1 ? "" : "s"}
                  </span>
                </div>
              )}

              <div className="dash-actions">
                <button className="btn btn-primary" disabled={!range || loading}>
                  {loading ? "Loading your calendars…" : "Show my events →"}
                </button>
              </div>
            </form>
          )}

          {step == "review" && list && range && (
            <>
              <div className="card review-head">
                <div>
                  <b>{describeRange(range)}</b>
                  <span className="muted">
                    {" "}
                    · {list.items.length} event{list.items.length == 1 ? "" : "s"} across {list.calendars.length} calendar
                    {list.calendars.length == 1 ? "" : "s"}
                    {list.alreadyDeclined > 0 && ` · ${list.alreadyDeclined} already declined`}
                  </span>
                </div>
                <button className="btn btn-ghost btn-small" onClick={() => setStep("when")}>
                  Change dates
                </button>
              </div>

              {list.errors.map((e) => (
                <div className="alert alert-error" key={e}>
                  {e}
                </div>
              ))}

              <div className="card">
                <label htmlFor="msg" className="label">
                  Note sent with declines and cancellations
                </label>
                <textarea
                  id="msg"
                  className="input"
                  rows={3}
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    setMessageEdited(true);
                  }}
                />
                {messageEdited && (
                  <button className="link-btn small" onClick={() => setMessageEdited(false)}>
                    Reset to default
                  </button>
                )}
              </div>

              <div className="bulk">
                <span className="muted small">
                  Work invites are declined and work meetings you organize are cancelled by default. Everything else is kept.
                </span>
                <span className="bulk-actions">
                  <button className="link-btn small" onClick={() => setAll((i) => i.defaultAction)}>
                    Reset to defaults
                  </button>
                  <button className="link-btn small" onClick={() => setAll(() => "keep")}>
                    Keep all
                  </button>
                </span>
              </div>

              {list.items.length == 0 && <div className="card cal-empty">Nothing on your calendars for these days. 🎉</div>}

              {groups.map((g) => (
                <section key={+g.day} className="day">
                  <h3 className="day-head">{fmtDayHeading.format(g.day)}</h3>
                  <ul className="events">
                    {g.items.map((i) => {
                      const k = key(i);
                      const choice = choices[k];
                      const takesNote = choice == "decline" || choice == "cancel";
                      return (
                        <li key={k} className={`card event ${choice != "keep" ? "event-changing" : ""}`}>
                          <div className="event-main">
                            <span className="event-time">{timeLabel(i)}</span>
                            <div className="event-info">
                              <span className="event-title">
                                {i.htmlLink ? (
                                  <a href={i.htmlLink} target="_blank" rel="noreferrer">
                                    {i.summary}
                                  </a>
                                ) : (
                                  i.summary
                                )}
                              </span>
                              <span className="event-meta">
                                <span className={`kind kind-${i.kind}`}>{i.kind}</span>
                                <span className="muted">{i.calendarId}</span>
                                <span className="muted">· {roleLabel(i)}</span>
                              </span>
                            </div>
                          </div>
                          <div className="seg" role="radiogroup" aria-label={`Action for ${i.summary}`}>
                            {i.actions.map((a) => (
                              <button
                                key={a}
                                role="radio"
                                aria-checked={choice == a}
                                className={`seg-btn ${choice == a ? `on on-${a}` : ""}`}
                                onClick={() => setChoices((c) => ({ ...c, [k]: a }))}
                              >
                                {ACTION_LABEL[a]}
                              </button>
                            ))}
                          </div>
                          {takesNote && (
                            <div className="event-note">
                              {openNote == k || notes[k] !== undefined ? (
                                <>
                                  <textarea
                                    className="input"
                                    rows={2}
                                    value={notes[k] ?? message}
                                    onChange={(e) => setNotes((n) => ({ ...n, [k]: e.target.value }))}
                                  />
                                  <button
                                    className="link-btn small"
                                    onClick={() => {
                                      setNotes(({ [k]: _, ...rest }) => rest);
                                      setOpenNote(null);
                                    }}
                                  >
                                    Use the default note
                                  </button>
                                </>
                              ) : (
                                <button className="link-btn small" onClick={() => setOpenNote(k)}>
                                  Custom note for this one
                                </button>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}

              <div className="card">
                <span className="label">Block your work calendars</span>
                <p className="muted small">
                  Adds a multi-day “OOO” entry for {describeRange(range)}. On Google Workspace it’s a real Out of office
                  event that also auto-declines new invites with your note.
                </p>
                {list.calendars.map((c) => (
                  <label key={c.calendarId} className="check">
                    <input
                      type="checkbox"
                      checked={oooCalendars.includes(c.calendarId)}
                      onChange={(e) =>
                        setOooCalendars((cur) =>
                          e.target.checked ? [...cur, c.calendarId] : cur.filter((x) => x != c.calendarId),
                        )
                      }
                    />
                    {c.calendarId} <span className={`kind kind-${c.kind}`}>{c.kind}</span>
                  </label>
                ))}
              </div>

              <div className="apply-bar">
                <span>
                  {changes == 0 && oooCalendars.length == 0 ? (
                    <span className="muted">Nothing to change</span>
                  ) : (
                    <>
                      {counts.decline > 0 && <b>{counts.decline} decline · </b>}
                      {counts.cancel > 0 && <b>{counts.cancel} cancel · </b>}
                      {counts.delete > 0 && <b>{counts.delete} delete · </b>}
                      <span className="muted">{counts.keep} kept</span>
                      {oooCalendars.length > 0 && <span className="muted"> · OOO on {oooCalendars.length}</span>}
                    </>
                  )}
                </span>
                <button
                  className="btn btn-primary"
                  disabled={applying || (changes == 0 && oooCalendars.length == 0)}
                  onClick={apply}
                >
                  {applying ? "Applying…" : "Apply"}
                </button>
              </div>
            </>
          )}

          {step == "done" && results && range && (
            <>
              <div className={`alert ${results.every((r) => r.ok) ? "alert-ok" : "alert-error"}`}>
                {results.length == 0
                  ? "Nothing needed changing."
                  : results.every((r) => r.ok)
                    ? `All done. Enjoy your time off, ${describeRange(range)}! 🌴`
                    : `${results.filter((r) => !r.ok).length} of ${results.length} changes failed. See below.`}
              </div>
              <ul className="cal-list">
                {results.map((r, n) => {
                  const item = r.eventId ? byKey.get(key({ calendarId: r.calendarId, eventId: r.eventId })) : undefined;
                  return (
                    <li key={n} className="card result">
                      <span className={r.ok ? "ok" : "bad"}>{r.ok ? "✓" : "✕"}</span>
                      <div>
                        <b>{RESULT_LABEL[r.action] || r.action}</b> · {item?.summary || r.calendarId}
                        {item && <span className="muted small"> · {timeLabel(item)}</span>}
                        {r.detail && <div className="muted small">{r.detail}</div>}
                        {r.error && <div className="error small">{r.error}</div>}
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="dash-actions">
                <Link to="/calendars" className="btn btn-primary">
                  Back to calendars
                </Link>
                <button
                  className="btn"
                  onClick={() => {
                    setStep("when");
                    setResults(null);
                    setList(null);
                  }}
                >
                  Plan more time off
                </button>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
