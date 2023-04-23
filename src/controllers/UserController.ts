import { Context, Next } from 'koa';
import Router from 'koa-router';
import { UserService, SocketService } from '../services';
import logger from '../utils/logger';
import _ from 'lodash';
import responseHandler, { CustomeError, ErrorCode, StatusCode } from '../utils/responseHandler';

interface HelloParam {
  id: number;
  name: string;
  tags?: string[];
}

/**
 * @typedef User
 * @property {string} name - The user's name.
 * @property {string} email - The user's email.
 */
export default class UserControler {
  private userService: UserService;
  private socketService: SocketService;

  constructor(inject: { userService: UserService; socketService: SocketService }) {
    this.userService = inject.userService;
    this.socketService = inject.socketService;
  }

  async helloWorld(context: Context) {
    responseHandler.success(context, await this.userService.helloWorld());
  }

  async helloB(context: Context, next: Next) {
    logger.info(`request body: ${JSON.stringify(context.request.body)}`);
    logger.info(`request query: ${JSON.stringify(context.query)}`);
    logger.info(`request query string: ${context.querystring}`);
    const { id: rawId, name, tags } = context.query;
    logger.info(`is array: ${_.isArray(rawId)}`);
    logger.info(`type: ${typeof rawId}`);
    logger.info(`id: ${rawId}, name: ${name}`);
    logger.info('-----------------');
    logger.info(_.isArray(rawId));
    logger.info(_.isString(rawId));
    logger.info(_.isNaN(rawId));
    logger.info(_.isNumber(rawId));
    logger.info(_.toString(rawId));
    logger.info(rawId);

    const params: HelloParam = {
      id: _.isArray(rawId)
        ? _.parseInt((rawId as Array<string>)[0])
        : _.isString(rawId)
        ? _.parseInt(rawId as string)
        : _.isNumber(rawId)
        ? rawId
        : 1,
      name: _.isArray(name) ? (name as Array<string>)[0] : '',
      tags: Array.isArray(tags) ? tags : [],
    };
    logger.info(`request param: ${JSON.stringify(params)}`);
    context.state.params = params;

    await next();
  }

  async hello(context: Context) {
    const { id, name, tags } = context.state.params;
    logger.info(`hello, id:${id}, name:${name}, tags:${tags}`);
    responseHandler.success(context, await this.userService.hello(id));
  }

  async helloCreate(context: Context) {
    const requestBody = context.request.body;
    await this.userService.helloCreate(requestBody);
    responseHandler.success(context, true);
  }

  async hello1(context: Context) {
    const { id, name, tags } = context.query;
    logger.info(`hello, id:${id}, name:${name}, tags:${tags}`);
    responseHandler.success(context, await this.userService.hello(_.parseInt((id as Array<string>)[0])));
  }

  async world(context: Context) {
    responseHandler.success(context, await this.userService.world());
  }

  async sendCommand(context: Context) {
    await this.socketService.sendCommandToClient('zhangsan', '-----------------------------helloworld');
    responseHandler.success(context, true);
  }

  async login(context: Context) {
    const { username, password } = context.request.body;
    responseHandler.success(context, await this.userService.login(username, password));
  }

  async userInfo(context: Context) {
    if (context.state.user == null) {
      responseHandler.fail(context, new CustomeError(StatusCode.Forbidden, ErrorCode.Fail, 'permission forbidden'));
    } else {
      responseHandler.success(context, context.state.user);
    }
  }

  router() {
    const router = new Router({ prefix: '/user' });
    router.get('/test', this.helloWorld.bind(this));
    router.get('/hello', this.helloB.bind(this), this.hello.bind(this));
    router.post('/hello', this.helloCreate.bind(this));
    router.get('/hello1', this.hello1.bind(this));
    router.get('/world', this.world.bind(this));
    router.post('/login', this.login.bind(this));
    router.get('/info', this.userInfo.bind(this));
    router.get('/send-command', this.sendCommand.bind(this));
    return router;
  }
}
