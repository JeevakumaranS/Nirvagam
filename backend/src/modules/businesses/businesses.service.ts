import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { CreateBranchDto } from './dto/create-branch.dto';

@Injectable()
export class BusinessesService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.business.findMany({
      where: { tenantId, isActive: true },
      include: {
        branches: { where: { isActive: true } },
        gstRegistrations: true,
        _count: {
          select: {
            products: true,
            customers: true,
            suppliers: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, businessId: string) {
    const business = await this.prisma.business.findFirst({
      where: { id: businessId, tenantId },
      include: {
        branches: { where: { isActive: true } },
        gstRegistrations: true,
        fiscalPeriods: true,
        documentSequences: true,
      },
    });

    if (!business) {
      throw new NotFoundException('Business entity not found');
    }

    return business;
  }

  async create(tenantId: string, dto: CreateBusinessDto) {
    return this.prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: {
          tenantId,
          legalName: dto.legalName,
          tradeName: dto.tradeName,
          businessType: dto.businessType as any || 'PROPRIETORSHIP',
          industry: dto.industry as any || 'RETAIL',
          pan: dto.pan,
          email: dto.email,
          phone: dto.phone,
          addressLine1: dto.addressLine1,
          addressLine2: dto.addressLine2,
          city: dto.city,
          state: dto.state,
          stateCode: dto.stateCode,
          pincode: dto.pincode,
          country: 'India',
        },
      });

      // Automatically create default Head Office Branch
      const branch = await tx.branch.create({
        data: {
          businessId: business.id,
          name: 'Head Office',
          code: 'HQ',
          isHeadOffice: true,
          addressLine1: dto.addressLine1,
          city: dto.city,
          state: dto.state,
          stateCode: dto.stateCode,
          pincode: dto.pincode,
        },
      });

      // Default warehouse
      await tx.warehouse.create({
        data: {
          branchId: branch.id,
          name: 'HQ Central Warehouse',
          code: 'WH-HQ',
          isDefault: true,
        },
      });

      return business;
    });
  }

  async update(tenantId: string, businessId: string, dto: UpdateBusinessDto) {
    const exists = await this.prisma.business.findFirst({
      where: { id: businessId, tenantId },
    });
    if (!exists) {
      throw new NotFoundException('Business entity not found');
    }

    return this.prisma.business.update({
      where: { id: businessId },
      data: dto as any,
    });
  }

  async findBranches(tenantId: string, businessId: string) {
    await this.findOne(tenantId, businessId);
    return this.prisma.branch.findMany({
      where: { businessId, isActive: true },
      include: {
        warehouses: true,
        _count: {
          select: {
            salesInvoices: true,
            purchaseInvoices: true,
          },
        },
      },
      orderBy: { isHeadOffice: 'desc' },
    });
  }

  async createBranch(tenantId: string, businessId: string, dto: CreateBranchDto) {
    await this.findOne(tenantId, businessId);

    const existingCode = await this.prisma.branch.findUnique({
      where: {
        businessId_code: {
          businessId,
          code: dto.code.toUpperCase().trim(),
        },
      },
    });

    if (existingCode) {
      throw new ConflictException(`Branch code "${dto.code}" already exists in this business`);
    }

    return this.prisma.$transaction(async (tx) => {
      const branch = await tx.branch.create({
        data: {
          businessId,
          name: dto.name,
          code: dto.code.toUpperCase().trim(),
          isHeadOffice: dto.isHeadOffice || false,
          gstin: dto.gstin,
          phone: dto.phone,
          addressLine1: dto.addressLine1,
          city: dto.city,
          state: dto.state,
          stateCode: dto.stateCode,
          pincode: dto.pincode,
        },
      });

      // Create a default stockroom/warehouse for this new branch
      await tx.warehouse.create({
        data: {
          branchId: branch.id,
          name: `${dto.name} Warehouse`,
          code: `WH-${dto.code.toUpperCase().trim()}`,
          isDefault: true,
        },
      });

      return branch;
    });
  }
}
