const { PrismaClient } = require('@prisma/client');
const url = 'file:./dev.db';
const prisma = new PrismaClient({ datasources: { db: { url } } });
async function main() {
  const groups = await prisma.group.findMany();
  console.log(groups);
}
main().catch(e => console.error(e));
