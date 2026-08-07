export interface User {
  id: string;
  full_name: string;
  phone?: string | null;
  cpf: string;
  email?: string | null;
  address?: string | null;
  cnh_photo?: string;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
  /** Contrato ao qual o operador está vinculado para registrar movimentações. */
  contract_id?: string | null;
  contract?: Contract;
  equipment_type_id?: string | null;
  equipment_type?: EquipmentType | null;
  ativo_placa?: string | null;
  qr_payload?: string | null;
  qr_generated_at?: string | null;
  qr_manual_optout?: boolean;
  qr_manual_reason?: string | null;
  qr_manual_at?: string | null;
}

export interface LoginResponse {
  access_token: string;
  message?: string;
  user?: User; // Depending on actual API response, sometimes APIs return user info on login
  name?: string;
  full_name?: string;
}

export interface Contract {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
  /** Números do contrato (ex.: "242 até 247"). Pode vir da API ou do mapeamento local. */
  numbers?: string | null;
}

export interface CreateContractDto {
  name: string;
}

export interface Obra {
  id: string;
  /** Número da obra vindo da tabela `obras.code` no Supabase */
  code: string;
  name?: string | null;
  contract_id?: string;
  created_at?: string;
}

export interface Equipment {
  id: string;
  name: string;
  contract_id?: string | null;
  obra_id?: string | null;
  company_name?: string | null;
  equipment_type_id?: string | null;
  ativo_placa?: string | null;
  qr_code_value?: string;
  active: boolean;
  created_at: string;
  contract?: Contract; // Optional if joined
  obra?: Obra | { id: string; code?: string; contract_id?: string };
  equipment_type?: EquipmentType;
  /** Tipo do identificador: placa ou ativo (endpoint equipments/contract retorna) */
  identifier_type?: 'placa' | 'ativo';
  /** Valor da placa ou do ativo */
  identifier_value?: string | null;
}

export interface CreateOperatorDto {
  full_name: string;
  email?: string | null;
  cpf: string;
  password: string;
  contract_id?: string | null;
}

export interface UpdateEquipmentRegistryDto {
  name?: string;
  contract_id?: string;
  obra_id?: string | null;
  company_name?: string;
  equipment_type_id?: string;
  ativo_placa?: string;
  active?: boolean;
}

export interface CreateEquipmentRegistryDto {
  name: string;
  contract_id: string;
  obra_id?: string | null;
  company_name: string;
  equipment_type_id: string;
  ativo_placa: string;
  active?: boolean;
}

/** Tipo de equipamento (ex: "Caminhão Basculante Trucado") - um por nome */
export interface EquipmentType {
  id: string;
  name: string;
  /** Se vem da tabela equipment_types, indica se o tipo está ativo */
  active?: boolean;
  /** Data de criação na tabela equipment_types */
  created_at?: string;
}

/** Dono/empresa da obra (terceirizado ou próprio) */
export interface EquipmentOwner {
  id: string;
  name: string;
  owner_type?: 'terceirizado' | 'proprio';
  equipments?: unknown[];
  /** Instâncias (placas/ativos) quando vem de equipment-owners?obraId= */
  instances?: EquipmentInstance[];
}

/** Instância = placa/ativo de um tipo (equipment-types/:id/instances) */
export interface EquipmentInstance {
  id: string;
  identifier_type?: 'placa' | 'ativo';
  identifier_value?: string | null;
  equipment_type?: EquipmentType;
  equipment_owner?: EquipmentOwner;
}

/** Operação com equipment_instance (resposta de check-operations/contract/:id) */
export interface EquipmentInstanceOnOperation {
  id: string;
  identifier_type?: 'placa' | 'ativo';
  identifier_value?: string | null;
  equipment_type?: EquipmentType;
  equipment_owner?: { id: string; name: string; owner_type?: string };
}

export type OperationType = 'checkin' | 'checkout';

export interface CheckOperation {
  id: string;
  contract_id: string;
  equipment_id?: string; // legado
  equipment_type_id?: string | null;
  operation_type: OperationType;
  horimeter: number;
  photo_url: string;
  latitude: number;
  longitude: number;
  observation?: string;
  operation_datetime: string;
  synced: boolean;
  device_id: string;
  created_at: string;
  /** Tipo selecionado (GET /api/check-operations/contract/:id) */
  equipment_type?: { id: string; name: string };
  /** Ativo ou placa digitado pelo usuário */
  ativo_placa?: string;
  // Optional expanded fields (legado)
  contract?: Contract;
  equipment?: Equipment;
  equipment_instance?: EquipmentInstanceOnOperation;
  user_id?: string;
  user?: User;
  created_by_user?: string | User;
}

export interface CreateOperationDto {
  contract_id: string;
  equipment_type_id: string;
  equipment_id?: string;
  ativo_placa: string;
  operation_type: OperationType;
  horimeter: number;
  latitude: number;
  longitude: number;
  operation_datetime: string;
  photo: File;
  device_id: string;
  observation?: string;
}

export interface SyncOperationDto {
  contract_id: string;
  equipment_type_id: string;
  ativo_placa: string;
  operation_type: OperationType;
  horimeter: number;
  photo_base64: string;
  latitude: number;
  longitude: number;
  operation_datetime: string;
  device_id: string;
  observation?: string;
}

/** Campos editáveis na movimentação (PATCH) */
export interface UpdateOperationDto {
  operation_datetime?: string;
  horimeter?: number;
  observation?: string;
}
