import Dexie, { type EntityTable } from 'dexie';
import type { Client } from '../lib/types';

const db = new Dexie('FinancialPlanningDB') as Dexie & {
  clients: EntityTable<Client, 'id'>;
};

db.version(1).stores({
  clients: 'id, firstName, lastName, updatedAt',
});

// Version 2: Added FHSA fields to Client
db.version(2).stores({
  clients: 'id, firstName, lastName, updatedAt',
});

// Version 3: Added spouse CPP/OAS, RRSP/TFSA fields
db.version(3).stores({
  clients: 'id, firstName, lastName, updatedAt',
}).upgrade((tx) => {
  return tx.table('clients').toCollection().modify((client) => {
    if (client.spouse) {
      client.spouse.estimatedCppMonthly ??= 800;
      client.spouse.cppStartAge ??= 65;
      client.spouse.oasStartAge ??= 65;
      client.spouse.rrspBalance ??= 0;
      client.spouse.tfsaBalance ??= 0;
    }
  });
});

// Version 4: Added RESP/children fields
db.version(4).stores({
  clients: 'id, firstName, lastName, updatedAt',
}).upgrade((tx) => {
  return tx.table('clients').toCollection().modify((client) => {
    client.children ??= [];
    client.respAnnualContribution ??= 0;
  });
});

export { db };
