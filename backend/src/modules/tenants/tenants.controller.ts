import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '@nirvagam/shared';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Tenants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('current')
  @RequirePermissions('settings:view')
  @ApiOperation({ summary: 'Get current tenant organization status, subscription and usage' })
  @ApiResponse({ status: 200, description: 'Tenant details returned' })
  async getCurrent(@CurrentUser() user: AuthUser) {
    return this.tenantsService.getCurrentTenant(user.tenantId);
  }

  @Patch('current')
  @RequirePermissions('settings:edit')
  @ApiOperation({ summary: 'Update tenant organization details' })
  @ApiResponse({ status: 200, description: 'Tenant updated successfully' })
  async updateCurrent(@CurrentUser() user: AuthUser, @Body() dto: UpdateTenantDto) {
    return this.tenantsService.updateTenant(user.tenantId, dto);
  }
}
