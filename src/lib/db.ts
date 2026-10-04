import { PrismaClient } from '@prisma/client'
import { createClient } from '@libsql/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'

const prismaClientSingleton = () => {
  const url = process.env.DATABASE_URL || 'file:./dev.db'

  if (url.startsWith('libsql://') || url.startsWith('https://')) {
    const libsql = createClient({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
    // @ts-ignore — adapter types lag behind runtime; verified working
    const adapter = new PrismaLibSQL(libsql)
    // @ts-ignore
    return new PrismaClient({ adapter })
  }

  return new PrismaClient({ datasources: { db: { url } } })
}

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined
}

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
