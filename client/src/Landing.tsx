import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, signIn, User } from "./api.ts";
import { Footer, GoogleButton, Nav } from "./Layout.tsx";

const ERRORS: Record<string, string> = {
  cancelled: "Sign-in was cancelled.",
  state: "Your sign-in session expired. Please try again.",
  signin: "Please sign in first.",
};

function CalendarMock() {
  return (
    <div className="mock" aria-hidden="true">
      <div className="mock-cal">
        <div className="mock-head">
          <span className="dot dot-personal" /> Personal
        </div>
        <div className="mock-grid">
          <div className="slot" style={{ top: "8%", height: "18%" }}>
            <b>Dentist</b>
            <small>9:00 – 10:00</small>
          </div>
          <div className="slot" style={{ top: "62%", height: "22%" }}>
            <b>Kids' school play</b>
            <small>15:00 – 16:30</small>
          </div>
        </div>
      </div>
      <div className="mock-arrow">
        <svg viewBox="0 0 48 24" width="48" height="24">
          <path d="M2 12h40m-8-8 8 8-8 8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="mock-cal">
        <div className="mock-head">
          <span className="dot dot-work" /> Work
        </div>
        <div className="mock-grid">
          <div className="slot slot-work" style={{ top: "32%", height: "20%" }}>
            <b>Team stand-up</b>
            <small>11:00 – 12:00</small>
          </div>
          <div className="slot slot-busy" style={{ top: "8%", height: "18%" }}>
            <b>Busy (confirmed)</b>
            <small>9:00 – 10:00</small>
          </div>
          <div className="slot slot-busy" style={{ top: "62%", height: "22%" }}>
            <b>Busy (confirmed)</b>
            <small>15:00 – 16:30</small>
          </div>
        </div>
      </div>
    </div>
  );
}

const STEPS = [
  { n: 1, title: "Sign in with Google", text: "Use whichever Google account you like. Signing in only shares your name and email." },
  {
    n: 2,
    title: "Connect your calendars",
    text: "Add your personal, work and side-project Google calendars. Each one can send busy time, receive it, or both.",
  },
  {
    n: 3,
    title: "Forget about it",
    text: "Every hour, busy blocks for the next 14 days are copied across, and anything that moved or was cancelled gets updated.",
  },
];

const FEATURES = [
  {
    icon: "🔒",
    title: "Private by design",
    text: "Copies show up as “Busy”. Titles, descriptions, attendees and locations never leave the original calendar.",
  },
  {
    icon: "🎛️",
    title: "You choose the direction",
    text: "Mark each calendar as a source, a destination, or both. Push personal time to work without pulling work into personal.",
  },
  {
    icon: "✅",
    title: "Respects your RSVPs",
    text: "Declined invites aren’t copied. Tentative and unanswered ones show up as tentative, and accepted ones as confirmed.",
  },
  {
    icon: "🧹",
    title: "Cleans up after itself",
    text: "Moved, cancelled or re-RSVP’d an event? Its copies are removed or replaced on the next run. No stale blocks.",
  },
  {
    icon: "⏱️",
    title: "Hourly, automatic",
    text: "A background job syncs everyone every hour. In a hurry? Hit “Sync now” on your dashboard.",
  },
  {
    icon: "🌴",
    title: "Time off in one go",
    text: "Say “vacation next week”. Review every event across your calendars, decline work invites with a note, and block work as OOO.",
  },
  {
    icon: "🔁",
    title: "No loops, no duplicates",
    text: "Copies are tagged with the event they came from, so they never get copied again or duplicated.",
  },
];

const FAQ = [
  {
    q: "What exactly gets copied?",
    a: "For each event in the next 14 days, a new event titled “Busy (confirmed)” or “Busy (tentative)” is created with the same start and end time. Nothing else from the original is copied.",
  },
  {
    q: "Do you store my events?",
    a: "No. Events are read from Google during each sync and are never saved. The only things stored are your email and the access tokens Google issues so the app can sync.",
  },
  {
    q: "How does time off work?",
    a: "Type when you’re out, like “I’m OOO on Friday” or “vacation next week”. You get every event in that range from all your connected calendars. Invites on work calendars are set to decline and meetings you organize there to cancel. Personal events are kept. Change any of them, edit the note, and apply. Your work calendars then get a multi-day “OOO” entry.",
  },
  {
    q: "What do people see when I decline?",
    a: "The organizer gets your RSVP with your note, the same as declining in Google Calendar. If you cancel a meeting you organize, guests get Google’s cancellation with your note at the top of the description. On Google Workspace the OOO entry is a real Out of office event, so new invites during your time off are auto-declined with the same note.",
  },
  {
    q: "Which calendars are supported?",
    a: "Google Calendar, including Google Workspace accounts. For each Google account you connect, its primary calendar is synced.",
  },
  {
    q: "How do I stop syncing a calendar?",
    a: "Remove it from your dashboard. That revokes the app’s access to that calendar. You can also revoke access any time from your Google Account’s security settings.",
  },
  {
    q: "How does it know what’s work and what’s personal?",
    a: "Each calendar is marked Work or Personal. Google Workspace accounts start as Work and @gmail.com ones as Personal, and you can switch any of them on your dashboard.",
  },
  {
    q: "What does it cost?",
    a: "Nothing. Calendars Sync is free and open source.",
  },
];

export default function Landing() {
  const [user, setUser] = useState<User | null>(null);
  const [params] = useSearchParams();
  const error = params.get("error");

  useEffect(() => {
    api.me().then(setUser).catch(() => setUser(null));
  }, []);

  const cta = user ? (
    <Link to="/calendars" className="btn btn-primary btn-lg">
      Open your dashboard →
    </Link>
  ) : (
    <GoogleButton onClick={signIn}>Sign in with Google</GoogleButton>
  );

  return (
    <div className="page">
      <Nav>
        <a href="#how">How it works</a>
        <a href="#features">Features</a>
        <a href="#time-off">Time off</a>
        <a href="#faq">FAQ</a>
        {user ? (
          <Link to="/calendars" className="btn btn-small">
            Dashboard
          </Link>
        ) : (
          <button className="btn btn-small" onClick={signIn}>
            Sign in
          </button>
        )}
      </Nav>

      <main>
        <section className="hero">
          <div className="container hero-inner">
            <div className="hero-copy">
              {error && <div className="alert alert-error">{ERRORS[error] || error}</div>}
              <span className="eyebrow">Free · Google Calendar · Private</span>
              <h1>
                Your personal life, <span className="accent">blocked out</span> on your work calendar.
              </h1>
              <p className="lead">
                Calendars Sync copies busy time across all the Google calendars you own. Colleagues stop booking over the
                dentist, and your family calendar knows when you’re in meetings. It runs every hour and copies only the
                times. Going on vacation? Say when, and it clears your work calendar for you.
              </p>
              <div className="hero-cta">
                {cta}
                <span className="muted">Setup takes about a minute.</span>
              </div>
            </div>
            <CalendarMock />
          </div>
        </section>

        <section id="how" className="section">
          <div className="container">
            <h2>How it works</h2>
            <p className="section-lead">Three steps, then it runs on its own.</p>
            <div className="steps">
              {STEPS.map((s) => (
                <div className="card step" key={s.n}>
                  <span className="step-n">{s.n}</span>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="section section-alt">
          <div className="container">
            <h2>Built for people with more than one calendar</h2>
            <p className="section-lead">Personal and work. Day job and side project. Consulting clients. It all stays in sync.</p>
            <div className="features">
              {FEATURES.map((f) => (
                <div className="card feature" key={f.title}>
                  <span className="feature-icon" aria-hidden="true">
                    {f.icon}
                  </span>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="time-off" className="section">
          <div className="container showcase">
            <div>
              <span className="eyebrow">New · Time off</span>
              <h2 className="left">“I’ll be on vacation next week.”</h2>
              <p className="lead">
                That’s all you type. Calendars Sync lists every event in those days across all your calendars and
                suggests what to do with each. You review it, adjust anything, and apply.
              </p>
              <ul className="ticks">
                <li>Work invites are declined with your note, so organizers know why</li>
                <li>Work meetings you run can be cancelled, and guests are notified</li>
                <li>Personal plans stay put unless you say otherwise</li>
                <li>Every choice can be changed one by one, and each decline can have its own note</li>
                <li>
                  Your work calendars get a multi-day <b>OOO</b> entry. On Google Workspace it auto-declines new invites too.
                </li>
              </ul>
            </div>
            <div className="card review-mock" aria-hidden="true">
              <div className="rm-when">
                <span className="muted small">When are you out?</span>
                <div className="rm-input">I’ll be on vacation next week</div>
                <span className="small rm-range">Mon, Oct 19 – Sun, Oct 25 · 7 days</span>
              </div>
              {[
                ["09:30", "Weekly planning", "work", "Decline"],
                ["11:00", "1:1 with Ana", "work", "Cancel meeting"],
                ["13:00", "Pilates", "personal", "Keep"],
                ["16:00", "Customer demo", "work", "Decline"],
              ].map(([t, title, kind, action]) => (
                <div key={title} className={`rm-row ${action == "Keep" ? "" : "rm-off"}`}>
                  <span className="muted small rm-t">{t}</span>
                  <span className="rm-title">
                    <span className="rm-name">{title}</span> <span className={`kind kind-${kind}`}>{kind}</span>
                  </span>
                  <span className={`rm-act ${action == "Keep" ? "" : "rm-act-off"}`}>{action}</span>
                </div>
              ))}
              <div className="rm-note small">
                “Hi! I’m out of office from Mon, Oct 19 – Sun, Oct 25 and won’t be able to make it. I’ll catch up when I’m
                back.”
              </div>
              <div className="rm-ooo">
                <span className="kind kind-work">work</span> OOO · Oct 19 – 25
              </div>
            </div>
          </div>
        </section>

        <section id="faq" className="section section-alt">
          <div className="container narrow">
            <h2>Questions</h2>
            <div className="faq">
              {FAQ.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="cta-band">
              <h2>Stop getting double-booked.</h2>
              <p>Connect your calendars once. Calendars Sync handles the rest, every hour, and on your days off too.</p>
              {cta}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
