const { createClient } = require('@libsql/client');
const client = createClient({ url: 'file:./prisma/dev.db' });
client.execute('PRAGMA table_info("Group")').then(res => console.log(res.rows.map(r => r[1]))).catch(console.log);
