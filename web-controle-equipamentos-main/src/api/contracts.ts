import client from './client';
import { Contract, CreateContractDto, Obra } from '../types';

export const contractsApi = {
  getAll: async (): Promise<Contract[]> => {
    const response = await client.get<{ contracts: Contract[] }>('/api/contracts');
    return response.data.contracts || [];
  },

  create: async (payload: CreateContractDto): Promise<Contract> => {
    const response = await client.post<{ contract: Contract } | Contract>('/api/contracts', payload);
    const data = response.data as { contract?: Contract } | Contract;
    return (data as { contract?: Contract })?.contract ?? (data as Contract);
  },

  getObras: async (contractId: string): Promise<Obra[]> => {
    const response = await client.get<{ obras: Obra[] } | Obra[]>(`/api/contracts/${contractId}/obras`);
    const data = response.data;
    if (Array.isArray(data)) return data;
    return (data as { obras: Obra[] }).obras ?? [];
  },

  createObra: async (contractId: string, payload: { name: string; code?: string }): Promise<Obra> => {
    const response = await client.post<Obra>(`/api/contracts/${contractId}/obras`, payload);
    return response.data;
  },

  updateStatus: async (contractId: string, active: boolean): Promise<Contract> => {
    const response = await client.patch<{ contract: Contract } | Contract>(
      `/api/contracts/${contractId}/status`,
      { active },
    );
    const data = response.data as any;
    return data?.contract ?? data;
  },
};
