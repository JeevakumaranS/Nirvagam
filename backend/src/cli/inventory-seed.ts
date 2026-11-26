import { PrismaClient } from '@prisma/client';

/** Development-only inventory fixtures. Run with BUSINESS_ID=<id>. */
async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Inventory seed is disabled in production');
  const businessId = process.env.BUSINESS_ID;
  if (!businessId) throw new Error('Set BUSINESS_ID to a tenant business before seeding');
  const prisma = new PrismaClient();
  try {
    const unit = await prisma.unit.findFirstOrThrow({ where: { businessId } });
    const taxRate = await prisma.taxRate.findFirstOrThrow({ where: { businessId } });
    const branch = await prisma.branch.findFirstOrThrow({ where: { businessId, isActive: true } });
    for (const item of [{ name: 'Organic Cotton Poplin', sku: 'TXT-COT-001', purchasePrice: 280, retailPrice: 599, quantity: 120 }, { name: 'Linen Blend Saree Fabric', sku: 'TXT-LIN-002', purchasePrice: 640, retailPrice: 1299, quantity: 35 }, { name: 'Indigo Denim Roll', sku: 'TXT-DNM-003', purchasePrice: 510, retailPrice: 999, quantity: 8 }]) {
      const exists = await prisma.product.findFirst({ where: { businessId, sku: item.sku } });
      if (exists) continue;
      const product = await prisma.product.create({ data: { businessId, unitId: unit.id, taxRateId: taxRate.id, name: item.name, sku: item.sku, purchasePrice: item.purchasePrice, mrp: item.retailPrice, retailPrice: item.retailPrice, wholesalePrice: item.retailPrice * 0.9, minStockLevel: 10 } });
      const variant = await prisma.productVariant.create({ data: { productId: product.id, name: 'Standard', sku: item.sku, purchasePrice: item.purchasePrice, salesPrice: item.retailPrice, mrp: item.retailPrice } });
      await prisma.stockBalance.create({ data: { branchId: branch.id, variantId: variant.id, quantity: item.quantity, averageCost: item.purchasePrice } });
      await prisma.stockMovement.create({ data: { branchId: branch.id, variantId: variant.id, type: 'MANUAL_IN', quantity: item.quantity, unitCost: item.purchasePrice, totalCost: item.quantity * item.purchasePrice, reason: 'Development inventory seed', notes: 'Inventory seed' } });
    }
  } finally { await prisma.$disconnect(); }
}
main().catch((error) => { console.error(error); process.exit(1); });
