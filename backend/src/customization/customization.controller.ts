import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SchemaCustomizationService } from './schema-customization.service';
import { CustomEntityCrudService } from './custom-entity-crud.service';
import { IndustryTemplatesService } from './industry-templates.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantResolverGuard } from '../tenancy/tenant-resolver.guard';
import { TenantContextStorage } from '../tenancy/tenant-context.storage';
import {
  CreateCustomFieldInput,
  CreateCustomEntityInput,
  CustomDatatype,
} from './customization.types';

@ApiTags('Customization Layer')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantResolverGuard)
@Controller('customization')
export class CustomizationController {
  constructor(
    private readonly customization: SchemaCustomizationService,
    private readonly crud: CustomEntityCrudService,
    private readonly templates: IndustryTemplatesService
  ) {}

  // =========================================================================
  // METADATA & SCHEMA MANAGEMENT
  // =========================================================================

  @Get('entities')
  @ApiOperation({ summary: 'List all extensible core tables and custom entities' })
  async listEntities() {
    return await this.customization.listEntities();
  }

  @Get('entities/:key')
  @ApiOperation({ summary: 'Get entity definition, custom fields, and relations' })
  async getEntityMetadata(@Param('key') key: string) {
    return await this.customization.getEntityMetadata(key);
  }

  @Post('entities')
  @ApiOperation({ summary: 'Create new custom table (ct_<slug>) and register in permission matrix' })
  async createCustomEntity(@Body() input: CreateCustomEntityInput) {
    return await this.customization.createCustomEntity(input);
  }

  @Post('entities/:key/archive')
  @ApiOperation({ summary: 'Safely archive custom entity (rename table, hide from UI)' })
  async archiveCustomEntity(@Param('key') key: string) {
    return await this.customization.archiveCustomEntity(key);
  }

  @Post('fields')
  @ApiOperation({ summary: 'Add custom field to core or custom entity (defaults to jsonb)' })
  async createCustomField(@Body() input: CreateCustomFieldInput) {
    return await this.customization.createCustomField(input);
  }

  @Post('fields/promote')
  @ApiOperation({ summary: 'Promote hot JSONB field to typed PostgreSQL column with batch backfill' })
  async promoteFieldToColumn(
    @Body() body: { entityKey: string; fieldKey: string }
  ) {
    return await this.customization.promoteFieldToColumn(body.entityKey, body.fieldKey);
  }

  @Post('fields/datatype/preview')
  @ApiOperation({ summary: 'Dry-run impact analysis before changing datatype' })
  async previewDatatypeChange(
    @Body() body: { entityKey: string; fieldKey: string; targetType: CustomDatatype }
  ) {
    return await this.customization.previewDatatypeChange(
      body.entityKey,
      body.fieldKey,
      body.targetType
    );
  }

  @Post('fields/datatype/apply')
  @ApiOperation({ summary: 'Apply datatype conversion with shadow backup and metadata update' })
  async applyDatatypeChange(
    @Body() body: { entityKey: string; fieldKey: string; targetType: CustomDatatype }
  ) {
    return await this.customization.applyDatatypeChange(
      body.entityKey,
      body.fieldKey,
      body.targetType
    );
  }

  @Get('history')
  @ApiOperation({ summary: 'Audit history of schema changes in this tenant' })
  async getSchemaHistory(@Query('limit') limit?: number) {
    return await this.customization.getSchemaHistory(Number(limit) || 50);
  }

  // =========================================================================
  // DYNAMIC DATA CRUD FOR CUSTOM ENTITIES
  // =========================================================================

  @Get('data/:entityKey')
  @ApiOperation({ summary: 'List custom entity records with pagination, search, and role masking' })
  async listData(
    @Param('entityKey') entityKey: string,
    @Query() query: { page?: number; limit?: number; search?: string; branchId?: string }
  ) {
    return await this.crud.findAll(entityKey, query);
  }

  @Get('data/:entityKey/:id')
  @ApiOperation({ summary: 'Get single custom entity record' })
  async getData(
    @Param('entityKey') entityKey: string,
    @Param('id') id: string
  ) {
    return await this.crud.findOne(entityKey, id);
  }

  @Post('data/:entityKey')
  @ApiOperation({ summary: 'Create custom entity record with metadata validation' })
  async createData(
    @Param('entityKey') entityKey: string,
    @Body() body: { customData: Record<string, any>; branchId?: string }
  ) {
    return await this.crud.create(entityKey, body);
  }

  @Put('data/:entityKey/:id')
  @ApiOperation({ summary: 'Update custom entity record with metadata validation' })
  async updateData(
    @Param('entityKey') entityKey: string,
    @Param('id') id: string,
    @Body() body: { customData: Record<string, any> }
  ) {
    return await this.crud.update(entityKey, id, body);
  }

  @Delete('data/:entityKey/:id')
  @ApiOperation({ summary: 'Soft delete custom entity record' })
  async deleteData(
    @Param('entityKey') entityKey: string,
    @Param('id') id: string
  ) {
    return await this.crud.delete(entityKey, id);
  }

  // =========================================================================
  // INDUSTRY TEMPLATES
  // =========================================================================

  @Get('templates')
  @ApiOperation({ summary: 'List pre-configured industry attribute templates' })
  listTemplates() {
    return this.templates.listTemplates();
  }

  @Post('templates/:code/apply')
  @ApiOperation({ summary: 'Apply industry template attributes to this tenant' })
  async applyTemplate(@Param('code') code: string) {
    const tenantId = TenantContextStorage.get().tenantId;
    return await this.templates.applyTemplateToTenant(tenantId, code);
  }
}
