import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { TenantProvisioningService } from '../tenancy/tenant-provisioning.service';
import { TenantMigrationService } from '../tenancy/tenant-migration.service';
import { TenantDatabaseService } from '../tenancy/tenant-database.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  const provisioningService = app.get(TenantProvisioningService);
  const migrationService = app.get(TenantMigrationService);
  const tenantDb = app.get(TenantDatabaseService);

  const args = process.argv.slice(2);
  const command = args[0];

  try {
    if (command === 'provision') {
      const slug = args.find((a) => a.startsWith('--slug='))?.split('=')[1] || `tenant-${Date.now()}`;
      const name = args.find((a) => a.startsWith('--name='))?.split('=')[1] || 'Demo Enterprise';
      const email = args.find((a) => a.startsWith('--email='))?.split('=')[1] || `${slug}@nirvagam.com`;

      console.log(`\n🚀 Provisioning Tenant: [slug=${slug}, name=${name}, email=${email}]`);
      const result = await provisioningService.provision({
        slug,
        displayName: name,
        ownerEmail: email,
        ownerPassword: 'Password@123',
      });

      console.log(`\n✅ Provisioning Complete!`);
      console.log(JSON.stringify(result, null, 2));
    } else if (command === 'migrate') {
      const tenantArg = args.find((a) => a.startsWith('--tenant='))?.split('=')[1];
      const concurrency = parseInt(args.find((a) => a.startsWith('--concurrency='))?.split('=')[1] || '5', 10);
      const dryRun = args.includes('--dry-run');

      console.log(`\n🔄 Running Tenant Migrations (Concurrency=${concurrency}, DryRun=${dryRun})...`);
      const report = await migrationService.runTenantMigrations({
        tenantId: tenantArg,
        concurrency,
        dryRun,
      });

      console.log(`\n📊 Migration Report:`);
      console.log(`Total Tenants Checked: ${report.totalTenants}`);
      console.log(`Migrated: ${report.migratedCount}`);
      console.log(`Skipped (Up-to-date): ${report.skippedCount}`);
      console.log(`Failed: ${report.failedCount}`);
      if (report.failedCount > 0) {
        console.log(`\nFailures:`);
        report.results.filter(r => r.status === 'FAILED').forEach(f => {
          console.error(`- [${f.slug}] (${f.schemaName}): ${f.error}`);
        });
      }
    } else {
      console.log(`
Usage:
  ts-node src/cli/tenant-cli.ts provision --slug=<slug> --name=<name> --email=<email>
  ts-node src/cli/tenant-cli.ts migrate [--tenant=<id|slug>] [--concurrency=N] [--dry-run]
      `);
    }
  } catch (err: any) {
    console.error('\n❌ Execution failed:', err.message);
    process.exit(1);
  } finally {
    await app.close();
    process.exit(0);
  }
}

bootstrap();
