import { calculatePurchaseDocument } from '@nirvagam/shared';

describe('purchase calculation engine', () => {
  it('calculates line discount, tax and invoice discount in order', () => {
    const result = calculatePurchaseDocument([
      {
        id: 'line-1',
        quantity: '2',
        rate: '500',
        lineDiscountType: 'PERCENT',
        lineDiscountValue: '10',
        taxRate: '18',
      },
    ], {
      businessStateCode: '33',
      supplierStateCode: '33',
      pricesIncludeTax: false,
      invoiceDiscountType: 'AMOUNT',
      invoiceDiscountValue: '50',
      charges: [],
    });

    expect(result.taxableAmount).toBe('850');
    expect(result.cgstAmount).toBe('76.5');
    expect(result.sgstAmount).toBe('76.5');
    expect(result.totalTax).toBe('153');
    expect(result.grandTotal).toBe('1003');
  });

  it('calculates inclusive tax and interstate IGST', () => {
    const result = calculatePurchaseDocument([
      { id: 'line-1', quantity: '1', rate: '1180', taxRate: '18' },
    ], {
      businessStateCode: '33',
      supplierStateCode: '29',
      pricesIncludeTax: true,
    });

    expect(result.taxableAmount).toBe('1000');
    expect(result.igstAmount).toBe('180');
    expect(result.grandTotal).toBe('1180');
  });

  it('adds taxable freight and its tax to the grand total', () => {
    const result = calculatePurchaseDocument([
      { id: 'line-1', quantity: '1', rate: '1000', taxRate: '18' },
    ], {
      businessStateCode: '33',
      supplierStateCode: '33',
      charges: [
        { name: 'Freight', type: 'FREIGHT', amount: '100', isTaxable: true, taxRate: '18', allocationMethod: 'VALUE' },
      ],
    });

    expect(result.additionalCharges).toBe('100');
    expect(result.totalTax).toBe('198');
    expect(result.grandTotal).toBe('1298');
  });
});
