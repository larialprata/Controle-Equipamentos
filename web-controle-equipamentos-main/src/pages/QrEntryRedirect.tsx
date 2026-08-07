import React from 'react';
import { Navigate, useParams } from 'react-router-dom';

const QrEntryRedirect: React.FC = () => {
  const { qr = '' } = useParams();

  if (!qr.trim()) {
    return <Navigate to="/login" replace state={{ message: 'QR code inválido.' }} />;
  }

  return <Navigate to={`/q/${encodeURIComponent(qr.trim())}`} replace />;
};

export default QrEntryRedirect;
