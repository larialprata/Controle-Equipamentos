import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { contractsApi } from '../api/contracts';
import { equipmentsApi } from '../api/equipments';
import { equipmentStructureApi } from '../api/equipmentStructure';
import { buildMovementQrUrl, buildPrintQrPageUrl, buildQrDataUrlWithLogo } from '../lib/qr';
import { downloadEquipmentQrPdf, downloadEquipmentQrPdfZip, type EquipmentQrPdfItem } from '../lib/qrPdf';
import type { Contract, Equipment, EquipmentType } from '../types';
import { FileDown, Loader2, Pencil, Plus, Printer, QrCode, RefreshCw, Trash2, Truck } from 'lucide-react';

const EquipmentQrImage: React.FC<{ value: string; alt: string }> = ({ value, alt }) => {
  const [src, setSrc] = useState('');

  useEffect(() => {
    let mounted = true;
    buildQrDataUrlWithLogo(buildMovementQrUrl(value), { width: 256, margin: 2 }).then((url) => {
      if (mounted) setSrc(url);
    });
    return () => {
      mounted = false;
    };
  }, [value]);

  if (!src) {
    return <div className="flex h-[256px] w-[256px] items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-700"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return <img src={src} alt={alt} className="h-[256px] w-[256px] rounded-xl border border-gray-200 bg-white p-2 dark:border-gray-600" />;
};

const Equipments: React.FC = () => {
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [equipmentTypes, setEquipmentTypes] = useState<EquipmentType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [contractFilter, setContractFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [ativoFilter, setAtivoFilter] = useState('');
  const [qrFilter, setQrFilter] = useState('');
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);
  const [isPdfBatchLoading, setIsPdfBatchLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    contract_id: '',
    company_name: '',
    equipment_type_id: '',
    ativo_placa: '',
  });

  const loadPage = async () => {
    try {
      setIsLoading(true);
      const [equipmentList, contractList, typeList] = await Promise.all([
        equipmentsApi.getAll(),
        contractsApi.getAll(),
        equipmentStructureApi.getEquipmentTypes(),
      ]);
      setEquipments(equipmentList);
      setContracts(contractList);
      setEquipmentTypes(typeList);
      setError(null);
    } catch (err) {
      console.error('Failed to load equipment registry:', err);
      setError('Falha ao carregar equipamentos. Tente novamente mais tarde.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPage();
  }, []);

  const filteredEquipments = useMemo(() => {
    const normalizedQrFilter = qrFilter.trim().toLowerCase();

    return equipments.filter((equipment) => {
      const qrValue = (equipment.qr_code_value || equipment.id || '').toLowerCase();
      const ativoValue = equipment.ativo_placa || '';
      const companyValue = equipment.company_name?.trim() || '';
      const matchesContract = !contractFilter || equipment.contract_id === contractFilter;
      const matchesCompany = !companyFilter || companyValue === companyFilter;
      const matchesAtivo = !ativoFilter || ativoValue === ativoFilter;
      const matchesQr = !normalizedQrFilter || qrValue.includes(normalizedQrFilter);

      return matchesContract && matchesCompany && matchesAtivo && matchesQr;
    });
  }, [ativoFilter, companyFilter, contractFilter, equipments, qrFilter]);

  const ativoOptions = useMemo(
    () =>
      Array.from(
        new Set(
          equipments
            .map((equipment) => equipment.ativo_placa?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [equipments],
  );

  const companyOptions = useMemo(
    () =>
      Array.from(
        new Set(
          equipments
            .map((equipment) => equipment.company_name?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [equipments],
  );

  const equipmentToPdfItem = (equipment: Equipment): EquipmentQrPdfItem => {
    const obra = equipment.obra;
    const obraCode = obra?.code?.trim();
    const obraLabelName =
      obra && 'name' in obra && typeof obra.name === 'string' ? obra.name.trim() : undefined;
    const obraName = obraCode
      ? `Obra ${obraCode}`
      : obraLabelName || equipment.contract?.name;

    return {
      qrValue: equipment.qr_code_value || equipment.id,
      ativoPlaca: equipment.ativo_placa || equipment.name,
      equipmentName: equipment.name,
      companyName: equipment.company_name ?? undefined,
      contractName: equipment.contract?.name,
      obraName,
    };
  };

  const handleDownloadQrPdf = async (equipment: Equipment) => {
    setPdfLoadingId(equipment.id);
    setError(null);
    try {
      await downloadEquipmentQrPdf(equipmentToPdfItem(equipment));
      setMessage(`PDF do ativo ${equipment.ativo_placa || equipment.name} gerado.`);
    } catch (err: any) {
      setError(err?.message || 'Falha ao gerar o PDF do QR code.');
    } finally {
      setPdfLoadingId(null);
    }
  };

  const handleDownloadFilteredQrPdf = async () => {
    if (filteredEquipments.length === 0) return;
    setIsPdfBatchLoading(true);
    setError(null);
    try {
      await downloadEquipmentQrPdfZip(filteredEquipments.map(equipmentToPdfItem));
      setMessage(
        `ZIP com ${filteredEquipments.length} PDF(s) gerado — pastas por obra e empresa, arquivos nomeados pelo ativo.`,
      );
    } catch (err: any) {
      setError(err?.message || 'Falha ao gerar o PDF em lote.');
    } finally {
      setIsPdfBatchLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingEquipment(null);
    setForm({ name: '', contract_id: '', company_name: '', equipment_type_id: '', ativo_placa: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (equipment: Equipment) => {
    setEditingEquipment(equipment);
    setForm({
      name: equipment.name,
      contract_id: equipment.contract_id || '',
      company_name: equipment.company_name || '',
      equipment_type_id: equipment.equipment_type_id || '',
      ativo_placa: equipment.ativo_placa || '',
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isSaving) return;
    setIsModalOpen(false);
    setEditingEquipment(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      const payload = {
        ...form,
        company_name: form.company_name.trim(),
        ativo_placa: form.ativo_placa.trim().toUpperCase(),
      };

      if (editingEquipment) {
        const updated = await equipmentsApi.update(editingEquipment.id, payload);
        setEquipments((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        setMessage('Equipamento atualizado com sucesso.');
      } else {
        const created = await equipmentsApi.create(payload);
        setEquipments((prev) => [created, ...prev]);
        setMessage('Equipamento vinculado com sucesso. O QR code do ativo já está disponível.');
      }

      setForm({ name: '', contract_id: '', company_name: '', equipment_type_id: '', ativo_placa: '' });
      setEditingEquipment(null);
      setIsModalOpen(false);
    } catch (err: any) {
      setError(err?.response?.data?.message || (editingEquipment ? 'Falha ao atualizar o equipamento.' : 'Falha ao cadastrar o vínculo do equipamento.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegenerateQr = async (equipment: Equipment) => {
    const confirmed = window.confirm(
      'Gerar um novo QR code? O QR impresso anteriormente deixará de funcionar.',
    );
    if (!confirmed) return;

    setActionLoadingId(equipment.id);
    setMessage(null);
    setError(null);

    try {
      const updated = await equipmentsApi.regenerateQr(equipment.id);
      setEquipments((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setMessage(`Novo QR gerado para ${updated.ativo_placa || updated.name}. Imprima novamente se necessário.`);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Falha ao gerar novo QR code.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (equipment: Equipment) => {
    const label = equipment.ativo_placa || equipment.name;
    const confirmed = window.confirm(
      `Excluir o equipamento "${label}"? O QR vinculado deixará de funcionar.`,
    );
    if (!confirmed) return;

    setActionLoadingId(equipment.id);
    setMessage(null);
    setError(null);

    try {
      await equipmentsApi.remove(equipment.id);
      setEquipments((prev) => prev.filter((item) => item.id !== equipment.id));
      setMessage(`Equipamento "${label}" excluído com sucesso.`);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Falha ao excluir o equipamento.');
    } finally {
      setActionLoadingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-red-400" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Equipamentos</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-200">
            Cadastre o vínculo entre contrato, equipamento e ativo. Cada ativo gera um QR code próprio.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 dark:bg-red-800 dark:hover:bg-red-700"
        >
          <Plus className="h-4 w-4" />
          Cadastrar vínculo
        </button>
      </div>

      {message && <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-700 dark:bg-green-900/20 dark:text-green-200">{message}</div>}
      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/20 dark:text-red-200">{error}</div>}

      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-500 dark:bg-gray-600">
        <div className="mb-3">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Filtros</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-200">Filtre os equipamentos por contrato, empresa, ativo ou QR vinculado.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">Contrato</label>
            <select
              value={contractFilter}
              onChange={(e) => setContractFilter(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-500 dark:bg-gray-700 dark:text-white dark:focus:border-red-600 dark:focus:ring-red-600"
            >
              <option value="">Todos</option>
              {contracts.map((contract) => (
                <option key={contract.id} value={contract.id}>
                  {contract.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">Empresa</label>
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-500 dark:bg-gray-700 dark:text-white dark:focus:border-red-600 dark:focus:ring-red-600"
            >
              <option value="">Todas</option>
              {companyOptions.map((company) => (
                <option key={company} value={company}>
                  {company}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">Ativo</label>
            <select
              value={ativoFilter}
              onChange={(e) => setAtivoFilter(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-500 dark:bg-gray-700 dark:text-white dark:focus:border-red-600 dark:focus:ring-red-600"
            >
              <option value="">Todos</option>
              {ativoOptions.map((ativo) => (
                <option key={ativo} value={ativo}>
                  {ativo}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">QR vinculado</label>
            <input
              type="text"
              value={qrFilter}
              onChange={(e) => setQrFilter(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-500 dark:bg-gray-700 dark:text-white dark:focus:border-red-600 dark:focus:ring-red-600"
              placeholder="Digite parte do QR"
            />
          </div>
        </div>

        {filteredEquipments.length > 0 && (
          <div className="mt-4 flex flex-col gap-2 border-t border-gray-200 pt-4 dark:border-gray-500 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-200">
              {filteredEquipments.length} equipamento(s) na lista — baixe um ZIP com um PDF por ativo (pastas por obra e empresa).
            </p>
            <button
              type="button"
              onClick={() => void handleDownloadFilteredQrPdf()}
              disabled={isPdfBatchLoading}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-500 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              {isPdfBatchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              Baixar ZIP ({filteredEquipments.length})
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {filteredEquipments.map((equipment) => {
          const qrValue = equipment.qr_code_value || equipment.id;
          const ativoLabel = equipment.ativo_placa || equipment.name;
          const printUrl = buildPrintQrPageUrl(qrValue, ativoLabel, equipment.name);

          const isBusy = actionLoadingId === equipment.id;

          return (
            <div
              key={equipment.id}
              className="rounded-2xl border border-gray-100 bg-white p-5 shadow-md dark:border-gray-500 dark:bg-gray-600"
            >
              <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-start 2xl:justify-between">
                <div className="min-w-0">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="rounded-lg bg-orange-100 p-2 dark:bg-red-900/30">
                      <Truck className="h-5 w-5 text-orange-600 dark:text-red-300" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{equipment.name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-200">{equipment.equipment_type?.name || 'Tipo não informado'}</p>
                    </div>
                  </div>

                  <div className="grid items-stretch gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-gray-50 p-3 text-center dark:bg-gray-500">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-200">Ativo</p>
                      <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{equipment.ativo_placa || '—'}</p>
                    </div>
                    <div className="rounded-xl bg-gray-50 p-3 text-center dark:bg-gray-500">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-200">Contrato</p>
                      <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{equipment.contract?.name || '—'}</p>
                    </div>
                    <div className="flex h-full flex-col items-center justify-center rounded-xl bg-gray-50 p-3 text-center dark:bg-gray-500">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-200">Empresa</p>
                      <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{equipment.company_name || '—'}</p>
                    </div>
                    <div className="rounded-xl bg-gray-50 p-3 text-center dark:bg-gray-500">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-200">QR vinculado</p>
                      <p className="mt-1 break-all text-sm font-medium text-gray-900 dark:text-white">{qrValue}</p>
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-200">
                        Ao escanear, o celular abre direto a página de movimentações deste ativo.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openEditModal(equipment)}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-500 dark:text-gray-200 dark:hover:bg-gray-500"
                    >
                      <Pencil className="h-4 w-4" />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRegenerateQr(equipment)}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900/20"
                    >
                      {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      Novo QR
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(equipment)}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:text-red-200 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-4 w-4" />
                      Excluir
                    </button>
                  </div>
                </div>

                <div className="flex w-full flex-shrink-0 flex-col items-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 dark:border-gray-500 dark:bg-gray-700 2xl:w-[304px]">
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-100">
                    <QrCode className="h-4 w-4" />
                    QR do ativo
                  </div>
                  <Link to={printUrl} target="_blank" rel="noreferrer" className="transition hover:scale-[1.01]">
                    <EquipmentQrImage key={qrValue} value={qrValue} alt={`QR do ativo ${ativoLabel}`} />
                  </Link>
                  <div className="mt-4 flex w-full flex-col gap-2">
                    <Link
                      to={printUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 dark:bg-red-800 dark:hover:bg-red-700"
                    >
                      <Printer className="h-4 w-4" />
                      Imprimir QR
                    </Link>
                    <button
                      type="button"
                      onClick={() => void handleDownloadQrPdf(equipment)}
                      disabled={pdfLoadingId === equipment.id || isPdfBatchLoading}
                      className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-500 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500"
                    >
                      {pdfLoadingId === equipment.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <FileDown className="h-4 w-4" />
                      )}
                      Baixar PDF
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {filteredEquipments.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-gray-300 bg-white py-12 text-center dark:border-gray-500 dark:bg-gray-600">
            <Truck className="mx-auto mb-4 h-12 w-12 text-gray-400 dark:text-gray-500" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              {equipments.length === 0 ? 'Nenhum vínculo cadastrado' : 'Nenhum equipamento encontrado'}
            </h3>
            <p className="mt-2 text-gray-500 dark:text-gray-200">
              {equipments.length === 0
                ? 'Cadastre o primeiro equipamento para gerar o QR do ativo.'
                : 'Nenhum equipamento corresponde aos filtros informados.'}
            </p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeModal}>
          <div className="w-full max-w-xl rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-500 dark:bg-gray-600" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{editingEquipment ? 'Editar equipamento' : 'Cadastrar vínculo do equipamento'}</h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-200">{editingEquipment ? 'Atualize os dados do vínculo. O QR atual permanece o mesmo até você gerar um novo.' : 'Ao salvar, o QR code do ativo será gerado automaticamente a partir do cadastro.'}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">Nome do equipamento</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-500 dark:bg-gray-700 dark:text-white dark:focus:border-red-600 dark:focus:ring-red-600"
                  placeholder="Ex.: Escavadeira principal"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">Contrato</label>
                  <select
                    required
                    value={form.contract_id}
                    onChange={(e) => setForm((prev) => ({ ...prev, contract_id: e.target.value }))}
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-500 dark:bg-gray-700 dark:text-white dark:focus:border-red-600 dark:focus:ring-red-600"
                  >
                    <option value="">Selecione</option>
                    {contracts.filter((item) => item.active).map((contract) => (
                      <option key={contract.id} value={contract.id}>{contract.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">Empresa</label>
                  <input
                    type="text"
                    required
                    value={form.company_name}
                    onChange={(e) => setForm((prev) => ({ ...prev, company_name: e.target.value }))}
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-500 dark:bg-gray-700 dark:text-white dark:focus:border-red-600 dark:focus:ring-red-600"
                    placeholder="Ex.: Locadora XYZ"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">Tipo de equipamento</label>
                  <select
                    required
                    value={form.equipment_type_id}
                    onChange={(e) => setForm((prev) => ({ ...prev, equipment_type_id: e.target.value }))}
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-500 dark:bg-gray-700 dark:text-white dark:focus:border-red-600 dark:focus:ring-red-600"
                  >
                    <option value="">Selecione</option>
                    {equipmentTypes.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">Ativo / placa</label>
                  <input
                    type="text"
                    required
                    value={form.ativo_placa}
                    onChange={(e) => setForm((prev) => ({ ...prev, ativo_placa: e.target.value.toUpperCase() }))}
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-500 dark:bg-gray-700 dark:text-white dark:focus:border-red-600 dark:focus:ring-red-600"
                    placeholder="Ex.: RJX1234"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isSaving}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-500 dark:text-gray-200 dark:hover:bg-gray-500"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-red-800 dark:hover:bg-red-700"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {isSaving ? 'Salvando...' : editingEquipment ? 'Salvar alterações' : 'Salvar vínculo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Equipments;
