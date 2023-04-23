import WebSocket from 'ws';
import logger from '../utils/logger';
import { Connection, MessageBean } from './bean';
import _, { map } from 'lodash';
import { MessageType, messageTypeValues } from './enum';
import { CustomeError, StatusCode, ErrorCode } from '../utils/responseHandler';
import IORedis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';
import { Queue, Worker } from 'bullmq';

export default class SocketService {
  private redis: IORedis;
  private subRedis: IORedis;
  private pubRedis: IORedis;
  private webSocketConnectionMap: Map<WebSocket, Connection> = new Map<WebSocket, Connection>();
  private userConnectionMap: Map<string, Connection> = new Map<string, Connection>();
  private sessionConnectionMap: Map<string, Connection> = new Map<string, Connection>();
  private channelName = 'redis-broadcast';

  constructor(inject: { redis: IORedis; subRedis: IORedis; pubRedis: IORedis }) {
    this.redis = inject.redis;
    this.subRedis = inject.subRedis;
    this.pubRedis = inject.pubRedis;
    this.timer();
    this.subscribe(this.channelName);
  }

  async listen(webSocketServer: WebSocket.WebSocketServer) {
    webSocketServer.on('connection', (webSocket) => {
      const connection = {
        connection: webSocket,
        sessionId: uuidv4(),
        onlineTime: moment().valueOf(),
        lastHeartbeat: moment().valueOf(),
      } as Connection;
      this.sessionConnectionMap.set(connection.sessionId, connection);
      this.webSocketConnectionMap.set(webSocket, connection);

      webSocket.on('close', () => {
        const connection = this.webSocketConnectionMap.get(webSocket);
        if (!_.isNil(connection)) {
          const { sessionId } = connection;
          if (!_.isNil(sessionId)) {
            this.sessionConnectionMap.delete(sessionId);
          }
        }
        this.webSocketConnectionMap.delete(webSocket);
      });

      webSocket.on('message', async (message) => {
        try {
          const messageBean = JSON.parse(message.toString()) as MessageBean;
          if (_.isNil(messageBean.msgType) || !_.includes(messageTypeValues, messageBean.msgType)) {
            return;
          }

          switch (messageBean.msgType) {
            case MessageType.Auth: {
              await this.processAuth(webSocket, messageBean);
              break;
            }
            case MessageType.Heartbeat: {
              const response = await this.processHeartbeat(messageBean);
              webSocket.send(JSON.stringify(response));
              break;
            }
            default:
              throw new CustomeError(StatusCode.BadRequest, ErrorCode.Fail, 'fail');
          }
        } catch (error) {
          // empty
        }
      });
    });
  }

  async processAuth(webSocket: WebSocket, messageBean: MessageBean) {
    if (messageBean.apiKey == 'hello') {
      const connection = this.webSocketConnectionMap.get(webSocket);
      if (_.isNil(connection)) {
        return;
      }
      connection.userId = 'zhangsan';
      connection.onlineTime = moment().valueOf();
      connection.lastHeartbeat = connection.onlineTime;
      this.userConnectionMap.set(connection.userId, connection);
      await this.kickConnection(connection.userId, connection.lastHeartbeat);
      webSocket.send(
        JSON.stringify({ msgType: MessageType.AuthResult, code: ErrorCode.Success, sessionId: connection.sessionId }),
      );
    } else {
      webSocket.send(JSON.stringify({ msgType: MessageType.AuthResult, code: ErrorCode.Fail }));
      webSocket.close(1001, 'unauthorized');
    }
  }

  async processHeartbeat(messageBean: MessageBean) {
    const { sessionId, time } = messageBean;
    const now = moment().valueOf();
    if (now - time < 30000 && !_.isNil(sessionId)) {
      let connection = this.sessionConnectionMap.get(sessionId);
      if (!_.isNil(connection)) {
        connection.lastHeartbeat = now;
        connection = this.userConnectionMap.get(connection.userId);
        if (!_.isNil(connection)) {
          connection.lastHeartbeat = now;
          return { msgType: MessageType.HeartbeatResult, code: ErrorCode.Success };
        }
      }
    }
    return { msgType: MessageType.HeartbeatResult, code: ErrorCode.Fail };
  }

  async kickConnection(userId: string, lastHeartbeat: number) {
    const messageBean = {
      msgType: MessageType.Kick,
      time: moment().valueOf(),
      userId: userId,
      lastHeartbeat: lastHeartbeat,
    };
    await this.pubRedis.publish(this.channelName, JSON.stringify(messageBean));
  }

  async sendCommandToClient(userId: string, context: string) {
    const messageBean = {
      msgType: MessageType.Command,
      time: moment().valueOf(),
      context: context,
      userId: userId,
    };
    await this.pubRedis.publish(this.channelName, JSON.stringify(messageBean));
  }

  async subscribe(channelName: string) {
    this.subRedis.subscribe(channelName, (error, count) => {
      if (!_.isNil(error)) {
        logger.error(error);
      }
      logger.info(`----- subscribe to ${count} channels`);
    });
    this.subRedis.on('message', async (channel, message) => {
      if (channel == this.channelName) {
        const messageBean = JSON.parse(message) as MessageBean;
        const { userId, msgType, lastHeartbeat } = messageBean;
        if (!_.isNil(msgType)) {
          switch (msgType) {
            case MessageType.Kick: {
              const connections = new Array<Connection>(0);
              this.sessionConnectionMap.forEach((connection) => {
                if (connection.userId === userId) {
                  connections.push(connection);
                }
              });
              if (!_.isNil(connections) && !_.isEmpty(connections)) {
                connections.forEach((connection) => {
                  if (lastHeartbeat != connection.lastHeartbeat) {
                    connection.connection.close(1000, 'kick connection');
                  }
                });
              }
              break;
            }
            case MessageType.Command: {
              if (!_.isNil(userId)) {
                const connection = this.userConnectionMap.get(userId as string);
                if (!_.isNil(connection)) {
                  connection.connection.send(message, async (error) => {
                    if (error) {
                      logger.error(error);
                    }
                  });
                }
              }
              break;
            }
            default:
              break;
          }
        }
      }
    });
  }

  timer() {
    const queueName = 'queue-name';
    const timedAwardForOnline = new Queue(queueName, { connection: this.redis });
    timedAwardForOnline.add(
      'timer',
      { name: 'timer' },
      { repeat: { pattern: '0/30 * * * * ?' }, removeOnComplete: true, removeOnFail: true },
    );
    const worker = new Worker(
      queueName,
      async () => {
        const now = moment().valueOf();
        const removeConnections = new Array<Connection>(0);
        this.sessionConnectionMap.forEach((value) => {
          if (now - value.lastHeartbeat > 30000) {
            removeConnections.push(value);
          }
        });
        this.userConnectionMap.forEach((value) => {
          if (now - value.lastHeartbeat > 30000) {
            removeConnections.push(value);
          }
        });

        _.forEach(removeConnections, async (connection) => {
          if (
            connection.connection.readyState === WebSocket.OPEN ||
            connection.connection.readyState === WebSocket.CONNECTING
          ) {
            await connection.connection.close(1000, 'heartbeat timeout');
          }
        });
      },
      { connection: this.redis, concurrency: 1 },
    );
    worker.on('completed', async (job) => {
      // clear history task
    });
    worker.on('failed', (_, error) => {
      logger.error(error);
    });
  }
}
