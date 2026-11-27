import { PrismaClient } from "@prisma/client";

/** Development-only inventory fixtures. Run with BUSINESS_ID=<id>. */
async function main() {
  if (process.env.NODE_ENV === "production")
    throw new Error("Inventory seed is disabled in production");
  const businessId = process.env.BUSINESS_ID;
  if (!businessId)
    throw new Error("Set BUSINESS_ID to a tenant business before seeding");
  const prisma = new PrismaClient();
  try {
    const unit = await prisma.unit.findFirstOrThrow({ where: { businessId } });
    const taxRate = await prisma.taxRate.findFirstOrThrow({
      where: { businessId },
    });
    const branch = await prisma.branch.findFirstOrThrow({
      where: { businessId, isActive: true },
    });
    for (const item of [
      {
        name: "Organic Cotton Poplin",
        sku: "TXT-COT-001",
        purchasePrice: 280,
        salesPrice: 599,
        openingStock: 120,
      },
      {
        name: "Linen Blend Saree Fabric",
        sku: "TXT-LIN-002",
        purchasePrice: 640,
        salesPrice: 1299,
        openingStock: 35,
      },
      {
        name: "Indigo Denim Roll",
        sku: "TXT-DNM-003",
        purchasePrice: 510,
        salesPrice: 999,
        openingStock: 8,
      },
    ]) {
      const exists = await prisma.product.findFirst({
        where: { businessId, sku: item.sku },
      });
      if (exists) continue;
      const product = await prisma.product.create({
        data: {
          businessId,
          unitId: unit.id,
          taxRateId: taxRate.id,
          name: item.name,
          sku: item.sku,
          purchasePrice: item.purchasePrice,
          mrp: item.salesPrice,
            retailPrice: item.salesPrice,
            wholesalePrice: item.salesPrice * 0.9,
          minStockLevel: 10,
        },
      });
      const variant = await prisma.productVariant.create({
        data: {
          productId: product.id,
          name: "Standard",
          sku: item.sku,
          purchasePrice: item.purchasePrice,
          retailPrice: item.salesPrice,
          mrp: item.salesPrice,
        },
      });
      await prisma.stockBalance.create({
        data: {
          branchId: branch.id,
          variantId: variant.id,
          quantity: item.openingStock,
          averageCost: item.purchasePrice,
        },
      });
      await prisma.stockMovement.create({
        data: {
          branchId: branch.id,
          variantId: variant.id,
          type: "MANUAL_IN",
          quantity: item.openingStock,
          unitCost: item.purchasePrice,
          totalCost: item.openingStock * item.purchasePrice,
          reason: "Development inventory seed",
          notes: "Inventory seed",
        },
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
