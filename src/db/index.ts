import Dexie, { type EntityTable } from 'dexie';
import type { Client } from '../lib/types';

const db = new Dexie('FinancialPlanningDB') as Dexie & {
  clients: EntityTable<Client, 'id'>;
};

db.version(1).stores({
  clients: 'id, firstName, lastName, updatedAt',
});

export { db };
