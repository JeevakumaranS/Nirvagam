const { Client } = require('pg');

async function check() {
  const client = new Client({ connectionString: 'postgresql://postgres:user@localhost:5432/nirvagam_db' });
  await client.connect();

  const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'platform'");
  console.log('Platform tables:', tables.rows.map(r => r.table_name));

  const puCols = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'platform' AND table_name = 'platform_users'");
  console.log('platform_users columns:', puCols.rows);

  const pr = await client.query("SELECT * FROM platform.platform_roles").catch(err => ({ error: err.message }));
  console.log('platform_roles query result:', pr.rows || pr.error);

  const pu = await client.query("SELECT pu.*, i.email, i.first_name, i.last_name FROM platform.platform_users pu JOIN platform.identities i ON pu.identity_id = i.id");
  console.log('platform_users data:', pu.rows);

  await client.end();
}

check().catch(console.error);
