import { User } from '../models';
import { RedisService, UserRepository } from '../repositories';
import logger from '../utils/logger';
import _ from 'lodash';
import { CustomeError, StatusCode, ErrorCode } from '../utils/responseHandler';
import jwt from 'jsonwebtoken';
import config from '../config';
import transaction from '../utils/transaction';
import { Knex } from 'knex';

export default class UserService {
  private userRepository: UserRepository;
  private redisService: RedisService;
  private knex: Knex;

  constructor(inject: { userRepository: UserRepository; redisService: RedisService; knex: Knex }) {
    this.redisService = inject.redisService;
    this.userRepository = inject.userRepository;
    this.knex = inject.knex;
  }

  async helloWorld() {
    return await this.userRepository.raw('select now()');
  }

  async hello(id: number) {
    const user = await this.userRepository.getById(id);
    logger.info(`user info ${id}, ${user?.id}, ${user?.name}, ${user?.age}, ${user?.addressHome}`);
    return user;
  }

  async helloCreate(user?: User) {
    logger.info(`insert before: ${user}`);
    if (!_.isNil(user) && !_.isNaN(user)) {
      const result = await transaction<User>(this.knex, (trx) => {
        return this.userRepository.save(user, trx);
      });
      logger.info(`insert after: ${result}`);
    }
  }

  async world() {
    return await this.userRepository.getAll();
  }

  async login(username: string, password: string) {
    if (password != 'ssna') {
      throw new CustomeError(StatusCode.Success, ErrorCode.Fail, '密码错误');
    }
    const token = jwt.sign({ username: username }, config.serverConfig.jwtSecret, { expiresIn: '1d' });
    return { token };
  }
}
