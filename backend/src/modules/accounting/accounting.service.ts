import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateJournalDto } from './dto/create-journal.dto';
import { PaginationParams } from '@nirvagam/shared';

@Injectable()
export class AccountingService {
  constructor(private prisma: PrismaService) {}

  async getChartOfAccounts(businessId: string) {
    const accounts = await this.prisma.chartOfAccount.findMany({
      where: { businessId, isActive: true },
      include: {
        journalLines: {
          select: { debit: true, credit: true },
        },
      },
      orderBy: { code: 'asc' },
    });

    return accounts.map((acc) => {
      let totalDebit = 0;
      let totalCredit = 0;
      acc.journalLines.forEach((jl) => {
        totalDebit += Number(jl.debit || 0);
        totalCredit += Number(jl.credit || 0);
      });

      // Asset & Expense normal balance = Debit - Credit
      // Liability, Equity & Income normal balance = Credit - Debit
      let netBalance = 0;
      if (acc.group === 'ASSET' || acc.group === 'EXPENSE') {
        netBalance = totalDebit - totalCredit;
      } else {
        netBalance = totalCredit - totalDebit;
      }

      return {
        id: acc.id,
        code: acc.code,
        name: acc.name,
        group: acc.group,
        subGroup: acc.subGroup,
        totalDebit,
        totalCredit,
        netBalance,
      };
    });
  }

  async getJournals(businessId: string, params: PaginationParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 50));
    const skip = (page - 1) * limit;

    const where: any = {
      businessId,
      ...(params.search && {
        OR: [
          { entryNumber: { contains: params.search, mode: 'insensitive' } },
          { narration: { contains: params.search, mode: 'insensitive' } },
          { reference: { contains: params.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [total, entries] = await Promise.all([
      this.prisma.journalEntry.count({ where }),
      this.prisma.journalEntry.findMany({
        where,
        skip,
        take: limit,
        include: {
          lines: {
            include: { account: true },
          },
        },
        orderBy: { date: 'desc' },
      }),
    ]);

    const formatted = entries.map((j) => {
      let totalAmount = 0;
      j.lines.forEach((l) => {
        totalAmount += Number(l.debit || 0);
      });
      return {
        ...j,
        totalAmount,
      };
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: formatted,
      meta: { total, page, limit, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 },
    };
  }

  async createJournal(businessId: string, dto: CreateJournalDto) {
    if (!dto.lines || dto.lines.length < 2) {
      throw new BadRequestException('A journal entry must contain at least 2 balanced lines');
    }

    let totalDebit = 0;
    let totalCredit = 0;

    dto.lines.forEach((l) => {
      totalDebit += Number(l.debit || 0);
      totalCredit += Number(l.credit || 0);
    });

    // Enforce strict double-entry balancing invariant!
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new BadRequestException(
        `Unbalanced Journal Entry! Total Debit (₹${totalDebit.toFixed(2)}) must equal Total Credit (₹${totalCredit.toFixed(2)})`
      );
    }

    const count = await this.prisma.journalEntry.count({ where: { businessId } });
    const entryNumber = `JRN-MANUAL-${1000 + count + 1}`;

    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.create({
        data: {
          businessId,
          entryNumber,
          date: dto.date ? new Date(dto.date) : new Date(),
          narration: dto.narration,
          reference: dto.reference,
          isPosted: true,
        },
      });

      for (const line of dto.lines) {
        await tx.journalLine.create({
          data: {
            journalEntryId: entry.id,
            accountId: line.accountId,
            debit: line.debit,
            credit: line.credit,
            notes: line.notes,
          },
        });
      }

      return entry;
    });
  }

  async getTrialBalance(businessId: string) {
    const coa = await this.getChartOfAccounts(businessId);

    let totalDebit = 0;
    let totalCredit = 0;

    const rows = coa.map((acc) => {
      let debit = 0;
      let credit = 0;

      if (acc.group === 'ASSET' || acc.group === 'EXPENSE') {
        if (acc.netBalance >= 0) {
          debit = acc.netBalance;
        } else {
          credit = Math.abs(acc.netBalance);
        }
      } else {
        if (acc.netBalance >= 0) {
          credit = acc.netBalance;
        } else {
          debit = Math.abs(acc.netBalance);
        }
      }

      totalDebit += debit;
      totalCredit += credit;

      return {
        code: acc.code,
        name: acc.name,
        group: acc.group,
        debit,
        credit,
      };
    });

    return {
      accounts: rows,
      totalDebit,
      totalCredit,
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.05,
    };
  }

  async getProfitLoss(businessId: string) {
    const coa = await this.getChartOfAccounts(businessId);

    const incomeAccounts = coa.filter((a) => a.group === 'INCOME');
    const expenseAccounts = coa.filter((a) => a.group === 'EXPENSE');

    const totalRevenue = incomeAccounts.reduce((sum, a) => sum + Math.max(0, a.netBalance), 0);
    const totalExpenses = expenseAccounts.reduce((sum, a) => sum + Math.max(0, a.netBalance), 0);
    const netProfit = totalRevenue - totalExpenses;

    return {
      totalRevenue,
      totalExpenses,
      netProfit,
      incomeAccounts,
      expenseAccounts,
    };
  }
}
