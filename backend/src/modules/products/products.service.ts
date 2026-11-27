import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { Prisma, StockMovementType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { CreateUnitDto, UpdateUnitDto } from "./dto/create-unit.dto";
import { PaginationParams } from "@nirvagam/shared";

const standardUnits = [
  {
    name: "Pieces",
    symbol: "PCS",
    decimalPlaces: 0,
    isDefault: true,
    isStandard: true,
    quantityType: "WHOLE",
    uqcCode: "PCS",
  },
  {
    name: "Numbers",
    symbol: "NOS",
    decimalPlaces: 0,
    isDefault: false,
    isStandard: true,
    quantityType: "WHOLE",
    uqcCode: "NOS",
  },
  {
    name: "Units",
    symbol: "UNT",
    decimalPlaces: 0,
    isDefault: false,
    isStandard: true,
    quantityType: "WHOLE",
    uqcCode: "UNT",
  },
  {
    name: "Pairs",
    symbol: "PRS",
    decimalPlaces: 0,
    isDefault: false,
    isStandard: true,
    quantityType: "WHOLE",
    uqcCode: "PRS",
  },
  {
    name: "Dozen",
    symbol: "DOZ",
    decimalPlaces: 0,
    isDefault: false,
    isStandard: true,
    quantityType: "WHOLE",
    uqcCode: "DOZ",
  },
  {
    name: "Sets",
    symbol: "SET",
    decimalPlaces: 0,
    isDefault: false,
    isStandard: true,
    quantityType: "WHOLE",
    uqcCode: "SET",
  },
  {
    name: "Kilograms",
    symbol: "KGS",
    decimalPlaces: 3,
    isDefault: false,
    isStandard: true,
    quantityType: "DECIMAL",
    uqcCode: "KGS",
  },
  {
    name: "Grams",
    symbol: "GMS",
    decimalPlaces: 3,
    isDefault: false,
    isStandard: true,
    quantityType: "DECIMAL",
    uqcCode: "GMS",
  },
  {
    name: "Milligrams",
    symbol: "MGS",
    decimalPlaces: 3,
    isDefault: false,
    isStandard: true,
    quantityType: "DECIMAL",
    uqcCode: "MGS",
  },
  {
    name: "Litres",
    symbol: "LTR",
    decimalPlaces: 3,
    isDefault: false,
    isStandard: true,
    quantityType: "DECIMAL",
    uqcCode: "LTR",
  },
  {
    name: "Millilitres",
    symbol: "MLT",
    decimalPlaces: 3,
    isDefault: false,
    isStandard: true,
    quantityType: "DECIMAL",
    uqcCode: "MLT",
  },
  {
    name: "Metres",
    symbol: "MTR",
    decimalPlaces: 3,
    isDefault: false,
    isStandard: true,
    quantityType: "DECIMAL",
    uqcCode: "MTR",
  },
  {
    name: "Centimetres",
    symbol: "CMS",
    decimalPlaces: 3,
    isDefault: false,
    isStandard: true,
    quantityType: "DECIMAL",
    uqcCode: "CMS",
  },
  {
    name: "Feet",
    symbol: "FT",
    decimalPlaces: 3,
    isDefault: false,
    isStandard: true,
    quantityType: "DECIMAL",
    uqcCode: "FT",
  },
  {
    name: "Square metres",
    symbol: "SQM",
    decimalPlaces: 3,
    isDefault: false,
    isStandard: true,
    quantityType: "DECIMAL",
    uqcCode: "SQM",
  },
  {
    name: "Square feet",
    symbol: "SQF",
    decimalPlaces: 3,
    isDefault: false,
    isStandard: true,
    quantityType: "DECIMAL",
    uqcCode: "SQF",
  },
  {
    name: "Boxes",
    symbol: "BOX",
    decimalPlaces: 0,
    isDefault: false,
    isStandard: true,
    quantityType: "WHOLE",
    uqcCode: "BOX",
  },
  {
    name: "Packs",
    symbol: "PAC",
    decimalPlaces: 0,
    isDefault: false,
    isStandard: true,
    quantityType: "WHOLE",
    uqcCode: "PAC",
  },
  {
    name: "Cartons",
    symbol: "CTN",
    decimalPlaces: 0,
    isDefault: false,
    isStandard: true,
    quantityType: "WHOLE",
    uqcCode: "CTN",
  },
  {
    name: "Bags",
    symbol: "BAG",
    decimalPlaces: 0,
    isDefault: false,
    isStandard: true,
    quantityType: "WHOLE",
    uqcCode: "BAG",
  },
  {
    name: "Bottles",
    symbol: "BTL",
    decimalPlaces: 0,
    isDefault: false,
    isStandard: true,
    quantityType: "WHOLE",
    uqcCode: "BTL",
  },
  {
    name: "Rolls",
    symbol: "ROL",
    decimalPlaces: 0,
    isDefault: false,
    isStandard: true,
    quantityType: "WHOLE",
    uqcCode: "ROL",
  },
  {
    name: "Bundles",
    symbol: "BDL",
    decimalPlaces: 0,
    isDefault: false,
    isStandard: true,
    quantityType: "WHOLE",
    uqcCode: "BDL",
  },
  {
    name: "Tablets",
    symbol: "TBZ",
    decimalPlaces: 0,
    isDefault: false,
    isStandard: true,
    quantityType: "WHOLE",
    uqcCode: "TBZ",
  },
];
const quickSelectUnitSymbols = new Set([
  "BDL",
  "DOZ",
  "MTR",
  "LTR",
  "PCS",
  "UNT",
]);

@Injectable()
export class ProductsService {
  private readonly metadataInitialization = new Map<string, Promise<void>>();

  constructor(private prisma: PrismaService) {}

  private getPagination(params: PaginationParams = {}) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 50));
    return { page, limit, skip: (page - 1) * limit };
  }

  private paginationMeta(total: number, page: number, limit: number) {
    const totalPages = Math.max(1, Math.ceil(total / limit));
    return {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
  }

  async findAll(businessId: string, params: PaginationParams) {
    const { page, limit, skip } = this.getPagination(params);

    const where: any = {
      businessId,
      isActive: true,
      ...(params.search && {
        OR: [
          { name: { contains: params.search, mode: "insensitive" } },
          { sku: { contains: params.search, mode: "insensitive" } },
          { barcode: { contains: params.search, mode: "insensitive" } },
          { hsnCode: { contains: params.search, mode: "insensitive" } },
          {
            variants: {
              some: { sku: { contains: params.search, mode: "insensitive" } },
            },
          },
          {
            variants: {
              some: {
                barcode: { contains: params.search, mode: "insensitive" },
              },
            },
          },
          {
            variants: {
              some: {
                attributeSearch: {
                  contains: params.search,
                  mode: "insensitive",
                },
              },
            },
          },
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
              stockBalances: { include: { branch: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const formatted = products.map((p) => {
      let totalStock = 0;
      const variants = p.variants.map((v) => {
        let variantStock = 0;
        v.stockBalances.forEach((sb) => {
          variantStock += Number(sb.quantity || 0);
        });
        totalStock += variantStock;
        const minimum = Number(v.minStockLevel ?? p.minStockLevel ?? 0);
        return {
          ...v,
          totalStock: variantStock,
          isLowStock: v.isActive && minimum > 0 && variantStock <= minimum,
          isOutOfStock: variantStock <= 0,
          stockBalances: v.stockBalances,
        };
      });

      return {
        ...p,
        variants,
        totalStock,
        isLowStock: p.hasVariants
          ? variants.some((variant) => variant.isActive && variant.isLowStock)
          : totalStock > 0 && totalStock <= Number(p.minStockLevel || 0),
      };
    });

    return {
      data: formatted,
      meta: this.paginationMeta(total, page, limit),
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
      unitId =
        defaultUnit?.id ||
        (await this.prisma.unit.findFirst({ where: { businessId } }))?.id;
    }

    let taxRateId = dto.taxRateId;
    if (!taxRateId) {
      const defaultTax = await this.prisma.taxRate.findFirst({
        where: { businessId, isDefault: true },
      });
      taxRateId =
        defaultTax?.id ||
        (await this.prisma.taxRate.findFirst({ where: { businessId } }))?.id;
    }

    if (!unitId || !taxRateId) {
      throw new NotFoundException(
        "Units or Tax Rates not configured for this business",
      );
    }
    const [unit, taxRate] = await Promise.all([
      this.prisma.unit.findFirst({ where: { id: unitId, businessId } }),
      this.prisma.taxRate.findFirst({ where: { id: taxRateId, businessId } }),
    ]);
    if (!unit || !taxRate)
      throw new BadRequestException(
        "Selected unit or GST rate does not belong to this business",
      );

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
          isActive: dto.isActive ?? true,
          isTaxInclusive: dto.isTaxInclusive || false,
          hasVariants: dto.hasVariants ?? false,
        },
      });

      if (product.hasVariants) {
        await this.saveVariants(tx, businessId, product, dto.variants || []);
      } else {
        await tx.productVariant.create({
          data: {
            productId: product.id,
            name: "Standard",
            sku: dto.sku.trim(),
            barcode: dto.barcode,
            purchasePrice,
            mrp,
            retailPrice,
            minStockLevel: dto.minStockLevel || 0,
          },
        });
      }

      return product;
    });
  }

  async getUnits(businessId: string, activeOnly = false) {
    await this.ensureInventoryMetadata(businessId);
    return this.prisma.unit.findMany({
      where: { businessId, ...(activeOnly ? { isActive: true } : {}) },
      orderBy: [{ isSystem: "desc" }, { symbol: "asc" }],
    });
  }

  async createUnit(businessId: string, dto: CreateUnitDto) {
    const name = dto.name.trim();
    const symbol = dto.symbol.trim().toUpperCase();
    const duplicate = await this.prisma.unit.findFirst({
      where: {
        businessId,
        OR: [{ symbol }, { name: { equals: name, mode: "insensitive" } }],
      },
    });
    if (duplicate)
      throw new ConflictException(
        "A unit with this name or code already exists",
      );
    const quantityType = dto.quantityType || "WHOLE";
    return this.prisma.unit.create({
      data: {
        businessId,
        name,
        symbol,
        isStandard: false,
        isQuickSelect: false,
        decimalPlaces: quantityType === "DECIMAL" ? 3 : 0,
        quantityType,
        uqcCode: dto.uqcCode?.trim().toUpperCase() || null,
      },
    });
  }

  async updateUnit(businessId: string, id: string, dto: UpdateUnitDto) {
    const unit = await this.prisma.unit.findFirst({
      where: { id, businessId },
    });
    if (!unit) throw new NotFoundException("Unit not found");

    const name = dto.name?.trim();
    const symbol = dto.symbol?.trim().toUpperCase();
    if (dto.name !== undefined && !name)
      throw new BadRequestException("Unit name cannot be empty");
    if (dto.symbol !== undefined && !symbol)
      throw new BadRequestException("Unit code cannot be empty");

    if (name || symbol) {
      const duplicate = await this.prisma.unit.findFirst({
        where: {
          businessId,
          id: { not: id },
          OR: [
            ...(symbol ? [{ symbol }] : []),
            ...(name
              ? [{ name: { equals: name, mode: "insensitive" as const } }]
              : []),
          ],
        },
      });
      if (duplicate)
        throw new ConflictException(
          "A unit with this name or code already exists",
        );
    }

    const data: Prisma.UnitUpdateInput = {};
    if (name) data.name = name;
    if (symbol) data.symbol = symbol;
    if (dto.quantityType) {
      data.quantityType = dto.quantityType;
      data.decimalPlaces = dto.quantityType === "DECIMAL" ? 3 : 0;
    }
    if (dto.uqcCode !== undefined)
      data.uqcCode = dto.uqcCode.trim().toUpperCase() || null;

    return this.prisma.unit.update({ where: { id }, data });
  }

  async deleteUnit(businessId: string, id: string) {
    const unit = await this.prisma.unit.findFirst({
      where: { id, businessId },
    });
    if (!unit) throw new NotFoundException("Unit not found");
    if (unit.isStandard)
      throw new BadRequestException("Standard units cannot be deleted");
    const productCount = await this.prisma.product.count({
      where: { businessId, unitId: id },
    });
    if (productCount > 0)
      throw new ConflictException(
        "This unit is assigned to existing products and cannot be deleted",
      );
    return this.prisma.unit.delete({ where: { id } });
  }

  async branches(businessId: string) {
    return this.prisma.branch.findMany({
      where: { businessId, isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    });
  }

  async inventoryVariants(businessId: string) {
    const variants = await this.prisma.productVariant.findMany({
      where: { isActive: true, product: { businessId, isActive: true } },
      include: {
        product: {
          select: {
            name: true,
            hasVariants: true,
            unit: { select: { symbol: true, quantityType: true } },
          },
        },
      },
      orderBy: [{ product: { name: "asc" } }, { sku: "asc" }],
    });
    return variants.map((variant) => ({
      ...variant,
      productName: variant.product.name,
      productHasVariants: variant.product.hasVariants,
      unit: variant.product.unit,
    }));
  }

  async getTaxRates(businessId: string) {
    await this.ensureInventoryMetadata(businessId);
    return this.prisma.taxRate.findMany({
      where: { businessId, isActive: true },
      orderBy: { rate: "asc" },
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
    await this.prisma.unit.createMany({
      data: standardUnits.map((unit) => ({
        businessId,
        ...unit,
        isStandard: quickSelectUnitSymbols.has(unit.symbol),
        isQuickSelect: quickSelectUnitSymbols.has(unit.symbol),
      })),
      skipDuplicates: true,
    });
    const taxCount = await this.prisma.taxRate.count({ where: { businessId } });
    if (taxCount === 0) {
      await this.prisma.taxRate.createMany({
        data: [0, 5, 12, 18, 28].map((rate) => ({
          businessId,
          name: rate === 0 ? "GST 0% (Nil)" : `GST ${rate}%`,
          rate,
          cgstRate: rate / 2,
          sgstRate: rate / 2,
          igstRate: rate,
          isDefault: rate === 18,
          isActive: true,
        })),
      });
    }
  }

  async updateProduct(
    businessId: string,
    id: string,
    dto: Partial<CreateProductDto>,
  ) {
    const product = await this.prisma.product.findFirst({
      where: { id, businessId },
      include: { variants: { include: { stockBalances: true } } },
    });
    if (!product) throw new NotFoundException("Product not found");
    const sku = dto.sku?.trim();
    if (dto.sku !== undefined && !sku)
      throw new BadRequestException("SKU is required");
    if (sku && sku !== product.sku) {
      const duplicate = await this.prisma.product.findFirst({
        where: { businessId, sku, NOT: { id } },
      });
      if (duplicate) throw new ConflictException(`SKU "${sku}" already exists`);
    }
    const hasVariants = dto.hasVariants ?? product.hasVariants;
    if (dto.unitId) {
      const unit = await this.prisma.unit.findFirst({
        where: { id: dto.unitId, businessId },
      });
      if (!unit)
        throw new BadRequestException(
          "Selected unit does not belong to this business",
        );
    }
    if (dto.taxRateId) {
      const taxRate = await this.prisma.taxRate.findFirst({
        where: { id: dto.taxRateId, businessId },
      });
      if (!taxRate)
        throw new BadRequestException(
          "Selected GST rate does not belong to this business",
        );
    }
    if (product.hasVariants && !hasVariants) {
      throw new BadRequestException(
        "Variant-enabled products cannot be converted back to a single variant",
      );
    }
    if (!product.hasVariants && hasVariants && dto.variants === undefined) {
      throw new BadRequestException(
        "Define product variants when enabling variant tracking",
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const updatedProduct = await tx.product.update({
        where: { id },
        data: {
          name: dto.name,
          sku,
          barcode: dto.barcode,
          hsnCode: dto.hsnCode,
          description: dto.description,
          unitId: dto.unitId,
          taxRateId: dto.taxRateId,
          purchasePrice: dto.purchasePrice,
          mrp: dto.mrp,
          wholesalePrice: dto.wholesalePrice,
          retailPrice: dto.retailPrice,
          minStockLevel: dto.minStockLevel,
          imageUrl: dto.imageUrl,
          isTaxInclusive: dto.isTaxInclusive,
          isActive: dto.isActive,
          hasVariants,
        },
      });
      if (hasVariants && dto.variants !== undefined) {
        const savedVariants = await this.saveVariants(
          tx,
          businessId,
          product,
          dto.variants,
          !product.hasVariants,
        );
        if (!product.hasVariants) {
          await this.allocateLegacyStock(
            tx,
            businessId,
            product,
            savedVariants,
            dto.stockAllocations || [],
          );
        }
      } else if (!hasVariants) {
        const variantData = {
          sku,
          barcode: dto.barcode,
          purchasePrice: dto.purchasePrice,
          mrp: dto.mrp,
          retailPrice: dto.retailPrice,
          minStockLevel: dto.minStockLevel,
        };
        if (Object.values(variantData).some((value) => value !== undefined)) {
          await tx.productVariant.updateMany({
            where: { productId: id, name: "Standard" },
            data: variantData,
          });
        }
      }
      return updatedProduct;
    });
  }

  private normalizeVariantAttributes(attributes: Record<string, string>) {
    if (
      !attributes ||
      typeof attributes !== "object" ||
      Array.isArray(attributes)
    ) {
      throw new BadRequestException(
        "Each variant must include attribute names and values",
      );
    }
    if (Object.values(attributes).some((value) => typeof value !== "string")) {
      throw new BadRequestException("Variant attribute values must be text");
    }
    const entries = Object.entries(attributes)
      .map(([key, value]) => [key.trim(), value.trim()] as const)
      .filter(([key, value]) => key && value)
      .sort(([a], [b]) =>
        a.localeCompare(b, undefined, { sensitivity: "base" }),
      );
    if (
      !entries.length ||
      entries.some(
        ([key], index) =>
          entries.findIndex(
            ([other]) => other.toLowerCase() === key.toLowerCase(),
          ) !== index,
      )
    ) {
      throw new BadRequestException(
        "Each variant must have at least one unique, non-empty attribute",
      );
    }
    const normalized = Object.fromEntries(entries);
    const combinationKey = entries
      .map(
        ([key, value]) =>
          `${encodeURIComponent(key.toLowerCase())}=${encodeURIComponent(value.toLowerCase())}`,
      )
      .join("&");
    return {
      attributes: normalized,
      combinationKey,
      attributeSearch: entries
        .map(([key, value]) => `${key}: ${value}`)
        .join(" "),
      name: entries.map(([, value]) => value).join(" / "),
    };
  }

  private async saveVariants(
    tx: Prisma.TransactionClient,
    businessId: string,
    product: {
      id: string;
      sku: string;
      purchasePrice: Prisma.Decimal | number;
      mrp: Prisma.Decimal | number;
      retailPrice: Prisma.Decimal | number;
      minStockLevel: Prisma.Decimal | number;
    },
    inputs: NonNullable<CreateProductDto["variants"]>,
    preserveLegacyStandard = false,
  ) {
    if (!inputs.length)
      throw new BadRequestException("Add at least one variant");
    if (inputs.every((variant) => variant.isActive === false)) {
      throw new BadRequestException(
        "At least one product variant must be active",
      );
    }
    const keys = new Set<string>();
    const skus = new Set<string>();
    const saved: Array<{ id: string; sku: string }> = [];
    for (const input of inputs) {
      const parsed = this.normalizeVariantAttributes(input.attributes);
      if (keys.has(parsed.combinationKey)) {
        throw new ConflictException(
          "Variant attribute combinations must be unique",
        );
      }
      keys.add(parsed.combinationKey);
      const generatedSku =
        `${product.sku}-${Object.values(parsed.attributes).join("-")}`
          .normalize("NFKD")
          .replace(/[^a-zA-Z0-9-]+/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "")
          .toUpperCase();
      const sku = (input.sku?.trim() || generatedSku).toUpperCase();
      if (skus.has(sku))
        throw new ConflictException(
          `SKU "${sku}" is duplicated in this product`,
        );
      skus.add(sku);

      const sameProductSku = await tx.product.findFirst({
        where: {
          businessId,
          sku: { equals: sku, mode: "insensitive" },
          NOT: { id: product.id },
        },
      });
      if (sameProductSku)
        throw new ConflictException(
          `SKU "${sku}" already belongs to another product`,
        );
      const sameSku = await tx.productVariant.findFirst({
        where: {
          sku: { equals: sku, mode: "insensitive" },
          ...(input.id ? { NOT: { id: input.id } } : {}),
        },
      });
      if (sameSku) throw new ConflictException(`SKU "${sku}" already exists`);
      if (input.barcode?.trim()) {
        const sameBarcode = await tx.productVariant.findFirst({
          where: {
            barcode: input.barcode.trim(),
            ...(input.id ? { NOT: { id: input.id } } : {}),
          },
        });
        if (sameBarcode)
          throw new ConflictException(
            `Barcode "${input.barcode.trim()}" already exists`,
          );
      }

      let existing = input.id
        ? await tx.productVariant.findFirst({
            where: { id: input.id, productId: product.id },
          })
        : await tx.productVariant.findFirst({
            where: {
              productId: product.id,
              combinationKey: parsed.combinationKey,
            },
          });
      if (input.id && !existing)
        throw new NotFoundException("Variant not found for this product");
      const data = {
        name: parsed.name,
        sku,
        barcode: input.barcode?.trim() || null,
        attributes: parsed.attributes,
        attributeSearch: parsed.attributeSearch,
        combinationKey: parsed.combinationKey,
        purchasePrice: input.purchasePrice ?? product.purchasePrice,
        mrp: input.mrp ?? product.mrp,
        retailPrice: input.retailPrice ?? product.retailPrice,
        minStockLevel: input.minStockLevel ?? product.minStockLevel,
        imageUrl: input.imageUrl || null,
        isActive: input.isActive ?? true,
      };
      const variant = existing
        ? await tx.productVariant.update({ where: { id: existing.id }, data })
        : await tx.productVariant.create({
            data: { productId: product.id, ...data },
          });
      saved.push({ id: variant.id, sku: variant.sku });
    }

    const savedIds = saved.map((variant) => variant.id);
    const previous = await tx.productVariant.findMany({
      where: {
        productId: product.id,
        ...(savedIds.length ? { id: { notIn: savedIds } } : {}),
      },
      select: { id: true, name: true },
    });
    for (const variant of previous) {
      const [balances, movementCount] = await Promise.all([
        tx.stockBalance.findMany({
          where: { variantId: variant.id },
          select: { quantity: true },
        }),
        tx.stockMovement.count({ where: { variantId: variant.id } }),
      ]);
      if (preserveLegacyStandard && variant.name === "Standard") {
        await tx.productVariant.update({
          where: { id: variant.id },
          data: { isActive: false },
        });
      } else if (
        movementCount ||
        balances.some((balance) => Number(balance.quantity) > 0)
      ) {
        throw new ConflictException(
          "Variants with stock or transaction history cannot be removed",
        );
      } else {
        await tx.productVariant.delete({ where: { id: variant.id } });
      }
    }
    return saved;
  }

  private async allocateLegacyStock(
    tx: Prisma.TransactionClient,
    businessId: string,
    product: {
      id: string;
      variants: Array<{
        id: string;
        name: string;
        stockBalances: Array<{
          branchId: string;
          quantity: Prisma.Decimal;
          averageCost: Prisma.Decimal;
        }>;
      }>;
    },
    variants: Array<{ id: string; sku: string }>,
    allocations: NonNullable<CreateProductDto["stockAllocations"]>,
  ) {
    const legacy = product.variants.find(
      (variant) => variant.name === "Standard",
    );
    if (!legacy) return;
    const sourceBalances = legacy.stockBalances.filter(
      (balance) => Number(balance.quantity) > 0,
    );
    if (!sourceBalances.length) return;
    if (!allocations.length) {
      throw new BadRequestException(
        "Allocate the existing stock to variants before enabling variants",
      );
    }
    const variantsBySku = new Map(
      variants.map((variant) => [variant.sku, variant]),
    );
    for (const balance of sourceBalances) {
      const branchAllocations = allocations.filter(
        (allocation) => allocation.branchId === balance.branchId,
      );
      const total = branchAllocations.reduce(
        (sum, allocation) => sum + Number(allocation.quantity),
        0,
      );
      if (Math.abs(total - Number(balance.quantity)) > 0.0001) {
        throw new BadRequestException(
          `Variant allocations for branch ${balance.branchId} must equal the existing stock`,
        );
      }
      for (const allocation of branchAllocations) {
        const variant = variantsBySku.get(allocation.sku);
        const quantity = Number(allocation.quantity);
        if (!variant || !Number.isFinite(quantity) || quantity <= 0) {
          throw new BadRequestException(
            "Every stock allocation must target a valid variant with a positive quantity",
          );
        }
        const branch = await tx.branch.findFirst({
          where: { id: balance.branchId, businessId },
        });
        if (!branch)
          throw new NotFoundException(
            "Stock allocation branch not found for this business",
          );
        await tx.stockBalance.upsert({
          where: {
            branchId_variantId: { branchId: branch.id, variantId: variant.id },
          },
          create: {
            branchId: branch.id,
            variantId: variant.id,
            quantity,
            averageCost: balance.averageCost,
          },
          update: { quantity: { increment: quantity } },
        });
        const movement = {
          branchId: branch.id,
          quantity,
          unitCost: balance.averageCost,
          totalCost: quantity * Number(balance.averageCost),
          reason: "Existing stock allocated during variant conversion",
        };
        await tx.stockMovement.create({
          data: {
            ...movement,
            variantId: legacy.id,
            type: StockMovementType.MANUAL_OUT,
          },
        });
        await tx.stockMovement.create({
          data: {
            ...movement,
            variantId: variant.id,
            type: StockMovementType.MANUAL_IN,
          },
        });
      }
      await tx.stockBalance.updateMany({
        where: { branchId: balance.branchId, variantId: legacy.id },
        data: { quantity: 0 },
      });
    }
    if (
      allocations.some(
        (allocation) =>
          !sourceBalances.some(
            (balance) => balance.branchId === allocation.branchId,
          ),
      )
    ) {
      throw new BadRequestException(
        "Stock allocation contains a branch without existing stock",
      );
    }
  }

  async removeProduct(businessId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, businessId },
    });
    if (!product) throw new NotFoundException("Product not found");
    return this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async overview(businessId: string) {
    const products = await this.prisma.product.findMany({
      where: { businessId },
      include: { unit: true, variants: { include: { stockBalances: true } } },
    });
    const rows = products.map((p) => {
      const stock = p.variants.reduce(
        (n, v) =>
          n + v.stockBalances.reduce((s, b) => s + Number(b.quantity), 0),
        0,
      );
      const valuation = p.variants.reduce(
        (n, v) =>
          n +
          v.stockBalances.reduce(
            (s, b) => s + Number(b.quantity) * Number(b.averageCost),
            0,
          ),
        0,
      );
      const isLowStock = p.hasVariants
        ? p.variants.some((variant) => {
            const variantStock = variant.stockBalances.reduce(
              (sum, balance) => sum + Number(balance.quantity),
              0,
            );
            const minimum = Number(variant.minStockLevel ?? p.minStockLevel);
            return variant.isActive && minimum > 0 && variantStock <= minimum;
          })
        : stock > 0 && stock <= Number(p.minStockLevel);
      return {
        ...p,
        totalStock: stock,
        valuation,
        isLowStock,
        isOutOfStock: stock <= 0,
      };
    });
    const recentMovements = await this.prisma.stockMovement.findMany({
      where: { branch: { businessId } },
      include: { variant: { include: { product: true } }, branch: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    });
    return {
      totalProducts: products.length,
      inventoryValuation: rows.reduce((n, p) => n + p.valuation, 0),
      lowStockProducts: rows.filter((p) => p.isLowStock).length,
      outOfStockProducts: rows.filter((p) => p.isOutOfStock).length,
      recentMovements,
    };
  }

  async balancesPage(businessId: string, params: PaginationParams) {
    const { page, limit, skip } = this.getPagination(params);
    const where: Prisma.StockBalanceWhereInput = {
      branch: { businessId },
      ...(params.search
        ? {
            variant: {
              product: {
                name: { contains: params.search, mode: "insensitive" },
              },
            },
          }
        : {}),
    };
    const [total, data] = await Promise.all([
      this.prisma.stockBalance.count({ where }),
      this.prisma.stockBalance.findMany({
        where,
        skip,
        take: limit,
        include: {
          branch: true,
          variant: {
            include: { product: { include: { unit: true } } },
          },
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      }),
    ]);
    return { data, meta: this.paginationMeta(total, page, limit) };
  }

  async movementsPage(
    businessId: string,
    params: PaginationParams,
    transfersOnly = false,
  ) {
    const { page, limit, skip } = this.getPagination(params);
    const where: Prisma.StockMovementWhereInput = {
      branch: { businessId },
      ...(params.search
        ? {
            variant: {
              product: {
                name: { contains: params.search, mode: "insensitive" },
              },
            },
          }
        : {}),
      ...(transfersOnly
        ? {
            type: {
              in: [
                StockMovementType.IN_TRANSFER,
                StockMovementType.OUT_TRANSFER,
              ],
            },
          }
        : {}),
    };
    const [total, data] = await Promise.all([
      this.prisma.stockMovement.count({ where }),
      this.prisma.stockMovement.findMany({
        where,
        skip,
        take: limit,
        include: { branch: true, variant: { include: { product: true } } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
    ]);
    return { data, meta: this.paginationMeta(total, page, limit) };
  }

  async balances(businessId: string, search?: string) {
    return this.prisma.stockBalance.findMany({
      where: {
        branch: { businessId },
        ...(search
          ? {
              variant: {
                product: { name: { contains: search, mode: "insensitive" } },
              },
            }
          : {}),
      },
      include: {
        branch: true,
        variant: {
          include: { product: { include: { unit: true } } },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  async movements(businessId: string, search?: string) {
    return this.prisma.stockMovement.findMany({
      where: {
        branch: { businessId },
        ...(search
          ? {
              variant: {
                product: { name: { contains: search, mode: "insensitive" } },
              },
            }
          : {}),
      },
      include: { branch: true, variant: { include: { product: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  async stockOperation(businessId: string, userId: string, dto: any) {
    const quantity = Number(dto.quantity);
    if (
      !dto.variantId ||
      !dto.branchId ||
      !Number.isFinite(quantity) ||
      quantity <= 0
    )
      throw new BadRequestException(
        "Variant, branch and a positive quantity are required",
      );
    if (!["IN", "OUT"].includes(dto.type))
      throw new BadRequestException("Unsupported stock operation");
    return this.prisma.$transaction(async (tx) => {
      const branch = await tx.branch.findFirst({
        where: { id: dto.branchId, businessId, isActive: true },
      });
      if (!branch)
        throw new NotFoundException("Branch not found for this business");
      const variant = await tx.productVariant.findFirst({
        where: { id: dto.variantId, isActive: true, product: { businessId } },
        include: {
          product: {
            select: {
              hasVariants: true,
              unit: { select: { quantityType: true } },
            },
          },
        },
      });
      if (!variant)
        throw new NotFoundException(
          "Product variant not found for this business",
        );
      if (variant.product.hasVariants && !variant.combinationKey) {
        throw new BadRequestException(
          "Select a product variant before recording stock",
        );
      }
      const current = await tx.stockBalance.findUnique({
        where: {
          branchId_variantId: { branchId: branch.id, variantId: dto.variantId },
        },
      });
      const isOut = dto.type === "OUT";
      if (
        variant.product.unit.quantityType === "WHOLE" &&
        !Number.isInteger(quantity)
      ) {
        throw new BadRequestException(
          "The selected unit only allows whole-number quantities",
        );
      }
      const currentQty = Number(current?.quantity || 0);
      if (isOut && currentQty < quantity)
        throw new BadRequestException(
          "Insufficient stock. Negative stock is not allowed",
        );
      const nextQty = currentQty + (isOut ? -quantity : quantity);
      const cost = Number(dto.unitCost ?? variant.purchasePrice);
      const averageCost =
        nextQty > 0 && !isOut
          ? (currentQty * Number(current?.averageCost || cost) +
              quantity * cost) /
            nextQty
          : Number(current?.averageCost || cost);
      if (isOut) {
        const updated = await tx.stockBalance.updateMany({
          where: {
            branchId: branch.id,
            variantId: dto.variantId,
            quantity: { gte: quantity },
          },
          data: { quantity: { decrement: quantity } },
        });
        if (!updated.count)
          throw new BadRequestException(
            "Insufficient stock. Negative stock is not allowed",
          );
      } else {
        await tx.stockBalance.upsert({
          where: {
            branchId_variantId: {
              branchId: branch.id,
              variantId: dto.variantId,
            },
          },
          create: {
            branchId: branch.id,
            variantId: dto.variantId,
            quantity: nextQty,
            averageCost,
          },
          update: { quantity: { increment: quantity }, averageCost },
        });
      }
      const movementType = isOut ? "MANUAL_OUT" : "MANUAL_IN";
      return tx.stockMovement.create({
        data: {
          branchId: branch.id,
          variantId: dto.variantId,
          type: movementType,
          quantity,
          unitCost: cost,
          totalCost: quantity * cost,
          notes: dto.reference || dto.notes,
          reason: dto.reason,
          performedById: userId,
        },
      });
    });
  }

  async transfer(businessId: string, userId: string, dto: any) {
    if (dto.fromBranchId === dto.toBranchId)
      throw new BadRequestException(
        "Source and destination branches must differ",
      );
    return this.prisma.$transaction(async (tx) => {
      const from = await tx.branch.findFirst({
        where: { id: dto.fromBranchId, businessId, isActive: true },
      });
      const to = await tx.branch.findFirst({
        where: { id: dto.toBranchId, businessId, isActive: true },
      });
      if (!from || !to)
        throw new NotFoundException(
          "Transfer branch not found for this business",
        );
      const variant = await tx.productVariant.findFirst({
        where: { id: dto.variantId, isActive: true, product: { businessId } },
        include: {
          product: {
            select: {
              hasVariants: true,
              unit: { select: { quantityType: true } },
            },
          },
        },
      });
      if (!variant)
        throw new NotFoundException(
          "Product variant not found for this business",
        );
      if (variant.product.hasVariants && !variant.combinationKey) {
        throw new BadRequestException(
          "Select a product variant before transferring stock",
        );
      }
      const qty = Number(dto.quantity);
      if (!Number.isFinite(qty) || qty <= 0)
        throw new BadRequestException("Transfer quantity must be positive");
      if (
        variant.product.unit.quantityType === "WHOLE" &&
        !Number.isInteger(qty)
      ) {
        throw new BadRequestException(
          "The selected unit only allows whole-number quantities",
        );
      }
      const balance = await tx.stockBalance.findUnique({
        where: {
          branchId_variantId: { branchId: from.id, variantId: dto.variantId },
        },
      });
      if (!balance || Number(balance.quantity) < qty)
        throw new BadRequestException("Insufficient stock for transfer");
      const balanceUpdated = await tx.stockBalance.updateMany({
        where: { id: balance.id, quantity: { gte: qty } },
        data: { quantity: { decrement: qty } },
      });
      if (!balanceUpdated.count)
        throw new BadRequestException("Insufficient stock for transfer");
      await tx.stockBalance.upsert({
        where: {
          branchId_variantId: { branchId: to.id, variantId: dto.variantId },
        },
        create: {
          branchId: to.id,
          variantId: dto.variantId,
          quantity: qty,
          averageCost: balance.averageCost,
        },
        update: {
          quantity: { increment: qty },
          averageCost: balance.averageCost,
        },
      });
      const common = {
        variantId: dto.variantId,
        quantity: qty,
        unitCost: balance.averageCost,
        totalCost: qty * Number(balance.averageCost),
        notes: dto.reason || "Branch stock transfer",
        referenceId: undefined,
        performedById: userId,
      };
      await tx.stockMovement.create({
        data: { branchId: from.id, type: "OUT_TRANSFER", ...common },
      });
      return tx.stockMovement.create({
        data: { branchId: to.id, type: "IN_TRANSFER", ...common },
      });
    });
  }

  async report(
    businessId: string,
    kind = "summary",
    method = "weighted-average",
  ) {
    if (!["summary", "low-stock", "dead-stock"].includes(kind)) {
      throw new BadRequestException("Unsupported inventory report");
    }
    const rows = await this.balances(businessId);
    if (kind === "low-stock") {
      const totals = new Map<string, { first: any; quantity: number }>();
      for (const row of rows as any[]) {
        const entry = totals.get(row.variantId) || { first: row, quantity: 0 };
        entry.quantity += Number(row.quantity);
        totals.set(row.variantId, entry);
      }
      return [...totals.values()]
        .filter(({ first, quantity }) => {
          const minimum = Number(
            first.variant.minStockLevel ?? first.variant.product.minStockLevel,
          );
          return first.variant.isActive && minimum > 0 && quantity <= minimum;
        })
        .map(({ first, quantity }) => ({
          variant: first.variant,
          totalStock: quantity,
          minimumStock: Number(
            first.variant.minStockLevel ?? first.variant.product.minStockLevel,
          ),
        }));
    }
    if (kind === "dead-stock")
      return rows.filter((r: any) => Number(r.quantity) > 0);
    if (method === "fifo") {
      const movements = await this.movements(businessId);
      return rows.map((r: any) => {
        let remaining = Number(r.quantity);
        const inbound = movements
          .filter(
            (m: any) =>
              m.branchId === r.branchId &&
              m.variantId === r.variantId &&
              ["MANUAL_IN", "IN_PURCHASE", "IN_TRANSFER"].includes(m.type),
          )
          .sort(
            (a: any, b: any) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          );
        const fifoValue = inbound.reduce((total: number, m: any) => {
          if (remaining <= 0) return total;
          const used = Math.min(remaining, Number(m.quantity));
          remaining -= used;
          return total + used * Number(m.unitCost);
        }, 0);
        return { ...r, valuation: fifoValue };
      });
    }
    return rows.map((r: any) => ({
      ...r,
      valuation: Number(r.quantity) * Number(r.averageCost),
      valuationMethod: "weighted-average",
    }));
  }
}
