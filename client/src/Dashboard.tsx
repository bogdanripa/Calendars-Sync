import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, Calendar, connectCalendar, UnauthorizedError, User } from "./api.ts";
import { Footer, Nav } from "./Layout.tsx";

type Notice = { kind: "ok" | "error"; text: string } | null;

function Toggle({ on, label, hint, onClick }: { on: boolean; label: string; hint: string; onClick: () => void }) {
  return (
    <button className={`toggle ${on ? "on" : ""}`} role="switch" aria-checked={on} onClick={onClick} title={hint}>
      <span className="toggle-track">
        <span className="toggle-thumb" />
      </span>
      {label}
    </button>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [calendars, setCalendars] = useState<Calendar[] | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const fail = (e: unknown) => {
    if (e instanceof UnauthorizedError) navigate("/");
    else setNotice({ kind: "error", text: (e as Error).message });
  };

  useEffect(() => {
    api.me().then(setUser).catch(fail);
    api.calendars().then(setCalendars).catch(fail);

    const added = params.get("added");
    const error = params.get("error");
    if (added) setNotice({ kind: "ok", text: `Connected ${added}. It will sync within the hour, or hit “Sync now”.` });
    if (error) setNotice({ kind: "error", text: error == "cancelled" ? "Connecting the calendar was cancelled." : error });
    if (added || error) setParams({}, { replace: true });
  }, []);

  const replace = (c: Calendar) => setCalendars((cl) => (cl || []).map((x) => (x.calendar_id == c.calendar_id ? c : x)));

  const handleDelete = async (calendar_id: string) => {
    if (!confirm(`Stop syncing ${calendar_id}? This also revokes the app's access to it.`)) return;
    try {
      await api.deleteCalendar(calendar_id);
      setCalendars((cl) => (cl || []).filter((c) => c.calendar_id !== calendar_id));
    } catch (e) {
      fail(e);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setNotice(null);
    try {
      const { result } = await api.sync();
      setNotice({ kind: "ok", text: `Sync complete. ${result}.` });
    } catch (e) {
      fail(e);
    }
    setSyncing(false);
  };

  const handleSignOut = async () => {
    await api.logout().catch(() => {});
    navigate("/");
  };

  return (
    <div className="page">
      <Nav>
        {user && <span className="muted nav-user">{user.email}</span>}
        <button className="btn btn-small" onClick={handleSignOut}>
          Sign out
        </button>
      </Nav>

      <main className="section">
        <div className="container narrow">
          <div className="dash-head">
            <div>
              <h1 className="dash-title">Your calendars</h1>
              <p className="muted">
                Busy time from every <b>source</b> calendar is copied into every <b>destination</b> calendar, every hour,
                for the next 14 days.
              </p>
            </div>
          </div>

          {notice && <div className={`alert alert-${notice.kind}`}>{notice.text}</div>}

          <ul className="cal-list">
            {calendars === null && <li className="card cal-empty">Loading…</li>}
            {calendars?.length === 0 && (
              <li className="card cal-empty">
                <b>No calendars yet.</b>
                <span className="muted">
                  Connect at least two Google calendars, for example your personal and your work one, to start syncing.
                </span>
              </li>
            )}
            {calendars?.map((c) => (
              <li className="card cal" key={c._id}>
                <div className="cal-id">
                  <span className="cal-avatar">{c.calendar_id.charAt(0).toUpperCase()}</span>
                  <span className="cal-name">{c.calendar_id}</span>
                </div>
                <div className="cal-actions">
                  <div className="seg seg-small" role="radiogroup" aria-label="Calendar type">
                    {(["work", "personal"] as const).map((k) => (
                      <button
                        key={k}
                        role="radio"
                        aria-checked={c.kind == k}
                        className={`seg-btn ${c.kind == k ? "on" : ""}`}
                        title={k == "work" ? "Work invites get declined when you take time off" : "Kept when you take time off"}
                        onClick={() => api.setKind(c.calendar_id, k).then(replace).catch(fail)}
                      >
                        {k == "work" ? "Work" : "Personal"}
                      </button>
                    ))}
                  </div>
                  <Toggle
                    on={c.source}
                    label="Source"
                    hint="Copy busy time from this calendar into the others"
                    onClick={() => api.toggleSource(c.calendar_id).then(replace).catch(fail)}
                  />
                  <Toggle
                    on={c.destination}
                    label="Destination"
                    hint="Receive busy time from the other calendars"
                    onClick={() => api.toggleDestination(c.calendar_id).then(replace).catch(fail)}
                  />
                  <button className="btn btn-ghost btn-small" onClick={() => handleDelete(c.calendar_id)}>
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="dash-actions">
            <button className="btn btn-primary" onClick={connectCalendar}>
              + Connect a Google calendar
            </button>
            {calendars && calendars.length > 0 && (
              <button className="btn" onClick={handleSync} disabled={syncing}>
                {syncing ? "Syncing…" : "Sync now"}
              </button>
            )}
          </div>
          {calendars && calendars.length > 0 && (
            <Link to="/time-off" className="card timeoff-cta">
              <span className="feature-icon" aria-hidden="true">
                🌴
              </span>
              <span>
                <b>Taking time off?</b>
                <span className="muted">
                  {" "}
                  Pick the days. We’ll show everything on your calendars, decline work invites with a note, and block your
                  work calendar as OOO.
                </span>
              </span>
              <span className="timeoff-go">Plan time off →</span>
            </Link>
          )}
          {calendars && calendars.length == 1 && (
            <p className="muted small">Tip: connect a second calendar. Syncing needs at least two.</p>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
