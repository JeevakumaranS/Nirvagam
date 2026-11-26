import { calculatePurchaseDocument } from '@nirvagam/shared';

describe('purchase calculation engine', () => {
  it('calculates line discount, invoice discount, and intra-state CGST/SGST in order', () => {
    const result = calculatePurchaseDocument(
      [
        {
          id: 'line-1',
          quantity: '2',
          rate: '500',
          lineDiscountType: 'PERCENT',
          lineDiscountValue: '10',
          taxRate: '18',
        },
      ],
      {
        businessStateCode: '33',
        supplierStateCode: '33',
        pricesIncludeTax: false,
        invoiceDiscountType: 'AMOUNT',
        invoiceDiscountValue: '50',
        charges: [],
      }
    );

    expect(result.taxableAmount).toBe('850');
    expect(result.discountAmount).toBe('150');
    expect(result.cgstAmount).toBe('76.5');
    expect(result.sgstAmount).toBe('76.5');
    expect(result.totalTax).toBe('153');
    expect(result.grandTotal).toBe('1003');
  });

  it('calculates inclusive tax and interstate IGST', () => {
    const result = calculatePurchaseDocument(
      [{ id: 'line-1', quantity: '1', rate: '1180', taxRate: '18' }],
      {
        businessStateCode: '33',
        supplierStateCode: '29',
        pricesIncludeTax: true,
      }
    );

    expect(result.isInterState).toBe(true);
    expect(result.taxableAmount).toBe('1000');
    expect(result.igstAmount).toBe('180');
    expect(result.grandTotal).toBe('1180');
  });

  it('allocates freight by VALUE, QUANTITY, and WEIGHT to item landedCost', () => {
    // 2 items: Item A (qty 2, rate 100 -> 200, weight 10), Item B (qty 8, rate 100 -> 800, weight 90)
    // Freight = 100
    const byValue = calculatePurchaseDocument(
      [
        { id: 'a', quantity: '2', rate: '100', weight: '10', taxRate: '0' },
        { id: 'b', quantity: '8', rate: '100', weight: '90', taxRate: '0' },
      ],
      {
        businessStateCode: '33',
        supplierStateCode: '33',
        charges: [{ name: 'Freight', type: 'FREIGHT', amount: '100', isTaxable: false, allocationMethod: 'VALUE' }],
      }
    );
    expect(byValue.items[0].allocatedFreight).toBe('20');
    expect(byValue.items[1].allocatedFreight).toBe('80');
    expect(byValue.items[0].landedCost).toBe('110'); // (200 + 20) / 2
    expect(byValue.items[1].landedCost).toBe('110'); // (800 + 80) / 8

    const byWeight = calculatePurchaseDocument(
      [
        { id: 'a', quantity: '2', rate: '100', weight: '10', taxRate: '0' },
        { id: 'b', quantity: '8', rate: '100', weight: '90', taxRate: '0' },
      ],
      {
        businessStateCode: '33',
        supplierStateCode: '33',
        charges: [{ name: 'Freight', type: 'FREIGHT', amount: '100', isTaxable: false, allocationMethod: 'WEIGHT' }],
      }
    );
    expect(byWeight.items[0].allocatedFreight).toBe('10');
    expect(byWeight.items[1].allocatedFreight).toBe('90');
    expect(byWeight.items[0].landedCost).toBe('105'); // (200 + 10) / 2
    expect(byWeight.items[1].landedCost).toBe('111.25'); // (800 + 90) / 8

    const byQty = calculatePurchaseDocument(
      [
        { id: 'a', quantity: '2', rate: '100', taxRate: '0' },
        { id: 'b', quantity: '8', rate: '100', taxRate: '0' },
      ],
      {
        businessStateCode: '33',
        supplierStateCode: '33',
        charges: [{ name: 'Freight', type: 'FREIGHT', amount: '100', isTaxable: false, allocationMethod: 'QUANTITY' }],
      }
    );
    expect(byQty.items[0].allocatedFreight).toBe('20');
    expect(byQty.items[1].allocatedFreight).toBe('80');
  });

  it('supports VAT regime, round-off, and multi-rate tax summary', () => {
    const result = calculatePurchaseDocument(
      [
        { id: 'a', quantity: '1', rate: '1000', taxRate: '5' },
        { id: 'b', quantity: '1', rate: '1000', taxRate: '15' },
      ],
      {
        businessStateCode: '33',
        supplierStateCode: '29',
        taxRegime: 'VAT',
        roundOff: '0.25',
        charges: [{ name: 'Packing', type: 'PACKING', amount: '100', isTaxable: true, taxRate: '5' }],
      }
    );

    expect(result.taxRegime).toBe('VAT');
    expect(result.vatAmount).toBe('205'); // 50 + 150 + 5
    expect(result.cgstAmount).toBe('0');
    expect(result.igstAmount).toBe('0');
    expect(result.grandTotal).toBe('2305.25');
    expect(result.taxSummary).toEqual(
      expect.arrayContaining([
        { rate: '5', taxable: '1100', tax: '55' },
        { rate: '15', taxable: '1000', tax: '150' },
      ])
    );
  });
});
