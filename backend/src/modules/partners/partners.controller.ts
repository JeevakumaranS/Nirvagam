import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { PartnersService } from './partners.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessContextGuard } from '../../common/guards/business-context.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser, PaginationParams } from '@nirvagam/shared';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Customers & Suppliers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, BusinessContextGuard, PermissionsGuard)
@Controller()
export class PartnersController {
  constructor(private readonly partnersService: PartnersService) {}

  @Get('customers')
  @RequirePermissions('customer:view')
  @ApiOperation({ summary: 'List customers with receivables and outstanding balances' })
  async findCustomers(@CurrentUser() user: AuthUser, @Query() query: PaginationParams) {
    return this.partnersService.findCustomers(user.businessId, query);
  }

  @Post('customers')
  @RequirePermissions('customer:create')
  @ApiOperation({ summary: 'Register a new customer' })
  async createCustomer(@CurrentUser() user: AuthUser, @Body() dto: CreateCustomerDto) {
    return this.partnersService.createCustomer(user.businessId, dto);
  }

  @Get('suppliers')
  @RequirePermissions('supplier:view')
  @ApiOperation({ summary: 'List suppliers with payables and outstanding balances' })
  async findSuppliers(@CurrentUser() user: AuthUser, @Query() query: PaginationParams) {
    return this.partnersService.findSuppliers(user.businessId, query);
  }

  @Post('suppliers')
  @RequirePermissions('supplier:create')
  @ApiOperation({ summary: 'Register a new vendor/supplier' })
  async createSupplier(@CurrentUser() user: AuthUser, @Body() dto: CreateSupplierDto) {
    return this.partnersService.createSupplier(user.businessId, dto);
  }
}
