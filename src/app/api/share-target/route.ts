import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkActionRateLimit } from "@/lib/rateLimit";
import { logSecurityEvent } from "@/lib/securityAudit";
import { validateImageMagicBytes } from "@/domain/receipt";
import { getReceiptExtractor, generateFingerprint } from "@/receipt/extractReceipt";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Handle the Share Target POST from PWA
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login?callbackUrl=/expenses/add", req.url), 303);
  }

  const userId = session.user.id;

  try {
    const rateLimit = checkActionRateLimit("share_target", userId);
    if (!rateLimit.allowed) {
      return NextResponse.redirect(new URL("/expenses/add?error=RateLimit", req.url), 303);
    }
  } catch (e) {
    return NextResponse.redirect(new URL("/expenses/add?error=RateLimit", req.url), 303);
  }

  // Parse multipart form data
  let file: File | null = null;
  let text = "";
  try {
    const formData = await req.formData();
    file = formData.get("receipt") as File | null;
    text = (formData.get("text") as string) || (formData.get("title") as string) || "";
  } catch (e) {
    console.error("Error parsing share target form data", e);
    return NextResponse.redirect(new URL("/expenses/add?error=InvalidPayload", req.url), 303);
  }

  if (file && file.size > 0) {
    if (file.size > MAX_FILE_SIZE) {
      await logSecurityEvent({
        type: "MALICIOUS_INPUT_BLOCKED",
        userId,
        details: { action: "share_target_file_too_large", size: file.size }
      });
      return NextResponse.redirect(new URL("/expenses/add?error=FileTooLarge", req.url), 303);
    }
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      await logSecurityEvent({
        type: "MALICIOUS_INPUT_BLOCKED",
        userId,
        details: { action: "share_target_invalid_mime", mime: file.type }
      });
      return NextResponse.redirect(new URL("/expenses/add?error=InvalidFileType", req.url), 303);
    }

    const buffer = await file.arrayBuffer();
    const isValidMagic = validateImageMagicBytes(buffer, file.type);
    if (!isValidMagic) {
      await logSecurityEvent({
        type: "MALICIOUS_INPUT_BLOCKED",
        userId,
        details: { action: "share_target_magic_bytes_mismatch", mime: file.type }
      });
      return NextResponse.redirect(new URL("/expenses/add?error=InvalidImageContent", req.url), 303);
    }

    const fingerprint = await generateFingerprint(buffer);
    const extractor = getReceiptExtractor();
    const extractedData = await extractor.extract(file, "screenshot");

    const scan = await prisma.receiptScan.create({
      data: {
        userId,
        status: "NEEDS_REVIEW",
        imageMimeType: file.type,
        imageSizeBytes: file.size,
        extractedData: JSON.stringify(extractedData),
        fingerprint,
        source: "SHARE",
      }
    });

    return NextResponse.redirect(new URL(`/receipt?scanId=${scan.id}`, req.url), 303);
  }

  // Text-only share fallback
  const redirectUrl = new URL("/expenses/add", req.url);
  redirectUrl.searchParams.set("mode", "screenshot");
  if (text) {
    redirectUrl.searchParams.set("desc", encodeURIComponent(text.substring(0, 50).replace(/[<>]/g, '')));
  }
  return NextResponse.redirect(redirectUrl, 303);
}
