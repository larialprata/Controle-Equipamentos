import { useCallback, useEffect, useState } from 'react';
import { operationsApi, type SyncOperationsResult } from '../api/operations';
import {
  clearLocalOpenCheckin,
  isBrowserOnline,
  listPendingOperations,
  pendingToSyncDto,
  removePendingOperation,
} from '../lib/offlineOperations';

export function useOfflineSync(userId: string | undefined) {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(isBrowserOnline());

  const refreshPendingCount = useCallback(async () => {
    if (!userId) {
      setPendingCount(0);
      return;
    }
    const list = await listPendingOperations(userId);
    setPendingCount(list.length);
  }, [userId]);

  const syncPending = useCallback(async (): Promise<SyncOperationsResult | null> => {
    if (!userId || !isBrowserOnline()) return null;

    const pending = await listPendingOperations(userId);
    if (pending.length === 0) {
      await refreshPendingCount();
      return { synced: 0, failed: 0, results: [] };
    }

    setIsSyncing(true);
    try {
      const operations = await Promise.all(pending.map((item) => pendingToSyncDto(item)));
      const result = await operationsApi.sync(operations);

      const failedIndexes = new Set<number>();
      result.results.forEach((item, index) => {
        if (!item.success) failedIndexes.add(index);
      });

      for (let i = 0; i < pending.length; i++) {
        if (!failedIndexes.has(i)) {
          await removePendingOperation(pending[i].id);
        }
      }

      const remaining = await listPendingOperations(userId);
      if (remaining.length === 0) {
        await clearLocalOpenCheckin(userId);
      }

      await refreshPendingCount();
      return result;
    } finally {
      setIsSyncing(false);
    }
  }, [refreshPendingCount, userId]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      void syncPending();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOnline(isBrowserOnline());

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncPending]);

  useEffect(() => {
    void refreshPendingCount();
  }, [refreshPendingCount]);

  useEffect(() => {
    if (userId && isOnline) {
      void syncPending();
    }
  }, [isOnline, syncPending, userId]);

  return {
    pendingCount,
    isSyncing,
    isOnline,
    refreshPendingCount,
    syncPending,
  };
}
