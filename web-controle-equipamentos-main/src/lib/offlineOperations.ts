import type { CheckOperation, Equipment, OperationType, SyncOperationDto } from '../types';

const DB_NAME = 'controle-equipamentos-offline';
const DB_VERSION = 1;
const STORE_PENDING = 'pendingOperations';
const STORE_EQUIPMENT = 'equipmentByQr';
const STORE_SESSION = 'sessionState';

export type PendingOperationRecord = {
  id: string;
  userId: string;
  createdAt: string;
  contract_id: string;
  equipment_type_id: string;
  ativo_placa: string;
  operation_type: OperationType;
  horimeter: number;
  latitude: number;
  longitude: number;
  operation_datetime: string;
  device_id: string;
  observation?: string;
  photoBlob: Blob;
  qrValue?: string;
};

type LocalOpenCheckin = {
  contract_id: string;
  equipment_type_id: string;
  ativo_placa: string;
  horimeter: number;
  operation_datetime: string;
  pendingId: string;
};

type SessionState = {
  userId: string;
  openCheckin: LocalOpenCheckin | null;
};

type CachedEquipmentRecord = {
  qrValue: string;
  equipment: Equipment;
  cachedAt: string;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error ?? new Error('Falha ao abrir IndexedDB'));
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_PENDING)) {
          db.createObjectStore(STORE_PENDING, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_EQUIPMENT)) {
          db.createObjectStore(STORE_EQUIPMENT, { keyPath: 'qrValue' });
        }
        if (!db.objectStoreNames.contains(STORE_SESSION)) {
          db.createObjectStore(STORE_SESSION, { keyPath: 'userId' });
        }
      };
      request.onsuccess = () => resolve(request.result);
    });
  }
  return dbPromise;
}

async function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Erro no IndexedDB'));
  });
}

async function idbGet<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDatabase();
  const tx = db.transaction(storeName, 'readonly');
  return idbRequest<T | undefined>(tx.objectStore(storeName).get(key));
}

async function idbPut(storeName: string, value: unknown): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(storeName, 'readwrite');
  await idbRequest(tx.objectStore(storeName).put(value));
}

async function idbDelete(storeName: string, key: IDBValidKey): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(storeName, 'readwrite');
  await idbRequest(tx.objectStore(storeName).delete(key));
}

async function idbGetAll<T>(storeName: string): Promise<T[]> {
  const db = await openDatabase();
  const tx = db.transaction(storeName, 'readonly');
  return idbRequest<T[]>(tx.objectStore(storeName).getAll());
}

export function isBrowserOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

export function isNetworkFailure(error: unknown): boolean {
  if (!isBrowserOnline()) return true;
  if (!error || typeof error !== 'object') return false;
  const err = error as { code?: string; message?: string; response?: unknown };
  if (err.code === 'ERR_NETWORK') return true;
  if (!err.response && typeof err.message === 'string') {
    return /network error|failed to fetch|load failed|timeout/i.test(err.message);
  }
  return false;
}

export async function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Falha ao converter foto'));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler foto'));
    reader.readAsDataURL(file);
  });
}

async function setLocalOpenCheckin(userId: string, openCheckin: LocalOpenCheckin | null): Promise<void> {
  await idbPut(STORE_SESSION, { userId, openCheckin } satisfies SessionState);
}

export async function enqueuePendingOperation(
  userId: string,
  payload: Omit<PendingOperationRecord, 'id' | 'userId' | 'createdAt'>,
): Promise<PendingOperationRecord> {
  const record: PendingOperationRecord = {
    ...payload,
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `pending-${Date.now()}`,
    userId,
    createdAt: new Date().toISOString(),
  };

  await idbPut(STORE_PENDING, record);

  if (record.operation_type === 'checkin') {
    await setLocalOpenCheckin(userId, {
      contract_id: record.contract_id,
      equipment_type_id: record.equipment_type_id,
      ativo_placa: record.ativo_placa,
      horimeter: record.horimeter,
      operation_datetime: record.operation_datetime,
      pendingId: record.id,
    });
  } else {
    await setLocalOpenCheckin(userId, null);
  }

  return record;
}

export async function listPendingOperations(userId: string): Promise<PendingOperationRecord[]> {
  const rows = await idbGetAll<PendingOperationRecord>(STORE_PENDING);
  return rows.filter((item) => item.userId === userId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function countPendingOperations(userId: string): Promise<number> {
  const list = await listPendingOperations(userId);
  return list.length;
}

export async function removePendingOperation(id: string): Promise<void> {
  await idbDelete(STORE_PENDING, id);
}

export async function cacheEquipmentForQr(qrValue: string, equipment: Equipment): Promise<void> {
  const record: CachedEquipmentRecord = {
    qrValue,
    equipment,
    cachedAt: new Date().toISOString(),
  };
  await idbPut(STORE_EQUIPMENT, record);
}

export async function getCachedEquipmentByQr(qrValue: string): Promise<Equipment | null> {
  const record = await idbGet<CachedEquipmentRecord>(STORE_EQUIPMENT, qrValue);
  return record?.equipment ?? null;
}

export async function getLocalOpenCheckin(userId: string): Promise<LocalOpenCheckin | null> {
  const session = await idbGet<SessionState>(STORE_SESSION, userId);
  return session?.openCheckin ?? null;
}

export async function clearLocalOpenCheckin(userId: string): Promise<void> {
  await setLocalOpenCheckin(userId, null);
}

export function toSyntheticCheckOperation(open: LocalOpenCheckin): CheckOperation {
  return {
    id: `local-${open.pendingId}`,
    contract_id: open.contract_id,
    equipment_type_id: open.equipment_type_id,
    ativo_placa: open.ativo_placa,
    operation_type: 'checkin',
    horimeter: open.horimeter,
    operation_datetime: open.operation_datetime,
    latitude: 0,
    longitude: 0,
    photo_url: '',
    synced: false,
    created_at: open.operation_datetime,
    device_id: '',
  };
}

export async function pendingToSyncDto(record: PendingOperationRecord): Promise<SyncOperationDto> {
  const photo_base64 = await fileToBase64(record.photoBlob);
  return {
    contract_id: record.contract_id,
    equipment_type_id: record.equipment_type_id,
    ativo_placa: record.ativo_placa,
    operation_type: record.operation_type,
    horimeter: record.horimeter,
    photo_base64,
    latitude: record.latitude,
    longitude: record.longitude,
    operation_datetime: record.operation_datetime,
    device_id: record.device_id,
    observation: record.observation,
  };
}
