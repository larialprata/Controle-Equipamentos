import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, ClipboardCheck, Loader2, MapPin, XCircle } from 'lucide-react';
import { publicMovimentacoesApi } from '../api/publicMovimentacoes';
import { compressImageFile } from '../lib/image';
import HorimeterPhotoCapture, { type HorimeterCaptureResult } from '../components/HorimeterPhotoCapture';
import type { CheckOperation, Equipment, OperationType } from '../types';
import guestBrandLogo from '../assets/logo-dimensional-full.png';

const GUEST_BRAND_LOGO_SRC = guestBrandLogo;

const DEVICE_STORAGE_KEY = 'guest-device-id';
const LOCATION_CACHE_KEY = 'guest-location-cache';
const LOCATION_CACHE_TTL_MS = 10 * 60 * 1000;
const GUEST_PHOTO_COMPRESS = {
  maxWidth: 1280,
  maxHeight: 1280,
  quality: 0.78,
  skipBelowBytes: 900_000,
} as const;

type CachedLocation = { latitude: number; longitude: number };

const getDeviceId = () => {
  const current = localStorage.getItem(DEVICE_STORAGE_KEY);
  if (current) return current;
  const generated = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `device-${Date.now()}`;
  localStorage.setItem(DEVICE_STORAGE_KEY, generated);
  return generated;
};

const readLocationCache = (): CachedLocation | null => {
  try {
    const raw = sessionStorage.getItem(LOCATION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedLocation & { ts?: number };
    if (!parsed.ts || Date.now() - parsed.ts > LOCATION_CACHE_TTL_MS) return null;
    if (!Number.isFinite(parsed.latitude) || !Number.isFinite(parsed.longitude)) return null;
    return { latitude: parsed.latitude, longitude: parsed.longitude };
  } catch {
    return null;
  }
};

const writeLocationCache = (location: CachedLocation) => {
  sessionStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify({ ...location, ts: Date.now() }));
};

const getLocation = async (): Promise<CachedLocation> =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalização não suportada neste navegador.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      () => reject(new Error('Não foi possível obter sua localização.')),
      { enableHighAccuracy: false, timeout: 5000, maximumAge: LOCATION_CACHE_TTL_MS },
    );
  });

const prefetchLocation = async (): Promise<CachedLocation | null> => {
  const cached = readLocationCache();
  if (cached) return cached;

  try {
    const location = await getLocation();
    writeLocationCache(location);
    return location;
  } catch {
    return null;
  }
};

const toErrorText = (err: any, fallback: string): string => {
  const message = err?.response?.data?.message;
  if (Array.isArray(message)) return message.join(' | ');
  if (typeof message === 'string' && message.trim()) return message;
  if (typeof err?.message === 'string' && err.message.trim()) return err.message.trim();
  return fallback;
};

const GuestMovimentacao: React.FC = () => {
  const { qr = '' } = useParams();
  const qrCode = qr.trim();
  const previewUrlRef = useRef<string | null>(null);

  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [pendingCheckout, setPendingCheckout] = useState<CheckOperation | null>(null);
  const [horimeter, setHorimeter] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cachedLocation, setCachedLocation] = useState<CachedLocation | null>(() => readLocationCache());
  const [loadingEquipment, setLoadingEquipment] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const clearPhoto = useCallback(() => {
    setPhoto(null);
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
  }, []);

  const handleHorimeterCapture = useCallback((result: HorimeterCaptureResult) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const nextUrl = URL.createObjectURL(result.file);
    previewUrlRef.current = nextUrl;
    setPhoto(result.file);
    setPreviewUrl(nextUrl);
  }, []);

  const loadContext = useCallback(async () => {
    if (!qrCode) {
      setEquipment(null);
      setPendingCheckout(null);
      setLoadingEquipment(false);
      return;
    }

    setLoadingEquipment(true);
    setMessage(null);

    try {
      const { equipment: found, openCheckin } = await publicMovimentacoesApi.getContext(qrCode);
      setEquipment(found);
      setPendingCheckout(openCheckin);
      setHorimeter('');
      clearPhoto();
    } catch (err: any) {
      setEquipment(null);
      setPendingCheckout(null);
      setMessage({
        type: 'error',
        text: toErrorText(err, 'QR code inválido ou equipamento não encontrado.'),
      });
    } finally {
      setLoadingEquipment(false);
    }
  }, [clearPhoto, qrCode]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  useEffect(() => {
    if (!qrCode) return;
    void prefetchLocation().then((location) => {
      if (location) setCachedLocation(location);
    });
  }, [qrCode]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const currentOperationType: OperationType = pendingCheckout ? 'checkout' : 'checkin';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!equipment?.contract_id || !equipment.equipment_type_id || !equipment.ativo_placa) {
      setMessage({ type: 'error', text: 'Equipamento inválido para esta movimentação.' });
      return;
    }

    if (!photo) {
      setMessage({ type: 'error', text: 'Tire a foto do horímetro para continuar.' });
      return;
    }

    const horimeterValue = Number(horimeter.replace(',', '.'));
    if (!Number.isFinite(horimeterValue) || horimeterValue <= 0) {
      setMessage({ type: 'error', text: 'Informe um horímetro válido.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const [uploadPhoto, location] = await Promise.all([
        compressImageFile(photo, GUEST_PHOTO_COMPRESS),
        cachedLocation
          ? Promise.resolve(cachedLocation)
          : prefetchLocation().then(async (cached) => {
              if (cached) return cached;
              const fresh = await getLocation();
              writeLocationCache(fresh);
              setCachedLocation(fresh);
              return fresh;
            }),
      ]);

      const created = await publicMovimentacoesApi.create({
        contract_id: equipment.contract_id,
        equipment_type_id: equipment.equipment_type_id,
        equipment_id: equipment.id,
        ativo_placa: equipment.ativo_placa,
        operation_type: currentOperationType,
        horimeter: horimeterValue,
        latitude: location.latitude,
        longitude: location.longitude,
        operation_datetime: new Date().toISOString(),
        photo: uploadPhoto,
        device_id: getDeviceId(),
      });

      setHorimeter('');
      clearPhoto();

      if (currentOperationType === 'checkin') {
        setPendingCheckout(created);
        setMessage({
          type: 'success',
          text: 'Abertura registrada. Preencha o horímetro e a foto para registrar o fechamento nesta mesma tela.',
        });
      } else {
        setPendingCheckout(null);
        setMessage({
          type: 'success',
          text: 'Fechamento registrado com sucesso.',
        });
      }
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: toErrorText(err, 'Não foi possível registrar a movimentação.'),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-6 dark:bg-gray-900 sm:px-6">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 sm:max-w-lg">
        <section className="rounded-[1.25rem] border border-gray-200 bg-white px-4 py-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:px-6 sm:py-6">
          <img
            src={GUEST_BRAND_LOGO_SRC}
            alt="Dimensional Engenharia"
            className="mx-auto block h-auto w-full max-w-[400px] object-contain"
          />
        </section>

        {message && (
          <div
            className={`rounded-[1.25rem] border px-4 py-3 text-sm leading-6 ${
              message.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-700 dark:bg-green-900/20 dark:text-green-200'
                : 'border-red-200 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-900/20 dark:text-red-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {message.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              <span>{message.text}</span>
            </div>
          </div>
        )}

        {loadingEquipment ? (
          <div className="flex min-h-[120px] items-center justify-center rounded-[1.25rem] border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <Loader2 className="h-7 w-7 animate-spin text-red-600" />
          </div>
        ) : equipment ? (
          <form onSubmit={handleSubmit} className="rounded-[1.25rem] border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-5">
            <div className="grid gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">Horímetro</label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={horimeter}
                  onChange={(e) => setHorimeter(e.target.value)}
                  className="block min-h-[56px] w-full rounded-[1.1rem] border border-gray-300 bg-white px-4 py-3 text-lg text-gray-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-red-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  placeholder="Ex.: 1234.5"
                />
              </div>

              <HorimeterPhotoCapture
                previewUrl={previewUrl}
                disabled={loading}
                compressOptions={GUEST_PHOTO_COMPRESS}
                onCapture={handleHorimeterCapture}
                onClear={clearPhoto}
              />


              <div className="rounded-[1.1rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>A localização será capturada no envio.</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[1.1rem] bg-red-600 px-4 py-3 text-base font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ClipboardCheck className="h-5 w-5" />}
                {loading ? 'Enviando...' : `Registrar ${currentOperationType === 'checkin' ? 'abertura' : 'fechamento'}`}
              </button>
            </div>
          </form>
        ) : (
          <div className="rounded-[1.25rem] border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/20 dark:text-red-200">
            Não foi possível carregar este QR code. Verifique se o link está correto.
          </div>
        )}
      </div>
    </div>
  );
};

export default GuestMovimentacao;
