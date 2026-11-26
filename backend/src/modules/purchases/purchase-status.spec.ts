import { assertPurchaseTransition } from './purchase-status';

describe('purchase status transitions', () => {
  it('allows PR approval and blocks direct conversion before approval', () => {
    expect(() => assertPurchaseTransition('PR', 'DRAFT', 'PENDING_APPROVAL')).not.toThrow();
    expect(() => assertPurchaseTransition('PR', 'PENDING_APPROVAL', 'APPROVED')).not.toThrow();
    expect(() => assertPurchaseTransition('PR', 'APPROVED', 'CONVERTED')).not.toThrow();
  });

  it('rejects invalid transitions', () => {
    expect(() => assertPurchaseTransition('GRN', 'POSTED', 'DRAFT')).toThrow(/Invalid GRN/);
    expect(() => assertPurchaseTransition('INVOICE', 'CANCELLED', 'APPROVED')).toThrow(/Invalid INVOICE/);
  });
});
