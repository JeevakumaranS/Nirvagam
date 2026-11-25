import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantResolverGuard } from '../../tenancy/tenant-resolver.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser, UserRoleName } from '@nirvagam/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';

@ApiTags('Roles & Permissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantResolverGuard)
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @ApiOperation({ summary: 'List all available roles and mapped permissions' })
  @ApiResponse({ status: 200, description: 'List of roles' })
  async findAll(@CurrentUser() user: AuthUser) {
    return this.rolesService.findAll(user.businessId);
  }

  @Get('permissions')
  @ApiOperation({ summary: 'List all granular system permissions grouped by resource' })
  @ApiResponse({ status: 200, description: 'Grouped permissions dictionary' })
  async getAllPermissions() {
    return this.rolesService.getAllPermissions();
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRoleName.BUSINESS_OWNER, UserRoleName.BUSINESS_ADMIN)
  @ApiOperation({ summary: 'Create a custom role for the current business' })
  @ApiResponse({ status: 201, description: 'Custom role created' })
  async createRole(@CurrentUser() user: AuthUser, @Body() dto: CreateRoleDto) {
    return this.rolesService.createBusinessRole(user.businessId, dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRoleName.BUSINESS_OWNER, UserRoleName.BUSINESS_ADMIN)
  @ApiOperation({ summary: 'Update a predefined or custom role' })
  @ApiResponse({ status: 200, description: 'Role updated' })
  async updateRole(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto
  ) {
    return this.rolesService.updateRole(id, user.businessId, dto);
  }

  @Put(':id/permissions')
  @UseGuards(RolesGuard)
  @Roles(UserRoleName.BUSINESS_OWNER, UserRoleName.BUSINESS_ADMIN)
  @ApiOperation({
    summary: 'Replace permissions for a predefined or custom role',
    description: 'Changes to predefined roles apply to every tenant using that role.',
  })
  @ApiResponse({ status: 200, description: 'Role permissions updated' })
  async updatePermissions(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRolePermissionsDto
  ) {
    return this.rolesService.updateRolePermissions(id, user.businessId, dto.permissionIds);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRoleName.BUSINESS_OWNER, UserRoleName.BUSINESS_ADMIN)
  @ApiOperation({
    summary: 'Delete a predefined or custom role',
    description: 'Predefined role deletion affects all tenants and is blocked while assigned to any user.',
  })
  @ApiResponse({ status: 200, description: 'Role deleted' })
  async deleteRole(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.rolesService.deleteRole(id, user.businessId);
  }
}
