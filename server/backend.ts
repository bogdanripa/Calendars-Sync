import { GenezioDeploy, GenezioAuth, GnzContext, GenezioMethod } from "@genezio/types";
import {GoogleAuth, CalendarEvent, CalendarEntry, GCredentials, EventAttendee} from './googleAuth';
import mongoose, { Schema, Document, InferSchemaType } from 'mongoose';
mongoose.connect(process.env["CALENDARS_SYNC_DATABASE_URL"] || "");

const CalendarSchema = new Schema({
  access_token: { type: String, required: true },
  refresh_token: { type: String, required: true },
  scope: { type: String, required: true },
  token_type: { type: String, required: true },
  expiry_date: { type: Number, required: true },
  email: { type: String, required: true },
  calendar_id: { type: String, required: true },
  source: { type: Boolean },
  destination: { type: Boolean },
});

// Infer the TypeScript type directly from the schema
type CalendarDocument = Document & InferSchemaType<typeof CalendarSchema>;

const Calendar = mongoose.model("Calendar", CalendarSchema);

const Users = mongoose.model("Users", new mongoose.Schema({
  userId: String,
  email: String,
  createdAt: Date,
  authProvider: String,
  verified: Boolean,
  name: String,
}));

@GenezioDeploy()
export class BackendService {
  constructor() {}

  @GenezioAuth()
  async getAuthUrl(context: GnzContext): Promise<string> {
    return await GoogleAuth.getAuthUrl();
  }

  @GenezioAuth()
  async saveTokens(context: GnzContext, code: string): Promise<undefined> {
    // save the new tokens
    const tokens:GCredentials = await GoogleAuth.getTokens(code);    
    if(!tokens.access_token) {
      throw new Error("Failed to get tokens");
    }

    const calendar = new Calendar({...tokens, email: context.user?.email, source: true, destination: true});

    // get calendar id
    const cl:CalendarEntry[] = await GoogleAuth.listUserCalendars(tokens.access_token);
    cl.forEach(async (c: CalendarEntry) => {
      if (c.primary) {
        calendar.calendar_id = c.id || 'unknown@unknown.com';
      }
    });

    // update existing one or create a new one
    const oldCalendar = await Calendar.findOne({email: context.user?.email, calendar_id: calendar.calendar_id});
    if (oldCalendar) {
      oldCalendar.access_token = calendar.access_token;
      if (calendar.refresh_token) {
        oldCalendar.refresh_token = calendar.refresh_token;
      }
      oldCalendar.scope = calendar.scope;
      oldCalendar.token_type = calendar.token_type;
      oldCalendar.expiry_date = calendar.expiry_date;
      await oldCalendar.save();
    } else {
      await calendar.save();
    }
  }

  @GenezioAuth()
  async getCalendars(context: GnzContext): Promise<CalendarDocument[]> {
    return await Calendar.find({email: context.user?.email});
  }

  @GenezioAuth()
  async deleteCalendar(context: GnzContext, calendar_id: string): Promise<undefined> {
    const c = await Calendar.findOne({email: context.user?.email, calendar_id});
    if (c) {
      await GoogleAuth.revokeToken(c.access_token);
      await c.deleteOne();
    }
  }

  private async refreshToken(c: CalendarDocument) {
    const tokens:GCredentials = await GoogleAuth.refreshTokens(c.refresh_token);
    if (tokens.access_token && tokens.refresh_token && tokens.expiry_date) {
      c.access_token = tokens.access_token;
      c.expiry_date = tokens.expiry_date;
      c.refresh_token = tokens.refresh_token;
      await c.save();
      console.log(c.calendar_id + ': token refreshed');
    } else {
      throw new Error("${c.calendar_id}: Failed to refresh token. Got: " + JSON.stringify(tokens));
    }
  }

  async toggleSource(calendar_id: string) {
    const c = await Calendar.findOne({calendar_id});
    if (c) {
      c.source = !c.source;
      await c.save();
    } else {
      throw new Error("Calendar not found");
    }
  }

  async toggleDestination(calendar_id: string) {
    const c = await Calendar.findOne({calendar_id});
    if (c) {
      c.destination = !c.destination;
      await c.save();
    } else {
      throw new Error("Calendar not found");
    }
  }

  private mapResponseStatusToEventStatus(event: CalendarEvent): string {
    // Find the attendee representing the authenticated user
    const selfAttendee = event.attendees?.find((attendee: EventAttendee) => attendee.self);
  
    // If there's no self attendee or no responseStatus, return the current event status
    if (!selfAttendee || !selfAttendee.responseStatus) {
      return event.status || '';
    }
  
    // Map the responseStatus to an event status
    switch (selfAttendee.responseStatus) {
      case 'accepted':
        return 'confirmed';
      case 'tentative':
        return 'tentative';
      case 'declined':
        return 'cancelled';
      case 'needsAction':
        // Decide how to handle 'needsAction'; you might treat it as 'tentative'
        return 'tentative';
      default:
        // If the responseStatus is unrecognized, return the current event status
        return event.status || '';
    }
  }

  private async processCalendar(c: CalendarDocument, cnt: number = 0): Promise<CalendarEvent[]> {
    if (cnt == 2) {
      throw new Error("Failed to refresh token");
    }

    const events: CalendarEvent[] = [];
    try {
      const ce = await GoogleAuth.listCalendarEvents(c.calendar_id, c.access_token);
      ce.forEach((event: CalendarEvent) => {
        event.status = this.mapResponseStatusToEventStatus(event);
        if (event.status == 'cancelled') return;
        events.push({
          id: event.id,
          summary: event.summary,
          description: event.description,
          status: event.status,
          start: event.start,
          end: event.end,
        });
      });
    } catch(error: any) {
      if(error.response?.status == 401) {
        console.log(`${c.calendar_id}: token explired`);
        // refresh the token
        try {
          await this.refreshToken(c);
        } catch (error: any) {
          if (error.message == "invalid_grant") {
            // the token is invalid, delete the calendar
            console.error(`${c.calendar_id}: token is invalid, deleting the calendar`);
            await c.deleteOne();
            throw error;
          } else {
            throw error;
          }
        }
        return await this.processCalendar(c, cnt+1);
      } else {
        throw error;
      }
    }
    return events;
  }

  private async processUser(email: string): Promise<string> {
    const cl:CalendarDocument[] = await Calendar.find({email});
    const events: CalendarEvent[][] = [];
    const existingIds: { [key: string]: string } = {};
    let i=0;
    for (const c of cl) {
      if (c.calendar_id && c.access_token) {
        events[i] = await this.processCalendar(c);
        for (const event of events[i]) {
          if (event.id && event.status) {
            existingIds[event.id] = event.status;
          }
        }
        i++;
      }
    }

    const eventsToDelete = [];
    for (let i=0;i<events.length;i++) {
      for (let j=0;j<events[i].length;j++) {
        let eventSummary: string = events[i][j].summary || '';
        if (eventSummary.indexOf("Copied from ") == -1) {
          eventSummary = events[i][j].description || '';
        }
        if (eventSummary.indexOf("Copied from ") == 0) {
          const originalEventStatus = existingIds[eventSummary.replace("Copied from ", "")];
          if (!originalEventStatus || originalEventStatus != events[i][j].status) {
            eventsToDelete.push({
              id: events[i][j].id,
              accountIdx: i,
            });
            // remove the event from the list
            events[i].splice(j, 1);
            j--;
          }
        }
      }
    }

    // deleteing the enents whose status changed or here the original event went away
    let cntDeleted = 0;
    for (let i=0;i<eventsToDelete.length;i++) {
      console.log(cl[eventsToDelete[i].accountIdx].calendar_id + ": Deleting " + eventsToDelete[i].id);
      await GoogleAuth.deleteEvent(cl[eventsToDelete[i].accountIdx].access_token, cl[eventsToDelete[i].accountIdx].calendar_id, eventsToDelete[i].id || '');
      cntDeleted++;
    }

    // cloning new events
    let cntCloned = 0;
    for (let i=0;i<events.length;i++) {
      if (!cl[i].source) continue;
      console.log(`${cl[i].calendar_id}: found ${events[i].length} events`);
      for (let j=0;j<events[i].length;j++) {
        let eventSummary = events[i][j].summary || '';
        if (eventSummary.indexOf("Copied from ") == -1) {
          eventSummary = events[i][j].description || '';
        }
        if (eventSummary.indexOf("Copied from ") == 0) {
          continue;
        }
        const eventId = events[i][j].id;
        for (let k:number=0;k<events.length;k++) {
          if (!cl[k].destination) continue;
          if (i != k) {
            // check if the event is present in the other calendars
            const found = events[k].find((e:CalendarEvent) => {
              let eventSummary = e.summary || '';
              if (eventSummary.indexOf("Copied from ") == -1) {
                eventSummary = e.description || '';
              }
              return eventSummary.replace("Copied from ", "") == eventId;
            });
            if (!found) {
              // create the event
              const evt = {
                summary: `Busy (${events[i][j].status})`,
                description: "Copied from " + eventId,
                start: events[i][j].start,
                end: events[i][j].end,
                status: events[i][j].status,
              };
              if (cl[k].access_token && cl[k].calendar_id) {
                console.log(cl[k].calendar_id + ": Cloning " + eventId);
                await GoogleAuth.createEvent(evt, cl[k].access_token, cl[k].calendar_id);
                cntCloned++;
              }
            }
          }
        }
      }
    }
    return `Deleted ${cntDeleted} events and cloned ${cntCloned} events`;
  }

  @GenezioMethod({ type: "cron", cronString: "59 * * * *" })
  async processAllUsers() {
    const users = await Users.find({});
    for (const user of users) {
      console.log("Processing " + user.email);
      if (user.email) {
        try {
          console.log(user.email + ": " + await this.processUser(user.email));
        } catch (error: unknown) {  // Use 'unknown' instead of 'any'
          if (error instanceof Error) {
            console.error("Error processing " + user.email + ": " + error.message);
          } else {
            console.error("Error processing " + user.email + ": " + JSON.stringify(error));
          }
        }
      }
    }
    console.log("Processing - done");
  }

  @GenezioAuth()
  async processMe(context: GnzContext): Promise<string> {
    if (context.user?.email)
      return await this.processUser(context.user.email);
    return "";
  }
}