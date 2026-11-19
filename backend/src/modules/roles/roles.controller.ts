import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '@nirvagam/shared';

@ApiTags('Roles & Permissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
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
}
