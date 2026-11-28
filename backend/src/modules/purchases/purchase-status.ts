import { BadRequestException } from "@nestjs/common";

type PurchaseDocumentType = "PR" | "PO" | "GRN" | "INVOICE";

const allowedTransitions: Record<
  PurchaseDocumentType,
  Record<string, readonly string[]>
> = {
  PR: {
    DRAFT: ["APPROVED", "PENDING_APPROVAL", "CANCELLED"],
    PENDING_APPROVAL: ["APPROVED", "REJECTED", "CANCELLED"],
  },
  PO: {
    DRAFT: ["APPROVED", "ORDER_PLACED", "PENDING_APPROVAL", "CANCELLED"],
    PENDING_APPROVAL: ["APPROVED", "CANCELLED"],
    ORDER_PLACED: ["PARTIALLY_RECEIVED", "FULLY_RECEIVED", "CLOSED", "CANCELLED"],
    APPROVED: ["PARTIALLY_RECEIVED", "FULLY_RECEIVED", "CLOSED", "CANCELLED"],
  },
  GRN: {
    DRAFT: ["POSTED", "CANCELLED"],
  },
  INVOICE: {
    DRAFT: ["PENDING_APPROVAL", "APPROVED", "CANCELLED"],
    PENDING_APPROVAL: ["APPROVED", "CANCELLED"],
  },
};

export function assertPurchaseTransition(
  documentType: PurchaseDocumentType,
  currentStatus: string,
  targetStatus: string,
): void {
  const allowed = allowedTransitions[documentType][currentStatus] || [];
  if (!allowed.includes(targetStatus)) {
    throw new BadRequestException(
      `Cannot change ${documentType} status from ${currentStatus} to ${targetStatus}`,
    );
  }
}
