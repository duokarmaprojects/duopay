"use client";

import { useState } from "react";
import { Share2, Copy, Check, MessageSquare } from "lucide-react";

export default function ShareInviteLink({
  groupId,
  inviteToken,
}: {
  groupId: string;
  inviteToken?: string;
}) {
  const [copied, setCopied] = useState(false);

  const getInviteUrl = () => {
    if (typeof window === "undefined") return "";
    const tokenParam = inviteToken ? `?token=${encodeURIComponent(inviteToken)}` : "";
    return `${window.location.origin}/groups/join/${groupId}${tokenParam}`;
  };

  const shareText = `Join my group on DuoPay — split expenses and settle up with ease! 💸`;

  const handleShare = async () => {
    const inviteUrl = getInviteUrl();

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join my DuoPay group",
          text: shareText,
          url: inviteUrl,
        });
        return;
      } catch (err: any) {
        // User aborted — don't do anything
        if (err.name === "AbortError") return;
        // Share failed, fall through to copy
      }
    }
    // Fallback: copy to clipboard
    copyToClipboard(inviteUrl);
  };

  const copyToClipboard = (url: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      });
    }
  };

  const whatsappUrl = () => {
    const inviteUrl = getInviteUrl();
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText}\n\n${inviteUrl}`)}`;
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Primary: Native Share (triggers OS share sheet on Android) */}
      <button
        type="button"
        onClick={handleShare}
        className="w-full flex items-center justify-center gap-2.5 py-3.5 px-4 bg-black text-white font-semibold rounded-2xl active:bg-gray-800 transition-colors shadow-sm text-sm"
      >
        <Share2 size={18} />
        {copied ? "Link Copied!" : "Share Invite Link"}
      </button>

      {/* Fallback row: copy + WhatsApp */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => copyToClipboard(getInviteUrl())}
          className="flex-1 flex items-center justify-center gap-2 py-3 px-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold rounded-2xl active:scale-[.98] transition-all text-sm"
        >
          {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
          <span>{copied ? "Copied!" : "Copy Link"}</span>
        </button>

        <a
          href={whatsappUrl()}
          target="_blank"
          rel="noreferrer"
          className="flex-1 flex items-center justify-center gap-2 py-3 px-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-2xl active:scale-[.98] transition-all text-sm"
        >
          <MessageSquare size={16} />
          <span>WhatsApp</span>
        </a>
      </div>
    </div>
  );
}
