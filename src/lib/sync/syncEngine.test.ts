import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addToOutbox, processOutbox } from './syncEngine';

// Mock IndexedDB
const mockDb = {
  put: vi.fn(),
  getAllFromIndex: vi.fn(),
  delete: vi.fn(),
};

vi.mock('../db/local', () => ({
  getLocalDB: vi.fn(() => Promise.resolve(mockDb)),
}));

// Mock fetch
global.fetch = vi.fn();

describe('Sync Engine & Offline Outbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, expense: { id: '123' } }),
    });
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    // Reset window just in case
    if (typeof window === 'undefined') {
       (global as any).window = { addEventListener: vi.fn() };
    }
  });

  it('queues a mutation when offline', async () => {
    const originalOnLine = navigator.onLine;
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    
    const id = await addToOutbox('CREATE_EXPENSE', { amount: 1200 });
    
    expect(id).toBeDefined();
    expect(mockDb.put).toHaveBeenCalledWith('outbox', expect.objectContaining({
      type: 'CREATE_EXPENSE',
      status: 'pending'
    }));
    
    Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
  });

  it('processes the outbox and deletes on success', async () => {
    mockDb.getAllFromIndex.mockResolvedValueOnce([
      { id: '1', type: 'CREATE_EXPENSE', payload: { amount: 100 }, status: 'pending', createdAt: 1 }
    ]);
    
    await processOutbox();
    
    expect(global.fetch).toHaveBeenCalledWith('/api/sync', expect.any(Object));
    expect(mockDb.delete).toHaveBeenCalledWith('outbox', '1');
  });

  it('handles conflicts gracefully on server rejection', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 400
    });

    mockDb.getAllFromIndex.mockResolvedValueOnce([
      { id: '2', type: 'CREATE_EXPENSE', payload: { amount: 100 }, status: 'pending', createdAt: 1 }
    ]);
    
    await processOutbox();
    
    // Should mark as error, not delete
    expect(mockDb.put).toHaveBeenCalledWith('outbox', expect.objectContaining({
      id: '2',
      status: 'error',
      error: 'Server returned 400'
    }));
    expect(mockDb.delete).not.toHaveBeenCalled();
  });
});
