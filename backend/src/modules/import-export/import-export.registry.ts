import { Injectable } from '@nestjs/common';

export interface ImportFieldDefinition {
  key: string;
  header: string;
  required?: boolean;
  type: 'text' | 'number' | 'boolean' | 'json';
  description: string;
}

export interface ImportExportAdapter {
  operation: string;
  label: string;
  fields: ImportFieldDefinition[];
}

@Injectable()
export class ImportExportRegistry {
  private readonly adapters = new Map<string, ImportExportAdapter>();

  register(adapter: ImportExportAdapter) {
    this.adapters.set(adapter.operation, adapter);
  }

  get(operation: string) {
    return this.adapters.get(operation);
  }

  list() {
    return [...this.adapters.values()];
  }
}

export const INVENTORY_CATALOG_FIELDS: ImportFieldDefinition[] = [
  { key: 'name', header: 'Product Name', required: true, type: 'text', description: 'Product display name' },
  { key: 'sku', header: 'Product SKU', required: true, type: 'text', description: 'Business-scoped parent SKU; keep leading zeros' },
  { key: 'barcode', header: 'Product Barcode', type: 'text', description: 'Optional barcode for standard products only; variant products use Variant Barcode' },
  { key: 'hsnCode', header: 'HSN Code', type: 'text', description: 'Parent product HSN shared by all variants; keep leading zeros' },
  { key: 'description', header: 'Description', type: 'text', description: 'Optional description' },
  { key: 'category', header: 'Category', type: 'text', description: 'Existing category name' },
  { key: 'brand', header: 'Brand', type: 'text', description: 'Existing brand name' },
  { key: 'unit', header: 'Unit', type: 'text', description: 'Unit name or symbol' },
  { key: 'taxRate', header: 'GST Rate', type: 'number', description: 'Existing tax rate percentage' },
  { key: 'isTaxInclusive', header: 'GST Inclusive', type: 'boolean', description: 'TRUE or FALSE' },
  { key: 'hasVariants', header: 'Has Variants', type: 'boolean', description: 'TRUE or FALSE' },
  { key: 'variantSku', header: 'Variant SKU', type: 'text', description: 'Variant SKU; blank for standard products' },
  { key: 'variantBarcode', header: 'Variant Barcode', type: 'text', description: 'Optional globally unique variant barcode' },
  { key: 'variantAttributes', header: 'Variant Attributes JSON', type: 'json', description: 'Example: {"Colour":"Red","Size":"M"}' },
  { key: 'purchasePrice', header: 'Purchase Price', type: 'number', description: 'Non-negative decimal' },
  { key: 'mrp', header: 'MRP', type: 'number', description: 'Non-negative decimal' },
  { key: 'retailPrice', header: 'Retail Price', type: 'number', description: 'Non-negative decimal' },
  { key: 'minStockLevel', header: 'Minimum Stock Level', type: 'number', description: 'Non-negative decimal' },
  { key: 'openingStock', header: 'Opening Stock', type: 'number', description: 'Only for new products; never changes existing stock' },
  { key: 'openingStockBranch', header: 'Opening Stock Branch Code', type: 'text', description: 'Required when opening stock is supplied' },
];

export const INVENTORY_PRODUCT_FIELDS: ImportFieldDefinition[] = INVENTORY_CATALOG_FIELDS.filter((field) => ![
  'variantSku', 'variantBarcode', 'variantAttributes',
].includes(field.key));

export const INVENTORY_STANDARD_TEMPLATE_FIELDS = INVENTORY_PRODUCT_FIELDS.filter((field) => field.key !== 'hasVariants');
// Variant-enabled products have no parent barcode. Barcodes belong to the
// individual variant rows; the parent HSN remains the shared product value.
export const INVENTORY_VARIANT_PRODUCT_FIELDS = INVENTORY_PRODUCT_FIELDS.filter((field) => !['hasVariants', 'barcode'].includes(field.key));
export const INVENTORY_VARIANT_FLAT_TEMPLATE_FIELDS = INVENTORY_CATALOG_FIELDS.filter((field) => field.key !== 'hasVariants');

export const INVENTORY_VARIANT_FIELDS: ImportFieldDefinition[] = [
  { key: 'sku', header: 'Parent Product SKU', required: true, type: 'text', description: 'Product SKU from the Products sheet' },
  { key: 'variantSku', header: 'Variant SKU', required: true, type: 'text', description: 'Globally unique variant SKU' },
  { key: 'variantBarcode', header: 'Variant Barcode', type: 'text', description: 'Optional globally unique barcode' },
  { key: 'purchasePrice', header: 'Purchase Price', type: 'number', description: 'Non-negative decimal' },
  { key: 'mrp', header: 'MRP', type: 'number', description: 'Non-negative decimal' },
  { key: 'retailPrice', header: 'Retail Price', type: 'number', description: 'Non-negative decimal' },
  { key: 'minStockLevel', header: 'Minimum Stock Level', type: 'number', description: 'Non-negative decimal' },
  { key: 'taxRate', header: 'GST Rate', type: 'number', description: 'Existing tax rate percentage' },
  { key: 'isTaxInclusive', header: 'GST Inclusive', type: 'boolean', description: 'TRUE or FALSE' },
  { key: 'attribute1Name', header: 'Attribute 1 Name', type: 'text', description: 'Dynamic attribute name, e.g. Colour' },
  { key: 'attribute1Value', header: 'Attribute 1 Value', type: 'text', description: 'Dynamic attribute value, e.g. Red' },
  { key: 'attribute2Name', header: 'Attribute 2 Name', type: 'text', description: 'Optional dynamic attribute name' },
  { key: 'attribute2Value', header: 'Attribute 2 Value', type: 'text', description: 'Optional dynamic attribute value' },
  { key: 'attribute3Name', header: 'Attribute 3 Name', type: 'text', description: 'Optional dynamic attribute name' },
  { key: 'attribute3Value', header: 'Attribute 3 Value', type: 'text', description: 'Optional dynamic attribute value' },
  { key: 'variantAttributes', header: 'Variant Attributes JSON', type: 'json', description: 'Optional v1 compatibility field; attribute pairs take precedence' },
];

// Kept out of the v2 workbook to avoid asking users to enter JSON. The parser
// still accepts this field for v1 files and existing exports.
export const INVENTORY_VARIANT_TEMPLATE_FIELDS = INVENTORY_VARIANT_FIELDS.filter((field) => field.key !== 'variantAttributes');

export const INVENTORY_MOVEMENT_FIELDS: ImportFieldDefinition[] = [
  { key: 'variantSku', header: 'Variant SKU', required: true, type: 'text', description: 'Existing variant SKU' },
  { key: 'branchCode', header: 'Branch Code', required: true, type: 'text', description: 'Existing active branch code' },
  { key: 'type', header: 'Type', required: true, type: 'text', description: 'IN or OUT' },
  { key: 'quantity', header: 'Quantity', required: true, type: 'number', description: 'Positive quantity respecting unit precision' },
  { key: 'unitCost', header: 'Unit Cost', type: 'number', description: 'Optional cost for IN' },
  { key: 'reason', header: 'Reason', type: 'text', description: 'Operational reason' },
  { key: 'reference', header: 'Reference', type: 'text', description: 'External reference' },
];

export const INVENTORY_TRANSFER_FIELDS: ImportFieldDefinition[] = [
  { key: 'variantSku', header: 'Variant SKU', required: true, type: 'text', description: 'Existing variant SKU' },
  { key: 'fromBranchCode', header: 'Source Branch Code', required: true, type: 'text', description: 'Existing active branch code' },
  { key: 'toBranchCode', header: 'Destination Branch Code', required: true, type: 'text', description: 'Existing active branch code' },
  { key: 'quantity', header: 'Quantity', required: true, type: 'number', description: 'Positive quantity respecting unit precision' },
  { key: 'reference', header: 'Reference', type: 'text', description: 'External reference' },
];
