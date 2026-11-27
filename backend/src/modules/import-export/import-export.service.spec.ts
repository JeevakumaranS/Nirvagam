import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { ImportExportRegistry } from './import-export.registry';
import { ImportExportService } from './import-export.service';

describe('ImportExportService templates and catalog parsing', () => {
  const user: any = { id: 'user-1', businessId: 'business-1' };

  function service() {
    const prisma: any = {
      category: { findMany: jest.fn().mockResolvedValue([{ name: 'Apparel' }, { name: 'Footwear' }]) },
      brand: { findMany: jest.fn().mockResolvedValue([{ name: 'Acme' }]) },
      unit: { findMany: jest.fn().mockResolvedValue([{ symbol: 'PCS' }]) },
      taxRate: { findMany: jest.fn().mockResolvedValue([{ rate: 5 }]) },
      branch: { findMany: jest.fn().mockResolvedValue([{ code: 'HQ' }]) },
      $queryRaw: jest.fn().mockResolvedValue([
        { tableName: 'categories', columnName: 'is_active' },
        { tableName: 'brands', columnName: 'is_active' },
        { tableName: 'units', columnName: 'is_active' },
        { tableName: 'tax_rates', columnName: 'is_active' },
        { tableName: 'branches', columnName: 'is_active' },
      ]),
      importExportJob: { create: jest.fn().mockImplementation(({ data }) => ({ id: 'job-1', status: data.status })), findUnique: jest.fn().mockResolvedValue(null), findFirst: jest.fn().mockResolvedValue(null) },
    };
    return { instance: new ImportExportService(prisma, {} as any, new ImportExportRegistry()), prisma };
  }

  it('generates a structured workbook with empty entry sheets and an active Products sheet', async () => {
    const { instance } = service();
    const result = await instance.template(user, 'catalog');
    const workbook = XLSX.read(result.body, { type: 'buffer' });
    expect(workbook.SheetNames).toEqual(['Instructions', 'Products', 'Variants', 'Examples', 'Reference Data']);
    expect(XLSX.utils.sheet_to_json(workbook.Sheets.Products, { header: 1 })).toHaveLength(1);
    expect(XLSX.utils.sheet_to_json(workbook.Sheets.Variants, { header: 1 })).toHaveLength(1);
    const variantTemplate = await instance.template(user, 'catalog', 'variants');
    const variantWorkbook = XLSX.read(variantTemplate.body, { type: 'buffer' });
    expect(XLSX.utils.sheet_to_json(variantWorkbook.Sheets.Products, { header: 1 })[0]).not.toContain('Product Barcode');
    expect(XLSX.utils.sheet_to_json(variantWorkbook.Sheets.Variants, { header: 1 })[0]).toContain('Variant Barcode');
    expect(result.fileName).toContain('v2.xlsx');
  });

  it('generates an Excel-only template with dynamic attribute columns', async () => {
    const { instance } = service();
    await expect(instance.template(user, 'catalog', 'standard')).resolves.toEqual(expect.objectContaining({ contentType: expect.stringContaining('spreadsheetml') }));
    await expect(instance.validate(user, 'catalog', { originalname: 'template.csv', size: 1, buffer: Buffer.from('Product SKU') })).rejects.toThrow('Only Excel');
  });

  it('loads reference data for legacy tenants without is_active columns', async () => {
    const { instance, prisma } = service();
    prisma.$queryRaw.mockResolvedValueOnce([]);
    await expect(instance.template(user, 'catalog')).resolves.toEqual(expect.objectContaining({ contentType: expect.stringContaining('spreadsheetml') }));
  });

  it('parses v2 Products and Variants sheets with leading zeros and dynamic attributes', async () => {
    const { instance, prisma } = service();
    const template = await instance.template(user, 'catalog');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(template.body as Buffer);
    workbook.getWorksheet('Products')!.addRow(['Cotton Shirt', '000123', '', '6205', 'Example', 'Apparel', 'Acme', 'PCS', 5, 'FALSE', 'TRUE', 450, 999, 899, 5, '', '']);
    workbook.getWorksheet('Variants')!.addRow(['000123', '000123-RED', '', 450, 999, 899, 2, 5, 'FALSE', 'Colour', 'Red', 'Size', 'M', '', '', '']);
    const result = await instance.validate(user, 'catalog', { originalname: 'filled.xlsx', size: 1, buffer: Buffer.from(await workbook.xlsx.writeBuffer()) });
    expect(result.errors).toEqual([]);
    expect(result.validRows).toBe(2);
    expect(prisma.importExportJob.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ validation: expect.objectContaining({ version: 2 }) }) }));
    const rows = prisma.importExportJob.create.mock.calls[0][0].data.validation.rows;
    expect(rows[1]).toEqual(expect.objectContaining({ sku: '000123', variantSku: '000123-RED', variantAttributes: JSON.stringify({ Colour: 'Red', Size: 'M' }) }));
  });
});
