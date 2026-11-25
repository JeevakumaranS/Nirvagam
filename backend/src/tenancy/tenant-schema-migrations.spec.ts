import { getTenantSchemaMigrations } from './tenant-schema-migrations';

describe('tenant schema migrations', () => {
  it('includes member profile fields required by tenant user provisioning', () => {
    const migration = getTenantSchemaMigrations().find(
      (item) => item.name === '20261125120000_user_member_profile_fields'
    );

    expect(migration).toBeDefined();
    expect(migration?.sql).toContain('ADD COLUMN "member_type"');
    expect(migration?.sql).toContain('ADD COLUMN "status"');
    expect(migration?.sql).toContain('ADD COLUMN "joining_date"');
    expect(migration?.sql).toContain('ADD COLUMN "reports_to_id"');
  });

  it('includes registration fields for newly provisioned tenant business profiles', () => {
    const migrations = getTenantSchemaMigrations();
    const memberFieldsIndex = migrations.findIndex(
      (item) => item.name === '20261125120000_user_member_profile_fields'
    );
    const registrationFieldsIndex = migrations.findIndex(
      (item) => item.name === '20261125124000_business_registration_profile_fields'
    );
    const registrationFields = migrations[registrationFieldsIndex];

    expect(registrationFieldsIndex).toBeGreaterThan(memberFieldsIndex);
    expect(registrationFields?.sql).toContain('ADD COLUMN "district"');
    expect(registrationFields?.sql).toContain('ADD COLUMN "jurisdiction"');
  });
});
