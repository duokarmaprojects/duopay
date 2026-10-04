import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface DuoPayLocalDB extends DBSchema {
  expenses: {
    key: string;
    value: any;
    indexes: { 'groupId': string, 'date': string };
  };
  groups: {
    key: string;
    value: any;
  };
  balances: {
    key: string;
    value: any;
  };
  outbox: {
    key: string;
    value: {
      id: string;
      type: string;
      payload: any;
      createdAt: number;
      status: 'pending' | 'syncing' | 'error';
      error?: string;
    };
    indexes: { 'status': string };
  };
  users: {
    key: string;
    value: any;
  };
}

let dbPromise: Promise<IDBPDatabase<DuoPayLocalDB>> | null = null;

export function getLocalDB() {
  if (typeof window === 'undefined') return null;
  if (!dbPromise) {
    dbPromise = openDB<DuoPayLocalDB>('duopay-local', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('expenses')) {
          const expenseStore = db.createObjectStore('expenses', { keyPath: 'id' });
          expenseStore.createIndex('groupId', 'groupId');
          expenseStore.createIndex('date', 'date');
        }
        if (!db.objectStoreNames.contains('groups')) {
          db.createObjectStore('groups', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('balances')) {
          db.createObjectStore('balances', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('users')) {
          db.createObjectStore('users', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('outbox')) {
          const outboxStore = db.createObjectStore('outbox', { keyPath: 'id' });
          outboxStore.createIndex('status', 'status');
        }
      },
    });
  }
  return dbPromise;
}

export async function clearLocalDB() {
  const db = await getLocalDB();
  if (!db) return;
  await Promise.all([
    db.clear('expenses'),
    db.clear('groups'),
    db.clear('balances'),
    db.clear('users'),
  ]);
}
