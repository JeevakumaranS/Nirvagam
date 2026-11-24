import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser, PaginationParams } from '@nirvagam/shared';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions('user:view')
  @ApiOperation({ summary: 'List all users with pagination and search' })
  @ApiResponse({ status: 200, description: 'Paginated user list' })
  async findAll(@CurrentUser() user: AuthUser, @Query() query: PaginationParams) {
    return this.usersService.findAll(user.tenantId, query);
  }

  @Post()
  @RequirePermissions('user:create')
  @ApiOperation({ summary: 'Create and onboard a new team member' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateUserDto) {
    return this.usersService.create(user.tenantId, user.businessId, dto);
  }

  @Get('hierarchy')
  @RequirePermissions('user:view')
  @ApiOperation({ summary: 'Get branch-based team member hierarchy tree' })
  @ApiResponse({ status: 200, description: 'Hierarchical branch tree with teams, managers, and employees' })
  async getHierarchy(@CurrentUser() user: AuthUser) {
    return this.usersService.getBranchHierarchy(user.tenantId);
  }

  @Get(':id')
  @RequirePermissions('user:view')
  @ApiOperation({ summary: 'Get user details by ID' })
  @ApiResponse({ status: 200, description: 'User details' })
  async findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.usersService.findOne(user.tenantId, id);
  }

  @Put(':id')
  @RequirePermissions('user:edit')
  @ApiOperation({ summary: 'Update user information, roles or branches' })
  @ApiResponse({ status: 200, description: 'User updated' })
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto
  ) {
    return this.usersService.update(user.tenantId, user.businessId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('user:delete')
  @ApiOperation({ summary: 'Deactivate user access' })
  @ApiResponse({ status: 200, description: 'User deactivated' })
  async deactivate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.usersService.deactivate(user.tenantId, id);
  }
}
