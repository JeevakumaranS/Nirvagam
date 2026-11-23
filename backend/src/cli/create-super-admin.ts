import { NestFactory } from '@nestjs/core';
import * as bcrypt from 'bcryptjs';
import { isEmail } from 'class-validator';
import * as readline from 'readline';
import { AppModule } from '../app.module';
import { TenantDatabaseService } from '../tenancy/tenant-database.service';

function getOption(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function printUsage(): void {
  console.log(`
Create or promote a platform super-admin identity.

Usage:
  npm run super-admin:create [-- --email=<email>] [--first-name=<name>] [--last-name=<name>]

If email is omitted, the CLI prompts for it. A new identity's password is requested
without echo. For automation, pass --email and set SUPER_ADMIN_PASSWORD in the
environment. Existing identities are promoted without changing their password.
  `);
}

async function promptText(prompt: string): Promise<string> {
  const terminal = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    return await new Promise<string>((resolve) => {
      terminal.question(prompt, resolve);
    });
  } finally {
    terminal.close();
  }
}

function promptSecret(prompt: string): Promise<string> {
  const input = process.stdin;
  if (!input.isTTY) {
    return Promise.reject(
      new Error('Password input requires a terminal. Set SUPER_ADMIN_PASSWORD for non-interactive use.')
    );
  }

  readline.emitKeypressEvents(input);
  input.setRawMode(true);
  input.resume();
  process.stdout.write(prompt);

  return new Promise((resolve, reject) => {
    let value = '';
    const cleanup = () => {
      input.removeListener('keypress', onKeypress);
      input.setRawMode(false);
      input.pause();
      process.stdout.write('\n');
    };

    const onKeypress = (character: string, key: readline.Key) => {
      if (key.ctrl && key.name === 'c') {
        cleanup();
        reject(new Error('Password input cancelled.'));
      } else if (key.name === 'return' || key.name === 'enter') {
        cleanup();
        resolve(value);
      } else if (key.name === 'backspace') {
        value = Array.from(value).slice(0, -1).join('');
      } else if (character && !key.ctrl && !key.meta) {
        value += character;
      }
    };

    input.on('keypress', onKeypress);
  });
}

async function getNewPassword(): Promise<string> {
  const configuredPassword = process.env.SUPER_ADMIN_PASSWORD;
  let password: string;

  if (configuredPassword !== undefined) {
    password = configuredPassword;
  } else {
    password = await promptSecret('New super-admin password: ');
    const confirmation = await promptSecret('Confirm password: ');
    if (password !== confirmation) {
      throw new Error('Passwords do not match.');
    }
  }

  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }

  return password;
}

async function bootstrap(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    return;
  }

  const emailInput = getOption('email') ?? (await promptText('Super-admin email: '));
  const email = emailInput.trim().toLowerCase();
  const firstName = getOption('first-name')?.trim() || 'Platform';
  const lastName = getOption('last-name')?.trim() || 'Administrator';

  if (!email || !isEmail(email)) {
    printUsage();
    throw new Error('A valid --email=<email> is required.');
  }
  if (firstName.length > 100 || lastName.length > 100) {
    throw new Error('First and last names must be 100 characters or fewer.');
  }

  let app: Awaited<ReturnType<typeof NestFactory.createApplicationContext>> | undefined;
  try {
    app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error', 'warn'],
    });
    const tenantDb = app.get(TenantDatabaseService);

    const existing = await tenantDb.withPlatform((tx) =>
      tx.queryOne<{ id: string; status: string; is_super_admin: boolean | null }>(
        `SELECT i.id, i.status, pu.is_super_admin
         FROM platform.identities i
         LEFT JOIN platform.platform_users pu ON pu.identity_id = i.id
         WHERE lower(i.email) = $1
         LIMIT 1;`,
        [email]
      )
    );

    if (existing?.status !== undefined && existing.status !== 'ACTIVE') {
      throw new Error(`Identity [${email}] is not active; refusing to promote it.`);
    }

    if (existing?.is_super_admin) {
      console.log(`Identity [${email}] is already a platform super admin.`);
      return;
    }

    const passwordHash = existing ? null : await bcrypt.hash(await getNewPassword(), 12);

    const result = await tenantDb.withPlatform(async (tx) => {
      const current = await tx.queryOne<{ id: string; status: string; is_super_admin: boolean | null }>(
        `SELECT i.id, i.status, pu.is_super_admin
         FROM platform.identities i
         LEFT JOIN platform.platform_users pu ON pu.identity_id = i.id
         WHERE lower(i.email) = $1
         LIMIT 1;`,
        [email]
      );

      if (current?.status !== undefined && current.status !== 'ACTIVE') {
        throw new Error(`Identity [${email}] is not active; refusing to promote it.`);
      }
      if (current?.is_super_admin) {
        return { identityId: current.id, createdIdentity: false, alreadyAdmin: true };
      }

      let identityId = current?.id;
      let createdIdentity = false;
      if (!identityId) {
        if (!passwordHash) {
          throw new Error('Identity changed during creation; rerun the command.');
        }

        const inserted = await tx.queryOne<{ id: string }>(
          `INSERT INTO platform.identities (email, password_hash, first_name, last_name, status)
           VALUES ($1, $2, $3, $4, 'ACTIVE')
           ON CONFLICT (email) DO NOTHING
           RETURNING id;`,
          [email, passwordHash, firstName, lastName]
        );
        if (!inserted) {
          throw new Error('Identity was created concurrently; rerun the command.');
        }
        identityId = inserted.id;
        createdIdentity = true;
      }

      await tx.execute(
        `INSERT INTO platform.platform_users (identity_id, is_super_admin, role)
         VALUES ($1, TRUE, 'SUPER_ADMIN')
         ON CONFLICT (identity_id)
         DO UPDATE SET is_super_admin = TRUE, role = 'SUPER_ADMIN';`,
        [identityId]
      );
      await tx.execute(
        `INSERT INTO platform.platform_audit_log (action, target_type, target_id, reason)
         VALUES ('SUPER_ADMIN_GRANTED', 'IDENTITY', $1, 'Created or promoted by CLI');`,
        [identityId]
      );

      return { identityId, createdIdentity, alreadyAdmin: false };
    });

    if (result.alreadyAdmin) {
      console.log(`Identity [${email}] is already a platform super admin.`);
    } else {
      console.log(
        `Platform super admin ${result.createdIdentity ? 'created' : 'granted'} for ${email} (identity ${result.identityId}).`
      );
    }
  } finally {
    await app?.close();
  }
}

bootstrap().catch((error: unknown) => {
  console.error(`Super-admin creation failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
