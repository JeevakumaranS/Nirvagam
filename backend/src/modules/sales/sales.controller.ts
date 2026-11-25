import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { SalesService } from './sales.service';
import { CreateInvoiceDto, CreateInvoicePaymentDto } from './dto/create-invoice.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantResolverGuard } from '../../tenancy/tenant-resolver.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser, PaginationParams } from '@nirvagam/shared';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Sales & Billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantResolverGuard, PermissionsGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get('tax-context')
  @RequirePermissions('sales_invoice:view')
  @ApiOperation({ summary: 'Get the active branch GST registration context' })
  async getTaxContext(@CurrentUser() user: AuthUser) {
    return this.salesService.getTaxContext(user.businessId, user.branchId);
  }

  @Get('invoices')
  @RequirePermissions('sales_invoice:view')
  @ApiOperation({ summary: 'List sales invoices' })
  async findAll(@CurrentUser() user: AuthUser, @Query() query: PaginationParams) {
    return this.salesService.findAll(user.businessId, user.branchId, query);
  }

  @Get('invoices/:id')
  @RequirePermissions('sales_invoice:view')
  @ApiOperation({ summary: 'Get invoice details with items and journal lines' })
  async findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.salesService.findOne(id, user.businessId, user.branchId);
  }

  @Post('invoices')
  @RequirePermissions('sales_invoice:create')
  @ApiOperation({ summary: 'Generate tax invoice with automated double-entry posting and stock update' })
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateInvoiceDto) {
    return this.salesService.create(
      user.businessId,
      user.branchId || '',
      dto,
      user.permissions.includes('sales_invoice:manual_number') ||
        user.roles.some((role) => ['BUSINESS_OWNER', 'BUSINESS_ADMIN'].includes(role))
    );
  }

  @Post('invoices/:id/payments')
  @RequirePermissions('sales_invoice:create')
  @ApiOperation({ summary: 'Record a customer payment against a sales invoice' })
  async recordPayment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateInvoicePaymentDto
  ) {
    return this.salesService.recordPayment(user.businessId, user.branchId, id, dto);
  }

  @Post('invoices/:id/generate')
  @RequirePermissions('sales_invoice:create')
  @ApiOperation({ summary: 'Generate an invoice from a recurring invoice template' })
  async generateRecurringInvoice(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.salesService.generateRecurringInvoice(user.businessId, user.branchId, id);
  }

  @Post('invoices/:id/issue')
  @RequirePermissions('sales_invoice:create')
  @ApiOperation({ summary: 'Issue a quotation, estimate, proforma, or sales order without posting accounting or stock' })
  async issueDraftDocument(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.salesService.issueDraftDocument(user.businessId, user.branchId, id, user.id);
  }

  @Post('invoices/:id/cancel')
  @RequirePermissions('sales_invoice:cancel')
  @ApiOperation({ summary: 'Cancel invoice and reverse stock' })
  async cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.salesService.cancelInvoice(id, user.businessId, user.branchId, user.id);
  }
}
