import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import { TenantContext } from './tenancy.types';
import { TenantContextStorage } from './tenant-context.storage';

@Injectable()
export class TenantStorageService {
  private readonly logger = new Logger(TenantStorageService.name);
  private readonly s3Bucket = process.env.S3_BUCKET || 'nirvagam-erp-attachments';

  /**
   * Generates a strictly scoped S3 key:
   * s3://bucket/tenants/{tenantId}/{category}/{sanitizedFileName}
   * Security Invariant: Client-supplied paths can NEVER escape the tenant's prefix.
   */
  getScopedStorageKey(fileName: string, category: 'invoices' | 'receipts' | 'attachments' = 'attachments'): string {
    const ctx = TenantContextStorage.get();

    // Sanitize filename to prevent directory traversal
    const baseName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestamp = Date.now();
    const storageKey = `tenants/${ctx.tenantId}/${category}/${timestamp}-${baseName}`;

    return storageKey;
  }

  /**
   * Generates a signed URL descriptor with scoped access
   */
  async generatePresignedUploadUrl(
    fileName: string,
    mimeType: string,
    category: 'invoices' | 'receipts' | 'attachments' = 'attachments'
  ): Promise<{ uploadUrl: string; storageKey: string; bucket: string; expiresIn: number }> {
    const storageKey = this.getScopedStorageKey(fileName, category);

    // In production with AWS SDK / MinIO: s3.getSignedUrlPromise('putObject', ...)
    const uploadUrl = `https://${this.s3Bucket}.s3.ap-south-1.amazonaws.com/${storageKey}?signature=scoped_token_${Date.now()}`;

    return {
      uploadUrl,
      storageKey,
      bucket: this.s3Bucket,
      expiresIn: 900, // 15 mins
    };
  }

  async generatePresignedDownloadUrl(storageKey: string): Promise<string> {
    const ctx = TenantContextStorage.get();

    // Security check: Key must start with tenants/{currentTenantId}/
    const expectedPrefix = `tenants/${ctx.tenantId}/`;
    if (!storageKey.startsWith(expectedPrefix)) {
      throw new Error(
        `SECURITY VIOLATION: Cross-tenant storage access blocked. Tenant [${ctx.tenantId}] cannot access key [${storageKey}].`
      );
    }

    return `https://${this.s3Bucket}.s3.ap-south-1.amazonaws.com/${storageKey}?download_token=${Date.now()}`;
  }
}
