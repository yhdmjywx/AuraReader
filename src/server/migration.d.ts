import type { DataStore } from './dataStore.js';
import type { MigrationStatus } from '../shared/storage.js';
export function createMigration(store: DataStore): {
    status(source: string): MigrationStatus;
    snapshot(source: string, input: Record<string, unknown>): { snapshotId: string };
    commit(source: string, snapshotId: string, options?: { cacheRecoveries?: Record<string, unknown>[] }): MigrationStatus;
};
