import { PrismaService } from '../../prisma/prisma.service';
import { ProductsService } from './products.service';

describe('ProductsService branch inventory', () => {
  it('updates product details and its standard inventory variant together', async () => {
    const updatedProduct = { id: 'product-id', sku: 'NEW-SKU' };
    const tx = {
      product: { update: jest.fn().mockResolvedValue(updatedProduct) },
      productVariant: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const prisma = {
      product: {
        findFirst: jest.fn()
          .mockResolvedValueOnce({ id: 'product-id', sku: 'OLD-SKU' })
          .mockResolvedValueOnce(null),
      },
      $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
    };
    const service = new ProductsService(prisma as unknown as PrismaService);

    await expect(service.updateProduct('business-id', 'product-id', {
      sku: ' NEW-SKU ',
      retailPrice: 25,
      isTaxInclusive: true,
    })).resolves.toBe(updatedProduct);

    expect(tx.product.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'product-id' },
      data: expect.objectContaining({ sku: 'NEW-SKU', retailPrice: 25, isTaxInclusive: true }),
    }));
    expect(tx.productVariant.updateMany).toHaveBeenCalledWith({
      where: { productId: 'product-id', name: 'Standard' },
      data: expect.objectContaining({ sku: 'NEW-SKU' }),
    });
  });

  it('creates dynamic variants with normalized attribute combinations', async () => {
    const tx = {
      product: { create: jest.fn().mockResolvedValue({
        id: 'product-id',
        sku: 'SHIRT',
        hasVariants: true,
        purchasePrice: 10,
        mrp: 20,
        retailPrice: 18,
        minStockLevel: 0,
      }), findFirst: jest.fn().mockResolvedValue(null) },
      productVariant: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'variant-id', sku: 'SHIRT-RED-S' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const prisma = {
      product: { findFirst: jest.fn().mockResolvedValue(null) },
      unit: {
        createMany: jest.fn(),
        findFirst: jest.fn().mockResolvedValue({ id: 'unit-id' }),
      },
      taxRate: {
        count: jest.fn().mockResolvedValue(1),
        findFirst: jest.fn().mockResolvedValue({ id: 'tax-id' }),
      },
      $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
    };
    const service = new ProductsService(prisma as unknown as PrismaService);

    await service.create('business-id', {
      name: 'Shirt',
      sku: 'SHIRT',
      unitId: 'unit-id',
      taxRateId: 'tax-id',
      purchasePrice: 10,
      hasVariants: true,
      variants: [{ sku: 'SHIRT-RED-S', attributes: { Colour: 'Red', Size: 'S' } }],
    });

    expect(tx.productVariant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productId: 'product-id',
        name: 'Red / S',
        combinationKey: 'colour=red&size=s',
        attributeSearch: 'Colour: Red Size: S',
      }),
    });
  });

  it('creates custom units with quantity and UQC metadata', async () => {
    const createdUnit = { id: 'unit-id', symbol: 'CASE' };
    const prisma = {
      unit: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(createdUnit),
      },
    };
    const service = new ProductsService(prisma as unknown as PrismaService);

    await expect(service.createUnit('business-id', {
      name: 'Case',
      symbol: 'case',
      quantityType: 'DECIMAL',
      uqcCode: 'BOX',
    })).resolves.toBe(createdUnit);
    expect(prisma.unit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessId: 'business-id',
        name: 'Case',
        symbol: 'CASE',
        quantityType: 'DECIMAL',
        decimalPlaces: 3,
        uqcCode: 'BOX',
      }),
    });
  });

  it('updates a unit within its business and recalculates quantity precision', async () => {
    const updatedUnit = { id: 'unit-id', name: 'Kilogram', symbol: 'KG' };
    const prisma = {
      unit: {
        findFirst: jest.fn()
          .mockResolvedValueOnce({ id: 'unit-id', quantityType: 'WHOLE' })
          .mockResolvedValueOnce(null),
        update: jest.fn().mockResolvedValue(updatedUnit),
      },
    };
    const service = new ProductsService(prisma as unknown as PrismaService);

    await expect(service.updateUnit('business-id', 'unit-id', {
      name: ' Kilogram ',
      symbol: 'kg',
      quantityType: 'DECIMAL',
      uqcCode: 'kgs',
    })).resolves.toBe(updatedUnit);

    expect(prisma.unit.findFirst).toHaveBeenNthCalledWith(1, {
      where: { id: 'unit-id', businessId: 'business-id' },
    });
    expect(prisma.unit.update).toHaveBeenCalledWith({
      where: { id: 'unit-id' },
      data: {
        name: 'Kilogram',
        symbol: 'KG',
        quantityType: 'DECIMAL',
        decimalPlaces: 3,
        uqcCode: 'KGS',
      },
    });
  });

  it('prevents a unit update from duplicating another unit name or code', async () => {
    const prisma = {
      unit: {
        findFirst: jest.fn()
          .mockResolvedValueOnce({ id: 'unit-id' })
          .mockResolvedValueOnce({ id: 'other-unit-id' }),
        update: jest.fn(),
      },
    };
    const service = new ProductsService(prisma as unknown as PrismaService);

    await expect(service.updateUnit('business-id', 'unit-id', {
      symbol: 'PCS',
    })).rejects.toThrow('A unit with this name or code already exists');
    expect(prisma.unit.update).not.toHaveBeenCalled();
  });

  it('prevents deleting custom units referenced by products', async () => {
    const prisma = {
      unit: {
        findFirst: jest.fn().mockResolvedValue({ id: 'unit-id', isStandard: false }),
        delete: jest.fn(),
      },
      product: { count: jest.fn().mockResolvedValue(1) },
    };
    const service = new ProductsService(prisma as unknown as PrismaService);

    await expect(service.deleteUnit('business-id', 'unit-id')).rejects.toThrow('assigned to existing products');
    expect(prisma.unit.delete).not.toHaveBeenCalled();
  });

  it('moves legacy stock into variants without removing movement history', async () => {
    const tx = {
      product: {
        update: jest.fn().mockResolvedValue({ id: 'product-id' }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      productVariant: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'variant-id', sku: 'SHIRT-RED' }),
        findMany: jest.fn().mockResolvedValue([{ id: 'standard-id', name: 'Standard' }]),
        update: jest.fn(),
      },
      stockBalance: {
        findMany: jest.fn().mockResolvedValue([{ quantity: 5 }]),
        upsert: jest.fn(),
        updateMany: jest.fn(),
      },
      stockMovement: {
        count: jest.fn().mockResolvedValue(1),
        create: jest.fn(),
      },
      branch: { findFirst: jest.fn().mockResolvedValue({ id: 'branch-id' }) },
    };
    const product = {
      id: 'product-id',
      sku: 'SHIRT',
      hasVariants: false,
      purchasePrice: 10,
      mrp: 20,
      retailPrice: 18,
      minStockLevel: 0,
      variants: [{
        id: 'standard-id',
        name: 'Standard',
        stockBalances: [{ branchId: 'branch-id', quantity: 5, averageCost: 10 }],
      }],
    };
    const prisma = {
      product: { findFirst: jest.fn().mockResolvedValue(product) },
      $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
    };
    const service = new ProductsService(prisma as unknown as PrismaService);

    await service.updateProduct('business-id', 'product-id', {
      hasVariants: true,
      variants: [{ sku: 'SHIRT-RED', attributes: { Colour: 'Red' } }],
      stockAllocations: [{ branchId: 'branch-id', sku: 'SHIRT-RED', quantity: 5 }],
    });

    expect(tx.stockBalance.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ branchId: 'branch-id', variantId: 'variant-id', quantity: 5 }),
    }));
    expect(tx.stockBalance.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { branchId: 'branch-id', variantId: 'standard-id' },
      data: { quantity: 0 },
    }));
    expect(tx.stockMovement.create).toHaveBeenCalledTimes(2);
    expect(tx.productVariant.update).toHaveBeenCalledWith({
      where: { id: 'standard-id' },
      data: { isActive: false },
    });
  });

  it('paginates stock balances and preserves the product search filter', async () => {
    const rows = [{ id: 'balance-id' }];
    const prisma = {
      stockBalance: {
        count: jest.fn().mockResolvedValue(21),
        findMany: jest.fn().mockResolvedValue(rows),
      },
    };
    const service = new ProductsService(prisma as unknown as PrismaService);

    await expect(service.balancesPage('business-id', {
      page: '2',
      limit: '10',
      search: 'tea',
    })).resolves.toEqual({
      data: rows,
      meta: {
        total: 21,
        page: 2,
        limit: 10,
        totalPages: 3,
        hasNextPage: true,
        hasPrevPage: true,
      },
    });

    expect(prisma.stockBalance.findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 10,
      take: 10,
      where: expect.objectContaining({
        branch: { businessId: 'business-id' },
        variant: { product: { name: { contains: 'tea', mode: 'insensitive' } } },
      }),
    }));
  });

  it('paginates transfer movements separately from other movements', async () => {
    const rows = [{ id: 'movement-id' }];
    const prisma = {
      stockMovement: {
        count: jest.fn().mockResolvedValue(12),
        findMany: jest.fn().mockResolvedValue(rows),
      },
    };
    const service = new ProductsService(prisma as unknown as PrismaService);

    await expect(service.movementsPage('business-id', { page: 2, limit: 10 }, true)).resolves.toEqual({
      data: rows,
      meta: {
        total: 12,
        page: 2,
        limit: 10,
        totalPages: 2,
        hasNextPage: false,
        hasPrevPage: true,
      },
    });

    expect(prisma.stockMovement.findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 10,
      take: 10,
      where: expect.objectContaining({
        branch: { businessId: 'business-id' },
        type: { in: ['IN_TRANSFER', 'OUT_TRANSFER'] },
      }),
    }));
  });

  it('records stock operations against the selected branch', async () => {
    const tx = {
      branch: { findFirst: jest.fn().mockResolvedValue({ id: 'branch-id' }) },
      productVariant: { findFirst: jest.fn().mockResolvedValue({
        purchasePrice: 10,
        combinationKey: null,
        product: { hasVariants: false, unit: { quantityType: 'WHOLE' } },
      }) },
      stockBalance: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn(),
      },
      stockMovement: { create: jest.fn().mockResolvedValue({ id: 'movement-id' }) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
    };
    const service = new ProductsService(prisma as unknown as PrismaService);

    await service.stockOperation('business-id', 'user-id', {
      branchId: 'branch-id',
      variantId: 'variant-id',
      type: 'IN',
      quantity: 5,
      unitCost: 10,
    });

    expect(tx.stockBalance.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { branchId_variantId: { branchId: 'branch-id', variantId: 'variant-id' } },
      create: expect.objectContaining({ branchId: 'branch-id', variantId: 'variant-id', quantity: 5 }),
    }));
    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        branchId: 'branch-id',
        variantId: 'variant-id',
        type: 'MANUAL_IN',
      }),
    });
  });

  it('rejects unsupported stock operations', async () => {
    const prisma = { $transaction: jest.fn() };
    const service = new ProductsService(prisma as unknown as PrismaService);

    await expect(service.stockOperation('business-id', 'user-id', {
      branchId: 'branch-id',
      variantId: 'variant-id',
      type: 'UNSUPPORTED',
      quantity: 5,
    })).rejects.toThrow('Unsupported stock operation');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('moves stock between branches without warehouses', async () => {
    const tx = {
      branch: {
        findFirst: jest.fn()
          .mockResolvedValueOnce({ id: 'from-branch' })
          .mockResolvedValueOnce({ id: 'to-branch' }),
      },
      productVariant: {
        findFirst: jest.fn().mockResolvedValue({
          combinationKey: null,
          product: { hasVariants: false, unit: { quantityType: 'WHOLE' } },
        }),
      },
      stockBalance: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'balance-id',
          quantity: 8,
          averageCost: 12,
        }),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        upsert: jest.fn(),
      },
      stockMovement: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
    };
    const service = new ProductsService(prisma as unknown as PrismaService);

    await service.transfer('business-id', 'user-id', {
      fromBranchId: 'from-branch',
      toBranchId: 'to-branch',
      variantId: 'variant-id',
      quantity: 3,
    });

    expect(tx.stockBalance.updateMany).toHaveBeenCalledWith({
      where: { id: 'balance-id', quantity: { gte: 3 } },
      data: { quantity: { decrement: 3 } },
    });
    expect(tx.stockBalance.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { branchId_variantId: { branchId: 'to-branch', variantId: 'variant-id' } },
    }));
    expect(tx.stockMovement.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({ branchId: 'from-branch', type: 'OUT_TRANSFER' }),
    });
    expect(tx.stockMovement.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({ branchId: 'to-branch', type: 'IN_TRANSFER' }),
    });
  });

  it('rejects unsupported inventory reports', async () => {
    const service = new ProductsService({} as PrismaService);

    await expect(service.report('business-id', 'unsupported')).rejects.toThrow('Unsupported inventory report');
  });
});
