import type postgres from 'postgres'
import { inDatabaseTransaction, type DatabaseExecutor } from './transaction.ts'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Run audited repository work in a transaction that records the authenticated teacher as actor. */
export async function withAuditActor<T>(
  database: DatabaseExecutor,
  actorId: string,
  operation: (transaction: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  if (!uuidPattern.test(actorId)) throw new Error('Audit actor must be a teacher account ID.')
  return inDatabaseTransaction(database, async (transaction) => {
    await transaction`select set_config('app.actor_id', ${actorId}, true)`
    return operation(transaction)
  })
}
