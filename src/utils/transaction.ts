import { Knex } from 'knex';

export default async function transaction<T>(knex: Knex, fn: (trx: Knex.Transaction) => Promise<T>) {
  const trx = await knex.transaction();
  try {
    const result = await fn(trx);
    await trx.commit();
    return result;
  } catch (error) {
    await trx.rollback();
    throw error;
  }
}
