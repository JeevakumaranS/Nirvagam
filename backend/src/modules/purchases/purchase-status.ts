export type PurchaseDocumentType = 'PR' | 'PO' | 'GRN' | 'INVOICE' | 'RETURN';

export const PURCHASE_TRANSITIONS: Record<PurchaseDocumentType, Record<string, string[]>> = {
  PR: {
    DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
    PENDING_APPROVAL: ['APPROVED', 'REJECTED', 'CANCELLED'],
    APPROVED: ['CONVERTED', 'CANCELLED'],
    REJECTED: [],
    CONVERTED: [],
    CANCELLED: [],
  },
  PO: {
    DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
    PENDING_APPROVAL: ['APPROVED', 'CANCELLED'],
    APPROVED: ['PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'CLOSED', 'CANCELLED'],
    PARTIALLY_RECEIVED: ['FULLY_RECEIVED', 'CLOSED', 'CANCELLED'],
    FULLY_RECEIVED: ['CLOSED', 'CANCELLED'],
    CLOSED: [],
    CANCELLED: [],
  },
  GRN: {
    DRAFT: ['POSTED', 'CANCELLED'],
    POSTED: ['CANCELLED'],
    CANCELLED: [],
  },
  INVOICE: {
    DRAFT: ['PENDING_APPROVAL', 'APPROVED', 'CANCELLED'],
    PENDING_APPROVAL: ['APPROVED', 'CANCELLED'],
    APPROVED: ['PARTIALLY_PAID', 'PAID', 'CANCELLED'],
    PARTIALLY_PAID: ['PAID', 'CANCELLED'],
    PAID: ['CANCELLED'],
    CANCELLED: [],
  },
  RETURN: {
    DRAFT: ['APPROVED', 'CANCELLED'],
    APPROVED: ['POSTED', 'CANCELLED'],
    POSTED: ['CANCELLED'],
    CANCELLED: [],
  },
};

export function assertPurchaseTransition(type: PurchaseDocumentType, from: string, to: string): void {
  if (!PURCHASE_TRANSITIONS[type][from]?.includes(to)) {
    throw new Error(`Invalid ${type} status transition: ${from} -> ${to}`);
  }
}
