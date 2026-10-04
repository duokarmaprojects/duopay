import { getLocalDB } from '../db/local';

export async function addToOutbox(type: string, payload: any) {
  const db = await getLocalDB();
  if (!db) return null;

  const id = crypto.randomUUID();
  const mutation = {
    id,
    type,
    payload,
    createdAt: Date.now(),
    status: 'pending' as const,
  };

  await db.put('outbox', mutation);
  
  // Try to sync immediately
  if (navigator.onLine) {
    processOutbox().catch(console.error);
  }
  
  return id;
}

let isSyncing = false;

export async function processOutbox() {
  if (isSyncing || typeof window === 'undefined' || !navigator.onLine) return;
  
  const db = await getLocalDB();
  if (!db) return;

  isSyncing = true;
  
  try {
    const pending = await db.getAllFromIndex('outbox', 'status', 'pending');
    
    // Sort by createdAt
    pending.sort((a, b) => a.createdAt - b.createdAt);
    
    for (const mutation of pending) {
      // Mark as syncing
      mutation.status = 'syncing';
      await db.put('outbox', mutation);
      
      try {
        // Post to server sync endpoint
        const res = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mutation),
        });
        
        if (res.ok) {
          // Success, remove from outbox
          await db.delete('outbox', mutation.id);
          
          // Optionally update local cache based on server response
          const result = await res.json();
          await applyServerState(mutation.type, result);
        } else {
          // If server rejects (e.g. 400), we might need to handle conflict
          mutation.status = 'error';
          mutation.error = `Server returned ${res.status}`;
          await db.put('outbox', mutation);
        }
      } catch (err: any) {
        // Network error, revert to pending
        mutation.status = 'pending';
        mutation.error = err.message;
        await db.put('outbox', mutation);
        break; // Stop processing if network fails
      }
    }
  } finally {
    isSyncing = false;
  }
}

async function applyServerState(type: string, result: any) {
  const db = await getLocalDB();
  if (!db) return;

  // Reconcile server authoritative state into local DB
  if (type === 'CREATE_EXPENSE' && result.expense) {
    await db.put('expenses', result.expense);
  }
  // Implement other types
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    processOutbox().catch(console.error);
  });
}
