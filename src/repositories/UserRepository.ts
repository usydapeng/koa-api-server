import { Knex } from 'knex';
import { User, userFields, userTable } from '../models';
import { SortDirection } from '../utils/SortDirection';
import _ from 'lodash';

export default class UserRepository {
  knex: Knex;

  constructor(inject: { knex: Knex }) {
    this.knex = inject.knex;
  }

  async save(user: User, trx?: Knex.Transaction) {
    return (await this.Users(trx).insert(user).returning('*'))[0];
  }

  async getById(id: number, trx?: Knex.Transaction) {
    return await this.Users(trx).where(userFields.id, id).first();
  }

  async getAll(trx?: Knex.Transaction) {
    return await this.Users(trx).orderBy(userFields.id, SortDirection.Desc);
  }

  async raw(sql: string, trx?: Knex.Transaction) {
    return await this.Client(trx).raw(sql);
  }

  Users(trx?: Knex.Transaction) {
    if (_.isNil(trx)) {
      return this.knex<User>(userTable);
    } else {
      return trx<User>(userTable);
    }
  }

  Client(trx?: Knex.Transaction) {
    if (_.isNil(trx)) {
      return this.knex;
    } else {
      return trx;
    }
  }
}
