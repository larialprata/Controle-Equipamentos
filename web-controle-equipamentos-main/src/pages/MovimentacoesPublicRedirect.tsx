import React from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';

/** Links antigos: /movimentacoes?qr=... → /q/... (página pública) */
const MovimentacoesPublicRedirect: React.FC = () => {
  const [searchParams] = useSearchParams();
  const qr = searchParams.get('qr')?.trim();

  if (!qr) {
    return <Navigate to="/login" replace state={{ message: 'Use o QR code do equipamento para registrar a movimentação.' }} />;
  }

  return <Navigate to={`/q/${encodeURIComponent(qr)}`} replace />;
};

export default MovimentacoesPublicRedirect;
