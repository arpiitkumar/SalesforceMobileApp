// dbResetService.js (when index.js exports database instance)
import database from './index';

async function runUnsafeResetWithinWriter(dbInstance) {
  if (typeof dbInstance.action === 'function') {
    await dbInstance.action(async () => {
      await dbInstance.unsafeResetDatabase();
    });
    return;
  }
  if (typeof dbInstance.write === 'function') {
    await dbInstance.write(async () => {
      await dbInstance.unsafeResetDatabase();
    });
    return;
  }
  throw new Error('No DB writer API found on instance.');
}

export async function resetLocalDatabase() {
  // ensure you have the actual instance
  const dbInstance = database;
  if (!dbInstance) throw new Error('database import is undefined');
  await runUnsafeResetWithinWriter(dbInstance);
  // (recreate or reimport as needed)
}
