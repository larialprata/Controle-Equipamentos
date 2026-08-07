import client, { API_BASE_URL } from './client';
import { CheckOperation, CreateOperationDto, SyncOperationDto, UpdateOperationDto } from '../types';

export type SyncOperationsResult = {
  synced: number;
  failed: number;
  results: Array<{
    success: boolean;
    id?: string;
    error?: string;
    deduplicated?: boolean;
    ignored_stale?: boolean;
  }>;
};

export interface ListOperationsParams {
  contract_id?: string;
  date_from?: string; // ISO date or datetime
  date_to?: string;
  equipment_id?: string;
  user_id?: string;
  limit?: number; // máximo de registros (backend pode ignorar se não suportar)
}

export interface OpenCheckinLookupParams {
  contractId: string;
  equipmentTypeId: string;
  ativoPlaca: string;
  date: string;
}

export const operationsApi = {
  getLastCheckin: async (): Promise<CheckOperation | null> => {
    const response = await client.get<CheckOperation | null>('/api/check-operations/last-checkin');
    return response.data ?? null;
  },

  getOpenCheckinForAsset: async (params: OpenCheckinLookupParams): Promise<CheckOperation | null> => {
    const searchParams = new URLSearchParams({
      contractId: params.contractId,
      equipmentTypeId: params.equipmentTypeId,
      ativoPlaca: params.ativoPlaca,
      date: params.date,
    });
    const response = await client.get<CheckOperation | null>(`/api/check-operations/open-checkin?${searchParams.toString()}`);
    return response.data ?? null;
  },

  /** Operações do contrato (com equipment_type + ativo_placa) — para BI */
  getByContract: async (contractId: string): Promise<CheckOperation[]> => {
    const response = await client.get<CheckOperation[] | { operations?: CheckOperation[] }>(
      `/api/check-operations/contract/${contractId}`
    );
    const data = response.data;
    if (Array.isArray(data)) return data;
    return (data as { operations?: CheckOperation[] }).operations ?? [];
  },

  list: async (params?: ListOperationsParams): Promise<CheckOperation[]> => {
    const searchParams = new URLSearchParams();
    if (params?.contract_id) searchParams.set('contract_id', params.contract_id);
    if (params?.date_from) searchParams.set('date_from', params.date_from);
    if (params?.equipment_id) searchParams.set('equipment_id', params.equipment_id);
    if (params?.user_id) searchParams.set('user_id', params.user_id);
    if (params?.date_to) searchParams.set('date_to', params.date_to);
    if (params?.limit != null) searchParams.set('limit', String(params.limit));
    const query = searchParams.toString();
    const response = await client.get<{ operations?: CheckOperation[]; data?: { operations?: CheckOperation[] } }>(
      `/api/check-operations${query ? `?${query}` : ''}`
    );
    const data = response.data;
    const list =
      (Array.isArray(data?.operations) ? data.operations : null) ??
      (Array.isArray(data?.data?.operations) ? data.data.operations : null) ??
      (Array.isArray(data) ? data : null) ??
      (Array.isArray(data?.data) ? data.data : null) ??
      [];
    return list;
  },

  create: async (data: CreateOperationDto): Promise<CheckOperation> => {
    const formData = new FormData();
    formData.append('contract_id', data.contract_id);
    formData.append('equipment_type_id', data.equipment_type_id);
    formData.append('ativo_placa', data.ativo_placa);
    formData.append('operation_type', data.operation_type);
    formData.append('horimeter', data.horimeter.toString());
    formData.append('latitude', data.latitude.toString());
    formData.append('longitude', data.longitude.toString());
    formData.append('operation_datetime', data.operation_datetime);
    formData.append('device_id', data.device_id);
    formData.append('photo', data.photo, data.photo.name || 'photo.jpg');
    if (data.observation) formData.append('observation', data.observation);

    const response = await client.post<CheckOperation | { operation?: CheckOperation }>('/api/check-operations', formData);
    const payload = response.data;
    if (payload && typeof payload === 'object' && 'operation' in payload) {
      return (payload as { operation: CheckOperation }).operation;
    }
    return payload as CheckOperation;
  },

  sync: async (operations: SyncOperationDto[]): Promise<SyncOperationsResult> => {
    const response = await client.post<SyncOperationsResult>('/api/check-operations/sync', { operations });
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await client.delete(`/api/check-operations/${id}`);
  },

  deleteMany: async (ids: string[]): Promise<{ message?: string; deleted?: number }> => {
    const response = await client.delete('/api/check-operations', { data: { ids } });
    return response.data ?? {};
  },

  update: async (id: string, data: UpdateOperationDto): Promise<CheckOperation> => {
    const response = await client.patch<CheckOperation>(`/api/check-operations/${id}`, data);
    return response.data;
  },

  getPhotoUrl: (filename: string): string => {
    const name = (filename || '').trim().split('/').pop() || filename;
    return `${API_BASE_URL}/api/check-operations/photo/${name}`;
  },
};
