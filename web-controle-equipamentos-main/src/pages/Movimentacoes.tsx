import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, CheckCircle2, ClipboardCheck, CloudOff, Loader2, MapPin, QrCode, RefreshCw, Search, Wifi, X, XCircle } from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { equipmentsApi } from '../api/equipments';
import { operationsApi } from '../api/operations';
import { useAuthStore } from '../store/authStore';
import { extractQrValue } from '../lib/qr';
import HorimeterPhotoCapture, { type HorimeterCaptureResult } from '../components/HorimeterPhotoCapture';
import { useOfflineSync } from '../hooks/useOfflineSync';
import {
  cacheEquipmentForQr,
  enqueuePendingOperation,
  getCachedEquipmentByQr,
  getLocalOpenCheckin,
  isBrowserOnline,
  isNetworkFailure,
  toSyntheticCheckOperation,
} from '../lib/offlineOperations';
import type { CheckOperation, Equipment, OperationType } from '../types';

const SCANNER_REGION_ID = 'movimentacoes-qr-reader';
const SCAN_FILE_REGION_ID = 'movimentacoes-qr-file-reader';
const DEVICE_STORAGE_KEY = 'device-id';
const MOVEMENT_LOCATION_CACHE_KEY = 'movement-location-cache';

const getDeviceId = () => {
  const current = localStorage.getItem(DEVICE_STORAGE_KEY);
  if (current) return current;
  const generated = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `device-${Date.now()}`;
  localStorage.setItem(DEVICE_STORAGE_KEY, generated);
  return generated;
};

const getLocation = async (): Promise<{ latitude: number; longitude: number }> =>
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
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 120_000 },
    );
  });

type MovementContext = {
  contract_id: string;
  equipment_type_id: string;
  ativo_placa: string;
  contract_label: string;
  equipment_label: string;
  obra_label: string;
  qr_label: string;
  opening_horimeter?: number;
};

const toErrorText = (err: any, fallback: string): string => {
  const message = err?.response?.data?.message;
  if (Array.isArray(message)) return message.join(' | ');
  if (typeof message === 'string' && message.trim()) return message;
  if (typeof err?.message === 'string' && err.message.trim()) {
    const normalizedMessage = err.message.trim();
    if (/No MultiFormat Readers were able to detect the code/i.test(normalizedMessage)) {
      return 'Não foi possível detectar o QR code na imagem. Aproxime mais a câmera, centralize o código, melhore a iluminação ou tente digitar o código manualmente.';
    }
    return normalizedMessage;
  }
  return fallback;
};

const normalizeAtivo = (value?: string | null): string =>
  (value ?? '').trim().toUpperCase().replace(/\s+/g, '');

const doesEquipmentMatchOperation = (equipment: Equipment, operation: CheckOperation): boolean => {
  const operationEquipmentTypeId = operation.equipment_type_id ?? operation.equipment_type?.id ?? null;
  return (
    equipment.contract_id === operation.contract_id &&
    (equipment.equipment_type_id ?? null) === operationEquipmentTypeId &&
    normalizeAtivo(equipment.ativo_placa) === normalizeAtivo(operation.ativo_placa)
  );
};

const pickBackCamera = async (): Promise<string | { facingMode: 'environment' }> => {
  try {
    const cameras = await Html5Qrcode.getCameras();
    if (!cameras?.length) return { facingMode: 'environment' };

    const backCamera = cameras.find((camera) =>
      /back|rear|traseira|trás|environment|wide/i.test(camera.label),
    );
    if (backCamera) return backCamera.id;

    return cameras[cameras.length - 1].id;
  } catch {
    return { facingMode: 'environment' };
  }
};

const readMovementLocationCache = (): { latitude: number; longitude: number } | null => {
  try {
    const raw = sessionStorage.getItem(MOVEMENT_LOCATION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { latitude: number; longitude: number };
    if (!Number.isFinite(parsed.latitude) || !Number.isFinite(parsed.longitude)) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeMovementLocationCache = (location: { latitude: number; longitude: number }) => {
  sessionStorage.setItem(MOVEMENT_LOCATION_CACHE_KEY, JSON.stringify(location));
};

const Movimentacoes: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const { pendingCount, isSyncing, isOnline, refreshPendingCount, syncPending } = useOfflineSync(user?.id);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const qrFileInputRef = useRef<HTMLInputElement | null>(null);
  const lastAutoResolvedQrRef = useRef<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [qrCodeValue, setQrCodeValue] = useState('');
  const [manualQrCode, setManualQrCode] = useState('');
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [pendingCheckout, setPendingCheckout] = useState<CheckOperation | null>(null);
  const [horimeter, setHorimeter] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cachedLocation, setCachedLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isPhotoPreviewOpen, setIsPhotoPreviewOpen] = useState(false);
  const [requiredCheckout, setRequiredCheckout] = useState<CheckOperation | null>(null);
  const [loading, setLoading] = useState(false);
  const [resolvingQr, setResolvingQr] = useState(false);
  const [processingQrCapture, setProcessingQrCapture] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const canUseCameraScanner =
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia;

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) return;

    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
    } catch {
      // noop
    }

    try {
      scanner.clear();
    } catch {
      // noop
    }
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      void stopScanner();
    };
  }, [previewUrl, stopScanner]);

  const clearPhoto = useCallback(() => {
    setPhoto(null);
    setIsPhotoPreviewOpen(false);
    setPreviewUrl((previousUrl) => {
      if (previousUrl) URL.revokeObjectURL(previousUrl);
      return null;
    });
  }, []);

  const handleHorimeterCapture = useCallback((result: HorimeterCaptureResult) => {
    setPhoto(result.file);
    setIsPhotoPreviewOpen(false);
    setPreviewUrl((previousUrl) => {
      if (previousUrl) URL.revokeObjectURL(previousUrl);
      return URL.createObjectURL(result.file);
    });
  }, []);

  const clearSelection = useCallback(() => {
    setEquipment(null);
    setPendingCheckout(null);
    setQrCodeValue('');
    setManualQrCode('');
    setHorimeter('');
    clearPhoto();
  }, [clearPhoto]);

  const refreshRequiredCheckout = useCallback(async (): Promise<CheckOperation | null> => {
    let serverCheckin: CheckOperation | null = null;
    if (isBrowserOnline()) {
      try {
        serverCheckin = await operationsApi.getLastCheckin();
      } catch {
        serverCheckin = null;
      }
    }

    const localOpen = user?.id ? await getLocalOpenCheckin(user.id) : null;
    const localCheckin = localOpen ? toSyntheticCheckOperation(localOpen) : null;
    const merged = serverCheckin ?? localCheckin;
    setRequiredCheckout(merged);
    return merged;
  }, [user?.id]);

  const resolveEquipment = useCallback(async (value: string) => {
    const normalized = extractQrValue(value);
    if (!normalized) return;

    setResolvingQr(true);
    setMessage(null);

    try {
      let found: Equipment | null = null;
      let usedCache = false;

      if (isBrowserOnline()) {
        try {
          found = await equipmentsApi.getByQrCode(normalized);
          await cacheEquipmentForQr(normalized, found);
        } catch (err) {
          if (!isNetworkFailure(err)) throw err;
          found = await getCachedEquipmentByQr(normalized);
          usedCache = true;
        }
      } else {
        found = await getCachedEquipmentByQr(normalized);
        usedCache = true;
      }

      if (!found?.contract_id || !found.equipment_type_id || !found.ativo_placa) {
        setEquipment(null);
        setMessage({
          type: 'error',
          text: usedCache
            ? 'Sem internet e este QR não está salvo no aparelho. Conecte-se uma vez, leia o QR e tente de novo.'
            : 'Não foi possível identificar este QR code.',
        });
        return;
      }

      const openCheckinRequired = await refreshRequiredCheckout();

      if (openCheckinRequired && !doesEquipmentMatchOperation(found, openCheckinRequired)) {
        setEquipment(null);
        setPendingCheckout(null);
        setMessage({
          type: 'error',
          text: `Existe um fechamento pendente para o ativo ${openCheckinRequired.ativo_placa || 'da última abertura'}. Leia o QR code desse mesmo ativo para concluir antes de iniciar outra abertura.`,
        });
        return;
      }

      let openCheckin: CheckOperation | null = openCheckinRequired;
      if (!openCheckin) {
        if (isBrowserOnline()) {
          openCheckin = await operationsApi.getOpenCheckinForAsset({
            contractId: found.contract_id,
            equipmentTypeId: found.equipment_type_id,
            ativoPlaca: found.ativo_placa,
            date: new Date().toISOString(),
          });
        } else if (user?.id) {
          const localOpen = await getLocalOpenCheckin(user.id);
          if (
            localOpen &&
            localOpen.contract_id === found.contract_id &&
            localOpen.equipment_type_id === found.equipment_type_id &&
            normalizeAtivo(localOpen.ativo_placa) === normalizeAtivo(found.ativo_placa)
          ) {
            openCheckin = toSyntheticCheckOperation(localOpen);
          }
        }
      }

      setQrCodeValue(normalized);
      setManualQrCode(normalized);
      setEquipment(found);
      setPendingCheckout(openCheckin);
      setHorimeter('');
      clearPhoto();

      if (usedCache) {
        setMessage({
          type: 'success',
          text: 'Modo offline: equipamento carregado do cache deste aparelho.',
        });
      }
    } catch (err: any) {
      setEquipment(null);
      setMessage({
        type: 'error',
        text: toErrorText(err, 'Não foi possível identificar este QR code.'),
      });
    } finally {
      setResolvingQr(false);
    }
  }, [clearPhoto, refreshRequiredCheckout, user?.id]);

  useEffect(() => {
    void refreshRequiredCheckout();
  }, [refreshRequiredCheckout]);

  const handleQrPhotoChange = useCallback(async (file?: File | null) => {
    if (!file) return;

    setProcessingQrCapture(true);
    setMessage(null);
    setScannerOpen(false);
    await stopScanner();

    const qrReader = new Html5Qrcode(SCAN_FILE_REGION_ID, {
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      useBarCodeDetectorIfSupported: true,
      verbose: false,
    });

    try {
      const decodedText = await qrReader.scanFile(file, false);
      await resolveEquipment(decodedText);
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: toErrorText(
          err,
          'Não foi possível ler o QR code da foto. Tente novamente com a câmera mais próxima ou digite o código manualmente.',
        ),
      });
    } finally {
      try {
        qrReader.clear();
      } catch {
        // noop
      }
      if (qrFileInputRef.current) {
        qrFileInputRef.current.value = '';
      }
      setProcessingQrCapture(false);
    }
  }, [resolveEquipment, stopScanner]);

  useEffect(() => {
    const qrFromUrl = searchParams.get('qr')?.trim();
    if (!qrFromUrl || qrFromUrl === lastAutoResolvedQrRef.current) return;

    lastAutoResolvedQrRef.current = qrFromUrl;
    setManualQrCode(qrFromUrl);
    void resolveEquipment(qrFromUrl);
  }, [resolveEquipment, searchParams]);

  useEffect(() => {
    if (!scannerOpen || !canUseCameraScanner) return;

    let cancelled = false;

    const qrBoxSize =
      typeof window !== 'undefined'
        ? Math.max(180, Math.min(260, window.innerWidth - 96))
        : 220;

    const startScanner = async () => {
      const html5QrCode = new Html5Qrcode(SCANNER_REGION_ID, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        useBarCodeDetectorIfSupported: true,
        verbose: false,
      });

      scannerRef.current = html5QrCode;

      try {
        const cameraConfig = await pickBackCamera();
        if (cancelled) return;

        await html5QrCode.start(
          cameraConfig,
          {
            fps: 10,
            qrbox: { width: qrBoxSize, height: qrBoxSize },
          },
          (decodedText) => {
            if (cancelled) return;
            setScannerOpen(false);
            void stopScanner().then(() => resolveEquipment(decodedText));
          },
          () => undefined,
        );
      } catch {
        if (!cancelled) {
          setScannerOpen(false);
          setMessage({
            type: 'error',
            text: 'Não foi possível abrir a câmera traseira. Tente novamente ou digite o código manualmente.',
          });
          await stopScanner();
        }
      }
    };

    void startScanner();

    return () => {
      cancelled = true;
      void stopScanner();
    };
  }, [canUseCameraScanner, resolveEquipment, scannerOpen, stopScanner]);

  const movementContext = useMemo<MovementContext | null>(() => {
    if (!equipment?.contract_id || !equipment?.equipment_type_id || !equipment?.ativo_placa) {
      return null;
    }

    return {
      contract_id: equipment.contract_id,
      equipment_type_id: equipment.equipment_type_id,
      ativo_placa: equipment.ativo_placa,
      contract_label: equipment.contract?.name || '—',
      equipment_label: equipment.equipment_type?.name || equipment.name || '—',
      obra_label: equipment.obra?.code ? `Obra ${equipment.obra.code}` : '—',
      qr_label: pendingCheckout ? 'Mesmo ativo com abertura em aberto nesta data' : qrCodeValue || '—',
      opening_horimeter: pendingCheckout ? Number(pendingCheckout.horimeter) : undefined,
    };
  }, [equipment, pendingCheckout, qrCodeValue]);

  const currentOperationType: OperationType = pendingCheckout ? 'checkout' : 'checkin';
  const isForcedCheckout = pendingCheckout != null;
  const canFillMovement = movementContext != null;

  useEffect(() => {
    if (!canFillMovement) {
      setCachedLocation(null);
      return;
    }

    let cancelled = false;
    void getLocation()
      .then((location) => {
        if (!cancelled) setCachedLocation(location);
      })
      .catch(() => {
        if (!cancelled) setCachedLocation(null);
      });

    return () => {
      cancelled = true;
    };
  }, [canFillMovement, movementContext?.contract_id, movementContext?.ativo_placa]);

  const saveOffline = async (
    location: { latitude: number; longitude: number },
    horimeterValue: number,
  ) => {
    if (!user?.id) {
      throw new Error('Faça login para salvar movimentações offline.');
    }

    await enqueuePendingOperation(user.id, {
      contract_id: movementContext!.contract_id,
      equipment_type_id: movementContext!.equipment_type_id,
      ativo_placa: movementContext!.ativo_placa,
      operation_type: currentOperationType,
      horimeter: horimeterValue,
      latitude: location.latitude,
      longitude: location.longitude,
      operation_datetime: new Date().toISOString(),
      device_id: getDeviceId(),
      photoBlob: photo!,
      qrValue: qrCodeValue || undefined,
      observation: !isBrowserOnline() ? 'Registrado offline no aparelho' : undefined,
    });
    await refreshPendingCount();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!movementContext) {
      setMessage({ type: 'error', text: 'Leia um QR code válido antes de registrar a movimentação.' });
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

    if (currentOperationType === 'checkout' && movementContext.opening_horimeter != null) {
      if (horimeterValue <= movementContext.opening_horimeter) {
        setMessage({
          type: 'error',
          text: 'O horímetro do fechamento deve ser maior que o da abertura.',
        });
        return;
      }
    }

    setLoading(true);
    setMessage(null);

    try {
      let location = cachedLocation ?? readMovementLocationCache();
      if (!location) {
        try {
          location = await getLocation();
          writeMovementLocationCache(location);
          setCachedLocation(location);
        } catch {
          location = readMovementLocationCache() ?? { latitude: 0, longitude: 0 };
        }
      }

      let savedOnline = false;

      if (isBrowserOnline()) {
        try {
          await operationsApi.create({
            contract_id: movementContext.contract_id,
            equipment_type_id: movementContext.equipment_type_id,
            ativo_placa: movementContext.ativo_placa,
            operation_type: currentOperationType,
            horimeter: horimeterValue,
            latitude: location.latitude,
            longitude: location.longitude,
            operation_datetime: new Date().toISOString(),
            photo,
            device_id: getDeviceId(),
          });
          savedOnline = true;
        } catch (err) {
          if (!isNetworkFailure(err)) throw err;
          await saveOffline(location, horimeterValue);
        }
      } else {
        await saveOffline(location, horimeterValue);
      }

      setHorimeter('');
      clearPhoto();

      if (currentOperationType === 'checkin') {
        if (savedOnline) {
          clearSelection();
          await refreshRequiredCheckout();
          navigate('/movimentacoes', { replace: true });
          setMessage({
            type: 'success',
            text: 'Abertura registrada com sucesso. O fechamento deste mesmo ativo agora e obrigatório antes de uma nova abertura.',
          });
        } else {
          await refreshRequiredCheckout();
          if (user?.id) {
            const localOpen = await getLocalOpenCheckin(user.id);
            if (
              localOpen &&
              equipment &&
              localOpen.contract_id === equipment.contract_id &&
              localOpen.equipment_type_id === equipment.equipment_type_id &&
              normalizeAtivo(localOpen.ativo_placa) === normalizeAtivo(equipment.ativo_placa)
            ) {
              setPendingCheckout(toSyntheticCheckOperation(localOpen));
            }
          }
          setMessage({
            type: 'success',
            text: 'Abertura salva no aparelho. Será enviada à nuvem quando houver internet. Você já pode registrar o fechamento deste ativo.',
          });
        }
      } else if (savedOnline) {
        clearSelection();
        setRequiredCheckout(null);
        navigate('/movimentacoes', { replace: true });
        setMessage({
          type: 'success',
          text: 'Fechamento registrado com sucesso. Agora você pode iniciar uma nova abertura.',
        });
      } else {
        clearSelection();
        setRequiredCheckout(null);
        setMessage({
          type: 'success',
          text: 'Fechamento salvo no aparelho. Será enviado à nuvem quando houver internet.',
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
    <div className="mx-auto flex w-full max-w-md flex-col gap-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:max-w-2xl sm:gap-4">
      <section className="rounded-[1.25rem] border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-blue-100 p-2.5 text-blue-700 dark:bg-red-900/30 dark:text-red-200 sm:p-3">
            <ClipboardCheck className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">Movimentações</h1>
            <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-300">
              {user?.full_name ? `Operador: ${user.full_name}` : 'Leia o QR code do ativo, confirme os dados e envie a foto do horímetro.'}
            </p>
          </div>
        </div>
      </section>

      {!isOnline && (
        <div className="rounded-[1.25rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <CloudOff className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>Sem internet.</strong> Você pode registrar abertura e fechamento; os dados ficam no aparelho e sobem para a nuvem quando a conexão voltar.
            </span>
          </div>
        </div>
      )}

      {pendingCount > 0 && (
        <div className="rounded-[1.25rem] border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-800 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-200">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              <Wifi className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong>{pendingCount}</strong> movimentação(ões) aguardando envio para a nuvem.
              </span>
            </div>
            {isOnline && (
              <button
                type="button"
                disabled={isSyncing}
                onClick={() => void syncPending().then((result) => {
                  if (!result) return;
                  void refreshRequiredCheckout();
                  if (result.failed > 0) {
                    setMessage({
                      type: 'error',
                      text: `${result.synced} enviada(s), ${result.failed} com erro. Tente novamente.`,
                    });
                  } else if (result.synced > 0) {
                    setMessage({
                      type: 'success',
                      text: `${result.synced} movimentação(ões) enviada(s) para a nuvem com sucesso.`,
                    });
                  }
                })}
                className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-red-800 dark:hover:bg-red-700"
              >
                {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar agora'}
              </button>
            )}
          </div>
        </div>
      )}

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

      {requiredCheckout && !canFillMovement && (
        <div className="rounded-[1.25rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
          Existe um fechamento pendente para o ativo <strong>{requiredCheckout.ativo_placa || 'da última abertura'}</strong>. Leia o QR code desse mesmo ativo para concluir o registro antes de iniciar outra abertura.
        </div>
      )}

      {!canFillMovement && (
        <section className="rounded-[1.25rem] border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Leitura do QR code</h2>
            <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-300">
              Tire a foto do QR code do ativo. Depois disso, a tela identifica se para este ativo e nesta data o próximo passo e uma abertura ou um fechamento.
            </p>
          </div>
          {canUseCameraScanner ? (
            <button
              type="button"
              onClick={() => {
                setMessage(null);
                setScannerOpen((prev) => !prev);
              }}
              className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-medium text-white hover:bg-red-700 sm:w-auto sm:px-4 sm:py-2.5"
            >
              <Camera className="h-4 w-4" />
              {scannerOpen ? 'Fechar câmera' : 'Abrir câmera'}
            </button>
          ) : (
            <label className="inline-flex min-h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-medium text-white hover:bg-red-700 sm:w-auto sm:px-4 sm:py-2.5">
              {processingQrCapture ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              {processingQrCapture ? 'Lendo foto...' : 'Abrir câmera'}
              <input
                ref={qrFileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                disabled={processingQrCapture || resolvingQr}
                onChange={(e) => void handleQrPhotoChange(e.target.files?.[0] ?? null)}
              />
            </label>
          )}
        </div>

        {!canUseCameraScanner && (
          <div className="mt-4 rounded-[1.25rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
            O navegador bloqueia a leitura direta da câmera do QR code fora de <strong>https</strong>. Use o botão vermelho acima para abrir a câmera nativa e tirar a foto do QR.
          </div>
        )}

        {scannerOpen && (
          <div className="mobile-qr-reader mt-4 overflow-hidden rounded-[1.25rem] border border-dashed border-red-300 bg-gray-50 p-3 dark:border-red-700 dark:bg-gray-900">
            <div id={SCANNER_REGION_ID} />
          </div>
        )}

        <div id={SCAN_FILE_REGION_ID} className="hidden" />

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <QrCode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={manualQrCode}
              onChange={(e) => setManualQrCode(e.target.value)}
              className="block min-h-[52px] w-full rounded-xl border border-gray-300 bg-white py-3 pl-10 pr-3 text-base text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-red-600 dark:focus:ring-red-600"
              placeholder="Cole ou digite o código do QR"
            />
          </div>
          <button
            type="button"
            onClick={() => resolveEquipment(manualQrCode)}
            disabled={resolvingQr}
            className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700 sm:w-auto"
          >
            {resolvingQr ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Buscar QR
          </button>
        </div>

        {!canFillMovement && (
          <div className="mt-4 rounded-[1.25rem] border border-dashed border-gray-300 bg-gray-50 px-4 py-4 text-sm leading-6 text-gray-600 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300">
            Depois da leitura do QR code, informe o <strong>horímetro manualmente</strong> e tire a <strong>foto do horímetro</strong> para registrar abertura ou fechamento.
          </div>
        )}
        </section>
      )}

      {canFillMovement && (
        <form onSubmit={handleSubmit} className="rounded-[1.25rem] border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-5">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Registrar movimentação</h2>
            </div>

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
                  className="block min-h-[56px] w-full rounded-[1.1rem] border border-gray-300 bg-white px-4 py-3 text-lg text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-red-600 dark:focus:ring-red-600"
                  placeholder="Ex.: 1234.5"
                />
              </div>

              <HorimeterPhotoCapture
                previewUrl={previewUrl}
                disabled={loading || resolvingQr}
                onCapture={handleHorimeterCapture}
                onClear={clearPhoto}
                onPreviewOpen={() => setIsPhotoPreviewOpen(true)}
              />


              <div className="rounded-[1.1rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>
                    {isOnline
                      ? 'A localização será capturada no envio (ou use a última posição salva).'
                      : 'Offline: usa a última localização conhecida; ao voltar a internet, o envio usa esses dados.'}
                  </span>
                </div>
              </div>

              <div className="sticky bottom-0 -mx-4 mt-2 border-t border-gray-200 bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-4 backdrop-blur dark:border-gray-700 dark:bg-gray-800/95 sm:static sm:m-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-0">
                <button
                  type="submit"
                  disabled={loading || resolvingQr}
                  className="inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[1.1rem] bg-blue-600 px-4 py-3 text-base font-semibold text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-red-800 dark:hover:bg-red-700"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ClipboardCheck className="h-5 w-5" />}
                  {loading
                    ? 'Salvando...'
                    : isOnline
                      ? `Registrar ${currentOperationType === 'checkin' ? 'abertura' : 'fechamento'}`
                      : `Salvar ${currentOperationType === 'checkin' ? 'abertura' : 'fechamento'} no aparelho`}
                </button>
              </div>
            </div>
        </form>
      )}

      {isPhotoPreviewOpen && previewUrl && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setIsPhotoPreviewOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Visualização da foto do horímetro"
        >
          <div
            className="relative flex max-h-[95vh] w-full max-w-5xl items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsPhotoPreviewOpen(false)}
              className="absolute right-2 top-2 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/70"
              aria-label="Fechar visualização"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={previewUrl}
              alt="Foto do horímetro ampliada"
              className="max-h-[95vh] w-full rounded-2xl object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Movimentacoes;
