import client from './client';
import type { EquipmentType } from '../types';

/** API de tipos de equipamento (lista para seleção; ativo/placa é digitado pelo usuário). */
export const equipmentStructureApi = {
  /** Lista tipos de equipamento para o usuário selecionar (GET /api/equipment-types) */
  getEquipmentTypes: async (): Promise<EquipmentType[]> => {
    const response = await client.get<EquipmentType[] | { types?: EquipmentType[]; data?: EquipmentType[]; equipmentTypes?: EquipmentType[] }>('/api/equipment-types');
    const data = response.data;
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object') {
      const arr = (data as { types?: EquipmentType[] }).types ?? (data as { data?: EquipmentType[] }).data ?? (data as { equipmentTypes?: EquipmentType[] }).equipmentTypes;
      return Array.isArray(arr) ? arr : [];
    }
    return [];
  },
};
