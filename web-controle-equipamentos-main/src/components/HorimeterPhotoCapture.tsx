import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Loader2, X } from 'lucide-react';
import { captureFrameFromVideo, compressImageFile, type CompressImageOptions } from '../lib/image';

export type HorimeterCaptureResult = {
  file: File;
};

type HorimeterPhotoCaptureProps = {
  previewUrl: string | null;
  disabled?: boolean;
  compressOptions?: CompressImageOptions;
  onCapture: (result: HorimeterCaptureResult) => void;
  onClear: () => void;
  onPreviewOpen?: () => void;
};

const HorimeterPhotoCapture: React.FC<HorimeterPhotoCaptureProps> = ({
  previewUrl,
  disabled = false,
  compressOptions,
  onCapture,
  onClear,
  onPreviewOpen,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [busy, setBusy] = useState(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
  }, []);

  const processFile = useCallback(
    async (file: File) => {
      setBusy(true);
      try {
        const compressed = await compressImageFile(file, compressOptions);
        onCapture({ file: compressed });
      } finally {
        setBusy(false);
      }
    },
    [compressOptions, onCapture],
  );

  const openCamera = useCallback(async () => {
    if (disabled || busy) return;
    setCameraOpen(true);

    if (!navigator.mediaDevices?.getUserMedia) {
      fileInputRef.current?.click();
      setCameraOpen(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
      }
    } catch {
      stopCamera();
      setCameraOpen(false);
      fileInputRef.current?.click();
    }
  }, [busy, disabled, stopCamera]);

  const handleCaptureFromCamera = useCallback(async () => {
    if (!videoRef.current || !cameraReady || busy) return;
    setBusy(true);
    try {
      const raw = await captureFrameFromVideo(videoRef.current);
      stopCamera();
      setCameraOpen(false);
      await processFile(raw);
    } catch {
      setBusy(false);
    }
  }, [busy, cameraReady, processFile, stopCamera]);

  const handleFileInput = useCallback(
    async (file?: File | null) => {
      if (!file) return;
      await processFile(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [processFile],
  );

  useEffect(() => {
    if (!cameraOpen) {
      stopCamera();
      return;
    }
    return () => stopCamera();
  }, [cameraOpen, stopCamera]);

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">Foto do horímetro</label>

      {!previewUrl ? (
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => void openCamera()}
          className="flex min-h-[176px] w-full flex-col items-center justify-center gap-2 rounded-[1.1rem] border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center transition hover:bg-gray-100 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:hover:bg-gray-800"
        >
          {busy ? (
            <Loader2 className="h-7 w-7 animate-spin text-blue-600 dark:text-red-400" />
          ) : (
            <Camera className="h-7 w-7 text-gray-400" />
          )}
          <span className="text-base font-medium text-gray-700 dark:text-gray-200">
            {busy ? 'Preparando foto...' : 'Fotografar horímetro'}
          </span>
          <span className="max-w-xs text-sm leading-6 text-gray-500 dark:text-gray-400">
            Tire uma foto nítida do display. O valor do horímetro deve ser informado manualmente acima.
          </span>
        </button>
      ) : (
        <div className="space-y-2">
          <button
            type="button"
            onClick={onPreviewOpen}
            className="mx-auto block w-full max-w-md overflow-hidden rounded-[1.1rem] focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-red-600"
            aria-label="Abrir foto do horímetro"
          >
            <img
              src={previewUrl}
              alt="Pré-visualização do horímetro"
              className="aspect-square w-full object-cover"
            />
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={disabled || busy}
              onClick={() => void openCamera()}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-300 px-3 py-2.5 text-sm font-medium text-gray-700 dark:border-gray-600 dark:text-gray-200"
            >
              <Camera className="h-4 w-4" />
              Refazer foto
            </button>
            <button
              type="button"
              disabled={disabled || busy}
              onClick={onClear}
              className="inline-flex items-center justify-center rounded-xl border border-gray-300 px-3 py-2.5 text-sm font-medium text-gray-700 dark:border-gray-600 dark:text-gray-200"
            >
              Remover
            </button>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        disabled={disabled || busy}
        onChange={(e) => void handleFileInput(e.target.files?.[0] ?? null)}
      />

      {cameraOpen && (
        <div className="fixed inset-0 z-[10000] flex flex-col bg-black">
          <div className="flex items-center justify-between px-4 py-3 text-white">
            <p className="text-base font-semibold">Foto do horímetro</p>
            <button
              type="button"
              onClick={() => {
                stopCamera();
                setCameraOpen(false);
              }}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15"
              aria-label="Fechar câmera"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="relative flex-1 overflow-hidden bg-black">
            <video ref={videoRef} playsInline muted className="h-full w-full object-contain" />
          </div>

          <div className="px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4">
            <button
              type="button"
              disabled={!cameraReady || busy}
              onClick={() => void handleCaptureFromCamera()}
              className="inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-white text-base font-semibold text-gray-900 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
              Capturar foto
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HorimeterPhotoCapture;
