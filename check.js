const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); prisma.group.findFirst().then(console.log)
