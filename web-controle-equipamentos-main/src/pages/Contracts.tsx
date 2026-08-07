import React, { useEffect, useState } from 'react';
import { contractsApi } from '../api/contracts';
import { Contract } from '../types';
import { FileText, Loader2, Calendar, Plus, X } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const toErrorText = (err: any, fallback: string): string => {
  const message = err?.response?.data?.message;
  if (Array.isArray(message)) return message.join(' | ');
  if (typeof message === 'string' && message.trim()) return message;
  if (typeof err?.message === 'string' && err.message.trim()) return err.message;
  return fallback;
};

const Contracts: React.FC = () => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [contractName, setContractName] = useState('');
  const [statusLoadingId, setStatusLoadingId] = useState<string | null>(null);
  const [selectedContractForStatus, setSelectedContractForStatus] = useState('');
  const [statusAction, setStatusAction] = useState<'activate' | 'deactivate'>('deactivate');
  const { user } = useAuthStore();
  const isAdmin = Boolean(user?.is_admin);

  const fetchContracts = async () => {
    try {
      const data = await contractsApi.getAll();
      setContracts(data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch contracts:', err);
      setError('Falha ao carregar contratos. Tente novamente mais tarde.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchContracts();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      const created = await contractsApi.create({ name: contractName.trim() });
      setContracts((prev) => [created, ...prev]);
      setContractName('');
      setIsModalOpen(false);
      setMessage('Contrato cadastrado com sucesso.');
    } catch (err: any) {
      setError(toErrorText(err, 'Falha ao cadastrar contrato.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (contract: Contract) => {
    setStatusLoadingId(contract.id);
    try {
      const updated = await contractsApi.updateStatus(contract.id, !contract.active);
      setContracts((prev) => prev.map((item) => (item.id === contract.id ? { ...item, ...updated } : item)));
      setMessage(`Contrato ${updated.active ? 'ativado' : 'desativado'} com sucesso.`);
    } catch (err) {
      console.error('Failed to update contract status:', err);
      setError('Não foi possível atualizar o status do contrato.');
    } finally {
      setStatusLoadingId(null);
    }
  };

  const handleStatusActionFromToolbar = async () => {
    if (!selectedContractForStatus) {
      setError('Selecione um contrato.');
      return;
    }

    const selected = contracts.find((item) => item.id === selectedContractForStatus);
    if (!selected) {
      setError('Contrato selecionado não encontrado.');
      return;
    }

    const shouldBeActive = statusAction === 'activate';
    if (selected.active === shouldBeActive) {
      setError(`Esse contrato já está ${shouldBeActive ? 'ativo' : 'inativo'}.`);
      return;
    }

    await handleToggleStatus(selected);
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
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Contratos</h1>
            <p className="text-base text-gray-600 dark:text-gray-200 mt-1">Lista de contratos cadastrados</p>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 dark:bg-red-800 dark:hover:bg-red-700"
              >
                <Plus className="h-4 w-4" />
                Adicionar contrato
              </button>

              <select
                value={selectedContractForStatus}
                onChange={(e) => setSelectedContractForStatus(e.target.value)}
                className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm min-w-[220px]"
              >
                <option value="">Selecione contrato...</option>
                {contracts.map((contract) => (
                  <option key={contract.id} value={contract.id}>
                    {contract.name} ({contract.active ? 'Ativo' : 'Inativo'})
                  </option>
                ))}
              </select>

              <select
                value={statusAction}
                onChange={(e) => setStatusAction(e.target.value as 'activate' | 'deactivate')}
                className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="deactivate">Desativar</option>
                <option value="activate">Ativar</option>
              </select>

              <button
                type="button"
                onClick={handleStatusActionFromToolbar}
                disabled={!!statusLoadingId}
                className="inline-flex items-center px-4 py-2 rounded-md bg-gray-700 text-white hover:bg-gray-800 disabled:opacity-60"
              >
                Aplicar
              </button>
            </div>
          )}
        </div>
      </div>

      {message && <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-700 dark:bg-green-900/20 dark:text-green-200">{message}</div>}
      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/20 dark:text-red-200">{error}</div>}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {contracts.map((contract) => (
          <div
            key={contract.id}
            className="text-left bg-white dark:bg-gray-600 rounded-lg shadow-md p-6 border border-gray-100 dark:border-gray-500"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 bg-blue-100 dark:bg-red-900/30 rounded-lg">
                <FileText className="h-6 w-6 text-blue-600 dark:text-red-400" />
              </div>
              <span className={`px-2.5 py-1 text-sm font-semibold rounded-full ${contract.active ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200' : 'bg-gray-100 dark:bg-gray-500 text-gray-800 dark:text-gray-200'}`}>
                {contract.active ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{contract.name}</h3>
            <div className="flex items-center text-base text-gray-500 dark:text-gray-200 mt-4 pt-4 border-t border-gray-200 dark:border-gray-500">
              <Calendar className="h-5 w-5 mr-2" />
              Criado em: {new Date(contract.created_at).toLocaleDateString('pt-BR')}
            </div>
          </div>
        ))}
      </div>

      {contracts.length === 0 && (
        <div className="col-span-full text-center py-12 bg-white dark:bg-gray-600 rounded-lg border border-dashed border-gray-300 dark:border-gray-500">
          <FileText className="h-14 w-14 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-gray-900 dark:text-white">Nenhum contrato encontrado</h3>
          <p className="text-base text-gray-500 dark:text-gray-200 mt-1">Não há contratos disponíveis.</p>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !isSaving && setIsModalOpen(false)}>
          <div
            className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-500 dark:bg-gray-600"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Adicionar contrato</h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-200">Cadastre um novo contrato para uso nas telas administrativas e operacionais.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={isSaving}
                className="rounded-md p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">Nome do contrato</label>
                <input
                  type="text"
                  required
                  value={contractName}
                  onChange={(e) => setContractName(e.target.value)}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-500 dark:bg-gray-700 dark:text-white dark:focus:border-red-600 dark:focus:ring-red-600"
                  placeholder="Ex.: 229 - ECO Barreira"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
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
                  {isSaving ? 'Salvando...' : 'Salvar contrato'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Contracts;
