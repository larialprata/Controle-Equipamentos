import client from './client';
import { CreateEquipmentRegistryDto, Equipment, UpdateEquipmentRegistryDto } from '../types';

export interface EquipmentsByContractParams {
  obraId?: string;
  equipmentOwnerId?: string;
}

export const equipmentsApi = {
  getAll: async (): Promise<Equipment[]> => {
    const response = await client.get<{ equipments: Equipment[] }>('/api/equipments');
    return response.data.equipments || [];
  },

  create: async (payload: CreateEquipmentRegistryDto): Promise<Equipment> => {
    const response = await client.post<{ equipment: Equipment }>('/api/equipments', payload);
    return response.data.equipment;
  },

  update: async (id: string, payload: UpdateEquipmentRegistryDto): Promise<Equipment> => {
    const response = await client.patch<{ equipment: Equipment }>(`/api/equipments/${id}`, payload);
    return response.data.equipment;
  },

  regenerateQr: async (id: string): Promise<Equipment> => {
    const response = await client.post<{ equipment: Equipment }>(`/api/equipments/${id}/regenerate-qr`);
    return response.data.equipment;
  },

  remove: async (id: string): Promise<void> => {
    await client.delete(`/api/equipments/${id}`);
  },

  getByQrCode: async (qrCode: string): Promise<Equipment> => {
    const response = await client.get<{ equipment: Equipment }>(`/api/equipments/qr/${encodeURIComponent(qrCode)}`);
    return response.data.equipment;
  },

  /** Equipamentos do contrato (com placa/ativo); filtros opcionais por obra ou dono */
  getByContract: async (
    contractId: string,
    params?: EquipmentsByContractParams
  ): Promise<Equipment[]> => {
    const searchParams = new URLSearchParams();
    if (params?.obraId) searchParams.set('obraId', params.obraId);
    if (params?.equipmentOwnerId) searchParams.set('equipmentOwnerId', params.equipmentOwnerId);
    const query = searchParams.toString();
    const url = `/api/equipments/contract/${contractId}${query ? `?${query}` : ''}`;
    const response = await client.get<{ equipments: Equipment[] }>(url);
    return response.data.equipments || [];
  },
};
