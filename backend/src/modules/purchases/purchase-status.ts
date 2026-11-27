import { BadRequestException } from "@nestjs/common";

type PurchaseDocumentType = "PR" | "PO" | "GRN" | "INVOICE" | "RETURN";

const allowedTransitions: Record<
  PurchaseDocumentType,
  Record<string, readonly string[]>
> = {
  PR: {
    DRAFT: ["PENDING_APPROVAL", "CANCELLED"],
    PENDING_APPROVAL: ["APPROVED", "REJECTED", "CANCELLED"],
  },
  PO: {
    DRAFT: ["PENDING_APPROVAL", "CANCELLED"],
    PENDING_APPROVAL: ["APPROVED", "CANCELLED"],
    APPROVED: ["PARTIALLY_RECEIVED", "FULLY_RECEIVED", "CLOSED", "CANCELLED"],
  },
  GRN: {
    DRAFT: ["POSTED", "CANCELLED"],
  },
  INVOICE: {
    DRAFT: ["PENDING_APPROVAL", "APPROVED", "CANCELLED"],
    PENDING_APPROVAL: ["APPROVED", "CANCELLED"],
  },
  RETURN: {
    DRAFT: ["APPROVED", "CANCELLED"],
    APPROVED: ["POSTED", "CANCELLED"],
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
