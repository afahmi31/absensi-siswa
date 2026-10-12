import type postgres from 'postgres'

export type DatabaseExecutor = postgres.Sql | postgres.TransactionSql

/** Begin a transaction at the pool boundary or a savepoint inside an existing transaction. */
export async function inDatabaseTransaction<T>(
  database: DatabaseExecutor,
  operation: (transaction: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  if ('begin' in database) {
    const result = await database.begin(async (transaction) => ({ value: await operation(transaction) }))
    return result.value
  }
  const result = await database.savepoint(async (transaction) => ({ value: await operation(transaction) }))
  return result.value
}
