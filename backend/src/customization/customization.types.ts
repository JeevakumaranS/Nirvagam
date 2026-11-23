export type CustomDatatype =
  | 'text'
  | 'long_text'
  | 'integer'
  | 'decimal'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'select'
  | 'multi_select'
  | 'lookup'
  | 'currency'
  | 'email'
  | 'phone'
  | 'url'
  | 'file';

export interface FieldValidationRules {
  min?: number;
  max?: number;
  regex?: string;
  maxLength?: number;
  decimalPlaces?: number;
  options?: string[]; // For select & multi_select
  lookupEntity?: string; // For lookup relation
}

export interface CreateCustomFieldInput {
  entityKey: string;
  fieldKey: string;
  label: string;
  datatype: CustomDatatype;
  storage?: 'jsonb' | 'column';
  required?: boolean;
  unique?: boolean;
  defaultValue?: string;
  validation?: FieldValidationRules;
  visibleRoles?: string[];
  editableRoles?: string[];
  sortOrder?: number;
  showInList?: boolean;
  showInPrint?: boolean;
}

export interface CreateCustomEntityInput {
  key: string;
  label: string;
  pluralLabel: string;
  icon?: string;
  fields?: CreateCustomFieldInput[];
}

export interface DatatypeImpactAnalysis {
  fieldKey: string;
  entityKey: string;
  currentType: CustomDatatype;
  targetType: CustomDatatype;
  isLossless: boolean;
  totalRowCount: number;
  incompatibleRowCount: number;
  sampleIncompatibleValues: any[];
  requiresShadowBackup: boolean;
  shadowBackupColumn?: string;
  estimatedDurationMs: number;
  canApplyDirectly: boolean;
  warnings: string[];
}

export interface SchemaChangeLogRecord {
  id: string;
  changeType: string;
  target: string;
  beforeState: any;
  afterState: any;
  ddlSql?: string;
  status: 'DRAFT' | 'PREVIEWED' | 'APPLIED' | 'FAILED' | 'ROLLED_BACK';
  requestedBy?: string;
  approvedBy?: string;
  appliedAt: Date;
  rollbackSql?: string;
  error?: string;
}
