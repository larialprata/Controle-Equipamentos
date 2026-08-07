import client from './client';
import { CreateOperatorDto, LoginResponse, User } from '../types';
import { API_BASE_URL } from './client';

export const authApi = {
  normalizeUserResponse: (payload: any): User => payload?.user ?? payload,
  login: async (identifier: string, password: string): Promise<LoginResponse> => {
    const response = await client.post<LoginResponse>('/api/auth/login', { identifier, password });
    return response.data;
  },

  register: async (formData: FormData): Promise<User> => {
    const response = await client.post<User>('/api/auth/register', formData);
    return response.data;
  },

  getUsers: async (): Promise<User[]> => {
    const response = await client.get<{ users: User[] }>('/api/users');
    return response.data.users || [];
  },

  createOperator: async (payload: CreateOperatorDto): Promise<User> => {
    const response = await client.post<{ user: User }>('/api/users', payload);
    return response.data.user;
  },

  toggleUserStatus: async (id: string): Promise<User> => {
    const response = await client.patch<User>(`/api/users/${id}/toggle-status`);
    return authApi.normalizeUserResponse(response.data);
  },

  deleteUser: async (id: string): Promise<{ message?: string }> => {
    const response = await client.delete<{ message?: string }>(`/api/users/${id}`);
    return response.data ?? {};
  },

  /** Definir ou remover permissão de administrador. Tenta /api/users/:id e, se 404, /api/auth/users/:id */
  setUserAdmin: async (id: string, is_admin: boolean): Promise<User> => {
    try {
      const response = await client.patch<User>(`/api/users/${id}`, { is_admin });
      return authApi.normalizeUserResponse(response.data);
    } catch (err: any) {
      if (err.response?.status === 404) {
        const response = await client.patch<User>(`/api/auth/users/${id}`, { is_admin });
        return authApi.normalizeUserResponse(response.data);
      }
      throw err;
    }
  },

  setUserContract: async (id: string, contract_id: string | null): Promise<User> => {
    const normalizedContractId = contract_id?.trim() || null;
    try {
      const response = await client.patch<User>(`/api/users/${id}`, { contract_id: normalizedContractId });
      return authApi.normalizeUserResponse(response.data);
    } catch (err: any) {
      if (err.response?.status === 404) {
        const response = await client.patch<User>(`/api/auth/users/${id}`, { contract_id: normalizedContractId });
        return authApi.normalizeUserResponse(response.data);
      }
      throw err;
    }
  },

  setUserEmail: async (id: string, email: string | null): Promise<User> => {
    const normalizedEmail = email?.trim().toLowerCase() || null;
    try {
      const response = await client.patch<User>(`/api/users/${id}`, { email: normalizedEmail });
      return authApi.normalizeUserResponse(response.data);
    } catch (err: any) {
      if (err.response?.status === 404) {
        const response = await client.patch<User>(`/api/auth/users/${id}`, { email: normalizedEmail });
        return authApi.normalizeUserResponse(response.data);
      }
      throw err;
    }
  },

  setUserQrProfile: async (
    id: string,
    data: {
      contract_id?: string | null;
      equipment_type_id?: string | null;
      ativo_placa?: string | null;
      is_active?: boolean;
      reload_qr?: boolean;
    }
  ): Promise<User> => {
    const payload = {
      ...data,
      ativo_placa: data.ativo_placa ? data.ativo_placa.trim().toUpperCase().replace(/\s/g, '') : data.ativo_placa ?? null,
    };
    try {
      const response = await client.patch<User>(`/api/users/${id}`, payload);
      return authApi.normalizeUserResponse(response.data);
    } catch (err: any) {
      if (err.response?.status === 404) {
        const response = await client.patch<User>(`/api/auth/users/${id}`, payload);
        return authApi.normalizeUserResponse(response.data);
      }
      throw err;
    }
  },

  reloadUserQr: async (id: string): Promise<User> => {
    return authApi.setUserQrProfile(id, { reload_qr: true });
  },

  /** URL para exibir a foto (CNH). Aceita filename/caminho do backend ou URL direta do bucket. */
  getDocumentPhotoUrl: (filename: string): string => {
    if (!filename?.trim()) return '';
    if (filename.startsWith('http://') || filename.startsWith('https://')) return filename.trim();
    const actualFilename = filename.split('/').pop() || filename;
    return `${client.defaults.baseURL}/api/users/document/${actualFilename}`;
  },

  /** Busca a foto (CNH) e retorna blob URL — funciona com API do backend ou URL direta do bucket. */
  getDocumentPhotoBlobUrl: async (filename: string): Promise<string> => {
    if (!filename?.trim()) throw new Error('Filename is required');
    const token = localStorage.getItem('token');
    const isFullUrl = filename.startsWith('http://') || filename.startsWith('https://');
    const url = isFullUrl
      ? filename.trim()
      : `${API_BASE_URL}/api/users/document/${filename.split('/').pop() || filename}`;
    const headers: HeadersInit = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  },
};
