import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import DashboardLayout from './layouts/DashboardLayout';
import Home from './pages/Home';
import Contracts from './pages/Contracts';
import Equipments from './pages/Equipments';
import Users from './pages/Users';
import BI from './pages/BI';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import GuestMovimentacao from './pages/GuestMovimentacao';
import MovimentacoesPublicRedirect from './pages/MovimentacoesPublicRedirect';
import PrintEquipmentQr from './pages/PrintEquipmentQr';
import { useTheme } from './hooks/useTheme';
import { useAuthStore } from './store/authStore';

function RoleHome() {
  const user = useAuthStore((state) => state.user);
  if (!user) return <Navigate to="/login" replace />;
  if (!user.is_admin) {
    return <Navigate to="/login" replace state={{ message: 'Acesso administrativo apenas. Operadores devem usar o QR code do equipamento.' }} />;
  }
  return <Home />;
}

function App() {
  useTheme(); // aplica tema (light/dark) no document
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/q/:qr" element={<GuestMovimentacao />} />
        <Route path="/movimentacoes" element={<MovimentacoesPublicRedirect />} />
        
        <Route element={<ProtectedRoute />}>
          <Route path="/imprimir-qr" element={<PrintEquipmentQr />} />

          <Route element={<DashboardLayout />}>
            <Route path="/" element={<RoleHome />} />

            <Route element={<AdminRoute />}>
              <Route path="/contracts" element={<Contracts />} />
              <Route path="/equipments" element={<Equipments />} />
              <Route path="/bi" element={<BI />} />
              <Route path="/users" element={<Users />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
