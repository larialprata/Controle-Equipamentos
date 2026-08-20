import React, { useEffect, useRef } from 'react';
import ExcelJS from 'exceljs';
import { X, ZoomIn, ZoomOut, RotateCw, Undo2 } from 'lucide-react';
import { contractsApi } from '../api/contracts';
import { operationsApi } from '../api/operations';
import { authApi } from '../api/auth';
import { equipmentsApi } from '../api/equipments';
import client, { API_BASE_URL } from '../api/client';
import { equipmentStructureApi } from '../api/equipmentStructure';
import OperationsMap from '../components/OperationsMap';
import type { CheckOperation, Contract, Equipment, EquipmentType, User } from '../types';

function operationPhotoUrl(operationId: string | undefined): string | null {
  if (!operationId) return null;
  return `${API_BASE_URL}/api/check-operations/${operationId}/photo`;
}

const LOGO_SRC = '/logo-dimensional.png';

const EXCEL_FONT = { name: 'Arial', size: 12 };
const EXCEL_BORDER = {
  top: { style: 'thin' as const },
  left: { style: 'thin' as const },
  bottom: { style: 'thin' as const },
  right: { style: 'thin' as const },
};

function formatDateTime(s: string) {
  if (!s) return '—';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleString('pt-BR');
}

function formatDateDayMonth(s: string) {
  if (!s) return '—';
  const d = new Date(s);
  return Number.isNaN(d.getTime())
    ? s
    : d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
}

function escapeHtml(value: unknown): string {
  const s = String(value ?? '—');
  return s.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#039;';
      default:
        return ch;
    }
  });
}

function isRegiaoMetropolitanaName(value: string): boolean {
  // Alguns provedores devolvem "Região Metropolitana de ..." em vez do município.
  const s = value.toLowerCase();
  return s.includes('metropolitana') || s.includes('metropolit');
}

function municipalityFromAddress(addr: any): string {
  if (!addr || typeof addr !== 'object') return '';

  const candidates: Array<unknown> = [
    addr.city,
    addr.town,
    addr.village,
    addr.municipality,
    addr.county,
    addr.city_district, // fallback
    addr.state_district,
  ];

  for (const c of candidates) {
    if (typeof c !== 'string') continue;
    const v = c.trim();
    if (!v) continue;
    if (isRegiaoMetropolitanaName(v)) continue;
    return v;
  }

  return '';
}

function neighborhoodFromAddress(addr: any): string {
  if (!addr || typeof addr !== 'object') return '';
  const candidates: Array<unknown> = [
    addr.neighbourhood,
    addr.neighborhood,
    addr.quarter,
    addr.suburb,
    addr.borough,
    addr.district,
    addr.city_district,
    addr.municipal_district,
  ];
  for (const c of candidates) {
    if (typeof c !== 'string') continue;
    const v = c.trim();
    if (!v) continue;
    return v;
  }
  return '';
}

function googleComponent(
  components: Array<{ long_name?: string; short_name?: string; types?: string[] }> | undefined,
  type: string
): string {
  if (!Array.isArray(components)) return '';
  const found = components.find((c) => Array.isArray(c.types) && c.types.includes(type));
  const name = found?.long_name ?? found?.short_name;
  return typeof name === 'string' ? name.trim() : '';
}

/** Resolve bairro + município por coordenada (Google primeiro; fallbacks OSM/BigDataCloud). */
async function resolveBairroMunicipioByLatLng(lat: number, lng: number): Promise<{ bairro: string; municipio: string }> {
  const googleKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim();

  // 1) Google Geocoding — melhor para municípios BR (ex.: Belford Roxo, Nova Iguaçu, Teresópolis)
  if (googleKey) {
    try {
      const r = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(String(lat))},${encodeURIComponent(String(lng))}&language=pt-BR&key=${encodeURIComponent(googleKey)}`
      );
      if (r.ok) {
        const json: any = await r.json();
        if (json?.status === 'OK' && Array.isArray(json.results) && json.results.length > 0) {
          // Junta componentes de todos os resultados para achar município e bairro
          const allComponents = json.results.flatMap((res: any) =>
            Array.isArray(res?.address_components) ? res.address_components : []
          );

          const municipio =
            googleComponent(allComponents, 'administrative_area_level_2') ||
            googleComponent(allComponents, 'locality') ||
            googleComponent(allComponents, 'administrative_area_level_3') ||
            '';

          const bairro =
            googleComponent(allComponents, 'sublocality_level_1') ||
            googleComponent(allComponents, 'sublocality') ||
            googleComponent(allComponents, 'neighborhood') ||
            '—';

          if (municipio && !isRegiaoMetropolitanaName(municipio)) {
            return { municipio, bairro: bairro || '—' };
          }
        }
      }
    } catch {
      // fallback abaixo
    }
  }

  // 2) Nominatim (OSM)
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lng))}&zoom=10&addressdetails=1`,
      { headers: { 'Accept-Language': 'pt-BR' } }
    );
    if (r.ok) {
      const json: any = await r.json();
      const municipio = municipalityFromAddress(json?.address);
      const bairro = neighborhoodFromAddress(json?.address);
      if (municipio || bairro) {
        return {
          municipio: municipio || '—',
          bairro: bairro || '—',
        };
      }
    }
  } catch {
    // fallback abaixo
  }

  // 3) BigDataCloud (client-side)
  try {
    const r = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(String(lat))}&longitude=${encodeURIComponent(String(lng))}&localityLanguage=pt`
    );
    if (r.ok) {
      const json: any = await r.json();
      const adminEntries: Array<{ name?: string; adminLevel?: number; description?: string }> = Array.isArray(
        json?.localityInfo?.administrative
      )
        ? json.localityInfo.administrative
        : [];

      // No Brasil, município costuma ser adminLevel 2 (ou descrição com "município"/"cidade")
      const byLevel2 = adminEntries.find((a) => a.adminLevel === 2)?.name;
      const byDesc = adminEntries.find((a) => {
        const d = String(a.description ?? '').toLowerCase();
        return d.includes('municip') || d.includes('city') || d.includes('cidade');
      })?.name;

      const municipioCandidates: Array<string | undefined> = [
        byLevel2,
        byDesc,
        typeof json?.city === 'string' ? json.city : undefined,
        typeof json?.locality === 'string' ? json.locality : undefined,
        ...adminEntries.map((a) => a.name),
      ];

      let municipioCandidate: string | undefined;
      for (const c of municipioCandidates) {
        if (typeof c !== 'string') continue;
        const v = c.trim();
        if (!v) continue;
        if (isRegiaoMetropolitanaName(v)) continue;
        municipioCandidate = v;
        break;
      }

      const bairroCandidate: string | undefined =
        (typeof json?.neighbourhood === 'string' ? json.neighbourhood : undefined) ||
        (typeof json?.neighborhood === 'string' ? json.neighborhood : undefined) ||
        (typeof json?.district === 'string' ? json.district : undefined) ||
        (typeof json?.suburb === 'string' ? json.suburb : undefined);

      if (municipioCandidate && !isRegiaoMetropolitanaName(municipioCandidate)) {
        return {
          municipio: municipioCandidate,
          bairro: bairroCandidate?.trim() || '—',
        };
      }
    }
  } catch {
    // sem fallback adicional
  }

  return {
    municipio: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    bairro: '—',
  };
}

/** Wrapper legado: resolve apenas o município. */
async function resolveMunicipalityByLatLng(lat: number, lng: number): Promise<string> {
  const r = await resolveBairroMunicipioByLatLng(lat, lng);
  return r.municipio;
}

/** Formata ISO datetime para input datetime-local (YYYY-MM-DDTHH:mm) */
function toInputDateTime(s: string): string {
  if (!s) return '';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}:${min}`;
}

/** Campos exibidos (id, synced, created_at removidos); Checkout não exibe Contrato nem Equipamento */
const ROW_FIELDS = ['contract', 'user', 'equipment', 'identifier', 'operation_type', 'horimeter', 'operation_datetime', 'photo_url', 'latitude', 'longitude', 'observation'] as const;
const FIELDS_CHECKOUT = ['operation_type', 'horimeter', 'operation_datetime', 'photo_url', 'latitude', 'longitude', 'observation'] as const;

const FIELD_LABELS: Record<(typeof ROW_FIELDS)[number], string> = {
  contract: 'Contrato',
  user: 'Usuário',
  equipment: 'Equipamento',
  identifier: 'Ativo/Placa',
  operation_type: 'Operação',
  horimeter: 'Horímetro',
  operation_datetime: 'Data/Hora',
  photo_url: 'Foto',
  latitude: 'Latitude',
  longitude: 'Longitude',
  observation: 'Obs',
};

/** Campos exibidos na tabela (remove Latitude/Longitude; adiciona Município) */
const TABLE_ROW_FIELDS = [
  'contract',
  'equipment',
  'identifier',
  'operation_type',
  'horimeter',
  'operation_datetime',
  'photo_url',
  'municipio',
] as const;

/** Campos exibidos na tabela - checkout (remove Latitude/Longitude; adiciona Município) */
const TABLE_FIELDS_CHECKOUT = ['operation_type', 'horimeter', 'operation_datetime', 'photo_url', 'municipio'] as const;

/** Label equipamento + ativo/placa: equipment_type.name + " – " + ativo_placa (novo fluxo); fallback legado */
function labelOperacao(op: CheckOperation): { equipment: string; identifier: string } {
  if (op.equipment_type?.name != null && op.ativo_placa != null) {
    const nome = String(op.equipment_type.name).trim();
    const ap = String(op.ativo_placa).trim();
    return { equipment: nome || '—', identifier: ap || '—' };
  }
  const inst = op.equipment_instance;
  if (inst) {
    const tipoNome = inst.equipment_type?.name ?? '—';
    const tipoId = inst.identifier_type === 'placa' ? 'Placa' : inst.identifier_type === 'ativo' ? 'Ativo' : '—';
    const valor = inst.identifier_value?.trim() ?? '—';
    return { equipment: tipoNome, identifier: tipoId && valor ? `${tipoId}: ${valor}` : valor };
  }
  return {
    equipment: op.equipment?.name ?? op.equipment_id ?? '—',
    identifier: '—',
  };
}

/** Formata uma operação para célula da tabela */
function toCell(
  op: CheckOperation | undefined,
  usersList: User[],
  identifierMap: Record<string, string>
): Record<string, string | number | undefined> {
  const defaultCell = {
    contract: '—',
    user: '—',
    equipment: '—',
    identifier: '—',
    operation_type: '—',
    horimeter: '—',
    operation_datetime: '—',
    photo_url: '—',
    latitude: '—',
    longitude: '—',
    observation: '—',
  };
  if (!op) return defaultCell;
  const lat = op.latitude != null ? Number(op.latitude) : NaN;
  const lng = op.longitude != null ? Number(op.longitude) : NaN;
  const createdBy = op.created_by_user;
  const createdById = typeof createdBy === 'string' ? createdBy : (createdBy && typeof createdBy === 'object' && 'id' in createdBy ? (createdBy as User).id : undefined);
  const uid = op.user_id ?? (op as { userId?: string }).userId ?? op.user?.id ?? createdById;
  const createdByName = typeof createdBy === 'object' && createdBy != null && 'full_name' in createdBy ? (createdBy as User).full_name : undefined;
  const userName = op.user?.full_name ?? createdByName ?? (uid ? usersList.find((u) => u.id === uid)?.full_name : undefined) ?? (uid ?? '—');
  const { equipment: eqLabel, identifier: idLabel } = labelOperacao(op);
  const equipmentId = op.equipment_id ?? op.equipment?.id ?? op.equipment_instance?.id ?? '';
  return {
    contract: op.contract?.name ?? op.contract_id ?? '—',
    user: String(userName),
    equipment: eqLabel,
    identifier: idLabel !== '—' ? idLabel : (equipmentId ? (identifierMap[equipmentId] ?? '—') : '—'),
    operation_type: op.operation_type === 'checkin' ? 'Abertura' : op.operation_type === 'checkout' ? 'Fechamento' : (op.operation_type ?? '—'),
    horimeter: op.horimeter ?? '—',
    operation_datetime: formatDateDayMonth(op.operation_datetime),
    photo_url: op.photo_url || '—',
    latitude: !Number.isNaN(lat) ? lat.toFixed(5) : '—',
    longitude: !Number.isNaN(lng) ? lng.toFixed(5) : '—',
    observation: op.observation ?? '—',
  };
}

/** Chave única do ativo para parear abertura/fechamento (contrato + usuário + tipo + placa). */
function equipmentMovementKey(op: CheckOperation): string {
  const contract = String(op.contract_id ?? '').trim() || 'sem-contrato';
  const createdBy = op.created_by_user;
  const createdById =
    typeof createdBy === 'string'
      ? createdBy
      : createdBy && typeof createdBy === 'object' && 'id' in createdBy
        ? (createdBy as User).id
        : undefined;
  const user =
    String(op.user_id ?? op.user?.id ?? createdById ?? '').trim() || 'sem-usuario';
  const type = op.equipment_type_id ?? op.equipment_type?.id;
  const plate = String(op.ativo_placa ?? '').trim().toUpperCase();
  if (type && plate) {
    return `${contract}:${user}:${type}:${plate}`;
  }
  const equipmentId = op.equipment_id ?? op.equipment?.id ?? 'sem-equipamento';
  return `${contract}:${user}:legacy:${equipmentId}`;
}

/** Pareia abertura com o próximo fechamento do mesmo ativo/usuário, em ordem cronológica. */
function mergeOperationsByDeviceId(
  operations: CheckOperation[],
  users: User[],
  identifierMap: Record<string, string>
): Array<Record<string, string | number | undefined>> {
  const usersList = Array.isArray(users) ? users : [];
  const sorted = [...operations].sort(
    (a, b) => new Date(a.operation_datetime).getTime() - new Date(b.operation_datetime).getTime(),
  );
  const openQueues = new Map<string, CheckOperation[]>();
  const pairs: Array<{ checkin?: CheckOperation; checkout?: CheckOperation }> = [];

  for (const op of sorted) {
    const key = equipmentMovementKey(op);
    if (op.operation_type === 'checkin') {
      const queue = openQueues.get(key) ?? [];
      queue.push(op);
      openQueues.set(key, queue);
      continue;
    }

    const queue = openQueues.get(key) ?? [];
    const checkin = queue.shift();
    openQueues.set(key, queue);
    pairs.push({ checkin, checkout: op });
  }

  for (const queue of openQueues.values()) {
    for (const checkin of queue) {
      pairs.push({ checkin, checkout: undefined });
    }
  }

  return pairs.map(({ checkin, checkout }) => {
    const c1 = toCell(checkin, usersList, identifierMap);
    const c2 = toCell(checkout, usersList, identifierMap);
    const row: Record<string, string | number | undefined> = {};
    ROW_FIELDS.forEach((f) => {
      row[`${f}1`] = c1[f];
      row[`${f}2`] = c2[f];
    });
    row['id1'] = checkin?.id;
    row['id2'] = checkout?.id;
    return row;
  });
}

/** Timestamp da abertura (check-in) da linha mesclada — para ordenar e agrupar por dia. */
function getOpeningTimestampForMergedRow(
  row: Record<string, string | number | undefined>,
  operations: CheckOperation[]
): number {
  const id1 = row['id1'] as string | undefined;
  const op = id1 ? operations.find((o) => o.id === id1) : undefined;
  if (!op?.operation_datetime) return 0;
  const t = new Date(op.operation_datetime).getTime();
  return Number.isNaN(t) ? 0 : t;
}

async function downloadMovimentacoesExcel(
  operations: CheckOperation[],
  users: User[],
  identifierMap: Record<string, string>,
  mergeFn: (ops: CheckOperation[], u: User[], map: Record<string, string>) => Array<Record<string, string | number | undefined>>,
  cachedLocations: Record<string, { bairro: string; municipio: string }>
) {
  try {
    const EXCEL_OPEN_FIELDS = [
      'operation_datetime',
      'contract',
      'user',
      'equipment',
      'identifier',
      'operation_type',
      'horimeter',
      'photo_url',
      'municipio',
      'observation',
    ] as const;
    const EXCEL_CLOSE_FIELDS = [
      'operation_datetime',
      'operation_type',
      'horimeter',
      'photo_url',
      'municipio',
      'observation',
    ] as const;

    const rows = mergeFn(operations, users ?? [], identifierMap).sort(
      (a, b) =>
        getOpeningTimestampForMergedRow(a, operations) -
        getOpeningTimestampForMergedRow(b, operations)
    );
    const wb = new ExcelJS.Workbook();
    wb.creator = 'BI - Controle de Equipamentos';
    wb.created = new Date();

    const toCoordKey = (latVal: unknown, lngVal: unknown): string | null => {
      const lat = typeof latVal === 'number' ? latVal : Number(String(latVal));
      const lng = typeof lngVal === 'number' ? lngVal : Number(String(lngVal));
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0 || lng === 0) return null;
      return `${lat.toFixed(6)},${lng.toFixed(6)}`;
    };
    const parseCoordKey = (key: string): { lat: number; lng: number } | null => {
      const [latRaw, lngRaw] = key.split(',');
      const lat = Number(latRaw);
      const lng = Number(lngRaw);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return { lat, lng };
    };
    const municipioByCoord = new Map<string, string>();
    Object.entries(cachedLocations ?? {}).forEach(([key, loc]) => {
      const municipio = String(loc?.municipio ?? '').trim();
      if (municipio) municipioByCoord.set(key, municipio);
    });
    const missingCoordKeys = new Set<string>();
    for (const row of rows) {
      const openKey = toCoordKey(row['latitude1'], row['longitude1']);
      const closeKey = toCoordKey(row['latitude2'], row['longitude2']);
      if (openKey && !municipioByCoord.has(openKey)) missingCoordKeys.add(openKey);
      if (closeKey && !municipioByCoord.has(closeKey)) missingCoordKeys.add(closeKey);
    }
    const keysToResolve = Array.from(missingCoordKeys);
    const chunkSize = 6;
    for (let i = 0; i < keysToResolve.length; i += chunkSize) {
      const chunk = keysToResolve.slice(i, i + chunkSize);
      const resolved = await Promise.all(
        chunk.map(async (key) => {
          const parsed = parseCoordKey(key);
          if (!parsed) return { key, municipio: '—' };
          try {
            const loc = await resolveBairroMunicipioByLatLng(parsed.lat, parsed.lng);
            return { key, municipio: String(loc?.municipio ?? '').trim() || '—' };
          } catch {
            return { key, municipio: '—' };
          }
        })
      );
      resolved.forEach(({ key, municipio }) => municipioByCoord.set(key, municipio));
    }
    const getMunicipio = (latVal: unknown, lngVal: unknown): string => {
      const key = toCoordKey(latVal, lngVal);
      if (!key) return '—';
      return municipioByCoord.get(key) ?? '—';
    };

  const headerCheckin = EXCEL_OPEN_FIELDS.map((f) => {
    if (f === 'municipio') return 'Município Abertura';
    if (f === 'contract') return 'Contrato';
    if (f === 'operation_datetime') return 'Data/Hora Abertura';
    if (f === 'user' || f === 'equipment' || f === 'identifier') return FIELD_LABELS[f];
    return `${FIELD_LABELS[f]} Abertura`;
  });
  const headerCheckout = EXCEL_CLOSE_FIELDS.map((f) => {
    if (f === 'municipio') return 'Município Fechamento';
    return `${FIELD_LABELS[f]} Fechamento`;
  });
  const headerRow = [...headerCheckin, ...headerCheckout];
  const photoOpenColumnIndex = EXCEL_OPEN_FIELDS.findIndex((f) => f === 'photo_url') + 1; // 1-based
  const photoCheckoutColumnIndex = EXCEL_OPEN_FIELDS.length + EXCEL_CLOSE_FIELDS.findIndex((f) => f === 'photo_url') + 1;
  const normalizePhotoLink = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const raw = value.trim();
    if (!raw || raw === '—') return null;
    return /^https?:\/\//i.test(raw) ? raw : null;
  };
    const WHITE_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFFFFF' } };
    const LIGHT_GRAY_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFF5F6F7' } };
    const HEADER_GRAY_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFE9ECEF' } };
  const opById = new Map(operations.map((op) => [op.id, op]));
  const toValidDate = (value: string | undefined): Date | null => {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const getMonthKeyFromRow = (row: Record<string, string | number | undefined>): string => {
    const id1 = String(row['id1'] ?? '');
    const id2 = String(row['id2'] ?? '');
    const dateSource =
      opById.get(id1)?.operation_datetime ??
      opById.get(id2)?.operation_datetime ??
      String(row['operation_datetime1'] ?? '');
    const d = new Date(dateSource);
    if (Number.isNaN(d.getTime())) return 'Sem data';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const monthLabel = (monthKey: string): string => {
    if (monthKey === 'Sem data') return monthKey;
    const [y, m] = monthKey.split('-').map(Number);
    if (!Number.isFinite(y) || !Number.isFinite(m)) return monthKey;
    return new Date(y, Math.max(0, m - 1), 1).toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric',
    });
  };

  const makeSheetName = (monthKey: string, usedNames: Set<string>): string => {
    const baseRaw = monthKey === 'Sem data' ? 'Sem Data' : monthLabel(monthKey);
    const base = baseRaw.replace(/[\\/*?:[\]]/g, '-').slice(0, 31).trim() || 'Planilha';
    let name = base;
    let i = 2;
    while (usedNames.has(name)) {
      const suffix = ` (${i})`;
      name = `${base.slice(0, Math.max(1, 31 - suffix.length))}${suffix}`;
      i += 1;
    }
    usedNames.add(name);
    return name;
  };

  const rowsByMonth = new Map<string, Array<Record<string, string | number | undefined>>>();
  for (const row of rows) {
    const key = getMonthKeyFromRow(row);
    const bucket = rowsByMonth.get(key) ?? [];
    bucket.push(row);
    rowsByMonth.set(key, bucket);
  }
  const sortedMonthKeys = Array.from(rowsByMonth.keys()).sort((a, b) => {
    if (a === 'Sem data') return 1;
    if (b === 'Sem data') return -1;
    return b.localeCompare(a);
  });

  const columnWidths = [
    22, // Data/Hora Abertura
    22, // Contrato
    28, // Equipamento
    18, // Ativo/Placa
    16, // Operação Abertura
    14, // Horímetro Abertura
    22, // Data/Hora Abertura
    14, // Foto Abertura
    25, // Município Abertura
    17, // Operação Fechamento
    14, // Horímetro Fechamento
    22, // Data/Hora Fechamento
    15, // Foto Fechamento
    25, // Município Fechamento
  ];

  const usedSheetNames = new Set<string>();
  for (const monthKey of sortedMonthKeys) {
    const monthRows = rowsByMonth.get(monthKey) ?? [];
    const ws = wb.addWorksheet(makeSheetName(monthKey, usedSheetNames), {
      views: [{ state: 'frozen', ySplit: 4 }],
    });

    const headerStartRow = 4;
    const dataStartRow = headerStartRow + 1;
    const lastColumn = headerRow.length;

    ws.mergeCells(1, 1, 1, lastColumn);
    const titleCell = ws.getCell(1, 1);
    titleCell.value = `BI das Movimentações - ${monthLabel(monthKey)}`;
    titleCell.font = { ...EXCEL_FONT, bold: true, size: 14 };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    titleCell.fill = WHITE_FILL;
    titleCell.border = EXCEL_BORDER;

    ws.mergeCells(2, 1, 2, lastColumn);
    const subtitleCell = ws.getCell(2, 1);
    subtitleCell.value = `Gerado em: ${new Date().toLocaleString('pt-BR')} | Registros: ${monthRows.length}`;
    subtitleCell.font = { ...EXCEL_FONT, size: 10, color: { argb: 'FF4B5563' } };
    subtitleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    subtitleCell.fill = LIGHT_GRAY_FILL;
    subtitleCell.border = EXCEL_BORDER;

    ws.getRow(headerStartRow).values = headerRow;
    const headerExcelRow = ws.getRow(headerStartRow);
    headerExcelRow.font = { ...EXCEL_FONT, bold: true };
    headerExcelRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    headerExcelRow.height = 26;
    headerExcelRow.eachCell((cell) => {
      cell.border = EXCEL_BORDER;
      cell.fill = HEADER_GRAY_FILL;
    });

    for (let rowIndex = 0; rowIndex < monthRows.length; rowIndex += 1) {
      const row = monthRows[rowIndex];
      const cellValues: (string | number)[] = [];
      const openingPhotoLink = normalizePhotoLink(row['photo_url1']);
      const checkoutPhotoLink = normalizePhotoLink(row['photo_url2']);

      for (const f of EXCEL_OPEN_FIELDS) {
        if (f === 'municipio') {
          cellValues.push(getMunicipio(row['latitude1'], row['longitude1']));
        } else if (f === 'photo_url') {
          cellValues.push(openingPhotoLink ? 'Abrir foto' : '—');
        } else {
          cellValues.push(String(row[`${f}1`] ?? '—'));
        }
      }
      for (const f of EXCEL_CLOSE_FIELDS) {
        if (f === 'municipio') {
          cellValues.push(getMunicipio(row['latitude2'], row['longitude2']));
        } else if (f === 'photo_url') {
          cellValues.push(checkoutPhotoLink ? 'Abrir foto' : '—');
        } else {
          cellValues.push(String(row[`${f}2`] ?? '—'));
        }
      }

      const excelRow = ws.addRow(cellValues);
      excelRow.font = EXCEL_FONT;
      excelRow.alignment = { vertical: 'middle', horizontal: 'left', wrapText: false };
      excelRow.height = 20;
      const dataRowFill = rowIndex % 2 === 0 ? WHITE_FILL : LIGHT_GRAY_FILL;
      excelRow.eachCell((cell) => {
        cell.border = EXCEL_BORDER;
        cell.fill = dataRowFill;
      });

      if (photoOpenColumnIndex > 0 && openingPhotoLink) {
        const photoCell = excelRow.getCell(photoOpenColumnIndex);
        photoCell.value = { text: 'Abrir foto', hyperlink: openingPhotoLink };
        photoCell.font = { ...EXCEL_FONT, color: { argb: 'FF0563C1' }, underline: true };
        photoCell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
      if (photoCheckoutColumnIndex > 0 && checkoutPhotoLink) {
        const photoCheckoutCell = excelRow.getCell(photoCheckoutColumnIndex);
        photoCheckoutCell.value = { text: 'Abrir foto', hyperlink: checkoutPhotoLink };
        photoCheckoutCell.font = { ...EXCEL_FONT, color: { argb: 'FF0563C1' }, underline: true };
        photoCheckoutCell.alignment = { vertical: 'middle', horizontal: 'center' };
      }

      const op1 = opById.get(String(row['id1'] ?? ''));
      const op2 = opById.get(String(row['id2'] ?? ''));
      const openDate = toValidDate(op1?.operation_datetime);
      const closeDate = toValidDate(op2?.operation_datetime);
      const openDateColumnIndex = EXCEL_OPEN_FIELDS.findIndex((f) => f === 'operation_datetime') + 1;
      const closeDateColumnIndex =
        EXCEL_OPEN_FIELDS.length +
        EXCEL_CLOSE_FIELDS.findIndex((f) => f === 'operation_datetime') +
        1;

      if (openDate && openDateColumnIndex > 0) {
        const openDateCell = excelRow.getCell(openDateColumnIndex);
        openDateCell.value = openDate;
        openDateCell.numFmt = 'dd/mm/yyyy hh:mm';
      }
      if (closeDate && closeDateColumnIndex > 0) {
        const closeDateCell = excelRow.getCell(closeDateColumnIndex);
        closeDateCell.value = closeDate;
        closeDateCell.numFmt = 'dd/mm/yyyy hh:mm';
      }
    }

    ws.columns.forEach((col, idx) => {
      col.width = columnWidths[idx] ?? 14;
    });

    const dataEndRow = Math.max(dataStartRow, ws.rowCount);
    ws.autoFilter = {
      from: { row: headerStartRow, column: 1 },
      to: { row: headerStartRow, column: lastColumn },
    };
  }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `movimentacoes-${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Erro ao exportar Excel:', error);
    window.alert('Não foi possível exportar o Excel agora. Tente novamente em alguns segundos.');
  }
}

const BI: React.FC = () => {
  const [contracts, setContracts] = React.useState<Contract[]>([]);
  const [operations, setOperations] = React.useState<CheckOperation[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = React.useState<string | null>(null);
  const [photoPreviewBlobUrl, setPhotoPreviewBlobUrl] = React.useState<string | null>(null);
  const [photoPreviewError, setPhotoPreviewError] = React.useState(false);
  const [photoZoom, setPhotoZoom] = React.useState(1);
  const [photoRotation, setPhotoRotation] = React.useState(0);
  const [photoPanX, setPhotoPanX] = React.useState(0);
  const [photoPanY, setPhotoPanY] = React.useState(0);
  const [isPhotoDragging, setIsPhotoDragging] = React.useState(false);
  const photoDragStartRef = React.useRef({ startX: 0, startY: 0, startPanX: 0, startPanY: 0 });
  const photoBlobUrlRef = React.useRef<string | null>(null);
  const [filterEquipmentId, setFilterEquipmentId] = React.useState<string>('');
  const [filterUserId, setFilterUserId] = React.useState<string>('');
  const [equipments, setEquipments] = React.useState<Equipment[]>([]);
  const [users, setUsers] = React.useState<User[]>([]);
  const [filterContractId, setFilterContractId] = React.useState<string>('');
  const [filterTipoId, setFilterTipoId] = React.useState<string>('');
  const [filterDateFrom, setFilterDateFrom] = React.useState<string>('');
  const [filterDateTo, setFilterDateTo] = React.useState<string>('');
  const [filterOperationType, setFilterOperationType] = React.useState<'' | 'checkin' | 'checkout'>('');
  const [filterIdentifierLabel, setFilterIdentifierLabel] = React.useState<string>('');
  const [selectedRowKeys, setSelectedRowKeys] = React.useState<Set<string>>(new Set());
  const [equipmentTypes, setEquipmentTypes] = React.useState<EquipmentType[]>([]);
  const [editRowKey, setEditRowKey] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);
  const [editFormOp1, setEditFormOp1] = React.useState({ operation_datetime: '', horimeter: '', observation: '' });
  const [editFormOp2, setEditFormOp2] = React.useState<{ operation_datetime: string; horimeter: string; observation: string } | null>(null);
  const [equipmentIdentifierMap, setEquipmentIdentifierMap] = React.useState<Record<string, string>>({});
  const [locationByCoordKey, setLocationByCoordKey] = React.useState<Record<string, { bairro: string; municipio: string }>>({});
  const pendingLocationsRef = React.useRef<Set<string>>(new Set());

  const fetchContracts = async () => {
    try {
      const list = await contractsApi.getAll();
      setContracts(list);
    } catch {
      setContracts([]);
    }
  };

  const fetchOperations = React.useCallback(
    async (
      contractId: string,
      equipmentId: string,
      userId: string,
      dateFrom: string,
      dateTo: string,
      operationType: '' | 'checkin' | 'checkout'
    ) => {
      setLoading(true);
      setError(null);
      try {
        let list: CheckOperation[];
        if (contractId.trim()) {
          try {
            list = await operationsApi.getByContract(contractId);
          } catch {
            list = await operationsApi.list({ contract_id: contractId, limit: 2000 });
          }
        } else {
          const dateFromIso = dateFrom.trim() ? `${dateFrom.trim()}T00:00:00` : undefined;
          const dateToIso = dateTo.trim() ? `${dateTo.trim()}T23:59:59` : undefined;
          list = await operationsApi.list({
            equipment_id: equipmentId || undefined,
            user_id: userId || undefined,
            date_from: dateFromIso,
            date_to: dateToIso,
            limit: 2000,
          });
        }
        let filtered = list;
        if (contractId.trim() !== '') {
          filtered = filtered.filter(
            (op) => String(op.contract_id ?? op.contract?.id ?? '') === String(contractId)
          );
        }
        if (equipmentId.trim() !== '') {
          filtered = filtered.filter(
            (op) =>
              String(op.equipment_id ?? op.equipment?.id ?? op.equipment_instance?.id ?? '') === String(equipmentId)
          );
        }
        if (userId.trim() !== '') {
          filtered = filtered.filter((op) => {
            const createdBy = op.created_by_user;
            const createdById = typeof createdBy === 'string' ? createdBy : createdBy?.id;
            const opUid = op.user_id ?? (op as { userId?: string }).userId ?? op.user?.id ?? createdById;
            return String(opUid ?? '') === String(userId);
          });
        }
        if (dateFrom.trim() || dateTo.trim()) {
          filtered = filtered.filter((op) => {
            const opDate = op.operation_datetime ? new Date(op.operation_datetime).getTime() : NaN;
            if (Number.isNaN(opDate)) return false;
            if (dateFrom.trim()) {
              const from = new Date(`${dateFrom.trim()}T00:00:00`).getTime();
              if (opDate < from) return false;
            }
            if (dateTo.trim()) {
              const to = new Date(`${dateTo.trim()}T23:59:59`).getTime();
              if (opDate > to) return false;
            }
            return true;
          });
        }
        if (operationType === 'checkin') {
          filtered = filtered.filter((op) => op.operation_type === 'checkin');
        } else if (operationType === 'checkout') {
          filtered = filtered.filter((op) => op.operation_type === 'checkout');
        }
        setOperations(filtered);
      } catch (e) {
        setOperations([]);
        setError('Erro ao carregar movimentações. Verifique se o backend expõe GET /api/check-operations.');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchContracts();
    authApi.getUsers().then(setUsers).catch(() => setUsers([]));
  }, []);

  useEffect(() => {
    fetchOperations(filterContractId, filterEquipmentId, filterUserId, filterDateFrom, filterDateTo, filterOperationType);
  }, [filterContractId, filterEquipmentId, filterUserId, filterDateFrom, filterDateTo, filterOperationType, fetchOperations]);

  // Tipos de equipamento: da API; se vazio, usa os que aparecem nas operações (fallback)
  useEffect(() => {
    equipmentStructureApi.getEquipmentTypes().then(setEquipmentTypes).catch(() => setEquipmentTypes([]));
  }, []);

  /** Tipos que aparecem nas operações (fallback quando a API não retorna nada) */
  const typesFromOperations = React.useMemo(() => {
    const seen = new Set<string>();
    const list: EquipmentType[] = [];
    operations.forEach((op) => {
      const t = op.equipment_type ?? op.equipment_instance?.equipment_type;
      if (t?.id && t?.name && !seen.has(t.id)) {
        seen.add(t.id);
        list.push({ id: t.id, name: t.name });
      }
    });
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [operations]);

  /** Lista final para os filtros Equipamento e Tipo: API ou fallback das operações */
  const equipmentTypesForFilter = equipmentTypes.length > 0 ? equipmentTypes : typesFromOperations;

  // Mapa de identificador: equipment_instance (legado) ou getByContract (legado); novo fluxo usa equipment_type + ativo_placa
  useEffect(() => {
    const hasInstance = operations.some((op) => op.equipment_instance);
    const allNew = operations.length > 0 && operations.every((op) => op.equipment_type != null && op.ativo_placa != null);
    if (allNew) {
      setEquipmentIdentifierMap({});
      return;
    }
    if (hasInstance) {
      const map: Record<string, string> = {};
      operations.forEach((op) => {
        const inst = op.equipment_instance;
        if (inst) {
          const tipoId = inst.identifier_type === 'placa' ? 'Placa' : inst.identifier_type === 'ativo' ? 'Ativo' : '—';
          const valor = inst.identifier_value?.trim() ?? '—';
          const label = tipoId && valor ? `${tipoId}: ${valor}` : valor;
          map[inst.id] = label;
          if (op.equipment_id) map[op.equipment_id] = label;
        }
      });
      setEquipmentIdentifierMap(map);
      return;
    }
    const contractIds = Array.from(new Set(operations.map((op) => op.contract_id ?? op.contract?.id).filter(Boolean) as string[]));
    if (contractIds.length === 0) {
      setEquipmentIdentifierMap({});
      return;
    }
    let cancelled = false;
    Promise.all(contractIds.map((id) => equipmentsApi.getByContract(id)))
      .then((equipmentLists) => {
        if (cancelled) return;
        const map: Record<string, string> = {};
        equipmentLists.flat().forEach((eq) => {
          const tipo = eq.identifier_type === 'placa' ? 'Placa' : eq.identifier_type === 'ativo' ? 'Ativo' : null;
          const valor = eq.identifier_value?.trim() || '';
          map[eq.id] = tipo && (valor || tipo) ? `${tipo}: ${valor || '—'}` : valor || '—';
        });
        setEquipmentIdentifierMap(map);
      })
      .catch(() => {
        if (!cancelled) setEquipmentIdentifierMap({});
      });
    return () => {
      cancelled = true;
    };
  }, [operations]);

  /** Operações filtradas por Equipamento (tipo), Tipo equip. e Ativo/Placa */
  const displayedOperations = React.useMemo(() => {
    let list = operations;
    const tipoId = filterEquipmentId.trim() || filterTipoId.trim();
    if (tipoId) {
      list = list.filter((op) => op.equipment_type?.id === tipoId || op.equipment_instance?.equipment_type?.id === tipoId);
    }
    if (filterIdentifierLabel.trim()) {
      list = list.filter((op) => {
        const ap = op.ativo_placa?.trim();
        if (ap !== undefined && ap !== '') return ap === filterIdentifierLabel;
        return equipmentIdentifierMap[op.equipment_id ?? op.equipment?.id ?? op.equipment_instance?.id ?? ''] === filterIdentifierLabel;
      });
    }
    return list;
  }, [operations, filterEquipmentId, filterTipoId, filterIdentifierLabel, equipmentIdentifierMap]);

  const locationByCoordKeyRef = React.useRef(locationByCoordKey);
  React.useEffect(() => {
    locationByCoordKeyRef.current = locationByCoordKey;
  }, [locationByCoordKey]);

  const coordKeyFromLatLng = React.useCallback((lat: number, lng: number) => `${lat.toFixed(5)}|${lng.toFixed(5)}`, []);

  // Pré-carrega município pelas coordenadas (cache por lat/lng arredondada)
  React.useEffect(() => {
    let cancelled = false;
    const unique: Record<string, { lat: number; lng: number }> = {};

    for (const op of displayedOperations) {
      const lat = Number(op.latitude);
      const lng = Number(op.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0 || lng === 0) continue;
      const key = coordKeyFromLatLng(lat, lng);
      unique[key] = unique[key] ?? { lat, lng };
    }

    const entries = Object.entries(unique).filter(([key]) => locationByCoordKeyRef.current[key] == null);
    if (entries.length === 0) return;

    entries.forEach(([key]) => pendingLocationsRef.current.add(key));

    (async () => {
      // Concorrência baixa para respeitar cota do Geocoding
      const CONCURRENCY = 2;
      for (let i = 0; i < entries.length; i += CONCURRENCY) {
        if (cancelled) return;
        const batch = entries.slice(i, i + CONCURRENCY);
        const results = await Promise.allSettled(
          batch.map(async ([key, { lat, lng }]) => {
            const loc = await resolveBairroMunicipioByLatLng(lat, lng);
            return [key, loc] as const;
          })
        );
        if (cancelled) return;

        setLocationByCoordKey((prev) => {
          const next = { ...prev };
          for (const r of results) {
            if (r.status === 'fulfilled') {
              const [key, loc] = r.value;
              next[key] = loc;
              pendingLocationsRef.current.delete(key);
            }
          }
          return next;
        });

        if (i + CONCURRENCY < entries.length) {
          await new Promise((resolve) => setTimeout(resolve, 120));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [displayedOperations, coordKeyFromLatLng]);

  const getMunicipioFromMergedRow = React.useCallback(
    (row: Record<string, string | number | undefined>, suffix: '1' | '2'): string => {
      const lat = Number(row[`latitude${suffix}`]);
      const lng = Number(row[`longitude${suffix}`]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0 || lng === 0) return '—';
      const key = coordKeyFromLatLng(lat, lng);
      const loc = locationByCoordKey[key];
      return loc?.municipio ?? (pendingLocationsRef.current.has(key) ? 'Carregando município...' : '—');
    },
    [coordKeyFromLatLng, locationByCoordKey]
  );

  const mergedRows = React.useMemo(() => {
    const rows = mergeOperationsByDeviceId(displayedOperations, users ?? [], equipmentIdentifierMap);
    rows.sort(
      (a, b) =>
        getOpeningTimestampForMergedRow(b, displayedOperations) -
        getOpeningTimestampForMergedRow(a, displayedOperations)
    );
    return rows;
  }, [displayedOperations, users, equipmentIdentifierMap]);

  /** Agrupa linhas por dia da abertura (ordem já é por data/hora da abertura, mais recente primeiro). */
  const rowKey = (row: Record<string, string | number | undefined>) =>
    String(row['id1'] ?? row['id2'] ?? '');

  /** Opções do filtro Ativo/Placa: valores únicos (ativo_placa ou legado) nas operações */
  const identifierFilterOptions = React.useMemo(() => {
    const labels = new Set<string>();
    operations.forEach((op) => {
      const ap = op.ativo_placa?.trim();
      if (ap) labels.add(ap);
      else {
        const label = equipmentIdentifierMap[op.equipment_id ?? op.equipment?.id ?? ''];
        if (label && label !== '—') labels.add(label);
      }
    });
    return Array.from(labels).sort();
  }, [operations, equipmentIdentifierMap]);

  const handleToggleRow = (key: string) => {
    setSelectedRowKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleToggleAllRows = () => {
    if (selectedRowKeys.size >= mergedRows.length) {
      setSelectedRowKeys(new Set());
    } else {
      setSelectedRowKeys(new Set(mergedRows.map((r) => rowKey(r))));
    }
  };

  const handleOpenEdit = () => {
    if (selectedRowKeys.size !== 1) return;
    const key = Array.from(selectedRowKeys)[0];
    const row = mergedRows.find((r) => rowKey(r) === key);
    const op1 = row ? operations.find((o) => o.id === row['id1']) : null;
    const op2 = row && row['id2'] ? operations.find((o) => o.id === row['id2']) : null;
    setEditRowKey(key);
    setEditError(null);
    if (op1) setEditFormOp1({ operation_datetime: toInputDateTime(op1.operation_datetime), horimeter: String(op1.horimeter), observation: op1.observation ?? '' });
    else setEditFormOp1({ operation_datetime: '', horimeter: '', observation: '' });
    if (op2) setEditFormOp2({ operation_datetime: toInputDateTime(op2.operation_datetime), horimeter: String(op2.horimeter), observation: op2.observation ?? '' });
    else setEditFormOp2(null);
  };

  const handleCloseEdit = () => {
    setEditRowKey(null);
    setEditError(null);
  };

  const handleSaveEdit = async (payload: {
    id1: string;
    id2: string | null;
    op1: { operation_datetime: string; horimeter: string; observation: string };
    op2: { operation_datetime: string; horimeter: string; observation: string } | null;
  }) => {
    setEditing(true);
    setEditError(null);
    try {
      const toIso = (s: string) => (s ? new Date(s).toISOString() : '');
      await operationsApi.update(payload.id1, {
        operation_datetime: toIso(payload.op1.operation_datetime),
        horimeter: Number(payload.op1.horimeter) || 0,
        observation: payload.op1.observation || undefined,
      });
      if (payload.id2 && payload.op2) {
        await operationsApi.update(payload.id2, {
          operation_datetime: toIso(payload.op2.operation_datetime),
          horimeter: Number(payload.op2.horimeter) || 0,
          observation: payload.op2.observation || undefined,
        });
      }
      setOperations((prev) =>
        prev.map((op) => {
          if (op.id === payload.id1) {
            return {
              ...op,
              operation_datetime: toIso(payload.op1.operation_datetime),
              horimeter: Number(payload.op1.horimeter) || 0,
              observation: payload.op1.observation || undefined,
            };
          }
          if (payload.id2 && op.id === payload.id2 && payload.op2) {
            return {
              ...op,
              operation_datetime: toIso(payload.op2.operation_datetime),
              horimeter: Number(payload.op2.horimeter) || 0,
              observation: payload.op2.observation || undefined,
            };
          }
          return op;
        })
      );
      handleCloseEdit();
    } catch (e: unknown) {
      const msg =
        (e as { message?: string })?.message ??
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        String(e);
      setEditError(msg || 'Não foi possível salvar a edição.');
    } finally {
      setEditing(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedRowKeys.size === 0 || deleting) return;
    const confirmed = window.confirm('vc tem certeza disso?');
    if (!confirmed) return;

    const idsToDelete = new Set<string>();
    mergedRows.forEach((row) => {
      if (!selectedRowKeys.has(rowKey(row))) return;
      const id1 = row['id1'] as string | undefined;
      const id2 = row['id2'] as string | undefined;
      if (id1) idsToDelete.add(id1);
      if (id2) idsToDelete.add(id2);
    });
    const ids = Array.from(idsToDelete);
    if (ids.length === 0) return;

    setDeleting(true);
    setError(null);
    try {
      await operationsApi.deleteMany(ids);
      setOperations((prev) => prev.filter((op) => !idsToDelete.has(op.id)));
      setSelectedRowKeys(new Set());
    } catch {
      setError('Erro ao excluir movimentações selecionadas.');
    } finally {
      setDeleting(false);
    }
  };

  // Busca a foto com token para o modal (img src direto não envia Authorization)
  React.useEffect(() => {
    if (!photoPreviewUrl) {
      if (photoBlobUrlRef.current) {
        URL.revokeObjectURL(photoBlobUrlRef.current);
        photoBlobUrlRef.current = null;
      }
      setPhotoPreviewBlobUrl(null);
      setPhotoPreviewError(false);
      setPhotoZoom(1);
      setPhotoRotation(0);
      setPhotoPanX(0);
      setPhotoPanY(0);
      return;
    }
    setPhotoPreviewBlobUrl(null);
    setPhotoPreviewError(false);
    setPhotoZoom(1);
    setPhotoRotation(0);
    setPhotoPanX(0);
    setPhotoPanY(0);
    client
      .get(photoPreviewUrl, { responseType: 'blob' })
      .then((res) => {
        const url = URL.createObjectURL(res.data);
        if (photoBlobUrlRef.current) URL.revokeObjectURL(photoBlobUrlRef.current);
        photoBlobUrlRef.current = url;
        setPhotoPreviewBlobUrl(url);
      })
      .catch(() => {
        setPhotoPreviewBlobUrl(null);
        setPhotoPreviewError(true);
      });
    return () => {
      if (photoBlobUrlRef.current) {
        URL.revokeObjectURL(photoBlobUrlRef.current);
        photoBlobUrlRef.current = null;
      }
    };
  }, [photoPreviewUrl]);

  // Arrastar a foto com o mouse: listeners globais enquanto isPhotoDragging
  React.useEffect(() => {
    if (!isPhotoDragging) return;
    const onMove = (e: MouseEvent) => {
      const { startX, startY, startPanX, startPanY } = photoDragStartRef.current;
      setPhotoPanX(startPanX + (e.clientX - startX));
      setPhotoPanY(startPanY + (e.clientY - startY));
    };
    const onUp = () => setIsPhotoDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isPhotoDragging]);

  return (
    <div className="space-y-6">
      {/* Header: logo (topo esquerdo) e título na mesma altura; filtros centralizados abaixo */}
      <header className="border-b border-gray-200 dark:border-gray-600 pb-4 space-y-5">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 min-h-[3.5rem]">
          <div className="flex justify-start">
            <img
              src={LOGO_SRC}
              alt="Dimensional Engenharia - Empresa Carbono Neutro - Nossa qualidade faz a diferença"
              className="h-14 w-auto max-h-14 object-contain object-left"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white text-center">
            BI das Movimentações
          </h1>
          <div />
        </div>
        <div className="flex justify-center">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-2">
              <label htmlFor="bi-equipment-filter" className="text-sm font-medium text-gray-700 dark:text-white whitespace-nowrap">
                Equipamento
              </label>
              <select
                id="bi-equipment-filter"
                value={filterEquipmentId}
                onChange={(e) => setFilterEquipmentId(e.target.value)}
                className="rounded-lg border border-gray-300 dark:border-gray-500 px-3 py-2 text-sm w-[200px] bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-red-600 focus:border-blue-500 dark:focus:border-red-600"
              >
                <option value="">Todos</option>
                {equipmentTypesForFilter.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="bi-identifier-filter" className="text-sm font-medium text-gray-700 dark:text-white whitespace-nowrap">
                Ativo/Placa
              </label>
              <select
                id="bi-identifier-filter"
                value={filterIdentifierLabel}
                onChange={(e) => setFilterIdentifierLabel(e.target.value)}
                className="rounded-lg border border-gray-300 dark:border-gray-500 px-3 py-2 text-sm w-[180px] bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-red-600 focus:border-blue-500 dark:focus:border-red-600"
              >
                <option value="">Todos</option>
                {identifierFilterOptions.map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="bi-user-filter" className="text-sm font-medium text-gray-700 dark:text-white whitespace-nowrap">
                Usuário
              </label>
              <select
                id="bi-user-filter"
                value={filterUserId}
                onChange={(e) => setFilterUserId(e.target.value)}
                className="rounded-lg border border-gray-300 dark:border-gray-500 px-3 py-2 text-sm w-[160px] bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-red-600 focus:border-blue-500 dark:focus:border-red-600"
              >
                <option value="">Todos</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="bi-contract-filter" className="text-sm font-medium text-gray-700 dark:text-white whitespace-nowrap">
                Contrato
              </label>
              <select
                id="bi-contract-filter"
                value={filterContractId}
                onChange={(e) => setFilterContractId(e.target.value)}
                className="rounded-lg border border-gray-300 dark:border-gray-500 px-3 py-2 text-sm w-[160px] bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-red-600 focus:border-blue-500 dark:focus:border-red-600"
              >
                <option value="">Todos</option>
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="bi-tipo-filter" className="text-sm font-medium text-gray-700 dark:text-white whitespace-nowrap">
                Tipo equip.
              </label>
              <select
                id="bi-tipo-filter"
                value={filterTipoId}
                onChange={(e) => setFilterTipoId(e.target.value)}
                className="rounded-lg border border-gray-300 dark:border-gray-500 px-3 py-2 text-sm w-[180px] bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-red-600 focus:border-blue-500 dark:focus:border-red-600"
              >
                <option value="">Todos</option>
                {equipmentTypesForFilter.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="bi-operation-type-filter" className="text-sm font-medium text-gray-700 dark:text-white whitespace-nowrap">
                Tipo
              </label>
              <select
                id="bi-operation-type-filter"
                value={filterOperationType}
                onChange={(e) => setFilterOperationType((e.target.value || '') as '' | 'checkin' | 'checkout')}
                className="rounded-lg border border-gray-300 dark:border-gray-500 px-3 py-2 text-sm w-[140px] bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-red-600 focus:border-blue-500 dark:focus:border-red-600"
              >
                <option value="">Todos</option>
                <option value="checkin">Abertura</option>
                <option value="checkout">Fechamento</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="bi-date-from" className="text-sm font-medium text-gray-700 dark:text-white whitespace-nowrap">
                Período
              </label>
              <input
                id="bi-date-from"
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="rounded-lg border border-gray-300 dark:border-gray-500 px-3 py-2 text-sm w-[140px] bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-red-600 focus:border-blue-500 dark:focus:border-red-600"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-white">até</span>
              <input
                id="bi-date-to"
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="rounded-lg border border-gray-300 dark:border-gray-500 px-3 py-2 text-sm w-[140px] bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-red-600 focus:border-blue-500 dark:focus:border-red-600"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setFilterEquipmentId('');
                setFilterIdentifierLabel('');
                setFilterTipoId('');
                setFilterUserId('');
                setFilterContractId('');
                setFilterOperationType('');
                setFilterDateFrom('');
                setFilterDateTo('');
              }}
              className="rounded-lg border border-gray-300 dark:border-gray-500 bg-gray-100 dark:bg-gray-600 px-3 py-2 text-sm font-medium text-gray-700 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-red-600 focus:border-blue-500 dark:focus:border-red-600"
            >
              Limpar filtros
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-200 px-4 py-2 text-sm">
          {error}
        </div>
      )}

      {/* Modal Editar movimentação */}
      {editRowKey && (() => {
        const row = mergedRows.find((r) => rowKey(r) === editRowKey);
        const id1 = row?.['id1'] as string | undefined;
        const id2 = row?.['id2'] as string | undefined;
        return (
          <div
            className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={handleCloseEdit}
            role="dialog"
            aria-modal="true"
            aria-label="Editar movimentação"
          >
            <div
              className="bg-white dark:bg-gray-600 rounded-xl shadow-xl border border-gray-200 dark:border-gray-500 w-full max-w-lg max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-500">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Editar movimentação</h2>
                <button
                  type="button"
                  onClick={handleCloseEdit}
                  className="p-1.5 rounded-lg text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-500 hover:text-gray-700 dark:hover:text-white"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form
                className="p-4 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (id1) handleSaveEdit({ id1, id2: id2 ?? null, op1: editFormOp1, op2: editFormOp2 });
                }}
              >
                {editError && (
                  <div className="rounded-lg bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-200 px-3 py-2 text-sm">{editError}</div>
                )}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-white">Abertura (check-in)</h3>
                  <div className="grid gap-2">
                    <label className="text-sm text-gray-600 dark:text-gray-200">Data e hora</label>
                    <input
                      type="datetime-local"
                      value={editFormOp1.operation_datetime}
                      onChange={(e) => setEditFormOp1((p) => ({ ...p, operation_datetime: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-500 px-3 py-2 text-sm bg-white dark:bg-gray-500 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-red-600 focus:border-blue-500 dark:focus:border-red-600"
                    />
                    <label className="text-sm text-gray-600 dark:text-gray-200">Horímetro</label>
                    <input
                      type="number"
                      min={0}
                      value={editFormOp1.horimeter}
                      onChange={(e) => setEditFormOp1((p) => ({ ...p, horimeter: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-500 px-3 py-2 text-sm bg-white dark:bg-gray-500 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-red-600 focus:border-blue-500 dark:focus:border-red-600"
                    />
                    <label className="text-sm text-gray-600 dark:text-gray-200">Observação</label>
                    <input
                      type="text"
                      value={editFormOp1.observation}
                      onChange={(e) => setEditFormOp1((p) => ({ ...p, observation: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-500 px-3 py-2 text-sm bg-white dark:bg-gray-500 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-red-600 focus:border-blue-500 dark:focus:border-red-600"
                      placeholder="Opcional"
                    />
                  </div>
                </div>
                {editFormOp2 && (
                  <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-500">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-white">Fechamento (check-out)</h3>
                    <div className="grid gap-2">
                      <label className="text-sm text-gray-600 dark:text-gray-200">Data e hora</label>
                      <input
                        type="datetime-local"
                        value={editFormOp2.operation_datetime}
                        onChange={(e) => setEditFormOp2((p) => p && { ...p, operation_datetime: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-500 px-3 py-2 text-sm bg-white dark:bg-gray-500 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-red-600 focus:border-blue-500 dark:focus:border-red-600"
                      />
                      <label className="text-sm text-gray-600 dark:text-gray-200">Horímetro</label>
                      <input
                        type="number"
                        min={0}
                        value={editFormOp2.horimeter}
                        onChange={(e) => setEditFormOp2((p) => p && { ...p, horimeter: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-500 px-3 py-2 text-sm bg-white dark:bg-gray-500 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-red-600 focus:border-blue-500 dark:focus:border-red-600"
                      />
                      <label className="text-sm text-gray-600 dark:text-gray-200">Observação</label>
                      <input
                        type="text"
                        value={editFormOp2.observation}
                        onChange={(e) => setEditFormOp2((p) => p && { ...p, observation: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-500 px-3 py-2 text-sm bg-white dark:bg-gray-500 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-red-600 focus:border-blue-500 dark:focus:border-red-600"
                        placeholder="Opcional"
                      />
                    </div>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleCloseEdit}
                    className="flex-1 rounded-lg border border-gray-300 dark:border-gray-500 px-3 py-2 text-sm font-medium text-gray-700 dark:text-white bg-white dark:bg-gray-500 hover:bg-gray-50 dark:hover:bg-gray-400"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={editing}
                    className="flex-1 rounded-lg border border-transparent px-3 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-red-800 hover:bg-blue-700 dark:hover:bg-red-700 focus:ring-2 focus:ring-blue-500 dark:focus:ring-red-600 disabled:opacity-50"
                  >
                    {editing ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white dark:bg-gray-600 rounded-lg shadow border border-gray-100 dark:border-gray-500 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-500 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-semibold text-gray-800 dark:text-white">Movimentações</span>
              {!loading && (
                <span className="text-sm text-gray-500 dark:text-gray-200">
                  {mergedRows.length} {mergedRows.length === 1 ? 'movimentação' : 'movimentações'}
                </span>
              )}
              {selectedRowKeys.size > 0 && (
                <>
                  {selectedRowKeys.size === 1 && (
                    <button
                      type="button"
                      onClick={handleOpenEdit}
                      className="rounded-lg border border-blue-300 dark:border-red-600 bg-blue-50 dark:bg-red-900/40 px-3 py-1.5 text-sm font-medium text-blue-700 dark:text-red-100 shadow-sm hover:bg-blue-100 dark:hover:bg-red-800/50 focus:ring-2 focus:ring-blue-500 dark:focus:ring-red-500"
                    >
                      Editar selecionada
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleDeleteSelected}
                    disabled={deleting}
                    className="rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/40 px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-100 shadow-sm hover:bg-red-100 dark:hover:bg-red-800/50 focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deleting ? 'Excluindo...' : 'Excluir selecionados'}
                  </button>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => downloadMovimentacoesExcel(displayedOperations, users, equipmentIdentifierMap, mergeOperationsByDeviceId, locationByCoordKey)}
              disabled={loading || displayedOperations.length === 0}
              className="rounded-lg border border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-500 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-white shadow-sm hover:bg-gray-50 dark:hover:bg-gray-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Exportar Excel
            </button>
          </div>
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-500 sticky top-0">
                <tr>
                  <th className="w-10 px-2 py-2">
                    <input
                      type="checkbox"
                      checked={mergedRows.length > 0 && selectedRowKeys.size === mergedRows.length}
                      onChange={handleToggleAllRows}
                      className="rounded border-gray-300 dark:border-gray-400 text-blue-600 dark:text-red-400 focus:ring-blue-500 dark:focus:ring-red-500"
                      aria-label="Selecionar todas"
                    />
                  </th>
                  {TABLE_ROW_FIELDS.map((f) => (
                    <th key={`${f}1`} className="text-left px-3 py-2 font-medium text-gray-700 dark:text-white whitespace-nowrap">
                      {f === 'municipio'
                        ? 'Município Abertura'
                        : f === 'contract' || f === 'equipment' || f === 'identifier'
                          ? FIELD_LABELS[f]
                          : `${FIELD_LABELS[f]} Abertura`}
                    </th>
                  ))}
                  {TABLE_FIELDS_CHECKOUT.map((f) => (
                    <th key={`${f}2`} className="text-left px-3 py-2 font-medium text-gray-700 dark:text-white whitespace-nowrap">
                      {f === 'municipio' ? 'Município Fechamento' : `${FIELD_LABELS[f]} Fechamento`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={1 + TABLE_ROW_FIELDS.length + TABLE_FIELDS_CHECKOUT.length} className="px-3 py-8 text-center text-gray-500 dark:text-gray-200">
                      Carregando...
                    </td>
                  </tr>
                ) : displayedOperations.length === 0 ? (
                  <tr>
                    <td colSpan={1 + TABLE_ROW_FIELDS.length + TABLE_FIELDS_CHECKOUT.length} className="px-3 py-8 text-center text-gray-500 dark:text-gray-200">
                      Nenhuma movimentação no período.
                    </td>
                  </tr>
                ) : (
                  mergedRows.map((row, index) => {
                    const key = rowKey(row);
                    return (
                    <tr key={`${key}-${index}`} className="border-t border-gray-100 dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-500/80 whitespace-nowrap">
                      <td className="w-10 px-2 py-2">
                        <input
                          type="checkbox"
                          checked={selectedRowKeys.has(key)}
                          onChange={() => handleToggleRow(key)}
                          className="rounded border-gray-300 dark:border-gray-400 text-blue-600 dark:text-red-400 focus:ring-blue-500 dark:focus:ring-red-500"
                          aria-label="Selecionar movimentação"
                        />
                      </td>
                      {TABLE_ROW_FIELDS.map((f) => {
                        const val = row[`${f}1`];
                        if (f === 'photo_url') {
                          const operationId1 = row['id1'] as string | undefined;
                          const url = operationPhotoUrl(operationId1);
                          const hasPhoto = val != null && String(val).trim() !== '' && String(val) !== '—';
                          const photoName = hasPhoto ? String(val).split('/').pop() ?? String(val) : '—';
                          return (
                            <td key="photo_url1" className="px-3 py-2 text-gray-700 dark:text-white max-w-[120px] truncate">
                              {url && hasPhoto ? (
                                <button
                                  type="button"
                                  onClick={() => setPhotoPreviewUrl(url)}
                                  className="text-blue-600 dark:text-red-300 hover:underline truncate block max-w-full text-left"
                                  title="Ver foto"
                                >
                                  {photoName}
                                </button>
                              ) : (
                                <span title={String(val ?? '')}>{photoName}</span>
                              )}
                            </td>
                          );
                        }
                        if (f === 'municipio') {
                          const municipio = getMunicipioFromMergedRow(row, '1');
                          return (
                            <td key="municipio1" className="px-3 py-2 text-gray-700 dark:text-white max-w-[160px] truncate" title={municipio}>
                              {municipio}
                            </td>
                          );
                        }
                        return (
                          <td key={`${f}1`} className="px-3 py-2 text-gray-700 dark:text-white max-w-[120px] truncate" title={String(val ?? '')}>{val ?? '—'}</td>
                        );
                      })}
                      {TABLE_FIELDS_CHECKOUT.map((f) => {
                        if (f === 'photo_url') {
                          const val2 = row[`${f}2`];
                          const operationId2 = row['id2'] as string | undefined;
                          const url2 = operationPhotoUrl(operationId2);
                          const hasPhoto2 = val2 != null && String(val2).trim() !== '' && String(val2) !== '—';
                          const photoName2 = hasPhoto2 ? String(val2).split('/').pop() ?? String(val2) : '—';
                          return (
                            <td key="photo_url2" className="px-3 py-2 text-gray-700 dark:text-white max-w-[120px] truncate">
                              {url2 && hasPhoto2 ? (
                                <button
                                  type="button"
                                  onClick={() => setPhotoPreviewUrl(url2)}
                                  className="text-blue-600 dark:text-red-300 hover:underline truncate block max-w-full text-left"
                                  title="Ver foto"
                                >
                                  {photoName2}
                                </button>
                              ) : (
                                <span title={String(val2 ?? '')}>{photoName2}</span>
                              )}
                            </td>
                          );
                        }
                        if (f === 'municipio') {
                          const municipio2 = getMunicipioFromMergedRow(row, '2');
                          return (
                            <td key="municipio2" className="px-3 py-2 text-gray-700 dark:text-white max-w-[160px] truncate" title={municipio2}>
                              {municipio2}
                            </td>
                          );
                        }
                        return (
                          <td key={`${f}2`} className="px-3 py-2 text-gray-700 dark:text-white max-w-[120px] truncate" title={String(row[`${f}2`] ?? '')}>{row[`${f}2`] ?? '—'}</td>
                        );
                      })}
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-600 rounded-lg shadow-sm border border-gray-200 dark:border-gray-500 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-500">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Mapa das Localizações</h2>
          <p className="text-sm text-gray-500 dark:text-gray-200 mt-1">
            Visualização geográfica das movimentações ({displayedOperations.length} registro{displayedOperations.length === 1 ? '' : 's'}).
          </p>
        </div>
        <div className="p-3">
          {loading ? (
            <div className="h-full min-h-[400px] bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">
              Carregando mapa...
            </div>
          ) : (
            <OperationsMap operations={displayedOperations} />
          )}
        </div>
      </div>

      {/* Popup para visualizar foto com zoom e rotação — glassmorphism */}
      {photoPreviewUrl && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-4 bg-black/50 backdrop-blur-md transition-all duration-300"
          onClick={() => setPhotoPreviewUrl(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Visualizar foto"
        >
          <div className="relative w-full max-w-[95vw] max-h-[95vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            {/* Barra de ferramentas em glassmorphism */}
            <div className="flex flex-wrap items-center justify-center gap-2 mb-4 p-3 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl shadow-black/20">
              <button
                type="button"
                onClick={() => setPhotoPreviewUrl(null)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/25 border border-white/20 text-white font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] hover:shadow-lg hover:shadow-white/5"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" strokeWidth={2.5} />
                <span>Fechar</span>
              </button>
              {photoPreviewBlobUrl && (
                <>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setPhotoZoom((z) => Math.min(z + 0.25, 4)); }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/25 border border-white/20 text-white font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] hover:shadow-lg hover:shadow-white/5"
                    aria-label="Aumentar zoom"
                  >
                    <ZoomIn className="h-5 w-5" strokeWidth={2.5} />
                    <span>Zoom +</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setPhotoZoom((z) => Math.max(z - 0.25, 0.25)); }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/25 border border-white/20 text-white font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] hover:shadow-lg hover:shadow-white/5"
                    aria-label="Diminuir zoom"
                  >
                    <ZoomOut className="h-5 w-5" strokeWidth={2.5} />
                    <span>Zoom −</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setPhotoRotation((r) => (r + 90) % 360); }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/25 border border-white/20 text-white font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] hover:shadow-lg hover:shadow-white/5"
                    aria-label="Girar foto"
                  >
                    <RotateCw className="h-5 w-5" strokeWidth={2.5} />
                    <span>Girar 90°</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setPhotoZoom(1); setPhotoRotation(0); setPhotoPanX(0); setPhotoPanY(0); }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/25 border border-white/20 text-white font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] hover:shadow-lg hover:shadow-white/5"
                    aria-label="Restaurar"
                  >
                    <Undo2 className="h-5 w-5" strokeWidth={2.5} />
                    <span>Restaurar</span>
                  </button>
                </>
              )}
            </div>
            {photoPreviewError && (
              <div className="rounded-2xl bg-red-500/20 backdrop-blur-xl border border-red-400/30 px-5 py-3 shadow-xl">
                <p className="text-white font-medium">Erro ao carregar a foto. Verifique se a API exige login e se o bucket do Supabase está acessível.</p>
              </div>
            )}
            {!photoPreviewBlobUrl && !photoPreviewError && (
              <div className="rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 px-5 py-4 flex items-center gap-3">
                <div className="h-5 w-5 border-2 border-white/60 border-t-white rounded-full animate-spin" />
                <p className="text-white font-medium">Carregando foto...</p>
              </div>
            )}
            {photoPreviewBlobUrl && (
              <div
                className="overflow-auto flex items-center justify-center min-h-[200px] rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-2 select-none"
                style={{ maxHeight: '85vh', cursor: isPhotoDragging ? 'grabbing' : 'grab' }}
                onWheel={(e) => {
                  e.stopPropagation();
                  if (e.deltaY < 0) setPhotoZoom((z) => Math.min(z + 0.1, 4));
                  else setPhotoZoom((z) => Math.max(z - 0.1, 0.25));
                }}
                onMouseDown={(e) => {
                  if (e.button !== 0) return;
                  e.preventDefault();
                  photoDragStartRef.current = {
                    startX: e.clientX,
                    startY: e.clientY,
                    startPanX: photoPanX,
                    startPanY: photoPanY,
                  };
                  setIsPhotoDragging(true);
                }}
              >
                <img
                  src={photoPreviewBlobUrl}
                  alt="Foto operação"
                  className="rounded-xl shadow-2xl shadow-black/40 select-none pointer-events-none"
                  style={{
                    transform: `translate(${photoPanX}px, ${photoPanY}px) scale(${photoZoom}) rotate(${photoRotation}deg)`,
                    maxWidth: '90vw',
                    maxHeight: '80vh',
                    objectFit: 'contain',
                  }}
                  draggable={false}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BI;
