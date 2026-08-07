import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, FileDown, Loader2, Printer } from 'lucide-react';
import { buildMovementQrUrl, buildQrDataUrlWithLogo } from '../lib/qr';
import { downloadEquipmentQrPdf } from '../lib/qrPdf';

const PrintEquipmentQr: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [src, setSrc] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);

  const value = searchParams.get('value')?.trim() || '';
  const ativo = searchParams.get('ativo')?.trim() || '';
  const equipmentName = searchParams.get('name')?.trim() || '';

  useEffect(() => {
    let mounted = true;

    if (!value) {
      setSrc('');
      return () => {
        mounted = false;
      };
    }

    buildQrDataUrlWithLogo(buildMovementQrUrl(value), {
      width: 280,
      margin: 1,
    }).then((url) => {
      if (mounted) setSrc(url);
    });

    return () => {
      mounted = false;
    };
  }, [value]);

  return (
    <div className="print-qr-page min-h-screen bg-gray-100 px-4 py-6 dark:bg-gray-900 sm:px-6">
      <div className="mx-auto flex max-w-[105mm] flex-col gap-4">
        <div data-print-hidden="true" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            to="/equipments"
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para equipamentos
          </Link>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 dark:bg-red-800 dark:hover:bg-red-700"
            >
              <Printer className="h-4 w-4" />
              Imprimir
            </button>
            <button
              type="button"
              disabled={!value || pdfLoading}
              onClick={() => {
                setPdfLoading(true);
                void downloadEquipmentQrPdf({
                  qrValue: value,
                  ativoPlaca: ativo,
                  equipmentName: equipmentName || undefined,
                }).finally(() => setPdfLoading(false));
              }}
              className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              Baixar PDF
            </button>
          </div>
        </div>

        <div className="print-qr-card rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex flex-col items-center text-center">
            <p className="print-qr-label text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
              QR para movimentações
            </p>
            <h1 className="print-qr-title mt-2 text-xl font-bold tracking-tight text-gray-900 dark:text-white">
              {ativo || 'Ativo não informado'}
            </h1>
            {equipmentName && (
              <p className="print-qr-subtitle mt-1 text-sm text-gray-600 dark:text-gray-300">{equipmentName}</p>
            )}

            <div className="print-qr-frame mt-4 flex items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-900">
              {src ? (
                <img
                  src={src}
                  alt={`QR do ativo ${ativo || equipmentName || value}`}
                  className="print-qr-image h-40 w-40 rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-600"
                />
              ) : (
                <div className="text-sm text-red-600 dark:text-red-300">
                  Não foi possível gerar o QR code para impressão.
                </div>
              )}
            </div>

            <p className="print-qr-code mt-3 break-all text-xs text-gray-500 dark:text-gray-400">
              Código vinculado: {value || '—'}
            </p>
            <p className="print-qr-note mt-2 text-xs leading-5 text-gray-600 dark:text-gray-300">
              Escaneie este QR para abrir a página de movimentações do ativo diretamente no celular.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintEquipmentQr;
