"use client";

import { useState } from "react";
import { Users, Check, MessageSquare, AlertCircle, Share2, Copy, Loader2, ArrowRight } from "lucide-react";
import { matchContacts } from "@/actions/user";
import { formatPhoneForDisplay } from "@/domain/phone";

interface ContactPickerProps {
  onSelectUser: (phoneOrUpi: string) => void;
  groupId?: string;
}

export default function ContactPicker({ onSelectUser, groupId }: ContactPickerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unsupported, setUnsupported] = useState(false);
  const [matchedResults, setMatchedResults] = useState<{
    registered: Array<{ id: string; name: string; phone: string; image: string | null; upiId: string | null; contactName: string }>;
    unregistered: Array<{ contactName: string; phone: string }>;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const isContactPickerSupported =
    typeof window !== "undefined" && "contacts" in navigator && "ContactsManager" in window;

  const handlePickContacts = async () => {
    setError(null);
    setMatchedResults(null);

    if (!isContactPickerSupported) {
      setUnsupported(true);
      return;
    }

    try {
      setLoading(true);
      const props = ["name", "tel"];
      const opts = { multiple: true };
      // @ts-ignore
      const rawContacts = await navigator.contacts.select(props, opts);

      if (!rawContacts || rawContacts.length === 0) {
        setLoading(false);
        return; // User dismissed picker without selecting
      }

      // Extract valid phone entries
      const formattedContacts: Array<{ name: string; tel: string }> = [];
      for (const c of rawContacts) {
        const name = (c.name && c.name[0]) || "Contact";
        if (c.tel && c.tel.length > 0) {
          for (const tel of c.tel) {
            formattedContacts.push({ name, tel });
          }
        }
      }

      if (formattedContacts.length === 0) {
        setError("None of the selected contacts had phone numbers.");
        setLoading(false);
        return;
      }

      // Match against DuoPay database
      const results = await matchContacts(formattedContacts);
      setMatchedResults(results);
    } catch (err: any) {
      if (err.name === "SecurityError") {
        setError("Contacts access denied or requires a secure context (HTTPS).");
      } else if (err.name !== "AbortError") {
        setError(err.message || "Failed to import contacts.");
      }
    } finally {
      setLoading(false);
    }
  };

  const getInviteUrl = () => {
    if (typeof window === "undefined") return "";
    return groupId ? `${window.location.origin}/groups/join/${groupId}` : `${window.location.origin}`;
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(getInviteUrl());
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleWhatsAppInvite = (phone: string, name: string) => {
    const inviteUrl = getInviteUrl();
    const cleanNumber = phone.replace(/[^0-9]/g, "");
    const message = encodeURIComponent(
      `Hey ${name}! Join me on DuoPay to split expenses and settle up easily: ${inviteUrl}`
    );
    window.open(`https://api.whatsapp.com/send?phone=${cleanNumber}&text=${message}`, "_blank");
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Import Contacts CTA */}
      <button
        type="button"
        onClick={handlePickContacts}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2.5 py-3.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold rounded-2xl active:scale-98 transition-all disabled:opacity-60 shadow-xs"
      >
        {loading ? (
          <>
            <Loader2 size={18} className="animate-spin text-gray-600" />
            <span>Checking contacts...</span>
          </>
        ) : (
          <>
            <Users size={18} className="text-gray-700" />
            <span>Import from Phone Contacts</span>
          </>
        )}
      </button>

      {/* Unsupported Browser Alert & Fallbacks */}
      {unsupported && (
        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200/60 text-amber-900 text-xs flex flex-col gap-3">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Contact import isn't supported on this device/browser</p>
              <p className="text-amber-800/80 mt-0.5">
                iOS Safari and some desktop browsers restrict contact address book access for privacy.
              </p>
            </div>
          </div>

          <div className="border-t border-amber-200/60 pt-2 flex flex-col gap-2">
            <p className="font-semibold text-[11px] text-amber-800">Alternative Options:</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex items-center justify-center gap-1.5 py-2 px-3 bg-white text-gray-800 font-semibold rounded-xl border border-amber-200 shadow-xs active:bg-amber-100/50"
              >
                {copiedLink ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                <span>{copiedLink ? "Copied!" : "Copy Link"}</span>
              </button>
              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                  `Join my DuoPay group: ${getInviteUrl()}`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 py-2 px-3 bg-green-600 text-white font-semibold rounded-xl shadow-xs active:bg-green-700 text-center"
              >
                <MessageSquare size={14} />
                <span>WhatsApp</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs text-center border border-red-100">
          {error}
        </div>
      )}

      {/* Matched Contacts Results */}
      {matchedResults && (
        <div className="flex flex-col gap-3 mt-2 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* 1. On DuoPay */}
          {matchedResults.registered.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">
                Already on DuoPay ({matchedResults.registered.length})
              </p>
              <div className="flex flex-col gap-2">
                {matchedResults.registered.map((user) => (
                  <div
                    key={user.id}
                    className="p-3 bg-white border border-gray-200 rounded-2xl flex items-center justify-between shadow-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center font-bold text-gray-600 text-sm">
                        {user.image ? (
                          <img src={user.image} alt={user.name} className="w-full h-full object-cover" />
                        ) : (
                          user.name.charAt(0)
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-gray-900">{user.name}</p>
                        <p className="text-xs text-gray-500">{formatPhoneForDisplay(user.phone)}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectUser(user.phone)}
                      className="py-1.5 px-3 bg-black text-white text-xs font-bold rounded-xl active:scale-95 transition-transform flex items-center gap-1 shadow-xs"
                    >
                      <span>Select</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. Not on DuoPay */}
          {matchedResults.unregistered.length > 0 && (
            <div className="flex flex-col gap-2 mt-2">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">
                Not on DuoPay yet ({matchedResults.unregistered.length})
              </p>
              <div className="flex flex-col gap-2">
                {matchedResults.unregistered.map((c, i) => (
                  <div
                    key={i}
                    className="p-3 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-between"
                  >
                    <div>
                      <p className="font-semibold text-sm text-gray-800">{c.contactName}</p>
                      <p className="text-xs text-gray-400">{formatPhoneForDisplay(c.phone)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleWhatsAppInvite(c.phone, c.contactName)}
                      className="py-1.5 px-3 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-bold rounded-xl active:scale-95 transition-all flex items-center gap-1 border border-green-200"
                    >
                      <MessageSquare size={13} />
                      <span>Invite</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {matchedResults.registered.length === 0 && matchedResults.unregistered.length === 0 && (
            <p className="text-xs text-gray-500 text-center py-2">
              No phone numbers found in the selected contacts.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
