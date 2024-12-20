import { google, calendar_v3 } from 'googleapis';
import { Credentials, OAuth2Client } from 'google-auth-library';
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs
import oauthCredentials from './client_secret.json';

// Define the OAuth2 client
const SCOPES = [
    'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
    'https://www.googleapis.com/auth/calendar.events',
];
let oauth2Client: OAuth2Client;

// Initialize the OAuth2 client
const initOAuthClient = async () => {
    console.log('Initializing OAuth client');
    const { client_id, client_secret, redirect_uris } = oauthCredentials.web;
    let redirectUri: string;
    
    if (process.env.HOME == '/') {
        // we are on the server
        redirectUri = redirect_uris[0].indexOf('localhost') == -1 ? redirect_uris[0] : redirect_uris[1];
    } else {
        // we are on the local machine
        redirectUri = redirect_uris[0].indexOf('localhost') == -1 ? redirect_uris[1] : redirect_uris[0];
    }
    
    oauth2Client = new google.auth.OAuth2(client_id, client_secret, redirectUri);
};

// Get the authentication URL
const getAuthUrl = async (): Promise<string> => {
    if (!oauth2Client) await initOAuthClient();
    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent',
        // prompt: 'select_account',
    });
};

// Get access tokens using the authorization code
const getTokens = async (code: string): Promise<Credentials> => {
    console.log('Getting tokens for ' + code);
    if (!oauth2Client) await initOAuthClient();
    const token = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(token.tokens);
    return token.tokens;
};

const refreshTokens = async (refresh_token: string): Promise<Credentials> => {
    if (!oauth2Client) await initOAuthClient();
    oauth2Client.setCredentials({ refresh_token });
    const credentials:Credentials = (await oauth2Client.refreshAccessToken()).credentials;
    return credentials;
}

const listUserCalendars = async (accessToken: string): Promise<calendar_v3.Schema$CalendarListEntry[]> => {
    if (!oauth2Client) await initOAuthClient();
    //const oauth2Client = new google.auth.OAuth2();

    oauth2Client.setCredentials({ access_token: accessToken });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    const response = await calendar.calendarList.list();
    return response.data.items || [];
};

const listCalendarEvents = async (calendarId: string, access_token: string): Promise<calendar_v3.Schema$Event[]> => {
    if (!oauth2Client) await initOAuthClient();
    oauth2Client.setCredentials({ access_token });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const now = new Date();
    const timeMin = now.toISOString();
    const timeMax = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(); // 14 days from now

    const response = await calendar.events.list({
        calendarId,
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: 'startTime',
    });

    return response.data.items || [];
}

const revokeToken = async (access_token: string) => {
    if (!oauth2Client) await initOAuthClient();
    oauth2Client.setCredentials({ access_token });

    try {
        await oauth2Client.revokeToken(access_token);
        console.log('The access token has been revoked.');
    } catch (error) {
        console.error('Failed to revoke the access token:', error);
    }
};

const createEvent = async (event: calendar_v3.Schema$Event, accessToken: string, calendarId: string) => {
    if (!oauth2Client) await initOAuthClient();
    oauth2Client.setCredentials({ access_token: accessToken });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Ensure the event object includes iCalUID
    if (!event.iCalUID) {
        event.iCalUID = uuidv4() + "@calendars-sync.app.genez.io";
    }

    if (event.status == 'tentative') {
        event.attendees = [
            {
                email: calendarId,
                responseStatus: 'needsAction',
                self: true                
            }
        ]
    }
    
    await calendar.events.insert({
        calendarId,
        requestBody: event,
    });
}

const deleteEvent = async (access_token: string, calendarId: string, eventId: string) => {
    if (!oauth2Client) await initOAuthClient();
    oauth2Client.setCredentials({ access_token });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    await calendar.events.delete({
        calendarId,
        eventId,
    });
}

export const GoogleAuth = {getAuthUrl, getTokens, refreshTokens, listUserCalendars, listCalendarEvents, createEvent, deleteEvent, revokeToken};
export type CalendarEvent = calendar_v3.Schema$Event;
export type EventAttendee = calendar_v3.Schema$EventAttendee;
export type CalendarEntry = calendar_v3.Schema$CalendarListEntry;
export type GCredentials = Credentials;
