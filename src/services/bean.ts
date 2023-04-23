import { WebSocket } from 'ws';
import { JsonObject } from '../utils/json';

export interface MessageBean extends JsonObject {
  msgType: string;
  sessionId: string;
  apiKey: string;
  time: number;
}

export interface Connection {
  connection: WebSocket;
  sessionId: string;
  userId: string;
  onlineTime: number;
  lastHeartbeat: number;
}
