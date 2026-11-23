import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AccountingService } from './accounting.service';
import { CreateJournalDto } from './dto/create-journal.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser, PaginationParams } from '@nirvagam/shared';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Double-Entry Accounting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('accounting')
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @Get('chart-of-accounts')
  @RequirePermissions('accounting:view')
  @ApiOperation({ summary: 'Get Chart of Accounts with real-time net balances' })
  async getChartOfAccounts(@CurrentUser() user: AuthUser) {
    return this.accountingService.getChartOfAccounts(user.businessId);
  }

  @Get('journals')
  @RequirePermissions('accounting:view')
  @ApiOperation({ summary: 'List posted journal entries with debits and credits' })
  async getJournals(@CurrentUser() user: AuthUser, @Query() query: PaginationParams) {
    return this.accountingService.getJournals(user.businessId, query);
  }

  @Post('journals')
  @RequirePermissions('accounting:create', 'accounting:approve')
  @ApiOperation({ summary: 'Post manual double-entry journal (enforces Sum(Dr) == Sum(Cr))' })
  async createJournal(@CurrentUser() user: AuthUser, @Body() dto: CreateJournalDto) {
    return this.accountingService.createJournal(user.businessId, dto);
  }

  @Get('trial-balance')
  @RequirePermissions('report:view', 'report:access_reports')
  @ApiOperation({ summary: 'Compute Trial Balance with balanced check' })
  async getTrialBalance(@CurrentUser() user: AuthUser) {
    return this.accountingService.getTrialBalance(user.businessId);
  }

  @Get('profit-loss')
  @RequirePermissions('report:view', 'report:access_reports')
  @ApiOperation({ summary: 'Compute Profit & Loss statement' })
  async getProfitLoss(@CurrentUser() user: AuthUser) {
    return this.accountingService.getProfitLoss(user.businessId);
  }
}
