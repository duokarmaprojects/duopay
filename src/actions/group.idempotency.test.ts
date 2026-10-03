import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { createGroup } from '@/actions/group'
import crypto from 'crypto'

// Mock authentication
vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "test-user-group-idempotency" } })
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn()
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn().mockImplementation((url: string) => {
    const e = new Error('NEXT_REDIRECT')
    e.message = 'NEXT_REDIRECT'
    throw e
  })
}))

describe('Group Creation Idempotency & Concurrency', () => {
  beforeEach(async () => {
    // Ensure the test user exists
    await prisma.user.upsert({
      where: { id: "test-user-group-idempotency" },
      create: { id: "test-user-group-idempotency", name: "Test User" },
      update: {}
    })

    await prisma.groupMember.deleteMany({ where: { userId: "test-user-group-idempotency" } })
    await prisma.group.deleteMany({
      where: {
        OR: [
          { members: { some: { userId: "test-user-group-idempotency" } } },
          { name: 'Legitimate Duplicate Trip' },
          { name: 'Concurrent Trip' }
        ]
      }
    })
  })

  it('should create only exactly ONE group under concurrent duplicate requests with the same idempotency key', async () => {
    const idempotencyKey = crypto.randomUUID()

    // 5 concurrent identical requests
    const promises = Array(5).fill(0).map(() => {
      const formData = new FormData()
      formData.append('name', 'Concurrent Trip')
      formData.append('idempotencyKey', idempotencyKey)
      return createGroup(formData).catch(e => {
        // Next.js redirect throws an error (NEXT_REDIRECT), we catch it
        if (e.message === 'NEXT_REDIRECT') return 'REDIRECTED'
        throw e
      })
    })

    const results = await Promise.all(promises)

    // All should either succeed or redirect (redirect counts as success)
    expect(results.every(r => r === 'REDIRECTED')).toBe(true)

    const groups = await prisma.group.findMany({
      where: { name: 'Concurrent Trip', idempotencyKey }
    })

    // Exactly one group should have been created
    expect(groups).toHaveLength(1)
  })

  it('should allow legitimate duplicate names when idempotency keys are different', async () => {
    const key1 = crypto.randomUUID()
    const key2 = crypto.randomUUID()

    const fd1 = new FormData()
    fd1.append('name', 'Legitimate Duplicate Trip')
    fd1.append('idempotencyKey', key1)

    const fd2 = new FormData()
    fd2.append('name', 'Legitimate Duplicate Trip')
    fd2.append('idempotencyKey', key2)

    await createGroup(fd1).catch(e => e.message === 'NEXT_REDIRECT' ? 'REDIRECTED' : null)
    await createGroup(fd2).catch(e => e.message === 'NEXT_REDIRECT' ? 'REDIRECTED' : null)

    const groups = await prisma.group.findMany({
      where: { name: 'Legitimate Duplicate Trip' }
    })

    // Two separate groups with the same name should be created
    expect(groups).toHaveLength(2)
  })
})
