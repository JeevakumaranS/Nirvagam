const { Client } = require('pg');
const fs = require('fs');

async function checkAndApply() {
  const client = new Client({ connectionString: 'postgresql://postgres:user@localhost:5432/nirvagam_db' });
  await client.connect();

  const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'platform'");
  console.log('Tables in platform:', tables.rows.map(r => r.table_name));

  if (!tables.rows.some(r => r.table_name === 'business_profiles')) {
    console.log('Applying 002_business_registration.sql...');
    const sql = fs.readFileSync('backend/migrations/platform/002_business_registration.sql', 'utf8');
    await client.query(sql);
    console.log('Applied 002_business_registration.sql successfully!');
  } else {
    console.log('platform.business_profiles already exists.');
  }

  // Also check if any profiles exist
  const profiles = await client.query('SELECT id, legal_name, trade_name FROM platform.business_profiles');
  console.log('Existing profiles count:', profiles.rowCount, profiles.rows);

  await client.end();
}

checkAndApply().catch(console.error);
