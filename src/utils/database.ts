import IORedis from 'ioredis';
import config from '../config';
import * as Knex from 'knex';
import logger from './logger';
import _ from 'lodash';

const knex = Knex.knex({
  client: 'pg',
  debug: config.serverConfig.isDev,
  connection: {
    user: config.dbConfig.username,
    password: config.dbConfig.password,
    host: config.dbConfig.hostname,
    port: config.dbConfig.port,
    database: config.dbConfig.database,
  },
  pool: {
    min: config.dbConfig.poolMin,
    max: config.dbConfig.poolMax,
    idleTimeoutMillis: config.dbConfig.poolIdle,
  },
  acquireConnectionTimeout: 2000,
  migrations: {
    tableName: 'KnexMigrations',
  },
  // Hook for modifying returned rows, before passing them forward to user. https://knexjs.org/guide/#postprocessresponse
  postProcessResponse: (result) => {
    logger.info(`--------post process response: ${result}`);
    if (Array.isArray(result)) {
      return result.map((row) => mapRowKeysToCamelCase(row));
    } else {
      return mapRowKeysToCamelCase(result);
    }
  },
  // transforming identifier names automatically to quoted versions for each dialect. https://knexjs.org/guide/#wrapidentifier
  wrapIdentifier: (value, origImpl) => {
    logger.info(`--------wrap indentifier: ${value}`);
    if (value === '*') {
      return origImpl(value);
    } else {
      return origImpl(_.snakeCase(value));
    }
  },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRowKeysToCamelCase(row: any): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = {};
  for (const key in row) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      const camelCaseKey = key.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
      result[camelCaseKey] = row[key];
    }
  }
  return result;
}

const redis = new IORedis(config.redisConfig.url);
const pubRedis = new IORedis(config.redisConfig.url);
const subRedis = new IORedis(config.redisConfig.url);

export default { redis, knex, pubRedis, subRedis };
