import client from './client';
import { CheckOperation, CreateOperationDto, Equipment } from '../types';

export const publicMovimentacoesApi = {
  getContext: async (qrCode: string): Promise<{ equipment: Equipment; openCheckin: CheckOperation | null }> => {
    const response = await client.get<{ equipment: Equipment; openCheckin: CheckOperation | null }>(
      `/api/public/movimentacoes/contexto/${encodeURIComponent(qrCode)}`,
    );
    return response.data;
  },

  getEquipmentByQr: async (qrCode: string): Promise<Equipment> => {
    const response = await client.get<{ equipment: Equipment }>(
      `/api/public/movimentacoes/equipamento/${encodeURIComponent(qrCode)}`,
    );
    return response.data.equipment;
  },

  getOpenCheckin: async (params: {
    contractId: string;
    equipmentTypeId: string;
    ativoPlaca: string;
    date: string;
  }): Promise<CheckOperation | null> => {
    const searchParams = new URLSearchParams({
      contractId: params.contractId,
      equipmentTypeId: params.equipmentTypeId,
      ativoPlaca: params.ativoPlaca,
      date: params.date,
    });
    const response = await client.get<CheckOperation | null>(
      `/api/public/movimentacoes/open-checkin?${searchParams.toString()}`,
    );
    return response.data ?? null;
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
    if (data.equipment_id) formData.append('equipment_id', data.equipment_id);
    if (data.observation) formData.append('observation', data.observation);

    const response = await client.post<{ operation?: CheckOperation } | CheckOperation>(
      '/api/public/movimentacoes',
      formData,
    );
    const payload = response.data;
    if (payload && typeof payload === 'object' && 'operation' in payload) {
      return (payload as { operation: CheckOperation }).operation;
    }
    return payload as CheckOperation;
  },
};
