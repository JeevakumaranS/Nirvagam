import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { PaginationParams, StockMovementType } from '@nirvagam/shared';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async findAll(businessId: string, params: PaginationParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 50));
    const skip = (page - 1) * limit;

    const where: any = {
      businessId,
      isActive: true,
      ...(params.search && {
        OR: [
          { name: { contains: params.search, mode: 'insensitive' } },
          { sku: { contains: params.search, mode: 'insensitive' } },
          { barcode: { contains: params.search, mode: 'insensitive' } },
          { hsnCode: { contains: params.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [total, products] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        include: {
          unit: true,
          taxRate: true,
          category: true,
          brand: true,
          variants: {
            include: {
              stockBalances: {
                include: { warehouse: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const formatted = products.map((p) => {
      let totalStock = 0;
      p.variants.forEach((v) => {
        v.stockBalances.forEach((sb) => {
          totalStock += Number(sb.quantity || 0);
        });
      });

      return {
        ...p,
        totalStock,
        isLowStock: totalStock <= Number(p.minStockLevel || 0),
      };
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: formatted,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  async create(businessId: string, branchId: string | undefined, dto: CreateProductDto) {
    const existing = await this.prisma.product.findFirst({
      where: { businessId, sku: dto.sku.trim() },
    });
    if (existing) {
      throw new ConflictException(`SKU "${dto.sku}" already exists`);
    }

    // Resolve default unit and tax rate if not passed
    let unitId = dto.unitId;
    if (!unitId) {
      const defaultUnit = await this.prisma.unit.findFirst({
        where: { businessId, isDefault: true },
      });
      unitId = defaultUnit?.id || (await this.prisma.unit.findFirst({ where: { businessId } }))?.id;
    }

    let taxRateId = dto.taxRateId;
    if (!taxRateId) {
      const defaultTax = await this.prisma.taxRate.findFirst({
        where: { businessId, isDefault: true },
      });
      taxRateId = defaultTax?.id || (await this.prisma.taxRate.findFirst({ where: { businessId } }))?.id;
    }

    if (!unitId || !taxRateId) {
      throw new NotFoundException('Units or Tax Rates not configured for this business');
    }

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          businessId,
          unitId,
          taxRateId,
          categoryId: dto.categoryId,
          name: dto.name,
          sku: dto.sku.trim(),
          barcode: dto.barcode,
          hsnCode: dto.hsnCode,
          purchasePrice: dto.purchasePrice,
          salesPrice: dto.salesPrice,
          mrp: dto.mrp || dto.salesPrice,
          minStockLevel: dto.minStockLevel || 0,
          isTaxInclusive: dto.isTaxInclusive || false,
        },
      });

      // Default Variant
      const variant = await tx.productVariant.create({
        data: {
          productId: product.id,
          name: 'Standard',
          sku: dto.sku.trim(),
          barcode: dto.barcode,
          purchasePrice: dto.purchasePrice,
          salesPrice: dto.salesPrice,
          mrp: dto.mrp || dto.salesPrice,
        },
      });

      // If opening stock provided, allocate to default warehouse
      if (dto.openingStock && dto.openingStock > 0 && branchId) {
        const warehouse = await tx.warehouse.findFirst({
          where: { branchId, isDefault: true },
        });

        if (warehouse) {
          await tx.stockBalance.create({
            data: {
              warehouseId: warehouse.id,
              variantId: variant.id,
              quantity: dto.openingStock,
              averageCost: dto.purchasePrice,
            },
          });

          await tx.stockMovement.create({
            data: {
              warehouseId: warehouse.id,
              variantId: variant.id,
              type: StockMovementType.ADJUSTMENT_ADD,
              quantity: dto.openingStock,
              unitCost: dto.purchasePrice,
              totalCost: dto.openingStock * dto.purchasePrice,
              notes: 'Opening Stock Balance',
            },
          });
        }
      }

      return product;
    });
  }

  async getUnits(businessId: string) {
    return this.prisma.unit.findMany({
      where: { businessId },
      orderBy: { name: 'asc' },
    });
  }

  async getCategories(businessId: string) {
    return this.prisma.category.findMany({
      where: { businessId },
      orderBy: { name: 'asc' },
    });
  }

  async getTaxRates(businessId: string) {
    return this.prisma.taxRate.findMany({
      where: { businessId, isActive: true },
      orderBy: { rate: 'asc' },
    });
  }
}
