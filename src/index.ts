import Koa from 'koa';
import Router from 'koa-router';
import koaBody from 'koa-body';
import koaJwt from 'koa-jwt';
import cors from '@koa/cors';
import logger from './utils/logger';
import dotenv from 'dotenv';
import { scopePerRequest } from 'awilix-koa';
import container from './containers/container';
import UserController from './controllers/UserController';
import config from './config';
import { errorHandler } from './utils/responseHandler';
import WebSocket from 'ws';
import http from 'http';
import { SocketService } from './services';

dotenv.config();

const app = new Koa();
const router = new Router();

app.use(scopePerRequest(container));
app.use(cors());
app.use(koaBody());
app.use(errorHandler);
app.use(
  koaJwt({ secret: config.serverConfig.jwtSecret, passthrough: true }).unless({
    path: config.serverConfig.unprotectedRoutes,
  }),
);

const userRouter = container.resolve<UserController>('userController').router();
router.use('/api', userRouter.routes()).use('/api', userRouter.allowedMethods());

app.use(router.routes()).use(router.allowedMethods());

const httpServer = http.createServer(app.callback());
const socketServer = new WebSocket.Server({ server: httpServer, path: '/socket' });
container.resolve<SocketService>('socketService').listen(socketServer);

httpServer.listen(config.serverConfig.port, () => {
  logger.info(`server has been launched on port ${config.serverConfig.port}.`);
});
