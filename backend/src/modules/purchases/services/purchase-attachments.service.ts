import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../../prisma/prisma.service';
import { PurchaseCoreService } from './purchase-core.service';

export const PURCHASE_INVOICE_BILL_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

@Injectable()
export class PurchaseAttachmentsService {
  private readonly uploadRoot = path.resolve(process.cwd(), 'uploads', 'purchases');

  constructor(
    private readonly prisma: PrismaService,
    private readonly core: PurchaseCoreService,
  ) {}

  async uploadFile(
    user: any,
    documentType: string,
    documentId: string,
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
  ) {
    const branchId = this.core.requireBranch(user);
    if (!file || !file.buffer) {
      throw new BadRequestException('File upload is required');
    }

    const settings = await this.core.getSettings(user.businessId);
    const maxBytes = (settings.maxAttachmentSizeMb || 25) * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new BadRequestException(`File exceeds maximum allowed size (${settings.maxAttachmentSizeMb} MB)`);
    }

    const allowedMimes: string[] = Array.isArray(settings.allowedAttachmentMimeTypes)
      ? (settings.allowedAttachmentMimeTypes as string[])
      : ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

    const permittedMimes = documentType.toUpperCase() === 'INVOICE'
      ? allowedMimes.filter((mime) => PURCHASE_INVOICE_BILL_MIME_TYPES.includes(mime))
      : allowedMimes;
    if (!permittedMimes.includes(file.mimetype)) {
      throw new BadRequestException(`MIME type "${file.mimetype}" is not permitted`);
    }

    const safeName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
    const dir = path.join(this.uploadRoot, user.businessId, documentType.toLowerCase(), documentId);
    fs.mkdirSync(dir, { recursive: true });

    const storedName = `${Date.now()}-${safeName}`;
    const fullPath = path.join(dir, storedName);
    fs.writeFileSync(fullPath, file.buffer);

    const checksum = crypto.createHash('sha256').update(file.buffer).digest('hex');

    return this.prisma.purchaseAttachment.create({
      data: {
        businessId: user.businessId,
        branchId,
        documentType: documentType.toUpperCase(),
        documentId,
        fileName: file.originalname,
        filePath: fullPath,
        mimeType: file.mimetype,
        size: file.size,
        checksum,
        uploadedById: user.id,
      },
    });
  }

  async list(user: any, documentType: string, documentId: string) {
    return this.prisma.purchaseAttachment.findMany({
      where: {
        businessId: user.businessId,
        ...(user.branchId ? { branchId: user.branchId } : {}),
        documentType: documentType.toUpperCase(),
        documentId,
        isDeleted: false,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDownloadInfo(user: any, id: string) {
    const att = await this.prisma.purchaseAttachment.findFirst({
      where: {
        id,
        businessId: user.businessId,
        ...(user.branchId ? { branchId: user.branchId } : {}),
        isDeleted: false,
      },
    });
    if (!att) throw new NotFoundException('Attachment not found');
    if (!fs.existsSync(att.filePath)) {
      throw new NotFoundException('Attachment file not found on storage');
    }
    return att;
  }

  async remove(user: any, id: string) {
    const existing = await this.prisma.purchaseAttachment.findFirst({
      where: {
        id,
        businessId: user.businessId,
        ...(user.branchId ? { branchId: user.branchId } : {}),
        isDeleted: false,
      },
    });
    if (!existing) throw new NotFoundException('Attachment not found');
    return this.prisma.purchaseAttachment.update({
      where: { id },
      data: { isDeleted: true },
    });
  }
}
