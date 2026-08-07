import { memoryStorage } from 'multer';

const IMAGE_EXT = /\.(jpe?g|png|webp|heic|heif)$/i;

export function isLikelyImageUpload(mimetype?: string, originalname?: string): boolean {
  const mime = (mimetype || '').toLowerCase();
  const name = (originalname || '').toLowerCase();
  return mime.startsWith('image/') || mime === 'application/octet-stream' || IMAGE_EXT.test(name);
}

/** Multer para fotos de operação/horímetro — aceita tipos comuns de celular. */
export const operationPhotoMulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (
    _req: unknown,
    file: Express.Multer.File,
    cb: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (!isLikelyImageUpload(file.mimetype, file.originalname)) {
      return cb(new Error('Envie uma imagem (JPG, PNG ou WebP).'), false);
    }
    cb(null, true);
  },
};
