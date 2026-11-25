import { Controller, ForbiddenException, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
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

  @Get('meta/units')
  @RequirePermissions('product:view')
  @ApiOperation({ summary: 'Get measurement units' })
  async getUnits(@CurrentUser() user: AuthUser) {
    return this.productsService.getUnits(user.businessId);
  }

  @Get('meta/categories')
  @RequirePermissions('product:view')
  @ApiOperation({ summary: 'Get product categories' })
  async getCategories(@CurrentUser() user: AuthUser) {
    return this.productsService.getCategories(user.businessId);
  }

  @Get('meta/tax-rates')
  @RequirePermissions('product:view')
  @ApiOperation({ summary: 'Get GST tax slabs' })
  async getTaxRates(@CurrentUser() user: AuthUser) {
    return this.productsService.getTaxRates(user.businessId);
  }
}
