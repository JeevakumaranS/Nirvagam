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
    })).resolves.toBe(updatedProduct);

    expect(tx.product.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'product-id' },
      data: expect.objectContaining({ sku: 'NEW-SKU', retailPrice: 25 }),
    }));
    expect(tx.productVariant.updateMany).toHaveBeenCalledWith({
      where: { productId: 'product-id', name: 'Standard' },
      data: expect.objectContaining({ sku: 'NEW-SKU' }),
    });
  });

  it('records stock operations against the selected branch', async () => {
    const tx = {
      branch: { findFirst: jest.fn().mockResolvedValue({ id: 'branch-id' }) },
      productVariant: { findFirst: jest.fn().mockResolvedValue({ purchasePrice: 10 }) },
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

  it('rejects removed adjustment operations', async () => {
    const prisma = { $transaction: jest.fn() };
    const service = new ProductsService(prisma as unknown as PrismaService);

    await expect(service.stockOperation('business-id', 'user-id', {
      branchId: 'branch-id',
      variantId: 'variant-id',
      type: 'ADJUSTMENT',
      quantity: 5,
    })).rejects.toThrow('Stock operation must be IN or OUT');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('moves stock between branches without warehouses', async () => {
    const tx = {
      branch: {
        findFirst: jest.fn()
          .mockResolvedValueOnce({ id: 'from-branch' })
          .mockResolvedValueOnce({ id: 'to-branch' }),
      },
      stockBalance: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'balance-id',
          quantity: 8,
          averageCost: 12,
        }),
        update: jest.fn(),
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

    expect(tx.stockBalance.update).toHaveBeenCalledWith({
      where: { id: 'balance-id' },
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
});
