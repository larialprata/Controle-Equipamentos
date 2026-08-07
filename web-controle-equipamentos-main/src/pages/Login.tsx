import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../api/auth';
import type { User } from '../types';
import { Lock, User as UserIcon, Loader2 } from 'lucide-react';

type LoginLocationState = {
  message?: string;
  from?: {
    pathname?: string;
    search?: string;
  };
};

const Login: React.FC = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as LoginLocationState | null;
  const setToken = useAuthStore((state) => state.setToken);
  const setUser = useAuthStore((state) => state.setUser);
  const logout = useAuthStore((state) => state.logout);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await authApi.login(identifier, password);
      setToken(response.access_token);
      let isAdmin = false;
      
      try {
        // Decode JWT to get user info since login response might not have it
        const base64Url = response.access_token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        const payload = JSON.parse(jsonPayload);
        
        // Nome: só claims que são realmente nome (nunca usar id/sub)
        const nameFromToken =
          payload.full_name ??
          payload.name ??
          payload.given_name ??
          payload.preferred_username ??
          'Usuário';

        const userFromToken: any = {
          id: payload.sub,
          email: payload.email ?? '',
          cpf: payload.cpf ?? '',
          is_admin: payload.is_admin === true || payload.isAdmin === true || payload.role === 'admin',
          full_name: nameFromToken,
          is_active: true,
          phone: null,
          address: null,
          contract_id: payload.contract_id ?? null,
          created_at: new Date().toISOString()
        };
        isAdmin = userFromToken.is_admin === true;

        if (response.user) {
          const apiUser = response.user as User & { name?: string };
          const fullName = apiUser.full_name ?? apiUser.name ?? nameFromToken;
          setUser({ ...response.user, full_name: fullName, is_admin: userFromToken.is_admin });
        } else {
          setUser(userFromToken);
        }
      } catch (e) {
        console.error("Failed to decode token or process user", e);
        if (response.user) {
          const apiUser = response.user as User & { name?: string };
          const fullName = apiUser.full_name ?? apiUser.name ?? 'Usuário';
          isAdmin = apiUser.is_admin === true;
          setUser({ ...response.user, full_name: fullName });
        } else {
          setUser({
            id: '',
            email: null,
            full_name: 'Usuário',
            cpf: '',
            is_admin: false,
            is_active: true,
            phone: null,
            address: null,
            created_at: new Date().toISOString()
          });
        }
      }

      const redirectTarget = locationState?.from?.pathname
        ? `${locationState.from.pathname}${locationState.from.search ?? ''}`
        : '/';

      if (!isAdmin) {
        logout();
        setError('Acesso restrito a administradores. Para movimentação, use o QR code impresso no equipamento.');
        return;
      }

      navigate(redirectTarget, { replace: true });
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.response?.data?.message || 'Falha no login. Verifique suas credenciais.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 px-4 transition-colors">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 border border-gray-200 dark:border-gray-700">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Controle de Equipamentos</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">Acesso administrativo ao sistema</p>
        </div>

        {(error || locationState?.message) && (
          <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 dark:border-red-700 p-4 mb-6">
            <p className="text-red-700 dark:text-red-200 text-sm">{error ?? locationState?.message}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nome, CPF ou e-mail
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <UserIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-blue-500 dark:focus:ring-red-600 focus:border-blue-500 dark:focus:border-red-600"
                placeholder="Digite seu nome, CPF ou e-mail"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Senha
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-blue-500 dark:focus:ring-red-600 focus:border-blue-500 dark:focus:border-red-600"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 dark:bg-red-800 hover:bg-blue-700 dark:hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-red-600 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                Entrando...
              </>
            ) : (
              'Entrar'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
