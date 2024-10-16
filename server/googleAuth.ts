import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

// Path to your OAuth2 credentials JSON file
const CREDENTIALS_PATH = './client_secret.json';

// Define the OAuth2 client
const SCOPES = ['https://www.googleapis.com/auth/calendar'];
let oauth2Client: OAuth2Client;

// Initialize the OAuth2 client
const initOAuthClient = async () => {
    console.log('Initializing OAuth client');
    const credentials = require(CREDENTIALS_PATH);
    const { client_id, client_secret, redirect_uris } = credentials.installed || credentials.web;
    oauth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
};

// Get the authentication URL
export const getAuthUrl = async (accountNickname: string): Promise<string> => {
    if (!oauth2Client) await initOAuthClient();
    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'select_account',
        state: accountNickname,
    });
};

// Get access tokens using the authorization code
export const getTokens = async (code: string) => {
    console.log('Getting tokens for ' + code);
    if (!oauth2Client) await initOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    return tokens;
};

// Export the authenticated client for use in other API calls
export const getAuthenticatedClient = async (): Promise<OAuth2Client> => {
    if (!oauth2Client) await initOAuthClient();
    return oauth2Client;
};
