import { Controller, ForbiddenException, Get, Post, Body, Query, UseGuards, Patch, Delete, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateUnitDto, UpdateUnitDto } from './dto/create-unit.dto';
import { CreateTaxRateDto, UpdateTaxRateDto } from './dto/tax-rate.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantResolverGuard } from '../../tenancy/tenant-resolver.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser, PaginationParams, UserRoleName } from '@nirvagam/shared';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Products & Inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantResolverGuard, PermissionsGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @RequirePermissions('product:view')
  @ApiOperation({ summary: 'List all products with stock balances and valuation' })
  @ApiResponse({ status: 200, description: 'Paginated product list' })
  async findAll(@CurrentUser() user: AuthUser, @Query() query: PaginationParams) {
    return this.productsService.findAll(user.businessId, query);
  }

  @Post()
  @RequirePermissions('product:create')
  @ApiOperation({ summary: 'Create product, default variant and opening stock' })
  @ApiResponse({ status: 201, description: 'Product created' })
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateProductDto) {
    if (
      dto.openingStock &&
      dto.openingStock > 0 &&
      !user.roles.includes(UserRoleName.SUPER_ADMIN)
    ) {
      const requiredPermissions = ['inventory:edit', 'inventory:approve'];
      const userPermissions = user.permissions || [];
      const missingPermissions = requiredPermissions.filter(
        (permission) => !userPermissions.includes(permission)
      );
      if (missingPermissions.length > 0) {
        throw new ForbiddenException(
          `Missing required permissions: ${missingPermissions.join(', ')}`
        );
      }
    }

    return this.productsService.create(user.businessId, user.branchId, dto);
  }

  @Patch(':id')
  @RequirePermissions('product:edit')
  async update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: Partial<CreateProductDto>) {
    return this.productsService.updateProduct(user.businessId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('product:delete')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.productsService.removeProduct(user.businessId, id);
  }

  @Get('meta/units')
  @RequirePermissions('product:view')
  @ApiOperation({ summary: 'Get measurement units' })
  async getUnits(@CurrentUser() user: AuthUser, @Query('activeOnly') activeOnly?: string) {
    return this.productsService.getUnits(user.businessId, activeOnly === 'true');
  }

  @Get('meta/categories')
  @RequirePermissions('product:view')
  @ApiOperation({ summary: 'Get product categories' })
  async getCategories(@CurrentUser() user: AuthUser) {
    return this.productsService.getCategories(user.businessId);
  }

  @Post('meta/categories')
  @RequirePermissions('product:create')
  async createCategory(@CurrentUser() user: AuthUser, @Body() dto: any) { return this.productsService.createCategory(user.businessId, dto); }

  @Post('meta/units')
  @RequirePermissions('product:create')
  async createUnit(@CurrentUser() user: AuthUser, @Body() dto: CreateUnitDto) {
    return this.productsService.createUnit(user.businessId, dto);
  }

  @Patch('meta/units/:id')
  @RequirePermissions('product:edit')
  async updateUnit(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateUnitDto) {
    return this.productsService.updateUnit(user.businessId, id, dto);
  }

  @Delete('meta/units/:id')
  @RequirePermissions('product:delete')
  async deleteUnit(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.productsService.deleteUnit(user.businessId, id);
  }

  @Patch('meta/units/:id/toggle')
  @RequirePermissions('product:edit')
  @ApiOperation({ summary: 'Enable or disable a measurement unit for the tenant' })
  async toggleUnit(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: { isActive: boolean }) {
    return this.productsService.toggleUnit(user.businessId, id, Boolean(dto.isActive));
  }

  @Get('meta/tax-rates')
  @RequirePermissions('product:view')
  @ApiOperation({ summary: 'Get configured tax rates' })
  async getTaxRates(@CurrentUser() user: AuthUser, @Query('activeOnly') activeOnly?: string) {
    return this.productsService.getTaxRates(user.businessId, activeOnly !== 'false');
  }

  @Get('inventory/overview')
  @RequirePermissions('product:view')
  async overview(@CurrentUser() user: AuthUser) { return this.productsService.overview(user.businessId); }

  @Get('inventory/branches')
  @RequirePermissions('product:view')
  async inventoryBranches(@CurrentUser() user: AuthUser) {
    return this.productsService.branches(user.businessId);
  }

  @Get('inventory/variants')
  @RequirePermissions('product:view')
  async inventoryVariants(@CurrentUser() user: AuthUser) {
    return this.productsService.inventoryVariants(user.businessId);
  }

  @Get('inventory/balances')
  @RequirePermissions('product:view')
  async balances(@CurrentUser() user: AuthUser, @Query() query: PaginationParams) {
    return this.productsService.balancesPage(user.businessId, query);
  }

  @Get('inventory/movements')
  @RequirePermissions('product:view')
  async movements(
    @CurrentUser() user: AuthUser,
    @Query() query: PaginationParams,
    @Query('transfersOnly') transfersOnly?: string,
  ) {
    return this.productsService.movementsPage(user.businessId, query, transfersOnly === 'true');
  }

  @Post('inventory/operations')
  @RequirePermissions('inventory:edit')
  async operation(@CurrentUser() user: AuthUser, @Body() dto: any) { return this.productsService.stockOperation(user.businessId, user.id, dto); }

  @Post('inventory/transfers')
  @RequirePermissions('inventory:edit')
  async transfer(@CurrentUser() user: AuthUser, @Body() dto: any) { return this.productsService.transfer(user.businessId, user.id, dto); }
}
