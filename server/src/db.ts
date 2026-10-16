import mongoose, { Schema, HydratedDocument, InferSchemaType } from "mongoose";

// Collection names and fields match the original Genezio deployment
// ("calendars" and "users"), so migrated data is used as-is.
const CalendarSchema = new Schema({
  access_token: { type: String, required: true },
  refresh_token: { type: String, required: true },
  scope: { type: String, required: true },
  token_type: { type: String, required: true },
  expiry_date: { type: Number, required: true },
  email: { type: String, required: true, index: true },
  calendar_id: { type: String, required: true },
  source: { type: Boolean },
  destination: { type: Boolean },
  // "work" | "personal". Unset on older records; see calendarKind().
  kind: { type: String, enum: ["work", "personal"] },
});

export type CalendarDocument = HydratedDocument<InferSchemaType<typeof CalendarSchema>>;

export const Calendar = mongoose.model("Calendar", CalendarSchema);

export const Users = mongoose.model(
  "Users",
  new Schema({
    userId: String,
    email: String,
    createdAt: Date,
    authProvider: String,
    verified: Boolean,
    name: String,
  }),
);

export async function connectDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  await mongoose.connect(url);
  console.log("Connected to MongoDB");
}

const PERSONAL_DOMAINS = ["gmail.com", "googlemail.com"];

// Consumer Google accounts default to personal, Workspace accounts to work.
export function calendarKind(c: { kind?: string | null; calendar_id: string }): "work" | "personal" {
  if (c.kind == "work" || c.kind == "personal") return c.kind;
  const domain = c.calendar_id.split("@")[1]?.toLowerCase() || "";
  return PERSONAL_DOMAINS.includes(domain) ? "personal" : "work";
}

// What the dashboard sees: never send OAuth tokens to the browser.
export function publicCalendar(c: CalendarDocument) {
  return {
    _id: String(c._id),
    calendar_id: c.calendar_id,
    source: !!c.source,
    destination: !!c.destination,
    kind: calendarKind(c),
  };
}
