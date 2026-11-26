import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PurchaseCoreService } from './purchase-core.service';
import { ApprovalActionDto, CreateApprovalRuleDto } from '../dto/purchase.dto';

@Injectable()
export class PurchaseApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly core: PurchaseCoreService,
  ) {}

  async listRules(user: any) {
    return this.prisma.approvalRule.findMany({
      where: {
        businessId: user.businessId,
        ...(user.branchId ? { OR: [{ branchId: user.branchId }, { branchId: null }] } : {}),
      },
      orderBy: [{ documentType: 'asc' }, { minAmount: 'asc' }],
    });
  }

  async createRule(user: any, dto: CreateApprovalRuleDto) {
    return this.prisma.approvalRule.create({
      data: {
        businessId: user.businessId,
        branchId: dto.branchId || user.branchId || null,
        department: dto.department || null,
        documentType: dto.documentType,
        minAmount: String(dto.minAmount ?? 0),
        maxAmount: dto.maxAmount !== undefined && dto.maxAmount !== null ? String(dto.maxAmount) : null,
        levels: dto.levels as any,
        isActive: dto.isActive !== false,
      },
    });
  }

  async deleteRule(user: any, id: string) {
    const existing = await this.prisma.approvalRule.findFirst({ where: { id, businessId: user.businessId } });
    if (!existing) throw new NotFoundException('Approval rule not found');
    await this.prisma.approvalRule.delete({ where: { id } });
    return { deleted: true };
  }

  async listRequests(user: any, status?: string) {
    return this.prisma.approvalRequest.findMany({
      where: {
        businessId: user.businessId,
        ...(user.branchId ? { branchId: user.branchId } : {}),
        ...(status ? { status: status as any } : {}),
      },
      include: { history: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDocumentTimeline(user: any, documentType: string, documentId: string) {
    return this.prisma.approvalRequest.findMany({
      where: { businessId: user.businessId, documentType, documentId },
      include: { history: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listNotifications(user: any) {
    return this.prisma.inAppNotification.findMany({
      where: { businessId: user.businessId, userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markNotificationRead(user: any, id: string) {
    return this.prisma.inAppNotification.updateMany({
      where: { id, userId: user.id },
      data: { isRead: true },
    });
  }

  private async notifyLevelApprovers(
    tx: any,
    params: {
      businessId: string;
      branchId: string;
      documentType: string;
      documentId: string;
      levelConfig: { level: number; roleName?: string; userIds?: string[] };
      title: string;
      message: string;
    },
  ) {
    const targetUserIds = new Set<string>(params.levelConfig?.userIds || []);
    if (params.levelConfig?.roleName) {
      const roleUsers = await tx.user.findMany({
        where: {
          isActive: true,
          userRoles: { some: { role: { name: params.levelConfig.roleName } } },
        },
        select: { id: true },
      });
      roleUsers.forEach((u: any) => targetUserIds.add(u.id));
    }

    for (const userId of targetUserIds) {
      await tx.inAppNotification.create({
        data: {
          businessId: params.businessId,
          branchId: params.branchId,
          userId,
          title: params.title,
          message: params.message,
          documentType: params.documentType,
          documentId: params.documentId,
        },
      });
    }
  }

  /**
   * Evaluates matching ApprovalRule inside an active transaction.
   * Returns { autoApproved: true } if no matching rule exists.
   */
  async submitForApproval(
    tx: any,
    user: any,
    params: {
      documentType: 'PR' | 'PO' | 'INVOICE' | 'RETURN';
      documentId: string;
      documentNumber: string;
      amount: number;
      department?: string | null;
    },
  ): Promise<{ autoApproved: boolean; approvalRequest?: any }> {
    const rules = await tx.approvalRule.findMany({
      where: {
        businessId: user.businessId,
        documentType: params.documentType,
        isActive: true,
        OR: [{ branchId: user.branchId }, { branchId: null }],
      },
      orderBy: [{ branchId: 'desc' }, { minAmount: 'desc' }],
    });

    const matchedRule = rules.find((rule: any) => {
      const deptMatch = !rule.department || (params.department && rule.department.toLowerCase() === params.department.toLowerCase());
      const minOk = params.amount >= Number(rule.minAmount || 0);
      const maxOk = rule.maxAmount === null || rule.maxAmount === undefined || params.amount <= Number(rule.maxAmount);
      return deptMatch && minOk && maxOk;
    });

    if (!matchedRule || !Array.isArray(matchedRule.levels) || matchedRule.levels.length === 0) {
      return { autoApproved: true };
    }

    const request = await tx.approvalRequest.create({
      data: {
        businessId: user.businessId,
        branchId: user.branchId,
        documentType: params.documentType,
        documentId: params.documentId,
        ruleId: matchedRule.id,
        status: 'PENDING',
        currentLevel: 1,
        requestedById: user.id,
        history: {
          create: {
            action: 'SUBMITTED',
            actorId: user.id,
            level: 1,
            reason: `Submitted ${params.documentType} ${params.documentNumber} for approval`,
          },
        },
      },
      include: { history: true },
    });

    const firstLevel = (matchedRule.levels as any[])[0];
    await this.notifyLevelApprovers(tx, {
      businessId: user.businessId,
      branchId: user.branchId,
      documentType: params.documentType,
      documentId: params.documentId,
      levelConfig: firstLevel,
      title: `Approval Required: ${params.documentNumber}`,
      message: `${params.documentType} ${params.documentNumber} (₹${params.amount.toFixed(2)}) awaits Level 1 approval.`,
    });

    return { autoApproved: false, approvalRequest: request };
  }

  async actOnRequest(
    user: any,
    requestId: string,
    action: 'APPROVE' | 'REJECT' | 'SEND_BACK' | 'DELEGATE',
    dto: ApprovalActionDto,
  ) {
    if ((action === 'REJECT' || action === 'SEND_BACK') && !dto.reason?.trim()) {
      throw new BadRequestException(`A reason is mandatory for ${action.toLowerCase().replace('_', ' ')}`);
    }
    if (action === 'DELEGATE' && !dto.delegatedToId) {
      throw new BadRequestException('Target user ID is required for delegation');
    }

    return this.prisma.$transaction(async (tx) => {
      const req = await tx.approvalRequest.findFirst({
        where: { id: requestId, businessId: user.businessId },
      });
      if (!req) throw new NotFoundException('Approval request not found');
      if (req.status !== 'PENDING' && req.status !== 'DELEGATED') {
        throw new BadRequestException(`Approval request is already ${req.status}`);
      }

      const rule = req.ruleId ? await tx.approvalRule.findUnique({ where: { id: req.ruleId } }) : null;
      const levels = (rule?.levels as any[]) || [];

      if (action === 'DELEGATE') {
        await tx.approvalHistory.create({
          data: {
            approvalRequestId: req.id,
            action: 'DELEGATED',
            actorId: user.id,
            level: req.currentLevel,
            delegatedToId: dto.delegatedToId,
            reason: dto.reason || 'Delegated approval',
          },
        });
        await tx.inAppNotification.create({
          data: {
            businessId: req.businessId,
            branchId: req.branchId,
            userId: dto.delegatedToId!,
            title: `Delegated Approval (${req.documentType})`,
            message: `Approval for ${req.documentType} was delegated to you.`,
            documentType: req.documentType,
            documentId: req.documentId,
          },
        });
        return tx.approvalRequest.update({
          where: { id: req.id },
          data: { status: 'DELEGATED', reason: dto.reason },
          include: { history: true },
        });
      }

      if (action === 'REJECT') {
        await tx.approvalHistory.create({
          data: {
            approvalRequestId: req.id,
            action: 'REJECTED',
            actorId: user.id,
            level: req.currentLevel,
            reason: dto.reason,
          },
        });
        await this.updateSourceDocumentStatus(tx, req.documentType, req.documentId, 'REJECTED', dto.reason!, user.id);
        return tx.approvalRequest.update({
          where: { id: req.id },
          data: { status: 'REJECTED', reason: dto.reason },
          include: { history: true },
        });
      }

      if (action === 'SEND_BACK') {
        await tx.approvalHistory.create({
          data: {
            approvalRequestId: req.id,
            action: 'SENT_BACK',
            actorId: user.id,
            level: req.currentLevel,
            reason: dto.reason,
          },
        });
        await this.updateSourceDocumentStatus(tx, req.documentType, req.documentId, 'DRAFT', dto.reason!, user.id);
        return tx.approvalRequest.update({
          where: { id: req.id },
          data: { status: 'SENT_BACK', reason: dto.reason },
          include: { history: true },
        });
      }

      // APPROVE
      await tx.approvalHistory.create({
        data: {
          approvalRequestId: req.id,
          action: 'APPROVED',
          actorId: user.id,
          level: req.currentLevel,
          reason: dto.reason || 'Approved',
        },
      });

      if (req.currentLevel < levels.length) {
        const nextLevel = req.currentLevel + 1;
        const nextLevelConfig = levels[nextLevel - 1];
        await this.notifyLevelApprovers(tx, {
          businessId: req.businessId,
          branchId: req.branchId,
          documentType: req.documentType,
          documentId: req.documentId,
          levelConfig: nextLevelConfig,
          title: `Level ${nextLevel} Approval Required (${req.documentType})`,
          message: `Document awaits Level ${nextLevel} approval.`,
          });
        return tx.approvalRequest.update({
          where: { id: req.id },
          data: { currentLevel: nextLevel, status: 'PENDING' },
          include: { history: true },
        });
      }

      // Final level approved
      await this.updateSourceDocumentStatus(tx, req.documentType, req.documentId, 'APPROVED', dto.reason || 'Approved', user.id);
      return tx.approvalRequest.update({
        where: { id: req.id },
        data: { status: 'APPROVED' },
        include: { history: true },
      });
    });
  }

  private async updateSourceDocumentStatus(
    tx: any,
    docType: string,
    docId: string,
    targetStatus: 'APPROVED' | 'REJECTED' | 'DRAFT',
    reason: string,
    userId: string,
  ) {
    if (docType === 'PR') {
      await tx.purchaseRequest.update({
        where: { id: docId },
        data: { status: targetStatus, ...(targetStatus !== 'APPROVED' ? { notes: reason } : {}), updatedById: userId, version: { increment: 1 } },
      });
    } else if (docType === 'PO') {
      const mapped = targetStatus === 'REJECTED' ? 'CANCELLED' : targetStatus;
      await tx.purchaseOrder.update({
        where: { id: docId },
        data: { status: mapped, updatedById: userId, version: { increment: 1 } },
      });
    } else if (docType === 'INVOICE') {
      const mapped = targetStatus === 'REJECTED' ? 'CANCELLED' : targetStatus;
      await tx.purchaseInvoice.update({
        where: { id: docId },
        data: { status: mapped, ...(mapped === 'CANCELLED' ? { cancellationReason: reason } : {}), updatedById: userId, version: { increment: 1 } },
      });
    } else if (docType === 'RETURN') {
      const mapped = targetStatus === 'REJECTED' ? 'CANCELLED' : targetStatus;
      await tx.purchaseReturn.update({
        where: { id: docId },
        data: { status: mapped, updatedById: userId, version: { increment: 1 } },
      });
    }
  }
}
