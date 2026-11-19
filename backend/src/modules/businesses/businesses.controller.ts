import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { BusinessesService } from './businesses.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { CreateBranchDto } from './dto/create-branch.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '@nirvagam/shared';

@ApiTags('Businesses & Branches')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('businesses')
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @Get()
  @ApiOperation({ summary: 'List all businesses belonging to current tenant' })
  @ApiResponse({ status: 200, description: 'List of businesses' })
  async findAll(@CurrentUser() user: AuthUser) {
    return this.businessesService.findAll(user.tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new business legal entity' })
  @ApiResponse({ status: 201, description: 'Business created' })
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateBusinessDto) {
    return this.businessesService.create(user.tenantId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get business details by ID' })
  @ApiResponse({ status: 200, description: 'Business details' })
  async findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.businessesService.findOne(user.tenantId, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update business details' })
  @ApiResponse({ status: 200, description: 'Business updated' })
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateBusinessDto
  ) {
    return this.businessesService.update(user.tenantId, id, dto);
  }

  @Get(':id/branches')
  @ApiOperation({ summary: 'List all branches for a business' })
  @ApiResponse({ status: 200, description: 'List of branches' })
  async findBranches(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.businessesService.findBranches(user.tenantId, id);
  }

  @Post(':id/branches')
  @ApiOperation({ summary: 'Create a new branch for a business' })
  @ApiResponse({ status: 201, description: 'Branch created' })
  async createBranch(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateBranchDto
  ) {
    return this.businessesService.createBranch(user.tenantId, id, dto);
  }
}
