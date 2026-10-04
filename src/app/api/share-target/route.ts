import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkActionRateLimit } from "@/lib/rateLimit";
import { logSecurityEvent } from "@/lib/securityAudit";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Handle the Share Target POST from PWA
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login?callbackUrl=/expenses/add", req.url), 303);
  }

  try {
    await checkActionRateLimit("share_target", session.user.id);
  } catch (e) {
    return NextResponse.redirect(new URL("/expenses/add?error=RateLimit", req.url), 303);
  }

  // Parse the multipart form data
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

  if (file) {
    if (file.size > MAX_FILE_SIZE) {
      await logSecurityEvent({
        type: "MALICIOUS_INPUT_BLOCKED",
        userId: session.user.id,
        details: { action: "share_target_file_too_large", size: file.size }
      });
      return NextResponse.redirect(new URL("/expenses/add?error=FileTooLarge", req.url), 303);
    }
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      await logSecurityEvent({
        type: "MALICIOUS_INPUT_BLOCKED",
        userId: session.user.id,
        details: { action: "share_target_invalid_mime", mime: file.type }
      });
      return NextResponse.redirect(new URL("/expenses/add?error=InvalidFileType", req.url), 303);
    }
  }

  // In a real production app, we would temporarily store the file buffer securely (e.g., S3 presigned URL)
  // before the user explicitly authorizes the expense. We NEVER save directly to an Expense record here.
  
  const redirectUrl = new URL("/expenses/add", req.url);
  redirectUrl.searchParams.set("mode", "screenshot");
  if (text) {
    // Basic sanitization
    redirectUrl.searchParams.set("desc", encodeURIComponent(text.substring(0, 50).replace(/[<>]/g, '')));
  }
  
  return NextResponse.redirect(redirectUrl, 303);
}
