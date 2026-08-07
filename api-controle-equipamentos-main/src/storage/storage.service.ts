import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

/**
 * Serviço que envia arquivos para buckets na nuvem (S3 ou compatível).
 * Usa bucket "CNH" para fotos de CNH e bucket "operation" para fotos de operações.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client: S3Client | null = null;
  private publicBaseUrl: string = '';
  private bucketCnh: string = 'cnh';
  private bucketOperation: string = 'Operation';

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const endpoint = (this.config.get<string>('STORAGE_ENDPOINT') || '').trim();
    const region = (this.config.get<string>('STORAGE_REGION') || this.config.get<string>('AWS_REGION') || 'us-east-1').trim();
    const accessKey = (this.config.get<string>('STORAGE_ACCESS_KEY') || this.config.get<string>('AWS_ACCESS_KEY_ID') || '').trim();
    const secretKey = (this.config.get<string>('STORAGE_SECRET_KEY') || this.config.get<string>('AWS_SECRET_ACCESS_KEY') || '').trim();

    this.publicBaseUrl = (this.config.get<string>('STORAGE_PUBLIC_BASE_URL') || '').trim();
    this.bucketCnh = (this.config.get<string>('BUCKET_CNH') || 'cnh').trim();
    this.bucketOperation = (this.config.get<string>('BUCKET_OPERATION') || 'Operation').trim();

    if (!accessKey || !secretKey) {
      this.logger.warn(
        'Storage: STORAGE_ACCESS_KEY ou STORAGE_SECRET_KEY vazios. Fotos serão salvas em disco (pasta uploads/).',
      );
      return;
    }

    const clientConfig: ConstructorParameters<typeof S3Client>[0] = {
      region,
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    };

    if (endpoint) {
      clientConfig.endpoint = endpoint;
      clientConfig.forcePathStyle = true;
    }

    this.client = new S3Client(clientConfig);
    this.logger.log(
      `Storage: BUCKETS ativo → CNH="${this.bucketCnh}", Operation="${this.bucketOperation}". Fotos vão para o Supabase.`,
    );
  }

  private async upload(buffer: Buffer, bucket: string, key: string, contentType: string): Promise<string> {
    if (!this.client) {
      throw new Error('Storage não configurado. Defina STORAGE_ACCESS_KEY e STORAGE_SECRET_KEY no .env e reinicie a API.');
    }

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        }),
      );
    } catch (err: any) {
      this.logger.error(`Storage upload falhou (bucket=${bucket}, key=${key}): ${err?.message || err}`);
      throw err;
    }

    if (this.publicBaseUrl) {
      const base = this.publicBaseUrl.replace(/\/$/, '');
      return `${base}/${bucket}/${key}`;
    }
    return key;
  }

  /** Envia foto da CNH para o bucket CNH e retorna a URL pública. */
  async uploadCnh(buffer: Buffer, filename: string, contentType: string = 'image/jpeg'): Promise<string> {
    const url = await this.upload(buffer, this.bucketCnh, filename, contentType);
    this.logger.log(`CNH uploaded: ${filename}`);
    return url;
  }

  /** Envia foto de operação para o bucket operation e retorna a URL pública. */
  async uploadOperation(buffer: Buffer, filename: string, contentType: string = 'image/jpeg'): Promise<string> {
    const url = await this.upload(buffer, this.bucketOperation, filename, contentType);
    this.logger.log(`Operation photo uploaded: ${filename}`);
    return url;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }
}
