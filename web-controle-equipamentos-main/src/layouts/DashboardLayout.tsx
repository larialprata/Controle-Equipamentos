import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../hooks/useTheme';
import { 
  LayoutDashboard, 
  FileText, 
  Truck, 
  ClipboardCheck, 
  LogOut, 
  Menu,
  Users,
  BarChart2,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { cn } from '../lib/utils';

const APP_VERSION = '1.0.5';

const DashboardLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuthStore();
  const { toggleTheme, isDark } = useTheme();
  const isMovementsPage = location.pathname === '/movimentacoes';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = user?.is_admin
    ? [
        { path: '/', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/contracts', label: 'Contratos', icon: FileText },
        { path: '/equipments', label: 'Equipamentos', icon: Truck },
      ]
    : [];

  if (user?.is_admin) {
    navItems.push({ path: '/users', label: 'Usuários', icon: Users });
    navItems.push({ path: '/bi', label: 'BI', icon: BarChart2 });
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex transition-colors">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 shadow-lg transform transition-all duration-200 ease-in-out lg:transform-none lg:w-64 transition-colors",
        isSidebarCollapsed && "lg:w-0 lg:min-w-0 lg:overflow-hidden",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-full flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-start justify-between gap-2">
              <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2 min-w-0">
              <ClipboardCheck className="text-blue-600 dark:text-red-800 flex-shrink-0 h-5 w-5" />
              <span className="truncate">Controle de Equipamentos</span>
              </h1>
            </div>
            {/* Toggle Modo escuro / Modo claro */}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => isDark && toggleTheme()}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors",
                  !isDark
                    ? "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                    : "bg-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300"
                )}
                aria-pressed={!isDark}
                aria-label="Modo claro"
              >
                <Sun className="h-4 w-4" />
                Claro
              </button>
              <button
                type="button"
                onClick={() => !isDark && toggleTheme()}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors",
                  isDark
                    ? "bg-gray-800 dark:bg-red-900/40 text-white dark:text-red-100 border border-red-800/50"
                    : "bg-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300"
                )}
                aria-pressed={isDark}
                aria-label="Modo escuro"
              >
                <Moon className="h-4 w-4" />
                Escuro
              </button>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                    isActive 
                      ? "bg-blue-50 dark:bg-red-900/30 text-blue-700 dark:text-red-200" 
                      : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100"
                  )}
                  onClick={() => setIsSidebarOpen(false)}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <LogOut className="h-5 w-5" />
              Sair
            </button>
            <p className="px-4 py-1 text-xs text-gray-500 dark:text-gray-400 text-center" title="Versão do app">
              v{APP_VERSION}
            </p>
          </div>
        </div>
      </aside>

      {/* Botão desktop para recolher/expandir totalmente o sidebar (meio lateral) */}
      <button
        type="button"
        onClick={() => setIsSidebarCollapsed((prev) => !prev)}
        className={cn(
          "hidden lg:inline-flex fixed top-1/2 -translate-y-1/2 z-50 h-10 w-10 items-center justify-center rounded-full border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-200 shadow-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-all",
          isSidebarCollapsed ? "left-3" : "left-[15.25rem]"
        )}
        aria-label={isSidebarCollapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
        title={isSidebarCollapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
      >
        {isSidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
      </button>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Mobile Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] shadow-sm dark:border-gray-700 dark:bg-gray-800 lg:hidden">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex flex-col items-center min-w-0">
              <span className="font-semibold text-gray-800 dark:text-gray-100 truncate">Controle de Equipamentos</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">v{APP_VERSION}</span>
            </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => isDark && toggleTheme()}
              className={cn("p-2 rounded-lg", !isDark ? "bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200" : "text-gray-500 dark:text-gray-400")}
              aria-label="Modo claro"
            >
              <Sun className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => !isDark && toggleTheme()}
              className={cn("p-2 rounded-lg", isDark ? "bg-gray-700 text-red-200" : "text-gray-500 dark:text-gray-400")}
              aria-label="Modo escuro"
            >
              <Moon className="h-5 w-5" />
            </button>
          </div>
        </header>

        <main className={cn(
          "flex-1 overflow-auto lg:p-8",
          isMovementsPage ? "p-3 sm:p-4" : "p-4",
        )}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
