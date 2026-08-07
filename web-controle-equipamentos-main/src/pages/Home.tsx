import React, { useEffect, useMemo, useState } from 'react';
import ExcelJS from 'exceljs';
import { Download, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../api/auth';
import { contractsApi } from '../api/contracts';
import { operationsApi } from '../api/operations';
import OperationsMap from '../components/OperationsMap';
import type { CheckOperation, Contract, EquipmentType, User } from '../types';

const EXCEL_FONT = { name: 'Arial', size: 12 };
const EXCEL_BORDER = {
  top: { style: 'thin' as const },
  left: { style: 'thin' as const },
  bottom: { style: 'thin' as const },
  right: { style: 'thin' as const },
};

const Home: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const [mapOperations, setMapOperations] = useState<CheckOperation[]>([]);
  const [mapLoading, setMapLoading] = useState(false);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [filterEquipmentTypeId, setFilterEquipmentTypeId] = useState('');
  const [filterIdentifier, setFilterIdentifier] = useState('');
  const [filterUserId, setFilterUserId] = useState('');
  const [filterContractId, setFilterContractId] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [exportingMonthlyExcel, setExportingMonthlyExcel] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadMapOperations = async () => {
      setMapLoading(true);
      try {
        const list = await operationsApi.list({ limit: 2000 });
        if (!cancelled) setMapOperations(list ?? []);
      } catch (error) {
        console.error('Erro ao carregar operações para o mapa do dashboard:', error);
        if (!cancelled) setMapOperations([]);
      } finally {
        if (!cancelled) setMapLoading(false);
      }
    };
    loadMapOperations();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    contractsApi.getAll().then(setContracts).catch(() => setContracts([]));
    authApi.getUsers().then(setUsers).catch(() => setUsers([]));
  }, []);

  const equipmentTypeOptions = useMemo(() => {
    const map = new Map<string, EquipmentType>();
    for (const op of mapOperations) {
      if (op.equipment_type?.id && op.equipment_type?.name) {
        map.set(op.equipment_type.id, { id: op.equipment_type.id, name: op.equipment_type.name });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [mapOperations]);

  const identifierOptions = useMemo(() => {
    const labels = new Set<string>();
    for (const op of mapOperations) {
      const ap = op.ativo_placa?.trim();
      if (ap) labels.add(ap);
    }
    return Array.from(labels).sort();
  }, [mapOperations]);

  const filteredMapOperations = useMemo(() => {
    let list = mapOperations;

    if (filterEquipmentTypeId.trim()) {
      list = list.filter((op) => op.equipment_type?.id === filterEquipmentTypeId);
    }

    if (filterIdentifier.trim()) {
      list = list.filter((op) => (op.ativo_placa?.trim() ?? '') === filterIdentifier);
    }

    if (filterUserId.trim()) {
      list = list.filter((op) => {
        const createdBy = op.created_by_user;
        const createdById = typeof createdBy === 'object' && createdBy != null && 'id' in createdBy
          ? String((createdBy as User).id ?? '')
          : '';
        const opUserId = String(op.user_id ?? op.user?.id ?? createdById);
        return opUserId === filterUserId;
      });
    }

    if (filterContractId.trim()) {
      list = list.filter((op) => String(op.contract_id ?? op.contract?.id ?? '') === filterContractId);
    }

    if (filterDateFrom.trim() || filterDateTo.trim()) {
      list = list.filter((op) => {
        const opDate = op.operation_datetime ? new Date(op.operation_datetime).getTime() : NaN;
        if (Number.isNaN(opDate)) return false;
        if (filterDateFrom.trim()) {
          const from = new Date(`${filterDateFrom.trim()}T00:00:00`).getTime();
          if (opDate < from) return false;
        }
        if (filterDateTo.trim()) {
          const to = new Date(`${filterDateTo.trim()}T23:59:59`).getTime();
          if (opDate > to) return false;
        }
        return true;
      });
    }

    return list;
  }, [
    mapOperations,
    filterEquipmentTypeId,
    filterIdentifier,
    filterUserId,
    filterContractId,
    filterDateFrom,
    filterDateTo,
  ]);

  const { totalEquipDia, totalEquipMes, totalMovDia, totalMovMes } = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDate();

    const equipmentIdentity = (op: CheckOperation): string => {
      const type = op.equipment_type?.id ?? 'sem-tipo';
      const plate = String(op.ativo_placa ?? '').trim().toUpperCase() || 'sem-ativo';
      const contract = String(op.contract_id ?? '').trim() || 'sem-contrato';
      return `${contract}:${type}:${plate}`;
    };

    const countEquipments = (ops: CheckOperation[]) => {
      const set = new Set<string>();
      for (const op of ops) {
        set.add(equipmentIdentity(op));
      }
      return set.size;
    };

    // Regra: check-in + check-out do mesmo equipamento contam como 1 movimentação.
    const countMovements = (ops: CheckOperation[]) => {
      const sorted = [...ops].sort(
        (a, b) => new Date(a.operation_datetime).getTime() - new Date(b.operation_datetime).getTime(),
      );
      const openByEquipment = new Map<string, string[]>();
      const movementIds = new Set<string>();

      for (const op of sorted) {
        const eqKey = equipmentIdentity(op);
        if (op.operation_type === 'checkin') {
          const queue = openByEquipment.get(eqKey) ?? [];
          queue.push(op.id);
          openByEquipment.set(eqKey, queue);
          movementIds.add(`mov:${op.id}`);
        } else {
          const queue = openByEquipment.get(eqKey) ?? [];
          if (queue.length > 0) {
            queue.shift();
            openByEquipment.set(eqKey, queue);
          } else {
            // checkout órfão no período também conta como movimentação única
            movementIds.add(`mov:checkout:${op.id}`);
          }
        }
      }
      return movementIds.size;
    };

    const opsMes: CheckOperation[] = [];
    const opsDia: CheckOperation[] = [];
    for (const op of mapOperations ?? []) {
      const d = new Date(op.operation_datetime);
      if (Number.isNaN(d.getTime())) continue;
      if (d.getFullYear() === year && d.getMonth() === month) {
        opsMes.push(op);
        if (d.getDate() === day) {
          opsDia.push(op);
        }
      }
    }

    return {
      totalEquipDia: countEquipments(opsDia),
      totalEquipMes: countEquipments(opsMes),
      totalMovDia: countMovements(opsDia),
      totalMovMes: countMovements(opsMes),
    };
  }, [mapOperations]);

  const exportMonthlyExcel = async () => {
    try {
      setExportingMonthlyExcel(true);
      const validOperations = (mapOperations ?? []).filter((op) => {
        const date = new Date(op.operation_datetime);
        return !Number.isNaN(date.getTime());
      });
      if (validOperations.length === 0) {
        window.alert('Não há movimentações para exportar.');
        return;
      }

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Dashboard - Controle de Equipamentos';
      workbook.created = new Date();

      const formatDateKey = (date: Date): string => {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      };
      const formatDayLabel = (dateKey: string): string => {
        const date = new Date(`${dateKey}T12:00:00`);
        if (Number.isNaN(date.getTime())) return dateKey;
        return date.toLocaleDateString('pt-BR');
      };
      const monthKeyFromDate = (date: Date): string => {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        return `${yyyy}-${mm}`;
      };
      const monthLabelFromKey = (monthKey: string): string => {
        const [yearText, monthText] = monthKey.split('-');
        const year = Number(yearText);
        const month = Number(monthText) - 1;
        if (!Number.isFinite(year) || !Number.isFinite(month)) return monthKey;
        return new Date(year, month, 1).toLocaleDateString('pt-BR', {
          month: 'long',
          year: 'numeric',
        });
      };
      const makeSheetName = (monthKey: string, usedNames: Set<string>): string => {
        const base = monthLabelFromKey(monthKey).replace(/[\\/*?:[\]]/g, '-').slice(0, 31).trim() || 'Mes';
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
      const equipmentIdentity = (op: CheckOperation): string => {
        const type = op.equipment_type?.id ?? 'sem-tipo';
        const plate = String(op.ativo_placa ?? '').trim().toUpperCase() || 'sem-ativo';
        const contract = String(op.contract_id ?? '').trim() || 'sem-contrato';
        return `${contract}:${type}:${plate}`;
      };
      const countEquipments = (ops: CheckOperation[]): number => {
        const set = new Set<string>();
        ops.forEach((op) => set.add(equipmentIdentity(op)));
        return set.size;
      };
      const countMovements = (ops: CheckOperation[]): number => {
        const sorted = [...ops].sort(
          (a, b) => new Date(a.operation_datetime).getTime() - new Date(b.operation_datetime).getTime(),
        );
        const openByEquipment = new Map<string, string[]>();
        const movementIds = new Set<string>();
        for (const op of sorted) {
          const eqKey = equipmentIdentity(op);
          if (op.operation_type === 'checkin') {
            const queue = openByEquipment.get(eqKey) ?? [];
            queue.push(op.id);
            openByEquipment.set(eqKey, queue);
            movementIds.add(`mov:${op.id}`);
          } else {
            const queue = openByEquipment.get(eqKey) ?? [];
            if (queue.length > 0) {
              queue.shift();
              openByEquipment.set(eqKey, queue);
            } else {
              movementIds.add(`mov:checkout:${op.id}`);
            }
          }
        }
        return movementIds.size;
      };
      const computeTotalHoursByAtivo = (ops: CheckOperation[]): Map<string, number> => {
        const sorted = [...ops].sort(
          (a, b) => new Date(a.operation_datetime).getTime() - new Date(b.operation_datetime).getTime(),
        );
        const openCheckins = new Map<string, CheckOperation[]>();
        const hoursByAtivo = new Map<string, number>();

        for (const op of sorted) {
          const eqKey = equipmentIdentity(op);
          const ativo = String(op.ativo_placa ?? '').trim().toUpperCase() || 'SEM IDENTIFICAÇÃO';

          if (op.operation_type === 'checkin') {
            const queue = openCheckins.get(eqKey) ?? [];
            queue.push(op);
            openCheckins.set(eqKey, queue);
            continue;
          }

          const queue = openCheckins.get(eqKey) ?? [];
          const checkin = queue.shift();
          openCheckins.set(eqKey, queue);
          if (!checkin) continue;

          const openHorimeter = Number(checkin.horimeter);
          const closeHorimeter = Number(op.horimeter);
          if (!Number.isFinite(openHorimeter) || !Number.isFinite(closeHorimeter) || closeHorimeter <= openHorimeter) {
            continue;
          }

          hoursByAtivo.set(ativo, (hoursByAtivo.get(ativo) ?? 0) + (closeHorimeter - openHorimeter));
        }

        return hoursByAtivo;
      };
      const formatTotalHours = (hours: number): string =>
        hours.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      const BRAND_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFB91C1C' } };
      const BRAND_SOFT_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFEE2E2' } };
      const HEADER_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFF3F4F6' } };
      const WHITE_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFFFFF' } };
      const ZEBRA_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFAFAFA' } };
      const LAST_COL = 3;

      const writeSectionTitle = (ws: ExcelJS.Worksheet, row: number, title: string) => {
        ws.mergeCells(row, 1, row, LAST_COL);
        const cell = ws.getCell(row, 1);
        cell.value = title;
        cell.font = { ...EXCEL_FONT, bold: true, size: 12, color: { argb: 'FF7F1D1D' } };
        cell.fill = BRAND_SOFT_FILL;
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
        cell.border = EXCEL_BORDER;
        ws.getRow(row).height = 24;
      };

      const writeHeaderRow = (ws: ExcelJS.Worksheet, row: number, values: string[]) => {
        const headerRow = ws.getRow(row);
        headerRow.values = values;
        headerRow.font = { ...EXCEL_FONT, bold: true, color: { argb: 'FF374151' } };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
        headerRow.height = 22;
        headerRow.eachCell((cell) => {
          cell.border = EXCEL_BORDER;
          cell.fill = HEADER_FILL;
        });
      };

      const writeDataRow = (
        ws: ExcelJS.Worksheet,
        row: number,
        values: (string | number)[],
        options?: { bold?: boolean; fill?: typeof WHITE_FILL; align?: 'left' | 'center' },
      ) => {
        const dataRow = ws.getRow(row);
        dataRow.values = values;
        dataRow.font = { ...EXCEL_FONT, bold: options?.bold ?? false };
        dataRow.alignment = { vertical: 'middle', horizontal: options?.align ?? 'left' };
        dataRow.height = 21;
        dataRow.eachCell((cell) => {
          cell.border = EXCEL_BORDER;
          cell.fill = options?.fill ?? WHITE_FILL;
        });
      };

      const operationsByMonth = new Map<string, CheckOperation[]>();
      for (const op of validOperations) {
        const monthKey = monthKeyFromDate(new Date(op.operation_datetime));
        const bucket = operationsByMonth.get(monthKey) ?? [];
        bucket.push(op);
        operationsByMonth.set(monthKey, bucket);
      }
      const sortedMonthKeys = Array.from(operationsByMonth.keys()).sort((a, b) => b.localeCompare(a));
      const usedSheetNames = new Set<string>();

      for (const monthKey of sortedMonthKeys) {
        const monthlyOperations = operationsByMonth.get(monthKey) ?? [];
        const monthLabel = monthLabelFromKey(monthKey);
        const worksheet = workbook.addWorksheet(makeSheetName(monthKey, usedSheetNames), {
          views: [{ state: 'frozen', ySplit: 7 }],
        });

        const totalEquipMes = countEquipments(monthlyOperations);
        const totalMovMes = countMovements(monthlyOperations);
        const hoursByAtivo = computeTotalHoursByAtivo(monthlyOperations);
        const equipmentNameByAtivo = new Map<string, string>();
        for (const op of monthlyOperations) {
          const ativo = String(op.ativo_placa ?? '').trim().toUpperCase() || 'SEM IDENTIFICAÇÃO';
          if (!equipmentNameByAtivo.has(ativo)) {
            equipmentNameByAtivo.set(ativo, op.equipment_type?.name ?? op.equipment?.name ?? '—');
          }
        }
        const sortedAtivos = Array.from(
          new Set(monthlyOperations.map((op) => String(op.ativo_placa ?? '').trim().toUpperCase() || 'SEM IDENTIFICAÇÃO')),
        ).sort((a, b) => a.localeCompare(b));
        const grandTotalHours = sortedAtivos.reduce((sum, ativo) => sum + (hoursByAtivo.get(ativo) ?? 0), 0);

        const dailyBuckets = new Map<string, CheckOperation[]>();
        for (const op of monthlyOperations) {
          const dateKey = formatDateKey(new Date(op.operation_datetime));
          const bucket = dailyBuckets.get(dateKey) ?? [];
          bucket.push(op);
          dailyBuckets.set(dateKey, bucket);
        }
        const sortedDayKeys = Array.from(dailyBuckets.keys()).sort((a, b) => a.localeCompare(b));

        worksheet.mergeCells(1, 1, 1, LAST_COL);
        const titleCell = worksheet.getCell(1, 1);
        titleCell.value = `Relatório — ${monthLabel}`;
        titleCell.font = { ...EXCEL_FONT, bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
        titleCell.fill = BRAND_FILL;
        titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
        titleCell.border = EXCEL_BORDER;
        worksheet.getRow(1).height = 34;

        worksheet.mergeCells(2, 1, 2, LAST_COL);
        const subtitleCell = worksheet.getCell(2, 1);
        subtitleCell.value = `Gerado em ${new Date().toLocaleString('pt-BR')} · ${monthlyOperations.length} registro(s)`;
        subtitleCell.font = { ...EXCEL_FONT, size: 10, color: { argb: 'FF6B7280' } };
        subtitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
        subtitleCell.fill = WHITE_FILL;
        subtitleCell.border = EXCEL_BORDER;
        worksheet.getRow(2).height = 20;

        writeSectionTitle(worksheet, 4, 'Resumo do mês');
        writeHeaderRow(worksheet, 5, ['Equipamentos', 'Movimentações', 'Total de horas']);
        writeDataRow(worksheet, 6, [totalEquipMes, totalMovMes, formatTotalHours(grandTotalHours)], {
          bold: true,
          align: 'center',
        });

        let currentRow = 8;
        writeSectionTitle(worksheet, currentRow, 'Horas por ativo');
        currentRow += 1;
        writeHeaderRow(worksheet, currentRow, ['Ativo', 'Equipamento', 'Horas']);
        currentRow += 1;

        sortedAtivos.forEach((ativo, index) => {
          writeDataRow(
            worksheet,
            currentRow,
            [ativo, equipmentNameByAtivo.get(ativo) ?? '—', formatTotalHours(hoursByAtivo.get(ativo) ?? 0)],
            { fill: index % 2 === 0 ? WHITE_FILL : ZEBRA_FILL, align: 'center' },
          );
          currentRow += 1;
        });

        writeDataRow(worksheet, currentRow, ['Total geral', '—', formatTotalHours(grandTotalHours)], {
          bold: true,
          fill: BRAND_SOFT_FILL,
          align: 'center',
        });
        currentRow += 2;

        writeSectionTitle(worksheet, currentRow, 'Movimentações por dia');
        currentRow += 1;
        writeHeaderRow(worksheet, currentRow, ['Data', 'Equipamentos', 'Movimentações']);
        currentRow += 1;

        sortedDayKeys.forEach((dayKey, index) => {
          const ops = dailyBuckets.get(dayKey) ?? [];
          writeDataRow(
            worksheet,
            currentRow,
            [formatDayLabel(dayKey), countEquipments(ops), countMovements(ops)],
            { fill: index % 2 === 0 ? WHITE_FILL : ZEBRA_FILL, align: 'center' },
          );
          currentRow += 1;
        });

        worksheet.columns = [
          { width: 22 },
          { width: 34 },
          { width: 18 },
        ];
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dashboard-relatorio-mensal-${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro ao exportar relatório mensal do dashboard:', error);
      window.alert('Não foi possível exportar o Excel agora. Tente novamente em alguns segundos.');
    } finally {
      setExportingMonthlyExcel(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-300 mt-2">Bem-vindo(a), {user?.full_name || 'Usuário'}!</p>
        <p className="text-gray-600 dark:text-gray-300 mt-2">Resumo de movimentações de equipamentos.</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={exportMonthlyExcel}
            disabled={exportingMonthlyExcel || mapLoading}
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {exportingMonthlyExcel ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {exportingMonthlyExcel ? 'Exportando...' : 'Exportar Excel'}
          </button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-blue-200/80 bg-gradient-to-br from-white to-blue-50 p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-blue-800 dark:from-gray-700 dark:to-blue-950/30">
          <p className="text-sm font-semibold tracking-wide text-blue-700 dark:text-blue-200">Equipamentos no dia</p>
          <p className="mt-4 text-4xl font-extrabold leading-none text-blue-700 dark:text-blue-100">{totalEquipDia}</p>
        </div>

        <div className="rounded-2xl border border-blue-200/80 bg-gradient-to-br from-white to-blue-50 p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-blue-800 dark:from-gray-700 dark:to-blue-950/30">
          <p className="text-sm font-semibold tracking-wide text-blue-700 dark:text-blue-200">Equipamentos no mês</p>
          <p className="mt-4 text-4xl font-extrabold leading-none text-blue-700 dark:text-blue-100">{totalEquipMes}</p>
        </div>

        <div className="rounded-2xl border border-red-200/80 bg-gradient-to-br from-white to-red-50 p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-red-800 dark:from-gray-700 dark:to-red-950/30">
          <p className="text-sm font-semibold tracking-wide text-red-700 dark:text-red-200">Movimentações no dia</p>
          <p className="mt-4 text-4xl font-extrabold leading-none text-red-700 dark:text-red-100">{totalMovDia}</p>
        </div>

        <div className="rounded-2xl border border-red-200/80 bg-gradient-to-br from-white to-red-50 p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-red-800 dark:from-gray-700 dark:to-red-950/30">
          <p className="text-sm font-semibold tracking-wide text-red-700 dark:text-red-200">Movimentações no mês</p>
          <p className="mt-4 text-4xl font-extrabold leading-none text-red-700 dark:text-red-100">{totalMovMes}</p>
        </div>
      </div>

      <div className="mt-12 bg-white dark:bg-gray-600 rounded-lg shadow-sm border border-gray-200 dark:border-gray-500 overflow-hidden">
        <div className="px-6 pt-5 pb-4 border-b border-gray-200 dark:border-gray-500">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-white whitespace-nowrap">Equipamento</label>
              <select
                value={filterEquipmentTypeId}
                onChange={(e) => setFilterEquipmentTypeId(e.target.value)}
                className="rounded-lg border border-gray-300 dark:border-gray-500 px-3 py-2 text-sm w-[190px] bg-white dark:bg-gray-600 text-gray-900 dark:text-white"
              >
                <option value="">Todos</option>
                {equipmentTypeOptions.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-white whitespace-nowrap">Ativo/Placa</label>
              <select
                value={filterIdentifier}
                onChange={(e) => setFilterIdentifier(e.target.value)}
                className="rounded-lg border border-gray-300 dark:border-gray-500 px-3 py-2 text-sm w-[180px] bg-white dark:bg-gray-600 text-gray-900 dark:text-white"
              >
                <option value="">Todos</option>
                {identifierOptions.map((label) => (
                  <option key={label} value={label}>{label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-white whitespace-nowrap">Usuário</label>
              <select
                value={filterUserId}
                onChange={(e) => setFilterUserId(e.target.value)}
                className="rounded-lg border border-gray-300 dark:border-gray-500 px-3 py-2 text-sm w-[180px] bg-white dark:bg-gray-600 text-gray-900 dark:text-white"
              >
                <option value="">Todos</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-white whitespace-nowrap">Contrato</label>
              <select
                value={filterContractId}
                onChange={(e) => setFilterContractId(e.target.value)}
                className="rounded-lg border border-gray-300 dark:border-gray-500 px-3 py-2 text-sm w-[170px] bg-white dark:bg-gray-600 text-gray-900 dark:text-white"
              >
                <option value="">Todos</option>
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-white whitespace-nowrap">Período</label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="rounded-lg border border-gray-300 dark:border-gray-500 px-3 py-2 text-sm w-[150px] bg-white dark:bg-gray-600 text-gray-900 dark:text-white"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-white">até</span>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="rounded-lg border border-gray-300 dark:border-gray-500 px-3 py-2 text-sm w-[150px] bg-white dark:bg-gray-600 text-gray-900 dark:text-white"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setFilterEquipmentTypeId('');
                setFilterIdentifier('');
                setFilterUserId('');
                setFilterContractId('');
                setFilterDateFrom('');
                setFilterDateTo('');
              }}
              className="rounded-lg border border-gray-300 dark:border-gray-500 bg-gray-100 dark:bg-gray-500 px-3 py-2 text-sm font-medium text-gray-700 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-400"
            >
              Limpar filtros
            </button>
          </div>
        </div>

        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-500">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Mapa das Localizações</h2>
          <p className="text-sm text-gray-500 dark:text-gray-200 mt-1">
            Visualização geográfica das movimentações ({filteredMapOperations.length} registro{filteredMapOperations.length === 1 ? '' : 's'}).
          </p>
        </div>
        <div className="p-3">
          {mapLoading ? (
            <div className="h-full min-h-[400px] bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">
              Carregando mapa...
            </div>
          ) : (
            <OperationsMap operations={filteredMapOperations} />
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;
