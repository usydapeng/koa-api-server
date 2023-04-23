import _ from 'lodash';

export enum MessageType {
  Auth = 'auth',
  AuthResult = 'auth-result',
  Heartbeat = 'heartbeat',
  HeartbeatResult = 'heartbeat-result',
  Command = 'command',
  CommandResult = 'command-result',
  Kick = 'kick',
}
export function getMessageType(num: string) {
  return _.findKey(MessageType, (value) => value === num);
}
export const messageTypeValues = Object.values(MessageType as Record<string, string>);
