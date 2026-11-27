import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductsService } from '../products/products.service';
import { AuthUser } from '@nirvagam/shared';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { INVENTORY_CATALOG_FIELDS, INVENTORY_MOVEMENT_FIELDS, INVENTORY_PRODUCT_FIELDS, INVENTORY_STANDARD_TEMPLATE_FIELDS, INVENTORY_TRANSFER_FIELDS, INVENTORY_VARIANT_FLAT_TEMPLATE_FIELDS, INVENTORY_VARIANT_FIELDS, INVENTORY_VARIANT_PRODUCT_FIELDS, INVENTORY_VARIANT_TEMPLATE_FIELDS, ImportExportRegistry, ImportFieldDefinition } from './import-export.registry';

type Row = { [key: string]: any; __row: number; __sheet?: string };
type UploadedImportFile = { originalname: string; size: number; buffer: Buffer };

function attributePairHeaders(count = 10) {
  return Array.from({ length: count }, (_, index) => [`Attribute ${index + 1} Name`, `Attribute ${index + 1} Value`]).flat();
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const headerFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: '1F4E78' } };
const requiredFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'D9EAF7' } };

function styleEntrySheet(sheet: ExcelJS.Worksheet, fields: ImportFieldDefinition[]) {
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + Math.min(fields.length, 26))}1` };
  sheet.getRow(1).height = 28;
  fields.forEach((field, index) => {
    const cell = sheet.getCell(1, index + 1);
    cell.value = `${field.header}${field.required ? ' *' : ''}`;
    cell.font = { bold: true, color: { argb: 'FFFFFF' } };
    cell.fill = headerFill;
    cell.alignment = { vertical: 'middle', wrapText: true };
    cell.border = { bottom: { style: 'thin', color: { argb: 'D9E2F3' } } };
    sheet.getColumn(index + 1).width = Math.max(16, Math.min(34, field.header.length + 7));
    if (field.type === 'number') sheet.getColumn(index + 1).numFmt = '#,##0.000';
    if (field.type === 'text') sheet.getColumn(index + 1).numFmt = '@';
    if (field.required) sheet.getColumn(index + 1).fill = requiredFill;
  });
}

function addListValidation(sheet: ExcelJS.Worksheet, column: number, range: string) {
  if (column > 0 && range) (sheet as any).dataValidations.add(`${sheet.getColumn(column).letter}2:${sheet.getColumn(column).letter}1000`, { type: 'list', allowBlank: true, formulae: [range], showErrorMessage: true });
}

async function formattedWorkbook(input: { references: Record<string, string[]>; examples: Record<string, unknown[][]>; productFields: ImportFieldDefinition[]; variantFields: ImportFieldDefinition[] }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Nirvagam'; workbook.created = new Date();
  const instructions = workbook.addWorksheet('Instructions');
  instructions.columns = [{ width: 24 }, { width: 100 }];
  instructions.addRow(['Nirvagam Inventory Catalog Template', 'Version 2']);
  instructions.addRow(['How to use', 'Fill only the Products and Variants sheets. Do not add stock quantities to catalog updates unless creating opening stock for a new product.']);
  instructions.addRow(['Required fields', 'Headers marked with * are required. Blue cells indicate required entry fields.']);
  instructions.addRow(['Variants', 'Enter one product row in Products and one or more rows in Variants using the parent Product SKU. Enter dynamic attributes as name/value pairs; do not write JSON. HSN is entered once on the parent product and inherited by every variant.']);
  instructions.addRow(['Barcodes', 'Standard products use Product Barcode. Variant-enabled products leave the parent barcode blank and enter each barcode on its Variant row.']);
  instructions.addRow(['References', 'Use the exact active values listed in Reference Data. Unknown categories, brands, units, GST rates and branches are rejected.']);
  instructions.addRow(['Leading zeros', 'SKU, barcode and HSN columns are stored as text. Do not prepend an apostrophe.']);
  instructions.getRow(1).font = { bold: true, size: 15, color: { argb: 'FFFFFF' } }; instructions.getRow(1).fill = headerFill;
  instructions.getColumn(1).font = { bold: true }; instructions.eachRow((row) => { row.alignment = { wrapText: true, vertical: 'top' }; row.height = 32; });

  const products = workbook.addWorksheet('Products'); styleEntrySheet(products, input.productFields);
  const variants = input.variantFields.length ? workbook.addWorksheet('Variants') : null;
  if (variants) styleEntrySheet(variants, input.variantFields);
  const examples = workbook.addWorksheet('Examples');
  examples.addRow(['Products and Variants examples — remove these rows; they are never imported']);
  examples.addRow(['Products']); examples.addRows(input.examples.Products);
  if (input.variantFields.length) { examples.addRow([]); examples.addRow(['Variants']); examples.addRows(input.examples.Variants); }
  examples.getRow(1).font = { bold: true, color: { argb: '9C0006' } }; examples.getColumn(1).width = 48; examples.eachRow((row) => { row.alignment = { wrapText: true }; });

  const reference = workbook.addWorksheet('Reference Data');
  const referenceColumns = Object.keys(input.references);
  reference.addRow(referenceColumns); reference.addRow(referenceColumns.map(() => '')); 
  const maxLength = Math.max(...referenceColumns.map((key) => input.references[key].length));
  for (let i = 0; i < maxLength; i++) reference.addRow(referenceColumns.map((key) => input.references[key][i] || ''));
  reference.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } }; reference.getRow(1).fill = headerFill; reference.views = [{ state: 'frozen', ySplit: 1 }];
  referenceColumns.forEach((key, index) => { reference.getColumn(index + 1).width = Math.max(18, key.length + 5); });

  const refColumn = (key: string) => {
    const index = referenceColumns.indexOf(key) + 1;
    return index > 0 ? `'Reference Data'!$${String.fromCharCode(64 + index)}$3:$${String.fromCharCode(64 + index)}$${Math.max(3, maxLength + 2)}` : '';
  };
  const productHeader = input.productFields.map((field) => field.header);
  addListValidation(products, productHeader.indexOf('Category') + 1, refColumn('Categories'));
  addListValidation(products, productHeader.indexOf('Brand') + 1, refColumn('Brands'));
  addListValidation(products, productHeader.indexOf('Unit') + 1, refColumn('Units'));
  addListValidation(products, productHeader.indexOf('GST Rate') + 1, refColumn('GST Rates'));
  addListValidation(products, productHeader.indexOf('GST Inclusive') + 1, '"TRUE,FALSE"');
  addListValidation(products, productHeader.indexOf('Has Variants') + 1, '"TRUE,FALSE"');
  addListValidation(products, productHeader.indexOf('Opening Stock Branch Code') + 1, refColumn('Branches'));
  if (variants) {
    const variantHeader = input.variantFields.map((field) => field.header);
    addListValidation(variants, variantHeader.indexOf('GST Rate') + 1, refColumn('GST Rates'));
    addListValidation(variants, variantHeader.indexOf('GST Inclusive') + 1, '"TRUE,FALSE"');
  }
  products.views = [{ state: 'frozen', ySplit: 1, activeCell: 'A2' }];
  workbook.views = [{ x: 0, y: 0, width: 1200, height: 800, firstSheet: 1, activeTab: 1, visibility: 'visible' }];
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function workbookBuffer(sheets: Record<string, unknown[][]>) {
  const workbook = new ExcelJS.Workbook();
  for (const [name, rows] of Object.entries(sheets)) {
    const sheet = workbook.addWorksheet(name);
    rows.forEach((row) => sheet.addRow(row));
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + Math.min((rows[0] || []).length, 26))}1` };
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    sheet.getRow(1).fill = headerFill;
    sheet.columns.forEach((column) => { column.width = 20; });
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

@Injectable()
export class ImportExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly products: ProductsService,
    private readonly registry: ImportExportRegistry,
  ) {
    registry.register({ operation: 'catalog', label: 'Inventory catalog', fields: INVENTORY_CATALOG_FIELDS });
    registry.register({ operation: 'movements', label: 'Bulk stock movements', fields: INVENTORY_MOVEMENT_FIELDS });
    registry.register({ operation: 'transfers', label: 'Branch transfers', fields: INVENTORY_TRANSFER_FIELDS });
  }

  adapters() { return this.registry.list(); }

  async template(user: AuthUser, operation: string, templateType = 'mixed') {
    const adapter = this.registry.get(operation);
    if (!adapter) throw new NotFoundException('Import template not found');
    const fields = operation === 'catalog' ? this.catalogTemplateFields(templateType) : adapter.fields;
    if (operation === 'catalog') return this.catalogWorkbook(user, templateType);
    const headers = operation === 'catalog' ? [...fields.map((field) => field.header), ...attributePairHeaders()] : fields.map((field) => field.header);
    const example = Object.fromEntries(fields.map((field) => [field.header, field.required ? `EXAMPLE_${field.key}` : '']));
    const body = await formattedWorkbook({ references: { Categories: [], Brands: [], Units: [], 'GST Rates': [], Branches: [] }, examples: { Products: [headers, headers.map((header) => example[header])], Variants: [] }, productFields: fields, variantFields: [] });
    return { fileName: `nirvagam-${operation}-template-v2.xlsx`, contentType: XLSX_MIME, body };
  }

  private catalogTemplateFields(templateType: string) {
    if (templateType === 'standard') return INVENTORY_STANDARD_TEMPLATE_FIELDS;
    if (templateType === 'variants') return INVENTORY_VARIANT_FLAT_TEMPLATE_FIELDS;
    return INVENTORY_CATALOG_FIELDS;
  }

  private async catalogWorkbook(user: AuthUser, templateType = 'mixed') {
    // Some existing tenant schemas predate the optional is_active columns on
    // categories, brands, and units. Detect those columns instead of making
    // template download depend on every tenant having the latest schema.
    const activeColumns = await this.prisma.$queryRaw<Array<{ tableName: string; columnName: string }>>(Prisma.sql`
      SELECT table_name AS "tableName", column_name AS "columnName"
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name IN ('categories', 'brands', 'units', 'tax_rates', 'branches')
        AND column_name = 'is_active'
    `);
    const hasActive = (tableName: string) => activeColumns.some((column) => column.tableName === tableName && column.columnName === 'is_active');
    const [categories, brands, units, taxes, branches] = await Promise.all([
      this.prisma.category.findMany({ where: { businessId: user.businessId, ...(hasActive('categories') ? { isActive: true } : {}) }, select: { name: true }, orderBy: { name: 'asc' } }),
      this.prisma.brand.findMany({ where: { businessId: user.businessId, ...(hasActive('brands') ? { isActive: true } : {}) }, select: { name: true }, orderBy: { name: 'asc' } }),
      this.prisma.unit.findMany({ where: { businessId: user.businessId, ...(hasActive('units') ? { isActive: true } : {}) }, select: { name: true, symbol: true, isDefault: true }, orderBy: { symbol: 'asc' } }),
      this.prisma.taxRate.findMany({ where: { businessId: user.businessId, ...(hasActive('tax_rates') ? { isActive: true } : {}) }, select: { rate: true, isDefault: true }, orderBy: { rate: 'asc' } }),
      this.prisma.branch.findMany({ where: { businessId: user.businessId, ...(hasActive('branches') ? { isActive: true } : {}) }, select: { code: true }, orderBy: { code: 'asc' } }),
    ]);
    const variantExample = (sku: string, variantSku: string, colour: string, size: string) => [sku, variantSku, '', 450, 999, 899, 2, Number(taxes[0]?.rate || 0), 'FALSE', 'Colour', colour, 'Size', size, '', ''];
    const productFields = templateType === 'standard' ? INVENTORY_STANDARD_TEMPLATE_FIELDS : templateType === 'variants' ? INVENTORY_VARIANT_PRODUCT_FIELDS : INVENTORY_PRODUCT_FIELDS;
    const variantFields = templateType === 'standard' ? [] : INVENTORY_VARIANT_TEMPLATE_FIELDS;
    const productExampleValues: Record<string, unknown> = {
      'Product Name': 'Cotton Shirt', 'Product SKU': 'EX-SHIRT-001', 'Product Barcode': '890000000001',
      'HSN Code': '6205', Description: 'Example product', Category: categories[0]?.name || 'Apparel', Brand: brands[0]?.name || '', Unit: units[0]?.symbol || '', 'GST Rate': Number(taxes[0]?.rate || 0), 'GST Inclusive': 'FALSE', 'Has Variants': 'FALSE', 'Purchase Price': 450, MRP: 999, 'Retail Price': 899, 'Minimum Stock Level': 5, 'Opening Stock': '', 'Opening Stock Branch Code': '',
    };
    const productExample = productFields.map((field) => productExampleValues[field.header] ?? '');
    const body = await formattedWorkbook({
      references: { Categories: categories.map((row) => row.name), Brands: brands.map((row) => row.name), Units: units.map((row) => row.symbol), 'GST Rates': taxes.map((row) => String(row.rate)), Branches: branches.map((row) => row.code) },
      examples: { Products: [productFields.map((field) => field.header), productExample], Variants: [INVENTORY_VARIANT_TEMPLATE_FIELDS.map((field) => field.header), variantExample('EX-SHOE-001', 'EX-SHOE-RED-08', 'Red', '8'), variantExample('EX-SHOE-001', 'EX-SHOE-BLU-09', 'Blue', '9')] },
      productFields,
      variantFields,
    });
    return { fileName: 'nirvagam-inventory-catalog-template-v2.xlsx', contentType: XLSX_MIME, body };
  }

  async validate(user: AuthUser, operation: string, file: UploadedImportFile, templateType = 'mixed') {
    const adapter = this.registry.get(operation);
    if (!adapter) throw new NotFoundException('Unsupported import operation');
    if (!file.originalname.toLowerCase().endsWith('.xlsx') || file.size > 10 * 1024 * 1024) throw new BadRequestException('Only Excel (.xlsx) files up to 10 MB are accepted');
    const parsed: Row[] = this.parseWorkbook(file.buffer);
    if (parsed.length > 50000) throw new BadRequestException('The maximum supported file size is 50,000 rows');
    const headerMap = new Map(adapter.fields.map((field) => [field.header.toLowerCase(), field.key]));
    const rows = parsed.map((source, index) => {
      const row: Row = { __row: source.__row || index + 2, __sheet: source.__sheet, __kind: source.__kind };
      for (const [header, value] of Object.entries(source)) {
        if (header.startsWith('__')) continue;
        row[headerMap.get(header.toLowerCase()) || header] = value;
      }
      if (operation === 'catalog') this.normalizeCatalogRow(row);
      return row;
    });
    const errors: any[] = [];
    for (const row of rows) {
      if (row.__kind === 'example' || /^(example|instructions)$/i.test(String(row['Record Type'] || ''))) {
        errors.push({ row: row.__row, field: 'Record Type', message: 'Remove template instruction/example rows before importing' });
        continue;
      }
      for (const field of adapter.fields) {
        const value = row[field.key];
        const variantRow = operation === 'catalog' && row.__kind === 'variant';
        if (field.required && !value && (!variantRow || ['sku', 'variantSku'].includes(field.key))) errors.push({ row: row.__row, field: field.key, message: `${field.header} is required` });
        if (value && field.type === 'number' && !Number.isFinite(Number(value))) errors.push({ row: row.__row, field: field.key, message: `${field.header} must be numeric` });
        if (value && field.type === 'json') { try { JSON.parse(value); } catch { errors.push({ row: row.__row, field: field.key, message: `${field.header} must be valid JSON` }); } }
      }
      if (operation === 'catalog' && row.variantSku && !row.name && !row.sku) errors.push({ row: row.__row, field: 'sku', message: 'Variant rows must include the parent product SKU' });
      if (operation === 'catalog' && row.__attributeError) errors.push({ row: row.__row, field: 'attributes', message: row.__attributeError });
      if (operation === 'catalog' && row.variantSku && row.barcode) errors.push({ row: row.__row, field: 'Product Barcode', message: 'Variant rows use Variant Barcode; parent products do not have a barcode' });
      if (operation === 'catalog' && templateType === 'standard' && (row.variantSku || row.variantBarcode)) errors.push({ row: row.__row, field: 'Variant SKU', message: 'Variant fields are not valid in the Standard Products template' });
      if (operation === 'catalog' && templateType === 'variants' && !row.variantSku) errors.push({ row: row.__row, field: 'Variant SKU', message: 'Variant SKU is required in the Products with Variants template' });
      if (operation === 'movements' && row.type && !['IN', 'OUT'].includes(row.type.toUpperCase())) errors.push({ row: row.__row, field: 'type', message: 'Type must be IN or OUT' });
    }
    const errorsWithSheet = errors.map((error) => ({ ...error, sheet: parsed[error.row - 2]?.__sheet }));
    const baseIdempotencyKey = createHash('sha256').update(`${user.businessId}:${file.originalname}:${file.size}:`).update(file.buffer).digest('hex');
    const legacyIdempotencyKey = createHash('sha256').update(`${user.businessId}:${file.originalname}:${file.size}:${file.buffer.subarray(0, 1024).toString('hex')}`).digest('hex');
    const existing = await this.prisma.importExportJob.findFirst({ where: { OR: [{ idempotencyKey: baseIdempotencyKey }, { idempotencyKey: legacyIdempotencyKey }] } });
    if (existing && !['FAILED', 'PARTIAL', 'CANCELLED'].includes(existing.status)) {
      const existingValidation = (existing.validation || {}) as any;
      const existingErrors = existingValidation.errors || [];
      return {
        id: existing.id,
        status: existing.status,
        alreadyProcessed: true,
        totalRows: existing.totalRows,
        validRows: existing.totalRows - new Set(existingErrors.map((error: any) => error.row)).size,
        errors: existingErrors,
        preview: existingValidation.rows?.slice(0, 100) || [],
      };
    }
    const idempotencyKey = existing ? `${baseIdempotencyKey}:retry:${Date.now()}` : baseIdempotencyKey;
    let job: any;
    try {
      job = await this.prisma.importExportJob.create({ data: { businessId: user.businessId, createdById: user.id, kind: 'IMPORT', operation, format: 'xlsx', status: 'READY', fileName: file.originalname, totalRows: rows.length, validation: { rows, errors: errorsWithSheet, version: 2 }, idempotencyKey } } as any);
    } catch (error: any) {
      if (error?.code !== 'P2002') throw error;
      const duplicate = await this.prisma.importExportJob.findUnique({ where: { idempotencyKey } });
      if (!duplicate) throw error;
      const duplicateValidation = (duplicate.validation || {}) as any;
      const duplicateErrors = duplicateValidation.errors || [];
      return { id: duplicate.id, status: duplicate.status, alreadyProcessed: true, totalRows: duplicate.totalRows, validRows: duplicate.totalRows - new Set(duplicateErrors.map((item: any) => item.row)).size, errors: duplicateErrors, preview: duplicateValidation.rows?.slice(0, 100) || [] };
    }
    return { id: job.id, status: job.status, totalRows: rows.length, validRows: rows.length - new Set(errorsWithSheet.map((error) => error.row)).size, errors: errorsWithSheet, preview: rows.slice(0, 100) };
  }

  private parseWorkbook(buffer: Buffer): Row[] {
    let workbook: XLSX.WorkBook;
    try { workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false, raw: false, sheetRows: 50002 }); }
    catch { throw new BadRequestException('The workbook is malformed or unreadable'); }
    const names = workbook.SheetNames.filter((name) => !['instructions', 'reference data', 'examples'].includes(name.toLowerCase()));
    if (!names.length) throw new BadRequestException('The workbook has no readable data worksheet');
    const rows: Row[] = [];
    for (const sheetName of names) {
      const values = XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[sheetName], { header: 1, defval: '', raw: false });
      if (!values.length) continue;
      const headers = values[0].map((value) => String(value).trim().replace(/\s+\*$/, ''));
      values.slice(1).filter((values) => values.some((value) => String(value).trim() !== '')).forEach((values, index) => rows.push({ __row: index + 2, __sheet: sheetName, __kind: sheetName.toLowerCase() === 'variants' ? 'variant' : 'product', ...Object.fromEntries(headers.map((header, i) => [header, String(values[i] ?? '').trim()])) }));
    }
    return rows;
  }

  private normalizeCatalogRow(row: Row) {
    if (row.__kind === 'variant') {
      row.sku = row.sku || row['Parent Product SKU'];
      row.hasVariants = 'TRUE';
      row.variantSku = row.variantSku || row['Variant SKU'];
    }
    const attributes: Record<string, string> = {};
    for (let index = 1; index <= 20; index++) {
      const name = String(row[`attribute${index}Name`] || row[`Attribute ${index} Name`] || '').trim();
      const value = String(row[`attribute${index}Value`] || row[`Attribute ${index} Value`] || '').trim();
      if (name && value) attributes[name] = value;
      if (name && !value) row.__attributeError = `Attribute ${index} Value is required when its name is supplied`;
    }
    if (Object.keys(attributes).length) row.variantAttributes = JSON.stringify(attributes);
  }

  async confirm(user: AuthUser, id: string, body: { mode?: string; allowPartial?: boolean }) {
    const job = await this.ownedJob(user, id);
    if (job.status !== 'READY') throw new BadRequestException(`Job cannot be confirmed from ${job.status}`);
    if (job.kind !== 'IMPORT') throw new BadRequestException('Only imports can be confirmed');
    if (job.operation !== 'catalog' && !user.permissions.includes('inventory:edit') && !user.roles.includes('SUPER_ADMIN')) throw new ForbiddenException('Inventory permission is required for stock imports');
    const mode = body.mode || 'CREATE_OR_UPDATE';
    if (!['CREATE_ONLY', 'UPDATE_ONLY', 'CREATE_OR_UPDATE'].includes(mode)) throw new BadRequestException('Invalid import mode');
    const errors = ((job.validation as any)?.errors || []) as any[];
    if (errors.length && !body.allowPartial) throw new BadRequestException('Correct validation errors or explicitly allow partial processing');
    const queued = await this.prisma.importExportJob.update({ where: { id }, data: { mode, status: 'QUEUED' } });
    setImmediate(() => this.process(user, queued.id).catch(() => undefined));
    return { id: queued.id, status: queued.status };
  }

  async cancel(user: AuthUser, id: string) {
    const job = await this.ownedJob(user, id);
    if (['COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED'].includes(job.status)) return job;
    return this.prisma.importExportJob.update({ where: { id }, data: { status: 'CANCELLED' } });
  }

  async retry(user: AuthUser, id: string) {
    const job = await this.ownedJob(user, id);
    if (!['FAILED', 'PARTIAL'].includes(job.status)) throw new BadRequestException('Only failed or partially completed jobs can be retried');
    const queued = await this.prisma.importExportJob.update({ where: { id }, data: { status: 'QUEUED', errorMessage: null } });
    setImmediate(() => this.process(user, queued.id).catch(() => undefined));
    return { id: queued.id, status: queued.status };
  }

  async jobs(user: AuthUser, page: number, limit: number) {
    const take = Math.min(100, Math.max(1, limit));
    const [data, total] = await Promise.all([
      this.prisma.importExportJob.findMany({ where: { businessId: user.businessId }, orderBy: { createdAt: 'desc' }, skip: (Math.max(1, page) - 1) * take, take }),
      this.prisma.importExportJob.count({ where: { businessId: user.businessId } }),
    ]);
    return { data, meta: { page, limit: take, total, totalPages: Math.ceil(total / take) } };
  }

  async job(user: AuthUser, id: string) { return this.ownedJob(user, id); }

  async errorReport(user: AuthUser, id: string) {
    const job = await this.ownedJob(user, id);
    const errors = ((job.result as any)?.errors || (job.validation as any)?.errors || []) as any[];
    return workbookBuffer({ Errors: [['Row', 'Field', 'Message', 'Status'], ...errors.map((error) => [error.row ?? '', error.field ?? '', error.message ?? '', error.status ?? ''])] });
  }

  private async ownedJob(user: AuthUser, id: string) {
    const job = await this.prisma.importExportJob.findFirst({ where: { id, businessId: user.businessId, createdById: user.id } });
    if (!job) throw new NotFoundException('Import/export job not found');
    return job;
  }

  private async process(user: AuthUser, id: string) {
    const job = await this.ownedJob(user, id);
    const validation = (job.validation || {}) as any;
    const errors: any[] = [...(validation.errors || [])];
    const invalid = new Set(errors.map((error) => error.row));
    let success = 0, skipped = 0, failed = 0;
    await this.prisma.importExportJob.update({ where: { id }, data: { status: 'PROCESSING', startedAt: new Date() } });
    const rows = (validation.rows || []) as Row[];
    try {
      const groups = new Map<string, Row[]>();
      for (const row of rows) if (!invalid.has(row.__row)) groups.set(row.sku || row.variantSku || '', [...(groups.get(row.sku || row.variantSku || '') || []), row]);
      if (job.operation === 'movements' || job.operation === 'transfers') {
        for (const row of rows) {
          if (invalid.has(row.__row)) continue;
          try {
            const variant = await this.prisma.productVariant.findFirst({ where: { sku: row.variantSku, product: { businessId: user.businessId }, isActive: true } });
            if (!variant) throw new BadRequestException(`Variant SKU "${row.variantSku}" was not found`);
            const branch = async (code: string) => {
              const result = await this.prisma.branch.findFirst({ where: { businessId: user.businessId, code, isActive: true } });
              if (!result) throw new BadRequestException(`Branch code "${code}" was not found`);
              return result;
            };
            const key = `import:${id}:${row.__row}`;
            if (job.operation === 'movements') {
              const target = await branch(row.branchCode);
              await this.products.stockOperation(user.businessId, user.id, { variantId: variant.id, branchId: target.id, type: row.type.toUpperCase(), quantity: Number(row.quantity), unitCost: Number(row.unitCost || 0), reason: row.reason || 'Bulk stock import', reference: row.reference, idempotencyKey: key });
            } else {
              const from = await branch(row.fromBranchCode), to = await branch(row.toBranchCode);
              await this.products.transfer(user.businessId, user.id, { variantId: variant.id, fromBranchId: from.id, toBranchId: to.id, quantity: Number(row.quantity), reason: row.reference || 'Bulk branch transfer', idempotencyKey: key });
            }
            success++;
          } catch (error: any) { errors.push({ row: row.__row, field: 'record', message: error.message, status: 'failed' }); failed++; }
          await this.prisma.importExportJob.update({ where: { id }, data: { processedRows: success + failed + invalid.size, successRows: success, failedRows: failed + invalid.size } });
        }
        const status = failed || invalid.size ? (success ? 'PARTIAL' : 'FAILED') : 'COMPLETED';
        return this.prisma.importExportJob.update({ where: { id }, data: { status: status as any, processedRows: rows.length, successRows: success, failedRows: failed + invalid.size, result: { errors }, completedAt: new Date() } });
      }
      for (const group of groups.values()) {
        const current = await this.prisma.product.findFirst({ where: { businessId: user.businessId, sku: group[0].sku }, select: { id: true, hasVariants: true } });
        const mode = job.mode || 'CREATE_OR_UPDATE';
        if (current && mode === 'CREATE_ONLY') { skipped += group.length; continue; }
        if (!current && mode === 'UPDATE_ONLY') { group.forEach((row) => errors.push({ row: row.__row, field: 'sku', message: 'Product does not exist for UPDATE_ONLY', status: 'skipped' })); skipped += group.length; continue; }
        try {
          const dto = await this.toProductDto(user.businessId, group);
          let product: any;
          if (!current) product = await this.products.create(user.businessId, user.branchId, dto as any);
          else product = await this.products.updateProduct(user.businessId, current.id, dto as any);
          for (const row of group) {
            if (Number(row.openingStock || 0) > 0) {
              const variantSku = row.variantSku || row.sku;
              const variant = await this.prisma.productVariant.findFirst({ where: { productId: product.id, sku: variantSku } });
              const branch = await this.prisma.branch.findFirst({ where: { businessId: user.businessId, code: row.openingStockBranch || undefined, id: row.openingStockBranch ? undefined : user.branchId } });
              if (!variant || !branch) throw new BadRequestException('Opening stock variant or branch was not found');
              await this.products.stockOperation(user.businessId, user.id, { variantId: variant.id, branchId: branch.id, type: 'IN', quantity: Number(row.openingStock), unitCost: Number(row.purchasePrice || 0), reason: 'Opening stock import', reference: `import:${id}:${row.__row}` });
            }
          }
          success += group.length;
        } catch (error: any) { group.forEach((row) => errors.push({ row: row.__row, field: 'record', message: error.message, status: 'failed' })); failed += group.length; }
        await this.prisma.importExportJob.update({ where: { id }, data: { processedRows: success + failed + skipped + invalid.size, successRows: success, failedRows: failed + invalid.size, skippedRows: skipped } });
      }
      const status = failed || invalid.size ? (success ? 'PARTIAL' : 'FAILED') : 'COMPLETED';
      return this.prisma.importExportJob.update({ where: { id }, data: { status: status as any, processedRows: rows.length, successRows: success, failedRows: failed + invalid.size, skippedRows: skipped, result: { errors }, completedAt: new Date() } });
    } catch (error: any) {
      return this.prisma.importExportJob.update({ where: { id }, data: { status: 'FAILED', errorMessage: error.message, result: { errors }, completedAt: new Date() } });
    }
  }

  private async toProductDto(businessId: string, rows: Row[]) {
    const first = rows[0];
    const activeColumns = await this.prisma.$queryRaw<Array<{ tableName: string; columnName: string }>>(Prisma.sql`
      SELECT table_name AS "tableName", column_name AS "columnName"
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name IN ('categories', 'brands', 'units', 'tax_rates')
        AND column_name = 'is_active'
    `);
    const hasActive = (tableName: string) => activeColumns.some((column) => column.tableName === tableName && column.columnName === 'is_active');
    const [units, categories, brands, taxes] = await Promise.all([
      this.prisma.unit.findMany({ where: { businessId, ...(hasActive('units') ? { isActive: true } : {}) }, select: { id: true, name: true, symbol: true, isDefault: true } }),
      this.prisma.category.findMany({ where: { businessId, ...(hasActive('categories') ? { isActive: true } : {}) }, select: { id: true, name: true } }),
      this.prisma.brand.findMany({ where: { businessId, ...(hasActive('brands') ? { isActive: true } : {}) }, select: { id: true, name: true } }),
      this.prisma.taxRate.findMany({ where: { businessId, ...(hasActive('tax_rates') ? { isActive: true } : {}) }, select: { id: true, rate: true, isDefault: true } }),
    ]);
    const unit = units.find((item) => [item.id, item.name, item.symbol].some((value) => value?.toLowerCase() === first.unit?.toLowerCase())) || units.find((item) => item.isDefault);
    const category = categories.find((item) => item.name.toLowerCase() === first.category?.toLowerCase());
    const brand = brands.find((item) => item.name.toLowerCase() === first.brand?.toLowerCase());
    const tax = taxes.find((item) => Number(item.rate) === Number(first.taxRate)) || taxes.find((item) => item.isDefault);
    if (!unit || !tax) throw new BadRequestException('A valid active unit and GST rate are required');
    if (first.category && !category) throw new BadRequestException(`Category "${first.category}" was not found in this business`);
    if (first.brand && !brand) throw new BadRequestException(`Brand "${first.brand}" was not found in this business`);
    const distinctHsnCodes = new Set(rows.map((row) => String(row.hsnCode || '').trim()).filter(Boolean).map((value) => value.toLowerCase()));
    if (distinctHsnCodes.size > 1) throw new BadRequestException('All variants must inherit the same HSN code from the parent product');
    const variants = rows.filter((row) => row.variantSku).map((row) => ({ sku: row.variantSku, barcode: row.variantBarcode || undefined, attributes: row.variantAttributes ? JSON.parse(row.variantAttributes) : {}, purchasePrice: Number(row.purchasePrice || 0), mrp: Number(row.mrp || 0), retailPrice: Number(row.retailPrice || 0), minStockLevel: Number(row.minStockLevel || 0), taxRateId: tax.id, isTaxInclusive: /^(true|1|yes)$/i.test(row.isTaxInclusive || '') }));
    const hasVariants = /^(true|1|yes)$/i.test(first.hasVariants || '') || variants.length > 0;
    return { name: first.name, sku: first.sku, barcode: hasVariants ? undefined : first.barcode || undefined, hsnCode: first.hsnCode || undefined, description: first.description || undefined, unitId: unit.id, categoryId: category?.id, brandId: brand?.id, taxRateId: tax.id, isTaxInclusive: /^(true|1|yes)$/i.test(first.isTaxInclusive || ''), hasVariants, purchasePrice: Number(first.purchasePrice || 0), mrp: Number(first.mrp || 0), retailPrice: Number(first.retailPrice || 0), minStockLevel: Number(first.minStockLevel || 0), variants: variants.length ? variants : undefined };
  }

}
