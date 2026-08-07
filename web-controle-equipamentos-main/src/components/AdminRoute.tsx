import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const AdminRoute: React.FC = () => {
  const user = useAuthStore((state) => state.user);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!user.is_admin) {
    return <Navigate to="/login" replace state={{ message: 'Acesso restrito a administradores. Para movimentação, use o QR code do equipamento.' }} />;
  }

  return <Outlet />;
};

export default AdminRoute;
