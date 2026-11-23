import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { PurchasesService } from './purchases.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser, PaginationParams } from '@nirvagam/shared';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Purchases & Procurement')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Get('invoices')
  @RequirePermissions('purchase_invoice:view')
  @ApiOperation({ summary: 'List purchase invoices and vendor bills' })
  async findAll(@CurrentUser() user: AuthUser, @Query() query: PaginationParams) {
    return this.purchasesService.findAll(user.businessId, user.branchId, query);
  }

  @Post('invoices')
  @RequirePermissions('purchase_invoice:create')
  @ApiOperation({ summary: 'Record vendor purchase invoice (increments stock & posts double-entry journal)' })
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreatePurchaseDto) {
    return this.purchasesService.create(user.businessId, user.branchId || '', dto);
  }
}
