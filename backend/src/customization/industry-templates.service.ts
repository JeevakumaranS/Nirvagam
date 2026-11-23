import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SchemaCustomizationService } from './schema-customization.service';
import { TenantDatabaseService } from '../tenancy/tenant-database.service';
import { TenantCacheService } from '../tenancy/tenant-cache.service';
import { TenantContext } from '../tenancy/tenancy.types';
import { CreateCustomFieldInput } from './customization.types';

export interface IndustryTemplate {
  code: string;
  name: string;
  description: string;
  targetEntity: string;
  fields: CreateCustomFieldInput[];
}

@Injectable()
export class IndustryTemplatesService {
  private readonly logger = new Logger(IndustryTemplatesService.name);

  constructor(
    private readonly customization: SchemaCustomizationService,
    private readonly tenantDb: TenantDatabaseService,
    private readonly cache: TenantCacheService
  ) {}

  private readonly templates: Record<string, IndustryTemplate> = {
    textiles: {
      code: 'textiles',
      name: 'Textiles & Garment Manufacturing',
      description: 'Standard Indian textile attributes: GSM, Weave, Yarn Count, Dye Lot, Loom',
      targetEntity: 'items',
      fields: [
        {
          entityKey: 'items',
          fieldKey: 'cf_fabric_gsm',
          label: 'Fabric GSM',
          datatype: 'integer',
          storage: 'jsonb',
          validation: { min: 10, max: 1000 },
          showInList: true,
        },
        {
          entityKey: 'items',
          fieldKey: 'cf_yarn_count',
          label: 'Yarn Count (e.g. 40s, 60s)',
          datatype: 'text',
          storage: 'jsonb',
          validation: { maxLength: 30 },
          showInList: true,
        },
        {
          entityKey: 'items',
          fieldKey: 'cf_weave_type',
          label: 'Weave Type',
          datatype: 'select',
          storage: 'jsonb',
          validation: { options: ['Plain', 'Twill', 'Satin', 'Dobby', 'Jacquard', 'Knitted'] },
          showInList: true,
        },
        {
          entityKey: 'items',
          fieldKey: 'cf_dye_lot_number',
          label: 'Dye Lot Number',
          datatype: 'text',
          storage: 'jsonb',
          validation: { maxLength: 50 },
          showInList: false,
        },
      ],
    },
    pharma: {
      code: 'pharma',
      name: 'Pharmaceuticals & Health',
      description: 'Compliant drug and healthcare attributes: Batch, Expiry, Schedule Drug',
      targetEntity: 'items',
      fields: [
        {
          entityKey: 'items',
          fieldKey: 'cf_batch_number',
          label: 'Batch Number',
          datatype: 'text',
          storage: 'column',
          required: true,
          validation: { maxLength: 50 },
          showInList: true,
        },
        {
          entityKey: 'items',
          fieldKey: 'cf_expiry_date',
          label: 'Expiry Date',
          datatype: 'date',
          storage: 'column',
          required: true,
          showInList: true,
        },
        {
          entityKey: 'items',
          fieldKey: 'cf_is_schedule_h',
          label: 'Schedule H / Prescription Drug',
          datatype: 'boolean',
          storage: 'jsonb',
          defaultValue: 'false',
          showInList: true,
        },
        {
          entityKey: 'items',
          fieldKey: 'cf_drug_composition',
          label: 'Active Pharmaceutical Ingredients (API)',
          datatype: 'long_text',
          storage: 'jsonb',
          showInList: false,
        },
      ],
    },
    retail: {
      code: 'retail',
      name: 'Modern Retail & Apparel',
      description: 'Consumer retail attributes: Brand, Size, Color, Shelf Location',
      targetEntity: 'items',
      fields: [
        {
          entityKey: 'items',
          fieldKey: 'cf_brand_name',
          label: 'Brand Name',
          datatype: 'text',
          storage: 'jsonb',
          validation: { maxLength: 100 },
          showInList: true,
        },
        {
          entityKey: 'items',
          fieldKey: 'cf_item_size',
          label: 'Size',
          datatype: 'select',
          storage: 'jsonb',
          validation: { options: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free Size'] },
          showInList: true,
        },
        {
          entityKey: 'items',
          fieldKey: 'cf_item_color',
          label: 'Color',
          datatype: 'text',
          storage: 'jsonb',
          validation: { maxLength: 50 },
          showInList: true,
        },
        {
          entityKey: 'items',
          fieldKey: 'cf_shelf_location',
          label: 'Aisle / Shelf Location',
          datatype: 'text',
          storage: 'jsonb',
          validation: { maxLength: 30 },
          showInList: false,
        },
      ],
    },
    wholesale: {
      code: 'wholesale',
      name: 'B2B Wholesale & Logistics',
      description: 'E-Way Bill, Transporter ID, Vehicle Number, Delivery Route',
      targetEntity: 'sales_invoices',
      fields: [
        {
          entityKey: 'sales_invoices',
          fieldKey: 'cf_transporter_id',
          label: 'Transporter GSTIN / ID',
          datatype: 'text',
          storage: 'jsonb',
          validation: { maxLength: 15 },
          showInList: true,
        },
        {
          entityKey: 'sales_invoices',
          fieldKey: 'cf_vehicle_number',
          label: 'Vehicle Reg Number',
          datatype: 'text',
          storage: 'jsonb',
          validation: { maxLength: 20 },
          showInList: true,
        },
        {
          entityKey: 'sales_invoices',
          fieldKey: 'cf_eway_bill_number',
          label: 'E-Way Bill Number',
          datatype: 'text',
          storage: 'jsonb',
          validation: { maxLength: 12 },
          showInList: true,
        },
      ],
    },
  };

  listTemplates(): IndustryTemplate[] {
    return Object.values(this.templates);
  }

  getTemplate(code: string): IndustryTemplate | null {
    return this.templates[code.toLowerCase()] || null;
  }

  /**
   * Applies an industry field template to a tenant workspace
   */
  async applyTemplateToTenant(tenantId: string, templateCode: string): Promise<any> {
    const template = this.getTemplate(templateCode);
    if (!template) {
      throw new BadRequestException(`Industry template "${templateCode}" does not exist.`);
    }

    const tenant = await this.cache.getTenant(tenantId) || await this.tenantDb.withPlatform(async (tx) => {
      return tx.queryOne(
        `SELECT id, slug, display_name, schema_name, status FROM platform.tenants WHERE id::text = $1 OR slug = $1 LIMIT 1;`,
        [tenantId]
      );
    });

    if (!tenant) {
      throw new BadRequestException(`Tenant [${tenantId}] not found.`);
    }

    const rawTenant = tenant as any;
    const tenantCtx: TenantContext = {
      tenantId: rawTenant.id,
      schemaName: rawTenant.schemaName || rawTenant.schema_name,
      slug: rawTenant.slug,
      displayName: rawTenant.displayName || rawTenant.display_name,
      status: rawTenant.status,
      roleKeys: ['SUPER_ADMIN'],
      branchIds: [],
      planLimits: { maxBranches: 1, maxUsers: 5, maxInvoicesPerMonth: 500, featureFlags: {} },
    };

    const results: any[] = [];
    await this.tenantDb.withTenant(tenantCtx, async () => {
      for (const field of template.fields) {
        try {
          const res = await this.customization.createCustomField(field);
          results.push({ fieldKey: field.fieldKey, status: 'CREATED', res });
        } catch (err: any) {
          results.push({ fieldKey: field.fieldKey, status: 'SKIPPED', reason: err.message });
        }
      }
    });

    return {
      template: template.name,
      tenantId: tenant.id,
      slug: tenant.slug,
      results,
    };
  }
}
