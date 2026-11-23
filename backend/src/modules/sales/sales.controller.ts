import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { SalesService } from './sales.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser, PaginationParams } from '@nirvagam/shared';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Sales & Billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get('invoices')
  @RequirePermissions('sales_invoice:view')
  @ApiOperation({ summary: 'List sales invoices' })
  async findAll(@CurrentUser() user: AuthUser, @Query() query: PaginationParams) {
    return this.salesService.findAll(user.businessId, user.branchId, query);
  }

  @Get('invoices/:id')
  @RequirePermissions('sales_invoice:view')
  @ApiOperation({ summary: 'Get invoice details with items and journal lines' })
  async findOne(@Param('id') id: string) {
    return this.salesService.findOne(id);
  }

  @Post('invoices')
  @RequirePermissions('sales_invoice:create')
  @ApiOperation({ summary: 'Generate tax invoice with automated double-entry posting and stock update' })
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateInvoiceDto) {
    return this.salesService.create(user.businessId, user.branchId || '', dto);
  }

  @Post('invoices/:id/cancel')
  @RequirePermissions('sales_invoice:cancel')
  @ApiOperation({ summary: 'Cancel invoice and reverse stock' })
  async cancel(@Param('id') id: string) {
    return this.salesService.cancelInvoice(id);
  }
}
