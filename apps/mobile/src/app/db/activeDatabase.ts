import type { Database } from '@nozbe/watermelondb';
import { createDatabase } from './index';
import {
  createRepositoryContainer,
  type MobileRepositoryContainer,
} from './repositoryContainer';

type ActiveDatabase = {
  dataScopeId: string;
  database: Database;
  repositories: MobileRepositoryContainer;
};

let active: ActiveDatabase | null = null;

export function activateMobileDataScope(
  dataScopeId: string
): MobileRepositoryContainer {
  if (active?.dataScopeId === dataScopeId) return active.repositories;
  const database = createDatabase(dataScopeId);
  const repositories = createRepositoryContainer(database);
  active = { dataScopeId, database, repositories };
  return repositories;
}

export function deactivateMobileDataScope(): void {
  active = null;
}

export function getActiveStorageScopeId(): string {
  if (!active) throw new Error('mobile_data_scope_unavailable');
  return active.dataScopeId;
}

export function getActiveDatabase(): Database {
  if (!active) throw new Error('mobile_data_scope_unavailable');
  return active.database;
}

export function getActiveRepositories(): MobileRepositoryContainer {
  if (!active) throw new Error('mobile_data_scope_unavailable');
  return active.repositories;
}

export function setActiveDatabaseForTests(
  database: Database,
  dataScopeId = 'scope_00000000-0000-7000-8000-000000000000'
): void {
  active = {
    dataScopeId,
    database,
    repositories: createRepositoryContainer(database),
  };
}
