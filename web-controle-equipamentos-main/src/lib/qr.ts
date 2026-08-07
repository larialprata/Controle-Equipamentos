import QRCode from 'qrcode';

/** Logo compacta (ícone) usada no centro do QR code. */
export const QR_LOGO_COMPACT_SRC = '/logo-dimensional.png';
/** @deprecated use QR_LOGO_COMPACT_SRC */
export const QR_LOGO_SRC = QR_LOGO_COMPACT_SRC;

export const getPublicAppBaseUrl = (): string =>
  (
    import.meta.env.VITE_PUBLIC_BASE_URL?.trim() ||
    (typeof window !== 'undefined' ? window.location.origin : '')
  ).replace(/\/+$/, '');

export const buildMovementQrUrl = (value: string): string =>
  `${getPublicAppBaseUrl()}/q/${encodeURIComponent(value)}`;

export const extractQrValue = (rawValue: string): string => {
  const normalized = rawValue.trim();
  if (!normalized) return '';

  const queryMatch = normalized.match(/[?&]qr=([^&#]+)/i);
  if (queryMatch?.[1]) {
    return decodeURIComponent(queryMatch[1]).trim();
  }

  const shortPathMatch = normalized.match(/(?:^|\/)q\/([^/?#]+)/i);
  if (shortPathMatch?.[1]) {
    return decodeURIComponent(shortPathMatch[1]).trim();
  }

  return normalized;
};

export const buildPrintQrPageUrl = (value: string, ativoPlaca: string, equipmentName?: string): string => {
  const searchParams = new URLSearchParams({
    value,
    ativo: ativoPlaca,
  });

  if (equipmentName?.trim()) {
    searchParams.set('name', equipmentName.trim());
  }

  return `/imprimir-qr?${searchParams.toString()}`;
};

type QrImageOptions = {
  width?: number;
  margin?: number;
  logoScale?: number;
  logoSrc?: string;
};

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });

/** Gera QR em data URL com a logo da Dimensional centralizada (error correction H). */
export async function buildQrDataUrlWithLogo(
  content: string,
  options: QrImageOptions = {},
): Promise<string> {
  const width = options.width ?? 280;
  const margin = options.margin ?? 1;
  const logoScale = options.logoScale ?? 0.24;
  const logoSrc = options.logoSrc ?? QR_LOGO_COMPACT_SRC;

  const qrDataUrl = await QRCode.toDataURL(content, {
    width,
    margin,
    errorCorrectionLevel: 'H',
  });

  if (typeof document === 'undefined') return qrDataUrl;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = width;
  const ctx = canvas.getContext('2d');
  if (!ctx) return qrDataUrl;

  const qrImg = await loadImage(qrDataUrl);
  ctx.drawImage(qrImg, 0, 0, width, width);

  try {
    const logoImg = await loadImage(logoSrc);
    const logoSize = Math.round(width * logoScale);
    const x = (width - logoSize) / 2;
    const y = (width - logoSize) / 2;
    const pad = Math.max(4, Math.round(logoSize * 0.14));

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - pad, y - pad, logoSize + pad * 2, logoSize + pad * 2);
    ctx.drawImage(logoImg, x, y, logoSize, logoSize);
  } catch {
    // Sem logo no disco: retorna só o QR.
  }

  return canvas.toDataURL('image/png');
}
