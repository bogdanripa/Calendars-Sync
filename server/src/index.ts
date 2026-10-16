import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { Calendar, Users, connectDb, publicCalendar } from "./db.js";
import { GoogleAuth, publicUrl } from "./google.js";
import { processAllUsers, processUser } from "./sync.js";
import { clearSession, readSession, requireUser, setOAuthState, setSession, takeOAuthState } from "./session.js";

const app = express();
app.set("trust proxy", true);
app.use(express.json());

const version = process.env.GIT_SHA || "dev";

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, version });
});

// ---- Auth -------------------------------------------------------------

function startOAuth(res: express.Response, mode: "login" | "calendar") {
  const nonce = crypto.randomBytes(16).toString("base64url");
  setOAuthState(res, nonce);
  const state = `${mode}.${nonce}`;
  res.redirect(mode == "login" ? GoogleAuth.getLoginUrl(state) : GoogleAuth.getAuthUrl(state));
}

app.get("/auth/google/login", (_req, res) => startOAuth(res, "login"));

app.get("/auth/google/calendar", (req, res) => {
  if (!readSession(req)) return res.redirect("/?error=signin");
  startOAuth(res, "calendar");
});

app.get("/auth/google/callback", async (req, res) => {
  const { code, state, error } = req.query as Record<string, string | undefined>;
  const expected = takeOAuthState(req, res);
  const [mode, nonce] = (state || "").split(".");
  if (error) return res.redirect(mode == "calendar" ? "/calendars?error=cancelled" : "/?error=cancelled");
  if (!code || !nonce || nonce != expected) return res.redirect("/?error=state");

  try {
    const tokens = await GoogleAuth.getTokens(code);

    if (mode == "login") {
      if (!tokens.id_token) throw new Error("No id_token returned");
      const id = await GoogleAuth.getIdentity(tokens.id_token);
      await Users.updateOne(
        { email: id.email },
        {
          $set: { name: id.name, verified: true },
          $setOnInsert: { userId: id.sub, email: id.email, createdAt: new Date(), authProvider: "google" },
        },
        { upsert: true },
      );
      setSession(res, { email: id.email, name: id.name });
      return res.redirect("/calendars");
    }

    // mode == "calendar": connect the primary calendar of the Google account
    // that was just authorised to the signed-in user.
    const user = readSession(req);
    if (!user) return res.redirect("/?error=signin");
    if (!tokens.access_token) throw new Error("Failed to get tokens");

    const cl = await GoogleAuth.listUserCalendars(tokens.access_token);
    const calendar_id = cl.find((c) => c.primary)?.id || "unknown@unknown.com";

    const old = await Calendar.findOne({ email: user.email, calendar_id });
    if (old) {
      old.access_token = tokens.access_token;
      if (tokens.refresh_token) old.refresh_token = tokens.refresh_token;
      old.scope = tokens.scope || old.scope;
      old.token_type = tokens.token_type || old.token_type;
      old.expiry_date = tokens.expiry_date || old.expiry_date;
      await old.save();
    } else {
      if (!tokens.refresh_token) throw new Error("Google did not return a refresh token");
      await Calendar.create({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        scope: tokens.scope,
        token_type: tokens.token_type,
        expiry_date: tokens.expiry_date,
        email: user.email,
        calendar_id,
        source: true,
        destination: true,
      });
    }
    res.redirect("/calendars?added=" + encodeURIComponent(calendar_id));
  } catch (e) {
    console.error("OAuth callback failed:", (e as Error).message);
    res.redirect((mode == "calendar" ? "/calendars" : "/") + "?error=" + encodeURIComponent((e as Error).message));
  }
});

app.get("/api/me", (req, res) => {
  const user = readSession(req);
  if (!user) return res.status(401).json({ error: "Not signed in" });
  res.json(user);
});

app.post("/api/logout", (_req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

// ---- Calendars --------------------------------------------------------

app.get("/api/calendars", requireUser, async (req, res) => {
  const cl = await Calendar.find({ email: req.user!.email });
  res.json(cl.map(publicCalendar));
});

app.delete("/api/calendars/:calendarId", requireUser, async (req, res) => {
  const c = await Calendar.findOne({ email: req.user!.email, calendar_id: req.params.calendarId });
  if (c) {
    await GoogleAuth.revokeToken(c.refresh_token || c.access_token);
    await c.deleteOne();
  }
  res.json({ ok: true });
});

for (const field of ["source", "destination"] as const) {
  app.post(`/api/calendars/:calendarId/toggle-${field}`, requireUser, async (req, res) => {
    const c = await Calendar.findOne({ email: req.user!.email, calendar_id: req.params.calendarId });
    if (!c) return res.status(404).json({ error: "Calendar not found" });
    c[field] = !c[field];
    await c.save();
    res.json(publicCalendar(c));
  });
}

app.post("/api/sync", requireUser, async (req, res) => {
  try {
    res.json({ result: await processUser(req.user!.email) });
  } catch (e) {
    console.error("Error processing " + req.user!.email + ": " + (e as Error).message);
    res.status(500).json({ error: (e as Error).message });
  }
});

// ---- Scheduled job ----------------------------------------------------

// Called hourly by the platform's scheduler. Answers at once and syncs in the
// background so a long run is never cut off by an HTTP timeout.
app.post("/api/cron/sync", (req, res) => {
  const expected = process.env.CRON_SECRET;
  const given = req.body?.secret || req.get("x-cron-secret");
  if (!expected || given != expected) return res.status(403).json({ error: "Forbidden" });
  processAllUsers().catch((e) => console.error("processAllUsers failed:", e));
  res.status(202).json({ started: true });
});

app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

// ---- Frontend ---------------------------------------------------------

const staticDir = process.env.STATIC_DIR
  ? path.resolve(process.env.STATIC_DIR)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../client/dist");
app.use(express.static(staticDir, { index: false, maxAge: "1h" }));
app.get("/{*path}", (_req, res) => res.sendFile(path.join(staticDir, "index.html")));

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

const port = Number(process.env.PORT || 80);
connectDb()
  .then(() => {
    app.listen(port, process.env.HOST || "::", () => console.log(`Listening on ${port}, public URL ${publicUrl()}`));
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
