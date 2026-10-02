import { describe, it, expect } from "vitest"
import { authConfig } from "./auth.config"

describe("Auth.js JWT and Session Size Guards", () => {
  it("never includes base64 image data in JWT token", async () => {
    // Generate a 38KB base64 string simulating an uploaded profile picture
    const largeBase64 = "data:image/jpeg;base64," + "A".repeat(38000)

    const initialToken: any = {
      sub: "cmuqjbkq1000049av7gmezmp3",
      picture: largeBase64,
      image: largeBase64,
      dataUrl: largeBase64,
    }

    const mockUser: any = {
      id: "cmuqjbkq1000049av7gmezmp3",
      name: "Moiz Dheela",
      phone: "9313846266",
      upiId: "moiz@oksbi",
      role: "ADMIN",
      image: `/api/users/cmuqjbkq1000049av7gmezmp3/avatar`,
    }

    const token = await authConfig.callbacks!.jwt!({
      token: initialToken,
      user: mockUser,
      account: null as any,
      profile: undefined,
      trigger: "signIn",
    })

    expect(token).toBeDefined()
    // 1. Picture must point to avatar endpoint, not base64
    expect(token.picture).toBe("/api/users/cmuqjbkq1000049av7gmezmp3/avatar")
    // 2. Large image/dataUrl properties must be deleted
    expect(token.image).toBeUndefined()
    expect(token.dataUrl).toBeUndefined()

    // 3. Serialized token payload must be compact (< 400 bytes, well below 4KB cookie chunk threshold)
    const serialized = JSON.stringify(token)
    expect(serialized).not.toContain("data:image")
    expect(serialized.length).toBeLessThan(400)
    expect(token.role).toBe("ADMIN")
  })

  it("produces a session object pointing to the avatar endpoint", async () => {
    const token: any = {
      id: "cmuqjbkq1000049av7gmezmp3",
      phone: "9313846266",
      upiId: "moiz@oksbi",
      role: "ADMIN",
      picture: "/api/users/cmuqjbkq1000049av7gmezmp3/avatar",
    }

    const mockSession: any = {
      user: {
        name: "Moiz Dheela",
        email: null,
      },
      expires: new Date(Date.now() + 86400000).toISOString(),
    }

    const session = await authConfig.callbacks!.session!({
      session: mockSession,
      token,
      user: null as any,
      newSession: null,
      trigger: "update",
    })

    expect(session.user.id).toBe("cmuqjbkq1000049av7gmezmp3")
    expect(session.user.image).toBe("/api/users/cmuqjbkq1000049av7gmezmp3/avatar")
    expect((session.user as any).phone).toBe("9313846266")
    expect((session.user as any).upiId).toBe("moiz@oksbi")
  })
})
