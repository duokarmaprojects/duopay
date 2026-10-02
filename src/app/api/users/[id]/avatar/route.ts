import { prisma } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return new NextResponse("User ID required", { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: { image: true }
    })

    if (!user || !user.image) {
      return new NextResponse("Avatar not found", { status: 404 })
    }

    // If stored as data URL (base64)
    if (user.image.startsWith("data:image/")) {
      const match = user.image.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/)
      if (!match) {
        return new NextResponse("Invalid image format", { status: 500 })
      }

      const contentType = match[1]
      const buffer = Buffer.from(match[2], "base64")

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Length": buffer.length.toString(),
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        },
      })
    }

    // If stored as an external/public URL
    if (user.image.startsWith("http://") || user.image.startsWith("https://")) {
      return NextResponse.redirect(user.image, 307)
    }

    if (user.image.startsWith("/")) {
      return NextResponse.redirect(new URL(user.image, req.url), 307)
    }

    return new NextResponse("Unsupported image source", { status: 404 })
  } catch (error) {
    console.error("Error serving avatar:", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}
