import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface TenantSchemaMigration {
  version: number;
  name: string;
  checksum: string;
  sql: string;
}

export function getTenantSchemaMigrations(): TenantSchemaMigration[] {
  const migrationsDir = path.resolve(__dirname, '../../prisma/migrations');
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Prisma migrations directory was not found: ${migrationsDir}`);
  }

  const names = fs.readdirSync(migrationsDir)
    .filter((name) =>
      /^\d+_.+$/.test(name) &&
      name !== '20261119160000_uuidv7_ids' &&
      fs.statSync(path.join(migrationsDir, name)).isDirectory()
    )
    .sort();

  if (!names.length) {
    throw new Error('No tenant schema migrations were found');
  }

  return names.map((name, index) => {
    const sql = fs.readFileSync(path.join(migrationsDir, name, 'migration.sql'), 'utf8')
      .replace(/\r\n/g, '\n');
    return {
      version: index + 1,
      name,
      checksum: crypto.createHash('sha256').update(sql).digest('hex'),
      sql,
    };
  });
}
