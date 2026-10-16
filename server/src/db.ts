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

// What the dashboard sees: never send OAuth tokens to the browser.
export function publicCalendar(c: CalendarDocument) {
  return {
    _id: String(c._id),
    calendar_id: c.calendar_id,
    source: !!c.source,
    destination: !!c.destination,
  };
}
