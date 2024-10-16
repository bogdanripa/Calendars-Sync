import { GenezioDeploy, GenezioAuth, GnzContext } from "@genezio/types";
import { getAuthUrl, getTokens } from './googleAuth';
import mongoose from 'mongoose';
mongoose.connect(process.env["CALENDARS_SYNC_DATABASE_URL"] || "");

const Connection = mongoose.model("Connection", new mongoose.Schema({
  access_token: String,
  refresh_token: String,
  scope: String,
  token_type: String,
  expiry_date: Number,
  account_nickname: String,
  email: String,
}));

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
  async getAuthUrl(context: GnzContext, accountNickname: string): Promise<string> {
    return await getAuthUrl(accountNickname);
  }

  @GenezioAuth()
  async saveTokens(context: GnzContext, code: string, accountNickname: string): Promise<any> {
    // delete the existing one
    await Connection.deleteMany({account_nickname: accountNickname, email: context.user?.email});

    // save the new tokens
    const tokens = await getTokens(code);    
    const connection = new Connection({...tokens, account_nickname: accountNickname, email: context.user?.email});
    connection.save();
  }

  @GenezioAuth()
  async getConnections(context: GnzContext): Promise<any> {
    return await Connection.find({email: context.user?.email});
  }

  @GenezioAuth()
  async deleteConnection(context: GnzContext, accountNickname: string): Promise<any> {
    return await Connection.deleteOne({email: context.user?.email, account_nickname: accountNickname});
  }

  async processUser(email: string) {
    const connections = await Connection.find({email});
    for (let connection of connections) {
      console.log(connection.access_token);
    }
  }

  async processAllUsers() {
    const users = await Users.find({});
    for (let user of users) {
      console.log("Processing " + user.email);
      if (user.email)
        this.processUser(user.email);
    }
  }
}