import { calculateGstInvoice } from '@nirvagam/shared';

describe('sales GST calculation', () => {
  const item = (unitPrice: number) => [
    { id: 'variant-1', name: 'Item', quantity: 1, unitPrice, gstRate: 18 },
  ];

  it('calculates exclusive and inclusive prices to the same taxable value and total', () => {
    const exclusive = calculateGstInvoice('33', '33', item(1000));
    const inclusive = calculateGstInvoice('33', '33', item(1180), 0, { pricesIncludeTax: true });

    expect(exclusive).toMatchObject({
      totalTaxable: 1000,
      totalCgst: 90,
      totalSgst: 90,
      netTotal: 1180,
    });
    expect(inclusive).toMatchObject({
      totalTaxable: 1000,
      totalCgst: 90,
      totalSgst: 90,
      netTotal: 1180,
    });
  });

  it('uses IGST for interstate supply and does not charge GST for an unregistered seller', () => {
    const interstate = calculateGstInvoice('33', '29', item(1000));
    const unregistered = calculateGstInvoice('33', '29', item(1000), 0, {
      sellerRegisteredForGst: false,
    });

    expect(interstate).toMatchObject({ totalCgst: 0, totalSgst: 0, totalIgst: 180 });
    expect(unregistered).toMatchObject({
      totalCgst: 0,
      totalSgst: 0,
      totalIgst: 0,
      totalTax: 0,
      netTotal: 1000,
    });
  });

  it('allocates invoice discounts before calculating tax and includes other charges', () => {
    const result = calculateGstInvoice('33', '33', item(1000), 100, { otherCharges: 25 });

    expect(result).toMatchObject({
      totalTaxable: 900,
      totalCgst: 81,
      totalSgst: 81,
      netTotal: 1087,
    });
  });
});
