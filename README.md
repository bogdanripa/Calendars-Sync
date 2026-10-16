## Calendars Sync

Synchronize busy time across multiple Google calendars you own.

Live: https://calendars-sync-coolify.bogdanripa.com

Use it to copy personal events to your work calendar, so time taken by personal events is blocked there automatically. Each calendar you add can be a source, a destination, or both. Copies appear as `Busy (confirmed)` / `Busy (tentative)` with the same start and end. No titles or details are copied.

### How it works

- **server/**: Express + Mongoose (TypeScript). Google sign-in, calendar OAuth, the sync engine, and the JSON API. It also serves the built client.
- **client/**: React + Vite. A marketing landing page (`/`), the dashboard (`/calendars`), and the legal pages.
- Every hour the platform scheduler calls `POST /api/cron/sync` (authenticated with `CRON_SECRET`), which syncs every user. The next 14 days are synced. Declined events are skipped, and tentative or unanswered ones are copied as tentative. A copy is deleted or replaced when its original moves, is cancelled, or changes RSVP. Copies are tagged `Copied from <event id>` in the description, so they never get copied again.

### Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | MongoDB connection string (injected by the platform) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth web client |
| `PUBLIC_URL` | Public base URL; the OAuth redirect is `${PUBLIC_URL}/auth/google/callback` |
| `SESSION_SECRET` | HMAC key for the session cookie |
| `CRON_SECRET` | Shared secret for `POST /api/cron/sync` |

The Google OAuth client must list `${PUBLIC_URL}/auth/google/callback` as an authorized redirect URI.

### Local development

```bash
cd server && npm install && PORT=8080 HOST=127.0.0.1 DATABASE_URL=mongodb://127.0.0.1/calendars-sync \
  SESSION_SECRET=dev CRON_SECRET=dev PUBLIC_URL=http://localhost:5173 \
  GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... npm run dev
cd client && npm install && npm run dev
```

### Deploying

Pushing to `main` builds an arm64 image in GitHub Actions and deploys it to pironman (`.github/workflows/deploy.yml`).

### Time off

`/time-off` lets you pick the days you are out (one-click presets or any dates), lists every event in it across all connected calendars, and suggests an action for each. Invites on **work** calendars default to *decline* and meetings you organize there to *cancel*. Everything else is *kept*. Each calendar is marked Work or Personal on the dashboard: Workspace accounts default to Work, `@gmail.com` to Personal. Declines and cancellations carry an editable note, which can be overridden per event. Work calendars then get a multi-day "OOO" entry. On Workspace that's a native Out of office event that auto-declines new invites; elsewhere it's an all-day event. These blocks are never copied by the sync.
