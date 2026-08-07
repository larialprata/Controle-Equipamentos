import React, { useEffect, useState } from 'react';
import { authApi } from '../api/auth';
import { contractsApi } from '../api/contracts';
import { User, Contract } from '../types';
import { useAuthStore } from '../store/authStore';
import { Loader2, User as UserIcon, Check, X, Shield, ShieldAlert, MapPin, FileText, ZoomIn, ZoomOut, RotateCw, Undo2, Plus, Lock, Trash2, Mail } from 'lucide-react';
import AuthenticatedImage from '../components/AuthenticatedImage';

const UUID_LIKE_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isUuidLike = (value: string): boolean => UUID_LIKE_REGEX.test(value.trim());

const getContractUuid = (contract: Contract): string | null => {
  const raw = (contract as any)?.id ?? (contract as any)?.contract_id;
  if (typeof raw !== 'string') return null;
  const normalized = raw.trim();
  return normalized && isUuidLike(normalized) ? normalized : null;
};

const toErrorText = (err: any, fallback: string): string => {
  const message = err?.response?.data?.message;
  if (Array.isArray(message)) return message.join(' | ');
  if (typeof message === 'string' && message.trim()) return message;
  if (typeof err?.message === 'string' && err.message.trim()) return err.message;
  return fallback;
};

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [adminLoadingId, setAdminLoadingId] = useState<string | null>(null);
  const [adminMessage, setAdminMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [contractLoadingId, setContractLoadingId] = useState<string | null>(null);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);
  const [photoPreviewOpen, setPhotoPreviewOpen] = useState(false);
  const [photoPreviewBlobUrl, setPhotoPreviewBlobUrl] = useState<string | null>(null);
  const [photoPreviewError, setPhotoPreviewError] = useState<string | null>(null);
  const [photoZoom, setPhotoZoom] = useState(1);
  const [photoRotation, setPhotoRotation] = useState(0);
  const [photoPanX, setPhotoPanX] = useState(0);
  const [photoPanY, setPhotoPanY] = useState(0);
  const [isPhotoDragging, setIsPhotoDragging] = useState(false);
  const [isPhotoLoading, setIsPhotoLoading] = useState(false);
  const [photoPreviewTitle, setPhotoPreviewTitle] = useState('Foto CNH');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createForm, setCreateForm] = useState({
    full_name: '',
    email: '',
    cpf: '',
    password: '',
    contract_id: '',
  });
  const validContracts = contracts
    .map((c) => ({ contract: c, uuid: getContractUuid(c) }))
    .filter((item): item is { contract: Contract; uuid: string } => Boolean(item.uuid));
  const { user: currentUser } = useAuthStore();

  useEffect(() => {
    if (!isPhotoDragging) return;
    const onMove = (e: MouseEvent) => {
      setPhotoPanX((prev) => prev + e.movementX);
      setPhotoPanY((prev) => prev + e.movementY);
    };
    const onUp = () => setIsPhotoDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isPhotoDragging]);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    contractsApi.getAll().then(setContracts).catch(() => setContracts([]));
  }, []);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const data = await authApi.getUsers();
      setUsers(data);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch users:', err);
      if (err.response?.status === 403 || err.response?.status === 401) {
        setError('Você não tem permissão para visualizar usuários.');
      } else {
        setError('Falha ao carregar usuários. Tente novamente mais tarde.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleStatus = async (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await authApi.toggleUserStatus(userId);
      setUsers(users.map(u => u.id === userId ? { ...u, is_active: !u.is_active } : u));
      if (selectedUser?.id === userId) {
        setSelectedUser(prev => prev ? { ...prev, is_active: !prev.is_active } : null);
      }
    } catch (err) {
      console.error('Failed to toggle user status:', err);
    }
  };

  const handleSetAdmin = async (userId: string, is_admin: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    setAdminMessage(null);
    setAdminLoadingId(userId);
    try {
      await authApi.setUserAdmin(userId, is_admin);
      setUsers(users.map(u => u.id === userId ? { ...u, is_admin } : u));
      if (selectedUser?.id === userId) {
        setSelectedUser(prev => prev ? { ...prev, is_admin } : null);
      }
      setAdminMessage({
        type: 'success',
        text: is_admin ? 'Permissão de administrador concedida.' : 'Permissão de administrador removida.',
      });
    } catch (err: any) {
      console.error('Failed to update admin status:', err);
      const msg = toErrorText(err, 'Falha ao atualizar. Verifique se o backend tem a rota PATCH /api/users/:id com { is_admin }.');
      setAdminMessage({ type: 'error', text: msg });
    } finally {
      setAdminLoadingId(null);
    }
  };

  const closeModal = () => setSelectedUser(null);

  const closePhotoPreview = () => {
    setPhotoPreviewOpen(false);
    setIsPhotoLoading(false);
    setPhotoPreviewError(null);
    setPhotoZoom(1);
    setPhotoRotation(0);
    setPhotoPanX(0);
    setPhotoPanY(0);
    if (photoPreviewBlobUrl) {
      URL.revokeObjectURL(photoPreviewBlobUrl);
      setPhotoPreviewBlobUrl(null);
    }
  };

  const openPhotoPreview = async (filename?: string, userName?: string) => {
    if (!filename?.trim()) return;
    setPhotoPreviewOpen(true);
    setIsPhotoLoading(true);
    setPhotoPreviewError(null);
    setPhotoPreviewBlobUrl(null);
    setPhotoZoom(1);
    setPhotoRotation(0);
    setPhotoPanX(0);
    setPhotoPanY(0);
    setPhotoPreviewTitle(userName ? `CNH de ${userName}` : 'Foto CNH');
    try {
      const blobUrl = await authApi.getDocumentPhotoBlobUrl(filename);
      setPhotoPreviewBlobUrl(blobUrl);
    } catch {
      setPhotoPreviewError('Erro ao carregar a foto da CNH.');
    } finally {
      setIsPhotoLoading(false);
    }
  };

  const getContractName = (user: User) => {
    if (user.contract?.name) return user.contract.name;
    const id = user.contract_id ?? undefined;
    if (!id) return '—';
    return contracts.find((c) => c.id === id)?.name ?? id;
  };

  const handleSetContract = async (userId: string, contractId: string, e: React.MouseEvent | React.ChangeEvent) => {
    e.stopPropagation?.();
    setContractLoadingId(userId);
    setAdminMessage(null);
    try {
      const normalized = contractId.trim();
      if (normalized && !isUuidLike(normalized)) {
        setAdminMessage({ type: 'error', text: `Contrato inválido selecionado: "${normalized}".` });
        return;
      }
      const updated = await authApi.setUserContract(userId, normalized || null);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...updated, contract_id: updated.contract_id ?? null, contract: updated.contract } : u)));
      if (selectedUser?.id === userId) {
        setSelectedUser((prev) => (prev ? { ...prev, ...updated, contract_id: updated.contract_id ?? null, contract: updated.contract } : null));
      }
      setAdminMessage({ type: 'success', text: normalized ? 'Contrato vinculado ao usuário.' : 'Vínculo com contrato removido.' });
    } catch (err: any) {
      const msg = toErrorText(err, 'Falha ao atualizar contrato. Verifique se o backend aceita PATCH /api/users/:id com { contract_id }.');
      setAdminMessage({ type: 'error', text: msg });
    } finally {
      setContractLoadingId(null);
    }
  };

  const handleSetEmail = async (userId: string, email: string) => {
    setContractLoadingId(userId);
    setAdminMessage(null);
    try {
      const normalized = email.trim().toLowerCase() || null;
      const updated = await authApi.setUserEmail(userId, normalized);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...updated } : u)));
      if (selectedUser?.id === userId) setSelectedUser((prev) => (prev ? { ...prev, ...updated } : null));
      setAdminMessage({ type: 'success', text: normalized ? 'E-mail atualizado.' : 'E-mail removido.' });
    } catch (err: any) {
      setAdminMessage({ type: 'error', text: toErrorText(err, 'Falha ao atualizar e-mail.') });
    } finally {
      setContractLoadingId(null);
    }
  };

  const handleCreateOperator = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setAdminMessage(null);

    try {
      const created = await authApi.createOperator({
        full_name: createForm.full_name.trim(),
        email: createForm.email.trim() || null,
        cpf: createForm.cpf.replace(/\D+/g, ''),
        password: createForm.password,
        contract_id: createForm.contract_id || null,
      });
      setUsers((prev) => [created, ...prev]);
      setCreateForm({ full_name: '', email: '', cpf: '', password: '', contract_id: '' });
      setIsCreateModalOpen(false);
      setAdminMessage({ type: 'success', text: 'Operador cadastrado com sucesso.' });
    } catch (err: any) {
      setAdminMessage({ type: 'error', text: toErrorText(err, 'Falha ao cadastrar operador.') });
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (currentUser?.id === userId) {
      setAdminMessage({ type: 'error', text: 'Você não pode excluir o próprio usuário.' });
      return;
    }

    const confirmed = window.confirm(`Deseja realmente excluir o usuário "${userName}"?`);
    if (!confirmed) return;

    setDeleteLoadingId(userId);
    setAdminMessage(null);

    try {
      const result = await authApi.deleteUser(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      if (selectedUser?.id === userId) {
        setSelectedUser(null);
      }
      setAdminMessage({ type: 'success', text: result.message || 'Usuário excluído com sucesso.' });
    } catch (err: any) {
      setAdminMessage({ type: 'error', text: toErrorText(err, 'Falha ao excluir usuário.') });
    } finally {
      setDeleteLoadingId(null);
    }
  };

  if (!currentUser?.is_admin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <ShieldAlert className="h-16 w-16 text-red-500 dark:text-red-400 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Acesso negado</h2>
        <p className="text-gray-600 dark:text-gray-200">Você precisa ser administrador para acessar esta página.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-red-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 dark:border-red-700 p-4 rounded-md">
        <div className="flex items-center">
          <ShieldAlert className="h-5 w-5 text-red-500 dark:text-red-400 mr-2" />
          <p className="text-red-700 dark:text-red-200">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Usuários</h1>
            <p className="text-gray-600 dark:text-gray-200">Gerencie acesso e permissões dos usuários</p>
          </div>
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 dark:bg-red-800 dark:hover:bg-red-700"
          >
            <Plus className="h-4 w-4" />
            Registrar operador
          </button>
        </div>
      </div>

      {adminMessage && (
        <div
          className={`mb-4 p-4 rounded-lg border ${
            adminMessage.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700 text-green-800 dark:text-green-200'
              : 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700 text-red-800 dark:text-red-200'
          }`}
        >
          {adminMessage.text}
        </div>
      )}

      <div className="bg-white dark:bg-gray-600 rounded-lg shadow-md overflow-hidden border border-gray-100 dark:border-gray-500">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-500">
            <thead className="bg-gray-50 dark:bg-gray-500">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-white uppercase tracking-wider">
                  Usuário
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-white uppercase tracking-wider">
                  Contrato vinculado
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-white uppercase tracking-wider">
                  Perfil
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-white uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-white uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-600 divide-y divide-gray-200 dark:divide-gray-500">
              {users.map((user) => (
                <tr 
                  key={user.id} 
                  className="hover:bg-gray-50 dark:hover:bg-gray-500/80 transition-colors cursor-pointer"
                  onClick={() => setSelectedUser(user)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openPhotoPreview(user.cnh_photo, user.full_name);
                        }}
                        disabled={!user.cnh_photo}
                        className="flex-shrink-0 h-10 w-10 bg-gray-100 dark:bg-gray-500 rounded-full flex items-center justify-center overflow-hidden disabled:cursor-default"
                        title={user.cnh_photo ? 'Clique para ampliar a foto da CNH' : 'Sem foto'}
                      >
                        <AuthenticatedImage
                          filename={user.cnh_photo}
                          alt={`Foto de ${user.full_name}`}
                          className="h-10 w-10 object-cover"
                          fallbackIcon={<UserIcon className="h-6 w-6 text-gray-400 dark:text-gray-400" />}
                        />
                      </button>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{user.full_name}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-200">CPF: {user.cpf || '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {getContractName(user)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      {user.is_admin ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 dark:bg-red-900/40 text-purple-800 dark:text-red-100 items-center gap-1">
                          <Shield className="h-3 w-3" /> Admin
                        </span>
                      ) : (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 dark:bg-gray-500 text-gray-800 dark:text-gray-200">
                          Usuário
                        </span>
                      )}
                      {currentUser?.id !== user.id && (
                        <button
                          type="button"
                          onClick={(e) => handleSetAdmin(user.id, !user.is_admin, e)}
                          disabled={adminLoadingId === user.id}
                          className="text-xs text-blue-600 dark:text-red-300 hover:text-blue-800 dark:hover:text-red-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {adminLoadingId === user.id ? 'Salvando...' : user.is_admin ? 'Remover ADM' : 'Dar ADM'}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      user.is_active ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200'
                    }`}>
                      {user.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {currentUser?.id !== user.id && ( // Prevent toggling own status if wanted, though API might allow it
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => handleToggleStatus(user.id, e)}
                          className={`inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white ${
                            user.is_active 
                              ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' 
                              : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                          } focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-600 transition-colors`}
                        >
                          {user.is_active ? (
                            <>
                              <X className="h-3 w-3 mr-1" /> Desativar
                            </>
                          ) : (
                            <>
                              <Check className="h-3 w-3 mr-1" /> Ativar
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteUser(user.id, user.full_name, e)}
                          disabled={deleteLoadingId === user.id}
                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-red-700 hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {deleteLoadingId === user.id ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3 mr-1" />
                          )}
                          Excluir
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {users.length === 0 && (
            <div className="text-center py-12">
              <UserIcon className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Nenhum usuário encontrado</h3>
              <p className="text-gray-500 dark:text-gray-200">Não há outros usuários cadastrados no sistema.</p>
            </div>
          )}
        </div>
      </div>

      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !createLoading && setIsCreateModalOpen(false)}>
          <div
            className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-500 dark:bg-gray-600"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Registrar operador</h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-200">
                  Cadastre nome, e-mail, CPF e senha para liberar acesso às Movimentações.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-md p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-500"
                disabled={createLoading}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOperator} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">Nome completo</label>
                <input
                  type="text"
                  value={createForm.full_name}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, full_name: e.target.value }))}
                  required
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-500 dark:bg-gray-700 dark:text-white dark:focus:border-red-600 dark:focus:ring-red-600"
                  placeholder="Nome completo do operador"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">E-mail</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))}
                    required
                    className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-500 dark:bg-gray-700 dark:text-white dark:focus:border-red-600 dark:focus:ring-red-600"
                    placeholder="operador@exemplo.com"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">CPF</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={createForm.cpf}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, cpf: e.target.value.replace(/\D+/g, '').slice(0, 11) }))}
                  required
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-500 dark:bg-gray-700 dark:text-white dark:focus:border-red-600 dark:focus:ring-red-600"
                  placeholder="Somente números"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">Senha</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="password"
                    value={createForm.password}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, password: e.target.value }))}
                    minLength={6}
                    required
                    className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-500 dark:bg-gray-700 dark:text-white dark:focus:border-red-600 dark:focus:ring-red-600"
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">Contrato vinculado</label>
                <select
                  value={createForm.contract_id}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, contract_id: e.target.value }))}
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-500 dark:bg-gray-700 dark:text-white dark:focus:border-red-600 dark:focus:ring-red-600"
                >
                  <option value="">Nenhum (definir depois)</option>
                  {validContracts.filter((item) => item.contract.active).map(({ contract, uuid }) => (
                    <option key={uuid} value={uuid}>
                      {contract.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-500 dark:text-gray-200 dark:hover:bg-gray-500"
                  disabled={createLoading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-red-800 dark:hover:bg-red-700"
                  disabled={createLoading}
                >
                  {createLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {createLoading ? 'Salvando...' : 'Criar operador'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50" onClick={closeModal}>
          <div 
            className="bg-white dark:bg-gray-600 rounded-lg shadow-xl max-w-2xl w-full overflow-hidden border border-gray-200 dark:border-gray-500" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-gray-500">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Detalhes do usuário</h3>
              <button onClick={closeModal} className="text-gray-400 dark:text-gray-300 hover:text-gray-500 dark:hover:text-white">
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-500">
                  <p className="text-xs text-gray-500 dark:text-gray-300 uppercase font-semibold">Nome completo</p>
                  <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{selectedUser.full_name}</p>
                </div>

                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-500 rounded-lg">
                  <Shield className="h-5 w-5 text-gray-400 dark:text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-300 uppercase font-semibold">CPF</p>
                    <p className="text-gray-900 dark:text-white">{selectedUser.cpf}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-500 rounded-lg">
                  <Mail className="h-5 w-5 text-gray-400 dark:text-gray-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 dark:text-gray-300 uppercase font-semibold mb-1">E-mail</p>
                    <input
                      type="email"
                      key={`${selectedUser.id}-email-${selectedUser.email ?? ''}`}
                      defaultValue={selectedUser.email ?? ''}
                      onBlur={(e) => {
                        const next = e.target.value.trim().toLowerCase();
                        const current = (selectedUser.email ?? '').trim().toLowerCase();
                        if (next !== current) handleSetEmail(selectedUser.id, e.target.value);
                      }}
                      disabled={contractLoadingId === selectedUser.id}
                      placeholder="usuario@exemplo.com"
                      className="block w-full border border-gray-300 dark:border-gray-500 rounded-md shadow-sm bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:ring-blue-500 dark:focus:ring-red-600 p-2 text-sm disabled:opacity-60"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-300">Salva ao sair do campo. Deixe vazio para remover.</p>
                    {contractLoadingId === selectedUser.id && (
                      <span className="inline-flex items-center gap-1 mt-1 text-xs text-gray-500 dark:text-gray-400">
                        <Loader2 className="h-3 w-3 animate-spin" /> Salvando...
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-500 rounded-lg">
                  <FileText className="h-5 w-5 text-gray-400 dark:text-gray-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 dark:text-gray-300 uppercase font-semibold mb-1">Contrato vinculado</p>
                    <p className="text-gray-600 dark:text-gray-300 text-sm mb-2">O operador só poderá registrar movimentações para o contrato selecionado.</p>
                    <select
                      value={selectedUser.contract_id ?? ''}
                      onChange={(e) => handleSetContract(selectedUser.id, e.target.value, e)}
                      disabled={contractLoadingId === selectedUser.id}
                      className="block w-full border border-gray-300 dark:border-gray-500 rounded-md shadow-sm bg-white dark:bg-gray-600 text-gray-900 dark:text-white focus:ring-blue-500 dark:focus:ring-red-600 p-2 text-sm"
                    >
                      <option value="">Nenhum (todos os contratos)</option>
                      {validContracts.filter((item) => item.contract.active).map(({ contract, uuid }) => (
                        <option key={uuid} value={uuid}>{contract.name}</option>
                      ))}
                    </select>
                    {contractLoadingId === selectedUser.id && (
                      <span className="inline-flex items-center gap-1 mt-1 text-xs text-gray-500 dark:text-gray-400">
                        <Loader2 className="h-3 w-3 animate-spin" /> Salvando...
                      </span>
                    )}
                  </div>
                </div>

              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-500/50 px-6 py-4 flex justify-end gap-3 flex-wrap border-t border-gray-200 dark:border-gray-500">
              {currentUser?.id !== selectedUser.id && (
                <>
                  <button
                    type="button"
                    onClick={(e) => handleSetAdmin(selectedUser.id, !selectedUser.is_admin, e)}
                    disabled={adminLoadingId === selectedUser.id}
                    className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                      selectedUser.is_admin
                        ? 'bg-gray-600 hover:bg-gray-700 text-white focus:ring-gray-500'
                        : 'bg-purple-600 dark:bg-red-800 hover:bg-purple-700 dark:hover:bg-red-700 text-white focus:ring-purple-500 dark:focus:ring-red-600'
                    } focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-600 transition-colors`}
                  >
                    {adminLoadingId === selectedUser.id ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Shield className="h-4 w-4 mr-2" />
                    )}
                    {adminLoadingId === selectedUser.id
                      ? 'Salvando...'
                      : selectedUser.is_admin
                        ? 'Remover permissão de admin'
                        : 'Dar permissão de admin'}
                  </button>
                  <button
                    onClick={(e) => handleToggleStatus(selectedUser.id, e as any)}
                    className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
                      selectedUser.is_active 
                        ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' 
                        : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                    } focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-600 transition-colors`}
                  >
                    {selectedUser.is_active ? 'Desativar usuário' : 'Ativar usuário'}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteUser(selectedUser.id, selectedUser.full_name, e)}
                    disabled={deleteLoadingId === selectedUser.id}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-700 hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed dark:focus:ring-offset-gray-600 transition-colors"
                  >
                    {deleteLoadingId === selectedUser.id ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    Excluir usuário
                  </button>
                </>
              )}
              <button
                type="button"
                className="inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-500 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-red-600 dark:focus:ring-offset-gray-600"
                onClick={closeModal}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
      {photoPreviewOpen && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-4 bg-black/50 backdrop-blur-md"
          onClick={closePhotoPreview}
          role="dialog"
          aria-modal="true"
          aria-label="Visualizar foto da CNH"
        >
          <div className="relative w-full max-w-[95vw] max-h-[95vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-wrap items-center justify-center gap-2 mb-4 p-3 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl shadow-black/20">
              <button type="button" onClick={closePhotoPreview} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/25 border border-white/20 text-white font-medium">
                <X className="h-5 w-5" />
                <span>Fechar</span>
              </button>
              {!!photoPreviewBlobUrl && (
                <>
                  <button type="button" onClick={() => setPhotoZoom((z) => Math.min(z + 0.25, 4))} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/25 border border-white/20 text-white font-medium">
                    <ZoomIn className="h-5 w-5" />
                    <span>Zoom +</span>
                  </button>
                  <button type="button" onClick={() => setPhotoZoom((z) => Math.max(z - 0.25, 0.25))} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/25 border border-white/20 text-white font-medium">
                    <ZoomOut className="h-5 w-5" />
                    <span>Zoom -</span>
                  </button>
                  <button type="button" onClick={() => setPhotoRotation((r) => (r + 90) % 360)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/25 border border-white/20 text-white font-medium">
                    <RotateCw className="h-5 w-5" />
                    <span>Girar 90°</span>
                  </button>
                  <button type="button" onClick={() => { setPhotoZoom(1); setPhotoRotation(0); setPhotoPanX(0); setPhotoPanY(0); }} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/25 border border-white/20 text-white font-medium">
                    <Undo2 className="h-5 w-5" />
                    <span>Restaurar</span>
                  </button>
                </>
              )}
            </div>
            <p className="text-white/90 text-sm mb-3">{photoPreviewTitle}</p>
            {isPhotoLoading && (
              <div className="rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 px-5 py-4 flex items-center gap-3">
                <div className="h-5 w-5 border-2 border-white/60 border-t-white rounded-full animate-spin" />
                <p className="text-white font-medium">Carregando foto...</p>
              </div>
            )}
            {photoPreviewError && !isPhotoLoading && (
              <div className="rounded-2xl bg-red-500/20 backdrop-blur-xl border border-red-400/30 px-5 py-3 shadow-xl">
                <p className="text-white font-medium">{photoPreviewError}</p>
              </div>
            )}
            {photoPreviewBlobUrl && !isPhotoLoading && (
              <div
                className="overflow-auto flex items-center justify-center min-h-[200px] rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-2 select-none"
                style={{ maxHeight: '85vh', cursor: isPhotoDragging ? 'grabbing' : 'grab' }}
                onWheel={(e) => {
                  if (e.deltaY < 0) setPhotoZoom((z) => Math.min(z + 0.1, 4));
                  else setPhotoZoom((z) => Math.max(z - 0.1, 0.25));
                }}
                onMouseDown={(e) => {
                  if (e.button !== 0) return;
                  e.preventDefault();
                  setIsPhotoDragging(true);
                }}
              >
                <img
                  src={photoPreviewBlobUrl}
                  alt={photoPreviewTitle}
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

export default Users;
