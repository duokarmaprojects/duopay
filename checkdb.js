const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url: 'file:./prisma/dev.db' } } });
async function main() {
  const group = await prisma.group.create({ data: { name: 'test', type: 'TRIP' } });
  console.log(group);
}
main().catch(e => console.error(e.message));
