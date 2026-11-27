import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInvoiceDto, CreateInvoicePaymentDto } from './dto/create-invoice.dto';
import {
  PaginationParams,
  StockMovementType,
  InvoiceStatus,
  InvoiceType,
  PaymentMode,
  calculateGstInvoice,
} from '@nirvagam/shared';

const DRAFT_DOCUMENT_TYPES = new Set<string>([
  InvoiceType.QUOTATION,
  InvoiceType.ESTIMATE,
  InvoiceType.PROFORMA,
  InvoiceType.SALES_ORDER,
  InvoiceType.RECURRING_INVOICE,
]);

const ACCOUNTING_DOCUMENT_TYPES = new Set<string>([
  InvoiceType.TAX_INVOICE,
  InvoiceType.BILL_OF_SUPPLY,
  InvoiceType.NON_GST,
  InvoiceType.POS_RECEIPT,
  InvoiceType.CREDIT_NOTE,
  InvoiceType.SALES_RETURN,
  InvoiceType.DEBIT_NOTE,
]);

const STOCK_OUT_DOCUMENT_TYPES = new Set<string>([
  InvoiceType.TAX_INVOICE,
  InvoiceType.BILL_OF_SUPPLY,
  InvoiceType.NON_GST,
  InvoiceType.POS_RECEIPT,
  InvoiceType.DELIVERY_CHALLAN,
]);

const STOCK_IN_DOCUMENT_TYPES = new Set<string>([InvoiceType.SALES_RETURN]);

const isPastDue = (dueDate: Date, now = new Date()) =>
  Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate()) <
  Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

@Injectable()
export class SalesService {
  constructor(private prisma: PrismaService) {}

  async getTaxContext(businessId: string, branchId?: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { businessId, ...(branchId ? { id: branchId } : {}) },
      include: { business: { select: { gstRegistrations: { select: { id: true } } } } },
      orderBy: { isHeadOffice: 'desc' },
    });
    if (!branch) {
      throw new NotFoundException('Business branch not found');
    }

    return {
      stateCode: branch.stateCode,
      registered: Boolean(branch.gstin || branch.business.gstRegistrations.length),
    };
  }

  async findAll(businessId: string, branchId: string | undefined, params: PaginationParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 50));
    const skip = (page - 1) * limit;

    const where: any = {
      ...(branchId ? { branchId } : { branch: { businessId } }),
      ...(params.search && {
        OR: [
          { invoiceNumber: { contains: params.search, mode: 'insensitive' } },
          { customer: { name: { contains: params.search, mode: 'insensitive' } } },
        ],
      }),
    };

    const [total, invoices] = await Promise.all([
      this.prisma.salesInvoice.count({ where }),
      this.prisma.salesInvoice.findMany({
        where,
        skip,
        take: limit,
        include: {
          customer: true,
          branch: true,
          items: {
            include: {
              variant: {
                include: { product: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);
    const now = new Date();
    const invoicesWithPaymentStatus = invoices.map((invoice) => ({
      ...invoice,
      status:
        ACCOUNTING_DOCUMENT_TYPES.has(invoice.invoiceType) &&
        invoice.status !== InvoiceStatus.CANCELLED &&
        invoice.status !== InvoiceStatus.DRAFT &&
        Number(invoice.paidAmount) < Number(invoice.grandTotal) &&
        isPastDue(invoice.dueDate, now)
          ? InvoiceStatus.OVERDUE
          : invoice.status,
    }));

    return {
      data: invoicesWithPaymentStatus,
      meta: { total, page, limit, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 },
    };
  }

  async findOne(id: string, businessId: string, branchId?: string) {
    const invoice = await this.prisma.salesInvoice.findFirst({
      where: {
        id,
        branch: { businessId, ...(branchId ? { id: branchId } : {}) },
      },
      include: {
        customer: true,
        branch: { include: { business: true } },
        items: {
          include: {
            variant: {
              include: { product: { include: { unit: true } } },
            },
          },
        },
        journalEntry: {
          include: {
            lines: { include: { account: true } },
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Sales invoice not found');
    }

    return {
      ...invoice,
      status:
        ACCOUNTING_DOCUMENT_TYPES.has(invoice.invoiceType) &&
        invoice.status !== InvoiceStatus.CANCELLED &&
        invoice.status !== InvoiceStatus.DRAFT &&
        Number(invoice.paidAmount) < Number(invoice.grandTotal) &&
        isPastDue(invoice.dueDate)
          ? InvoiceStatus.OVERDUE
          : invoice.status,
    };
  }

  async create(
    businessId: string,
    branchId: string,
    dto: CreateInvoiceDto,
    canUseManualInvoiceNumber = false
  ) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Invoice must contain at least one item');
    }

    const [branch, customer] = await Promise.all([
      this.prisma.branch.findUnique({
        where: { id: branchId },
        include: {
          business: { select: { gstRegistrations: { select: { id: true } } } },
        },
      }),
      this.prisma.customer.findUnique({
        where: { id: dto.customerId },
      }),
    ]);

    if (!branch || branch.businessId !== businessId || !customer || customer.businessId !== businessId) {
      throw new NotFoundException('Branch or Customer not found');
    }
    const variantIds = Array.from(new Set(dto.items.map((item) => item.variantId)));
    const validVariantCount = await this.prisma.productVariant.count({
      where: { id: { in: variantIds }, product: { businessId } },
    });
    if (validVariantCount !== variantIds.length) {
      throw new BadRequestException('One or more selected products do not belong to this business');
    }

    const invoiceType = dto.invoiceType || InvoiceType.TAX_INVOICE;
    const isDraftDocument = DRAFT_DOCUMENT_TYPES.has(invoiceType);
    const isCreditDocument =
      invoiceType === InvoiceType.CREDIT_NOTE || invoiceType === InvoiceType.SALES_RETURN;
    const shouldPostAccounting = ACCOUNTING_DOCUMENT_TYPES.has(invoiceType);
    const shouldUpdateStock =
      STOCK_OUT_DOCUMENT_TYPES.has(invoiceType) || STOCK_IN_DOCUMENT_TYPES.has(invoiceType);
    if (
      [InvoiceType.CREDIT_NOTE, InvoiceType.DEBIT_NOTE, InvoiceType.SALES_RETURN].includes(invoiceType) &&
      !dto.relatedInvoiceId
    ) {
      throw new BadRequestException('Select the original invoice for this adjustment document');
    }

    let relatedInvoice: { id: string; grandTotal: unknown } | null = null;
    if (dto.relatedInvoiceId) {
      relatedInvoice = await this.prisma.salesInvoice.findFirst({
        where: {
          id: dto.relatedInvoiceId,
          customerId: customer.id,
          invoiceType: {
            in: [
              InvoiceType.TAX_INVOICE,
              InvoiceType.BILL_OF_SUPPLY,
              InvoiceType.NON_GST,
              InvoiceType.POS_RECEIPT,
            ],
          },
          branch: { businessId },
          status: { notIn: [InvoiceStatus.CANCELLED, InvoiceStatus.DRAFT] },
        },
        select: { id: true, grandTotal: true },
      });
      if (!relatedInvoice) {
        throw new NotFoundException('Referenced invoice was not found or is not eligible for adjustment');
      }
    }

    if (isCreditDocument && relatedInvoice) {
      const [sourceItems, previousReturns] = await Promise.all([
        this.prisma.salesInvoiceItem.findMany({
          where: { salesInvoiceId: relatedInvoice.id },
          select: { variantId: true, quantity: true },
        }),
        this.prisma.salesInvoice.findMany({
          where: {
            relatedInvoiceId: relatedInvoice.id,
            invoiceType: InvoiceType.SALES_RETURN,
            status: { not: InvoiceStatus.CANCELLED },
          },
          include: { items: { select: { variantId: true, quantity: true } } },
        }),
      ]);
      const sourceQuantities = new Map<string, number>();
      const returnedQuantities = new Map<string, number>();
      sourceItems.forEach((item) =>
        sourceQuantities.set(item.variantId, (sourceQuantities.get(item.variantId) || 0) + Number(item.quantity))
      );
      previousReturns.forEach((salesReturn) =>
        salesReturn.items.forEach((item) =>
          returnedQuantities.set(
            item.variantId,
            (returnedQuantities.get(item.variantId) || 0) + Number(item.quantity)
          )
        )
      );
      for (const item of dto.items) {
        const available =
          (sourceQuantities.get(item.variantId) || 0) - (returnedQuantities.get(item.variantId) || 0);
        if (item.quantity > available) {
          throw new BadRequestException('Returned quantity exceeds the unreturned quantity on the original invoice');
        }
        returnedQuantities.set(
          item.variantId,
          (returnedQuantities.get(item.variantId) || 0) + item.quantity
        );
      }
    }

    if (dto.invoiceNumber && !canUseManualInvoiceNumber) {
      throw new BadRequestException('Manual invoice numbering permission is required');
    }

    const requestedInvoiceNumber = dto.invoiceNumber?.trim();
    if (dto.invoiceNumber && !requestedInvoiceNumber) {
      throw new BadRequestException('Manual invoice number cannot be empty');
    }
    if (
      requestedInvoiceNumber &&
      (await this.prisma.salesInvoice.findFirst({
        where: { branchId, invoiceNumber: requestedInvoiceNumber },
        select: { id: true },
      }))
    ) {
      throw new BadRequestException('Invoice number already exists for this branch');
    }

    const isGstDocument =
      invoiceType !== InvoiceType.BILL_OF_SUPPLY && invoiceType !== InvoiceType.NON_GST;
    const sellerRegisteredForGst =
      isGstDocument && Boolean(branch.gstin || branch.business.gstRegistrations.length);
    if (invoiceType === InvoiceType.TAX_INVOICE && !sellerRegisteredForGst) {
      throw new BadRequestException('Tax invoices require an active GST registration; use a Non-GST or Bill of Supply document');
    }
    const businessStateCode = branch.stateCode;
    const customerStateCode =
      dto.placeOfSupplyCode ||
      customer.shippingStateCode ||
      customer.billingStateCode ||
      businessStateCode;
    const additionalCharges = dto.additionalCharges || 0;
    const discountableSubtotal = dto.items.reduce((total, item) => {
      const lineTotal = item.quantity * item.unitPrice;
      if ((item.discountAmount || 0) > lineTotal) {
        throw new BadRequestException('An item discount cannot exceed its line amount');
      }
      const lineAfterItemDiscount = lineTotal - (item.discountAmount || 0);
      const taxableBase =
        dto.pricesIncludeTax && sellerRegisteredForGst && item.gstRate > 0
          ? lineAfterItemDiscount / (1 + item.gstRate / 100)
          : lineAfterItemDiscount;
      return total + taxableBase;
    }, 0);
    if ((dto.discountAmount || 0) > discountableSubtotal) {
      throw new BadRequestException('Invoice discount cannot exceed the taxable subtotal');
    }

    const gstCalculation = calculateGstInvoice(
      businessStateCode,
      customerStateCode,
      dto.items.map((i) => ({
        id: i.variantId,
        name: 'Item',
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        discountAmount: i.discountAmount || 0,
        gstRate: i.gstRate,
      })),
      dto.discountAmount || 0,
      {
        pricesIncludeTax: dto.pricesIncludeTax || false,
        sellerRegisteredForGst,
        otherCharges: additionalCharges,
      }
    );
    if (gstCalculation.netTotal <= 0) {
      throw new BadRequestException('Document total must be greater than zero');
    }
    if (isCreditDocument && relatedInvoice) {
      const previousCredits = await this.prisma.salesInvoice.aggregate({
        where: {
          relatedInvoiceId: relatedInvoice.id,
          invoiceType: { in: [InvoiceType.CREDIT_NOTE, InvoiceType.SALES_RETURN] },
          status: { not: InvoiceStatus.CANCELLED },
        },
        _sum: { grandTotal: true },
      });
      const remainingCredit =
        Number(relatedInvoice.grandTotal) + Number(previousCredits._sum.grandTotal || 0);
      if (gstCalculation.netTotal > remainingCredit) {
        throw new BadRequestException('Credit exceeds the remaining amount on the original invoice');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      if (invoiceType === InvoiceType.SALES_RETURN && relatedInvoice) {
        await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM sales_invoices WHERE id = ${relatedInvoice.id}::uuid FOR UPDATE
        `;
        const [sourceInvoice, sourceItems, previousReturns] = await Promise.all([
          tx.salesInvoice.findUnique({ where: { id: relatedInvoice.id } }),
          tx.salesInvoiceItem.findMany({
            where: { salesInvoiceId: relatedInvoice.id },
            select: { variantId: true, quantity: true },
          }),
          tx.salesInvoice.findMany({
            where: {
              relatedInvoiceId: relatedInvoice.id,
              invoiceType: InvoiceType.SALES_RETURN,
              status: { not: InvoiceStatus.CANCELLED },
            },
            include: { items: { select: { variantId: true, quantity: true } } },
          }),
        ]);
        if (
          !sourceInvoice ||
          sourceInvoice.status === InvoiceStatus.CANCELLED ||
          sourceInvoice.status === InvoiceStatus.DRAFT
        ) {
          throw new BadRequestException('Original invoice is no longer eligible for a return');
        }
        if (isCreditDocument) {
          const previousCredits = await tx.salesInvoice.aggregate({
            where: {
              relatedInvoiceId: relatedInvoice.id,
              invoiceType: { in: [InvoiceType.CREDIT_NOTE, InvoiceType.SALES_RETURN] },
              status: { not: InvoiceStatus.CANCELLED },
            },
            _sum: { grandTotal: true },
          });
          const remainingCredit =
            Number(sourceInvoice.grandTotal) + Number(previousCredits._sum.grandTotal || 0);
          if (gstCalculation.netTotal > remainingCredit) {
            throw new BadRequestException(
              'Credit exceeds the remaining amount on the original invoice'
            );
          }
        }
        const sourceQuantities = new Map<string, number>();
        const returnedQuantities = new Map<string, number>();
        sourceItems.forEach((item) =>
          sourceQuantities.set(
            item.variantId,
            (sourceQuantities.get(item.variantId) || 0) + Number(item.quantity)
          )
        );
        previousReturns.forEach((salesReturn) =>
          salesReturn.items.forEach((item) =>
            returnedQuantities.set(
              item.variantId,
              (returnedQuantities.get(item.variantId) || 0) + Number(item.quantity)
            )
          )
        );
        for (const item of dto.items) {
          const available =
            (sourceQuantities.get(item.variantId) || 0) -
            (returnedQuantities.get(item.variantId) || 0);
          if (item.quantity > available) {
            throw new BadRequestException(
              'Returned quantity exceeds the unreturned quantity on the original invoice'
            );
          }
          returnedQuantities.set(
            item.variantId,
            (returnedQuantities.get(item.variantId) || 0) + item.quantity
          );
        }
      }

      const sequence = requestedInvoiceNumber
        ? null
        : await tx.documentSequence.upsert({
            where: {
              businessId_branchId_documentType: { businessId, branchId, documentType: invoiceType },
            },
            create: {
              businessId,
              branchId,
              documentType: invoiceType,
              prefix: `${invoiceType.replace(/_/g, '')}-`,
              nextNumber: 1002,
            },
            update: { nextNumber: { increment: 1 } },
          });
      let invoiceNumber = requestedInvoiceNumber || '';
      if (sequence) {
        let nextNumber = sequence.nextNumber - 1;
        const makeNumber = (number: number) =>
          `${sequence.prefix}${String(number).padStart(sequence.padding, '0')}${sequence.suffix || ''}`;
        invoiceNumber = makeNumber(nextNumber);
        while (
          await tx.salesInvoice.findFirst({
            where: { branchId, invoiceNumber },
            select: { id: true },
          })
        ) {
          const updatedSequence = await tx.documentSequence.update({
            where: { id: sequence.id },
            data: { nextNumber: { increment: 1 } },
          });
          nextNumber = updatedSequence.nextNumber - 1;
          invoiceNumber = makeNumber(nextNumber);
        }
      }

      const initialPaymentTotal = (dto.payments || []).reduce((total, payment) => total + payment.amount, 0);
      if (isDraftDocument && initialPaymentTotal > 0) {
        throw new BadRequestException('Draft documents cannot receive payments');
      }
      if (isCreditDocument && initialPaymentTotal > 0) {
        throw new BadRequestException('Credit documents cannot receive payments');
      }
      if (initialPaymentTotal > gstCalculation.netTotal) {
        throw new BadRequestException('Payments cannot exceed the invoice total');
      }
      if (!shouldPostAccounting && initialPaymentTotal > 0) {
        throw new BadRequestException('Payments are only accepted for posted sales documents');
      }

      let journalEntryId: string | null = null;
      if (shouldPostAccounting) {
        const [arAcc, salesAcc, cgstAcc, sgstAcc, igstAcc, roundAcc] = await Promise.all([
          tx.chartOfAccount.findFirst({ where: { businessId, code: '1030' } }),
          tx.chartOfAccount.findFirst({ where: { businessId, code: '4010' } }),
          tx.chartOfAccount.findFirst({ where: { businessId, code: '2021' } }),
          tx.chartOfAccount.findFirst({ where: { businessId, code: '2022' } }),
          tx.chartOfAccount.findFirst({ where: { businessId, code: '2023' } }),
          tx.chartOfAccount.findFirst({ where: { businessId, code: '5090' } }),
        ]);
        if (!arAcc || !salesAcc) {
          throw new BadRequestException('Accounts receivable and sales revenue accounts must be configured');
        }

        const journal = await tx.journalEntry.create({
          data: {
            businessId,
            entryNumber: `JRN-${invoiceNumber}`,
            date: dto.invoiceDate ? new Date(dto.invoiceDate) : new Date(),
            narration: `Sales Invoice ${invoiceNumber} issued to ${customer.name}`,
            reference: invoiceNumber,
            isPosted: true,
          },
        });
        journalEntryId = journal.id;

        await tx.journalLine.createMany({
          data: isCreditDocument
            ? [
                {
                  journalEntryId: journal.id,
                  accountId: arAcc.id,
                  debit: 0,
                  credit: gstCalculation.netTotal,
                  notes: `Credit due to ${customer.name}`,
                },
                {
                  journalEntryId: journal.id,
                  accountId: salesAcc.id,
                  debit: gstCalculation.totalTaxable + additionalCharges,
                  credit: 0,
                  notes: 'Sales reversal and other charges',
                },
              ]
            : [
                {
                  journalEntryId: journal.id,
                  accountId: arAcc.id,
                  debit: gstCalculation.netTotal,
                  credit: 0,
                  notes: `Receivable from ${customer.name}`,
                },
                {
                  journalEntryId: journal.id,
                  accountId: salesAcc.id,
                  debit: 0,
                  credit: gstCalculation.totalTaxable + additionalCharges,
                  notes: 'Operating Sales Revenue and Other Charges',
                },
              ],
        });

        if (gstCalculation.isInterState && igstAcc && gstCalculation.totalIgst > 0) {
          await tx.journalLine.create({
            data: {
              journalEntryId: journal.id,
              accountId: igstAcc.id,
              debit: isCreditDocument ? gstCalculation.totalIgst : 0,
              credit: isCreditDocument ? 0 : gstCalculation.totalIgst,
              notes: 'Output IGST Payable',
            },
          });
        } else {
          if (cgstAcc && gstCalculation.totalCgst > 0) {
            await tx.journalLine.create({
              data: {
                journalEntryId: journal.id,
                accountId: cgstAcc.id,
                debit: isCreditDocument ? gstCalculation.totalCgst : 0,
                credit: isCreditDocument ? 0 : gstCalculation.totalCgst,
                notes: 'Output CGST Payable',
              },
            });
          }
          if (sgstAcc && gstCalculation.totalSgst > 0) {
            await tx.journalLine.create({
              data: {
                journalEntryId: journal.id,
                accountId: sgstAcc.id,
                debit: isCreditDocument ? gstCalculation.totalSgst : 0,
                credit: isCreditDocument ? 0 : gstCalculation.totalSgst,
                notes: 'Output SGST Payable',
              },
            });
          }
        }

        if (roundAcc && gstCalculation.roundOffAmount !== 0) {
          await tx.journalLine.create({
            data: {
              journalEntryId: journal.id,
              accountId: roundAcc.id,
              debit: isCreditDocument
                ? Math.max(0, gstCalculation.roundOffAmount)
                : Math.max(0, -gstCalculation.roundOffAmount),
              credit: isCreditDocument
                ? Math.max(0, -gstCalculation.roundOffAmount)
                : Math.max(0, gstCalculation.roundOffAmount),
              notes: 'Invoice Round-off Adjustment',
            },
          });
        }
      }

      // 4. Create Sales Invoice Header
      const invoice = await tx.salesInvoice.create({
        data: {
          branchId,
          customerId: customer.id,
          journalEntryId,
          relatedInvoiceId: relatedInvoice?.id,
          invoiceType,
          recurrenceFrequency: dto.recurrenceFrequency,
          invoiceNumber,
          invoiceDate: dto.invoiceDate ? new Date(dto.invoiceDate) : new Date(),
          dueDate: dto.dueDate ? new Date(dto.dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          status: isDraftDocument
            ? InvoiceStatus.DRAFT
            : isCreditDocument || !shouldPostAccounting
            ? InvoiceStatus.POSTED
            : initialPaymentTotal >= gstCalculation.netTotal
            ? InvoiceStatus.PAID
            : initialPaymentTotal > 0
            ? InvoiceStatus.PARTIALLY_PAID
            : InvoiceStatus.UNPAID,
          taxableAmount: gstCalculation.totalTaxable * (isCreditDocument ? -1 : 1),
          cgstAmount: gstCalculation.totalCgst * (isCreditDocument ? -1 : 1),
          sgstAmount: gstCalculation.totalSgst * (isCreditDocument ? -1 : 1),
          igstAmount: gstCalculation.totalIgst * (isCreditDocument ? -1 : 1),
          totalTax: gstCalculation.totalTax * (isCreditDocument ? -1 : 1),
          discountAmount: (dto.discountAmount || 0) * (isCreditDocument ? -1 : 1),
          additionalCharges: additionalCharges * (isCreditDocument ? -1 : 1),
          pricesIncludeTax: dto.pricesIncludeTax || false,
          roundOff: gstCalculation.roundOffAmount * (isCreditDocument ? -1 : 1),
          grandTotal: gstCalculation.netTotal * (isCreditDocument ? -1 : 1),
          paidAmount: initialPaymentTotal,
          notes: dto.notes,
          terms: dto.terms,
        },
      });

      if (dto.payments?.length) {
        const [cashAccount, bankAccount, receivableAccount] = await Promise.all([
          tx.chartOfAccount.findFirst({ where: { businessId, code: '1010' } }),
          tx.chartOfAccount.findFirst({ where: { businessId, code: '1020' } }),
          tx.chartOfAccount.findFirst({ where: { businessId, code: '1030' } }),
        ]);
        if (!cashAccount || !bankAccount || !receivableAccount) {
          throw new BadRequestException('Cash, bank, and accounts receivable accounts must be configured');
        }

        for (const [index, paymentInput] of dto.payments.entries()) {
          const payment = await tx.payment.create({
            data: {
              branchId,
              type: 'CUSTOMER_RECEIPT',
              customerId: customer.id,
              mode: paymentInput.mode,
              amount: paymentInput.amount,
              paymentDate: paymentInput.paymentDate ? new Date(paymentInput.paymentDate) : new Date(),
              reference: paymentInput.reference,
            },
          });
          await tx.paymentAllocation.createMany({
            data: { paymentId: payment.id, salesInvoiceId: invoice.id, amount: paymentInput.amount },
          });

          const paymentJournal = await tx.journalEntry.create({
            data: {
              businessId,
              entryNumber: `JRN-${invoiceNumber}-PAY-${index + 1}`,
              date: payment.paymentDate,
              narration: `Payment received for ${invoiceNumber}`,
              reference: payment.reference || invoiceNumber,
              isPosted: true,
            },
          });
          const paymentAccount =
            paymentInput.mode === PaymentMode.CASH ? cashAccount : bankAccount;
          await tx.journalLine.createMany({
            data: [
              {
                journalEntryId: paymentJournal.id,
                accountId: paymentAccount.id,
                debit: paymentInput.amount,
                credit: 0,
                notes: `Received by ${paymentInput.mode}`,
              },
              {
                journalEntryId: paymentJournal.id,
                accountId: receivableAccount.id,
                debit: 0,
                credit: paymentInput.amount,
                notes: `Invoice ${invoiceNumber} payment`,
              },
            ],
          });
        }
      }

      // 5. Create Line Items and Update Inventory Stock
      for (const item of gstCalculation.items) {
        await tx.salesInvoiceItem.create({
          data: {
            salesInvoiceId: invoice.id,
            variantId: item.id,
            unitName: dto.items.find((line) => line.variantId === item.id)?.unitName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discountAmount: item.discountAmount || 0,
            taxableValue: item.taxableValue * (isCreditDocument ? -1 : 1),
            gstRate: item.gstRate,
            cgstAmount: item.cgstAmount * (isCreditDocument ? -1 : 1),
            sgstAmount: item.sgstAmount * (isCreditDocument ? -1 : 1),
            igstAmount: item.igstAmount * (isCreditDocument ? -1 : 1),
            totalAmount: item.totalAmount * (isCreditDocument ? -1 : 1),
          },
        });

        if (shouldUpdateStock) {
          const balance = await tx.stockBalance.findUnique({
            where: {
              branchId_variantId: {
                branchId: branch.id,
                variantId: item.id,
              },
            },
          });

          if (balance) {
            await tx.stockBalance.update({
              where: { id: balance.id },
              data: {
                quantity: STOCK_IN_DOCUMENT_TYPES.has(invoiceType)
                  ? { increment: item.quantity }
                  : { decrement: item.quantity },
              },
            });
          } else if (STOCK_IN_DOCUMENT_TYPES.has(invoiceType)) {
            await tx.stockBalance.create({
              data: { branchId: branch.id, variantId: item.id, quantity: item.quantity },
            });
          }

          await tx.stockMovement.create({
            data: {
              branchId: branch.id,
              variantId: item.id,
              type: STOCK_IN_DOCUMENT_TYPES.has(invoiceType)
                ? StockMovementType.RETURN_IN_CREDIT_NOTE
                : StockMovementType.OUT_SALE,
              quantity: item.quantity,
              unitCost: item.unitPrice,
              totalCost: item.totalAmount,
              referenceId: invoice.id,
              notes: STOCK_IN_DOCUMENT_TYPES.has(invoiceType)
                ? `Returned against ${invoiceNumber}`
                : `Dispatched against ${invoiceNumber}`,
            },
          });
        }
      }

      return invoice;
    });
  }

  async recordPayment(
    businessId: string,
    branchId: string | undefined,
    invoiceId: string,
    dto: CreateInvoicePaymentDto
  ) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.salesInvoice.findFirst({
        where: {
          id: invoiceId,
          branch: { businessId, ...(branchId ? { id: branchId } : {}) },
        },
      });
      if (!invoice) {
        throw new NotFoundException('Sales invoice not found');
      }
      if (invoice.status === InvoiceStatus.CANCELLED || invoice.status === InvoiceStatus.DRAFT) {
        throw new BadRequestException('Payments can only be recorded for issued invoices');
      }

      const paidAmount = Number(invoice.paidAmount);
      const nextPaidAmount = paidAmount + dto.amount;
      if (dto.amount > Number(invoice.grandTotal) - paidAmount) {
        throw new BadRequestException('Payment cannot exceed the outstanding invoice balance');
      }
      const status =
        nextPaidAmount >= Number(invoice.grandTotal)
          ? InvoiceStatus.PAID
          : InvoiceStatus.PARTIALLY_PAID;
      const updateResult = await tx.salesInvoice.updateMany({
        where: { id: invoice.id, paidAmount: invoice.paidAmount },
        data: { paidAmount: nextPaidAmount, status },
      });
      if (updateResult.count !== 1) {
        throw new BadRequestException('Invoice balance changed; refresh and try again');
      }

      const [cashAccount, bankAccount, receivableAccount] = await Promise.all([
        tx.chartOfAccount.findFirst({ where: { businessId, code: '1010' } }),
        tx.chartOfAccount.findFirst({ where: { businessId, code: '1020' } }),
        tx.chartOfAccount.findFirst({ where: { businessId, code: '1030' } }),
      ]);
      if (!cashAccount || !bankAccount || !receivableAccount) {
        throw new BadRequestException('Cash, bank, and accounts receivable accounts must be configured');
      }

      const payment = await tx.payment.create({
        data: {
          branchId: invoice.branchId,
          type: 'CUSTOMER_RECEIPT',
          customerId: invoice.customerId,
          mode: dto.mode,
          amount: dto.amount,
          paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
          reference: dto.reference,
        },
      });
      await tx.paymentAllocation.createMany({
        data: { paymentId: payment.id, salesInvoiceId: invoice.id, amount: dto.amount },
      });

      const paymentJournal = await tx.journalEntry.create({
        data: {
          businessId,
          entryNumber: `JRN-${invoice.invoiceNumber}-PAY-${payment.id}`,
          date: payment.paymentDate,
          narration: `Payment received for ${invoice.invoiceNumber}`,
          reference: payment.reference || invoice.invoiceNumber,
          isPosted: true,
        },
      });
      const paymentAccount = dto.mode === PaymentMode.CASH ? cashAccount : bankAccount;
      await tx.journalLine.createMany({
        data: [
          {
            journalEntryId: paymentJournal.id,
            accountId: paymentAccount.id,
            debit: dto.amount,
            credit: 0,
            notes: `Received by ${dto.mode}`,
          },
          {
            journalEntryId: paymentJournal.id,
            accountId: receivableAccount.id,
            debit: 0,
            credit: dto.amount,
            notes: `Invoice ${invoice.invoiceNumber} payment`,
          },
        ],
      });

      return tx.salesInvoice.findUniqueOrThrow({ where: { id: invoice.id } });
    });
  }

  async generateRecurringInvoice(
    businessId: string,
    branchId: string | undefined,
    templateId: string
  ) {
    const template = await this.prisma.salesInvoice.findFirst({
      where: {
        id: templateId,
        invoiceType: InvoiceType.RECURRING_INVOICE,
        status: InvoiceStatus.DRAFT,
        branch: { businessId, ...(branchId ? { id: branchId } : {}) },
      },
      include: { customer: true, items: true },
    });
    if (!template) {
      throw new NotFoundException('Recurring invoice template not found');
    }

    const invoiceDate = new Date();
    const dueDate = new Date(
      invoiceDate.getTime() + template.customer.creditPeriodDays * 24 * 60 * 60 * 1000
    );
    return this.create(businessId, template.branchId, {
      customerId: template.customerId,
      invoiceType: InvoiceType.TAX_INVOICE,
      invoiceDate: invoiceDate.toISOString(),
      dueDate: dueDate.toISOString(),
      pricesIncludeTax: template.pricesIncludeTax,
      discountAmount: Number(template.discountAmount),
      additionalCharges: Number(template.additionalCharges),
      notes: template.notes || undefined,
      terms: template.terms || undefined,
      items: template.items.map((item) => ({
        variantId: item.variantId,
        unitName: item.unitName || undefined,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        gstRate: Number(item.gstRate),
        discountAmount: Number(item.discountAmount),
      })),
    });
  }

  async issueDraftDocument(
    businessId: string,
    branchId: string | undefined,
    documentId: string,
    userId: string
  ) {
    const document = await this.prisma.salesInvoice.findFirst({
      where: {
        id: documentId,
        invoiceType: { in: [InvoiceType.QUOTATION, InvoiceType.ESTIMATE, InvoiceType.PROFORMA, InvoiceType.SALES_ORDER] },
        status: InvoiceStatus.DRAFT,
        branch: { businessId, ...(branchId ? { id: branchId } : {}) },
      },
      include: { branch: { include: { business: true } } },
    });
    if (!document) {
      throw new NotFoundException('Draft sales document not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const issued = await tx.salesInvoice.update({
        where: { id: document.id },
        data: { status: InvoiceStatus.POSTED },
      });
      await tx.auditLog.create({
        data: {
          tenantId: document.branch.business.tenantId,
          businessId: document.branch.businessId,
          userId,
          action: 'POST',
          entityType: 'SalesInvoice',
          entityId: document.id,
          diff: { status: { from: InvoiceStatus.DRAFT, to: InvoiceStatus.POSTED } },
        },
      });
      return issued;
    });
  }

  async cancelInvoice(id: string, businessId: string, branchId?: string, userId?: string) {
    const invoice = await this.prisma.salesInvoice.findFirst({
      where: { id, branch: { businessId, ...(branchId ? { id: branchId } : {}) } },
      include: {
        items: true,
        branch: { include: { business: true } },
      },
    });

    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('Invoice is already cancelled');
    }
    if (Number(invoice.paidAmount) > 0) {
      throw new BadRequestException('Refund or reverse recorded payments before cancelling this invoice');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Mark as cancelled
      const updated = await tx.salesInvoice.update({
        where: { id },
        data: { status: InvoiceStatus.CANCELLED },
      });

      if (invoice.journalEntryId) {
        const originalJournal = await tx.journalEntry.findUnique({
          where: { id: invoice.journalEntryId },
          include: { lines: true },
        });
        if (originalJournal) {
          const reversal = await tx.journalEntry.create({
            data: {
              businessId: invoice.branch.businessId,
              entryNumber: `JRN-CANCEL-${invoice.invoiceNumber}`,
              date: new Date(),
              narration: `Cancellation reversal for ${invoice.invoiceNumber}`,
              reference: invoice.invoiceNumber,
              isPosted: true,
            },
          });
          if (originalJournal.lines.length) {
            await tx.journalLine.createMany({
              data: originalJournal.lines.map((line) => ({
                journalEntryId: reversal.id,
                accountId: line.accountId,
                debit: line.credit,
                credit: line.debit,
                notes: `Reversal: ${line.notes || invoice.invoiceNumber}`,
              })),
            });
          }
        }
      }

      if (
        (STOCK_OUT_DOCUMENT_TYPES.has(invoice.invoiceType) ||
          STOCK_IN_DOCUMENT_TYPES.has(invoice.invoiceType))
      ) {
        for (const item of invoice.items) {
          await tx.stockBalance.updateMany({
            where: { branchId: invoice.branchId, variantId: item.variantId },
            data: {
              quantity: STOCK_OUT_DOCUMENT_TYPES.has(invoice.invoiceType)
                ? { increment: item.quantity }
                : { decrement: item.quantity },
            },
          });

          await tx.stockMovement.create({
            data: {
              branchId: invoice.branchId,
              variantId: item.variantId,
              type: STOCK_OUT_DOCUMENT_TYPES.has(invoice.invoiceType)
                ? StockMovementType.RETURN_IN_CREDIT_NOTE
                : StockMovementType.OUT_SALE,
              quantity: item.quantity,
              unitCost: item.unitPrice,
              totalCost: item.totalAmount,
              referenceId: invoice.id,
              notes: `Cancelled invoice ${invoice.invoiceNumber} stock return`,
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          tenantId: invoice.branch.business.tenantId,
          businessId: invoice.branch.businessId,
          userId,
          action: 'CANCEL',
          entityType: 'SalesInvoice',
          entityId: invoice.id,
          diff: { status: { from: invoice.status, to: InvoiceStatus.CANCELLED } },
        },
      });

      return updated;
    });
  }
}
