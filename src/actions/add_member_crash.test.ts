import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { addMemberToGroup } from '@/actions/group'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "test-user-id" } })
}))

describe('Add Member Crash Test', () => {
  beforeEach(async () => {
    await prisma.user.upsert({
      where: { id: "test-user-id" },
      create: { id: "test-user-id", name: "Test User" },
      update: {}
    })
    
    await prisma.group.upsert({
      where: { id: "test-group-id" },
      create: { 
        id: "test-group-id", 
        name: "Test Group",
        members: { create: { userId: "test-user-id" } }
      },
      update: {}
    })
  })

  it('should not crash with a Server Component error when given a nonexistent phone number', async () => {
    try {
      await addMemberToGroup("test-group-id", "8888888888")
    } catch (err: any) {
      console.log("CAUGHT ERROR:", err)
      expect(err.message).toContain("User not found")
    }
  })
})
