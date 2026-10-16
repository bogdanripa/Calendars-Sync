import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";

const COOKIE = "cs_session";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export type SessionUser = { email: string; name?: string };

declare module "express-serve-static-core" {
  interface Request {
    user?: SessionUser;
  }
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return s;
}

function sign(value: string): string {
  return crypto.createHmac("sha256", secret()).update(value).digest("base64url");
}

export function parseCookies(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (req.headers.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function secure(): boolean {
  return (process.env.PUBLIC_URL || "").startsWith("https://");
}

export function setSession(res: Response, user: SessionUser) {
  const payload = Buffer.from(JSON.stringify({ ...user, exp: Date.now() + MAX_AGE_MS })).toString("base64url");
  res.cookie(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: secure(),
    sameSite: "lax",
    maxAge: MAX_AGE_MS,
    path: "/",
  });
}

export function clearSession(res: Response) {
  res.clearCookie(COOKIE, { path: "/" });
}

export function readSession(req: Request): SessionUser | undefined {
  const raw = parseCookies(req)[COOKIE];
  if (!raw) return;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return;
  const expected = sign(payload);
  if (sig.length != expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!data.email || data.exp < Date.now()) return;
    return { email: data.email, name: data.name };
  } catch {
    return;
  }
}

export function requireUser(req: Request, res: Response, next: NextFunction) {
  const user = readSession(req);
  if (!user) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }
  req.user = user;
  next();
}

// Short-lived cookie that ties an OAuth callback to the browser that started it.
export function setOAuthState(res: Response, state: string) {
  res.cookie("cs_oauth_state", state, { httpOnly: true, secure: secure(), sameSite: "lax", maxAge: 10 * 60 * 1000, path: "/" });
}

export function takeOAuthState(req: Request, res: Response): string | undefined {
  res.clearCookie("cs_oauth_state", { path: "/" });
  return parseCookies(req)["cs_oauth_state"];
}
