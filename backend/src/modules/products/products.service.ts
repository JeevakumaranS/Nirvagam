import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { PaginationParams } from '@nirvagam/shared';

@Injectable()
export class ProductsService {
  private readonly metadataInitialization = new Map<string, Promise<void>>();

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
          variants: {
            include: {
              stockBalances: true,
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

  async create(businessId: string, dto: CreateProductDto) {
    await this.ensureInventoryMetadata(businessId);
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

    const purchasePrice = Number(dto.purchasePrice || 0);
    const retailPrice = Number(dto.retailPrice || 0);
    const mrp = Number(dto.mrp || retailPrice);

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          businessId,
          unitId,
          taxRateId,
          name: dto.name,
          sku: dto.sku.trim(),
          barcode: dto.barcode,
          hsnCode: dto.hsnCode,
          purchasePrice,
          mrp,
          wholesalePrice: Number(dto.wholesalePrice || retailPrice),
          retailPrice,
          minStockLevel: dto.minStockLevel || 0,
          description: dto.description,
          imageUrl: dto.imageUrl,
          trackingMode: dto.trackingMode || 'NONE',
          isActive: dto.isActive ?? true,
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
          purchasePrice,
          mrp,
        },
      });

      return product;
    });
  }

  async getUnits(businessId: string) {
    await this.ensureInventoryMetadata(businessId);
    return this.prisma.unit.findMany({
      where: { businessId },
      orderBy: { name: 'asc' },
    });
  }

  async createUnit(businessId: string, dto: any) {
    if (!dto.name?.trim() || !dto.symbol?.trim()) throw new BadRequestException('Unit name and symbol are required');
    return this.prisma.unit.create({ data: { businessId, name: dto.name.trim(), symbol: dto.symbol.trim().toUpperCase(), decimalPlaces: Number(dto.decimalPlaces || 0), isDefault: Boolean(dto.isDefault) } });
  }

  async branches(businessId: string) {
    return this.prisma.branch.findMany({
      where: { businessId, isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });
  }

  async getTaxRates(businessId: string) {
    await this.ensureInventoryMetadata(businessId);
    return this.prisma.taxRate.findMany({
      where: { businessId, isActive: true },
      orderBy: { rate: 'asc' },
    });
  }

  /** Makes the inventory form usable for businesses created before inventory defaults existed. */
  private async ensureInventoryMetadata(businessId: string) {
    const running = this.metadataInitialization.get(businessId);
    if (running) return running;
    const initialization = this.initializeInventoryMetadata(businessId);
    this.metadataInitialization.set(businessId, initialization);
    try {
      await initialization;
    } finally {
      this.metadataInitialization.delete(businessId);
    }
  }

  private async initializeInventoryMetadata(businessId: string) {
    const [unitCount, taxCount] = await Promise.all([
      this.prisma.unit.count({ where: { businessId } }),
      this.prisma.taxRate.count({ where: { businessId } }),
    ]);
    if (unitCount === 0) {
      await this.prisma.unit.createMany({ data: [
        { businessId, name: 'Pieces', symbol: 'PCS', decimalPlaces: 0, isDefault: true },
        { businessId, name: 'Meter', symbol: 'MTR', decimalPlaces: 2, isDefault: false },
        { businessId, name: 'Kilogram', symbol: 'KG', decimalPlaces: 3, isDefault: false },
      ] });
    }
    if (taxCount === 0) {
      await this.prisma.taxRate.createMany({ data: [0, 5, 12, 18, 28].map((rate) => ({
        businessId, name: rate === 0 ? 'GST 0% (Nil)' : `GST ${rate}%`, rate,
        cgstRate: rate / 2, sgstRate: rate / 2, igstRate: rate, isDefault: rate === 18, isActive: true,
      })) });
    }
  }

  async updateProduct(businessId: string, id: string, dto: Partial<CreateProductDto>) {
    const product = await this.prisma.product.findFirst({ where: { id, businessId } });
    if (!product) throw new NotFoundException('Product not found');
    const sku = dto.sku?.trim();
    if (dto.sku !== undefined && !sku) throw new BadRequestException('SKU is required');
    if (sku && sku !== product.sku) {
      const duplicate = await this.prisma.product.findFirst({ where: { businessId, sku, NOT: { id } } });
      if (duplicate) throw new ConflictException(`SKU "${sku}" already exists`);
    }
    return this.prisma.$transaction(async (tx) => {
      const updatedProduct = await tx.product.update({ where: { id }, data: {
        name: dto.name, sku, barcode: dto.barcode, hsnCode: dto.hsnCode, description: dto.description,
        unitId: dto.unitId, taxRateId: dto.taxRateId,
        purchasePrice: dto.purchasePrice, mrp: dto.mrp,
        wholesalePrice: dto.wholesalePrice, retailPrice: dto.retailPrice, minStockLevel: dto.minStockLevel,
        imageUrl: dto.imageUrl, trackingMode: dto.trackingMode, isActive: dto.isActive,
      } });
      const variantData = {
        sku,
        barcode: dto.barcode,
        purchasePrice: dto.purchasePrice,
        mrp: dto.mrp,
      };
      if (Object.values(variantData).some((value) => value !== undefined)) {
        await tx.productVariant.updateMany({
          where: { productId: id, name: 'Standard' },
          data: variantData,
        });
      }
      return updatedProduct;
    });
  }

  async removeProduct(businessId: string, id: string) {
    const product = await this.prisma.product.findFirst({ where: { id, businessId } });
    if (!product) throw new NotFoundException('Product not found');
    return this.prisma.product.update({ where: { id }, data: { isActive: false } });
  }

  async overview(businessId: string) {
    const products = await this.prisma.product.findMany({
      where: { businessId },
      include: { unit: true, variants: { include: { stockBalances: true } } },
    });
    const rows = products.map((p) => {
      const stock = p.variants.reduce((n, v) => n + v.stockBalances.reduce((s, b) => s + Number(b.quantity), 0), 0);
      const valuation = p.variants.reduce((n, v) => n + v.stockBalances.reduce((s, b) => s + Number(b.quantity) * Number(b.averageCost), 0), 0);
      return { ...p, totalStock: stock, valuation, isLowStock: stock > 0 && stock <= Number(p.minStockLevel), isOutOfStock: stock <= 0 };
    });
    const recentMovements = await this.prisma.stockMovement.findMany({
      where: { branch: { businessId } }, include: { variant: { include: { product: true } }, branch: true }, orderBy: { createdAt: 'desc' }, take: 8,
    });
    return { totalProducts: products.length, inventoryValuation: rows.reduce((n, p) => n + p.valuation, 0), lowStockProducts: rows.filter(p => p.isLowStock).length, outOfStockProducts: rows.filter(p => p.isOutOfStock).length, recentMovements };
  }

  async balances(businessId: string, search?: string) {
    return this.prisma.stockBalance.findMany({
      where: { branch: { businessId }, ...(search ? { variant: { product: { name: { contains: search, mode: 'insensitive' } } } } : {}) },
      include: { branch: true, variant: { include: { product: { include: { unit: true } } } } }, orderBy: { updatedAt: 'desc' },
    });
  }

  async movements(businessId: string, search?: string) {
    return this.prisma.stockMovement.findMany({ where: { branch: { businessId }, ...(search ? { variant: { product: { name: { contains: search, mode: 'insensitive' } } } } : {}) }, include: { branch: true, variant: { include: { product: true } } }, orderBy: { createdAt: 'desc' }, take: 200 });
  }

  async stockOperation(businessId: string, userId: string, dto: any) {
    const quantity = Number(dto.quantity);
    if (!dto.variantId || !dto.branchId || !Number.isFinite(quantity) || quantity <= 0) throw new BadRequestException('Variant, branch and a positive quantity are required');
    if (!['IN', 'OUT'].includes(dto.type)) throw new BadRequestException('Stock operation must be IN or OUT');
    return this.prisma.$transaction(async (tx) => {
      const branch = await tx.branch.findFirst({ where: { id: dto.branchId, businessId, isActive: true } });
      if (!branch) throw new NotFoundException('Branch not found for this business');
      const variant = await tx.productVariant.findFirst({ where: { id: dto.variantId, product: { businessId } } });
      if (!variant) throw new NotFoundException('Product variant not found for this business');
      const current = await tx.stockBalance.findUnique({ where: { branchId_variantId: { branchId: branch.id, variantId: dto.variantId } } });
      const isOut = dto.type === 'OUT';
      const currentQty = Number(current?.quantity || 0);
      if (isOut && currentQty < quantity) throw new BadRequestException('Insufficient stock. Negative stock is not allowed');
      const nextQty = currentQty + (isOut ? -quantity : quantity);
      const cost = Number(dto.unitCost ?? variant.purchasePrice);
      const averageCost = nextQty > 0 && !isOut ? ((currentQty * Number(current?.averageCost || cost)) + quantity * cost) / nextQty : Number(current?.averageCost || cost);
      await tx.stockBalance.upsert({ where: { branchId_variantId: { branchId: branch.id, variantId: dto.variantId } }, create: { branchId: branch.id, variantId: dto.variantId, quantity: nextQty, averageCost }, update: { quantity: nextQty, averageCost } });
      return tx.stockMovement.create({ data: { branchId: branch.id, variantId: dto.variantId, type: isOut ? 'MANUAL_OUT' : 'MANUAL_IN', quantity, unitCost: cost, totalCost: quantity * cost, notes: dto.reference || dto.notes, reason: dto.reason, performedById: userId, batchNumber: dto.batchNumber, expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined, serialNumber: dto.serialNumber } });
    });
  }

  async transfer(businessId: string, userId: string, dto: any) {
    if (dto.fromBranchId === dto.toBranchId) throw new BadRequestException('Source and destination branches must differ');
    return this.prisma.$transaction(async (tx) => {
      const from = await tx.branch.findFirst({ where: { id: dto.fromBranchId, businessId, isActive: true } });
      const to = await tx.branch.findFirst({ where: { id: dto.toBranchId, businessId, isActive: true } });
      if (!from || !to) throw new NotFoundException('Transfer branch not found for this business');
      const qty = Number(dto.quantity); if (!Number.isFinite(qty) || qty <= 0) throw new BadRequestException('Transfer quantity must be positive');
      const balance = await tx.stockBalance.findUnique({ where: { branchId_variantId: { branchId: from.id, variantId: dto.variantId } } });
      if (!balance || Number(balance.quantity) < qty) throw new BadRequestException('Insufficient stock for transfer');
      await tx.stockBalance.update({ where: { id: balance.id }, data: { quantity: { decrement: qty } } });
      await tx.stockBalance.upsert({ where: { branchId_variantId: { branchId: to.id, variantId: dto.variantId } }, create: { branchId: to.id, variantId: dto.variantId, quantity: qty, averageCost: balance.averageCost }, update: { quantity: { increment: qty }, averageCost: balance.averageCost } });
      const common = { variantId: dto.variantId, quantity: qty, unitCost: balance.averageCost, totalCost: qty * Number(balance.averageCost), notes: dto.reason || 'Branch stock transfer', referenceId: undefined, performedById: userId };
      await tx.stockMovement.create({ data: { branchId: from.id, type: 'OUT_TRANSFER', ...common } });
      return tx.stockMovement.create({ data: { branchId: to.id, type: 'IN_TRANSFER', ...common } });
    });
  }

  async report(businessId: string, kind = 'summary', method = 'weighted-average') {
    const rows = await this.balances(businessId);
    if (kind === 'low-stock') return rows.filter((r: any) => Number(r.quantity) <= Number(r.variant.product.minStockLevel));
    if (kind === 'expiry') return (await this.movements(businessId)).filter((m: any) => m.expiryDate && new Date(m.expiryDate) <= new Date(Date.now() + 90 * 86400000));
    if (kind === 'dead-stock') return rows.filter((r: any) => Number(r.quantity) > 0);
    if (method === 'fifo') {
      const movements = await this.movements(businessId);
      return rows.map((r: any) => {
        let remaining = Number(r.quantity);
        const inbound = movements.filter((m: any) => m.branchId === r.branchId && m.variantId === r.variantId && ['MANUAL_IN', 'IN_PURCHASE', 'IN_TRANSFER'].includes(m.type)).sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        const fifoValue = inbound.reduce((total: number, m: any) => { if (remaining <= 0) return total; const used = Math.min(remaining, Number(m.quantity)); remaining -= used; return total + used * Number(m.unitCost); }, 0);
        return { ...r, valuation: fifoValue };
      });
    }
    return rows.map((r: any) => ({ ...r, valuation: Number(r.quantity) * Number(r.averageCost), valuationMethod: 'weighted-average' }));
  }
}
