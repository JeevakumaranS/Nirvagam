import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { InvoiceStatus, InvoiceType, PaginationParams } from '@nirvagam/shared';

@Injectable()
export class PartnersService {
  constructor(private prisma: PrismaService) {}

  // Customers
  async findCustomers(businessId: string, params: PaginationParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 50));
    const skip = (page - 1) * limit;

    const where: any = {
      businessId,
      isActive: true,
      ...(params.search && {
        OR: [
          { name: { contains: params.search, mode: 'insensitive' } },
          { companyName: { contains: params.search, mode: 'insensitive' } },
          { phone: { contains: params.search, mode: 'insensitive' } },
          { gstin: { contains: params.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [total, customers] = await Promise.all([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        include: {
          salesInvoices: {
            where: {
              status: { notIn: [InvoiceStatus.CANCELLED, InvoiceStatus.DRAFT] },
              invoiceType: {
                in: [
                  InvoiceType.TAX_INVOICE,
                  InvoiceType.BILL_OF_SUPPLY,
                  InvoiceType.NON_GST,
                  InvoiceType.POS_RECEIPT,
                  InvoiceType.CREDIT_NOTE,
                  InvoiceType.DEBIT_NOTE,
                  InvoiceType.SALES_RETURN,
                ],
              },
            },
            select: { grandTotal: true, paidAmount: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const formatted = customers.map((c) => {
      let totalBilled = 0;
      let totalPaid = 0;
      c.salesInvoices.forEach((inv) => {
        totalBilled += Number(inv.grandTotal || 0);
        totalPaid += Number(inv.paidAmount || 0);
      });
      const outstandingBalance = Number(c.openingBalance || 0) + (totalBilled - totalPaid);

      return {
        id: c.id,
        name: c.name,
        companyName: c.companyName,
        phone: c.phone,
        email: c.email,
        gstin: c.gstin,
        billingCity: c.billingCity,
        billingState: c.billingState,
        billingStateCode: c.billingStateCode,
        creditLimit: c.creditLimit,
        creditPeriodDays: c.creditPeriodDays,
        openingBalance: c.openingBalance,
        outstandingBalance,
        invoiceCount: c.salesInvoices.length,
        createdAt: c.createdAt,
      };
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: formatted,
      meta: { total, page, limit, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 },
    };
  }

  async createCustomer(businessId: string, dto: CreateCustomerDto) {
    return this.prisma.customer.create({
      data: {
        businessId,
        name: dto.name,
        companyName: dto.companyName,
        email: dto.email,
        phone: dto.phone,
        gstin: dto.gstin,
        pan: dto.pan,
        billingStreet: dto.billingStreet,
        billingCity: dto.billingCity,
        billingState: dto.billingState,
        billingStateCode: dto.billingStateCode,
        billingPincode: dto.billingPincode,
        creditLimit: dto.creditLimit || 0,
        creditPeriodDays: dto.creditPeriodDays || 30,
        openingBalance: dto.openingBalance || 0,
      },
    });
  }

  // Suppliers
  async findSuppliers(businessId: string, params: PaginationParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 50));
    const skip = (page - 1) * limit;

    const where: any = {
      businessId,
      isActive: true,
      ...(params.search && {
        OR: [
          { name: { contains: params.search, mode: 'insensitive' } },
          { companyName: { contains: params.search, mode: 'insensitive' } },
          { phone: { contains: params.search, mode: 'insensitive' } },
          { gstin: { contains: params.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [total, suppliers] = await Promise.all([
      this.prisma.supplier.count({ where }),
      this.prisma.supplier.findMany({
        where,
        skip,
        take: limit,
        include: {
          purchaseInvoices: {
            where: { status: { not: 'CANCELLED' } },
            select: { grandTotal: true, paidAmount: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const formatted = suppliers.map((s) => {
      let totalBilled = 0;
      let totalPaid = 0;
      s.purchaseInvoices.forEach((inv) => {
        totalBilled += Number(inv.grandTotal || 0);
        totalPaid += Number(inv.paidAmount || 0);
      });
      const outstandingBalance = Number(s.openingBalance || 0) + (totalBilled - totalPaid);

      return {
        id: s.id,
        name: s.name,
        companyName: s.companyName,
        phone: s.phone,
        email: s.email,
        gstin: s.gstin,
        city: s.city,
        state: s.state,
        stateCode: s.stateCode,
        creditPeriodDays: s.creditPeriodDays,
        openingBalance: s.openingBalance,
        outstandingBalance,
        invoiceCount: s.purchaseInvoices.length,
        createdAt: s.createdAt,
      };
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: formatted,
      meta: { total, page, limit, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 },
    };
  }

  async createSupplier(businessId: string, dto: CreateSupplierDto) {
    return this.prisma.supplier.create({
      data: {
        businessId,
        name: dto.name,
        companyName: dto.companyName,
        email: dto.email,
        phone: dto.phone,
        gstin: dto.gstin,
        pan: dto.pan,
        addressStreet: dto.addressStreet,
        city: dto.city,
        state: dto.state,
        stateCode: dto.stateCode,
        pincode: dto.pincode,
        creditPeriodDays: dto.creditPeriodDays || 30,
        openingBalance: dto.openingBalance || 0,
      },
    });
  }
}
