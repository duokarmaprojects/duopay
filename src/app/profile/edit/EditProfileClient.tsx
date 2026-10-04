"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateUserProfile } from "@/actions/user";
import { validateUpiFormat } from "@/domain/upi";
import { Check, AlertCircle, Loader2, User, CreditCard, Phone, Mail, Lock } from "lucide-react";
import Link from "next/link";

interface EditProfileClientProps {
  initialUser: {
    name: string | null;
    phone: string | null;
    upiId: string | null;
    email: string | null;
  };
}

export default function EditProfileClient({ initialUser }: EditProfileClientProps) {
  const router = useRouter();

  const [name, setName] = useState(initialUser.name || "");
  const [upiId, setUpiId] = useState(initialUser.upiId || "");
  const [email, setEmail] = useState(initialUser.email || "");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setError("Name must be at least 2 characters.");
      return;
    }

    const trimmedUpi = upiId.trim();
    const upiValidation = validateUpiFormat(trimmedUpi);
    if (!upiValidation.valid || !upiValidation.normalized) {
      setError(upiValidation.error || "Please enter a valid UPI ID (e.g. name@bank).");
      return;
    }

    setLoading(true);
    try {
      await updateUserProfile({
        name: trimmedName,
        upiId: upiValidation.normalized,
        email: email.trim() || undefined,
      });

      setSuccess("Profile updated successfully!");
      setTimeout(() => {
        router.push("/profile");
        router.refresh();
      }, 700);
    } catch (err: any) {
      setError(err?.message || "Failed to update profile. Please try again.");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 w-full">
      {error && (
        <div className="p-3.5 rounded-2xl bg-red-950/40 border border-red-900/50 flex items-start gap-2.5 text-xs text-red-400 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-900/50 flex items-start gap-2.5 text-xs text-emerald-400 animate-in fade-in">
          <Check className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {/* Full Name */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="name"
          className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 px-1"
        >
          <User size={13} className="text-zinc-500" />
          Full Name
        </label>
        <div className="relative">
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            required
            minLength={2}
            maxLength={50}
            className="w-full bg-[#121316] border border-zinc-800/80 rounded-2xl px-4 py-3.5 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm font-medium transition-all"
          />
        </div>
      </div>

      {/* UPI ID */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="upiId"
          className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 px-1"
        >
          <CreditCard size={13} className="text-zinc-500" />
          UPI ID
        </label>
        <div className="relative">
          <input
            id="upiId"
            type="text"
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            placeholder="e.g. yourname@okhdfcbank"
            required
            className="w-full bg-[#121316] border border-zinc-800/80 rounded-2xl px-4 py-3.5 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm font-mono transition-all"
          />
        </div>
        <p className="text-[11px] text-zinc-500 px-1">
          Used by friends to settle balances directly into your bank via UPI.
        </p>
      </div>

      {/* Phone Number (Read-Only Primary Identifier) */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between px-1">
          <label
            htmlFor="phone"
            className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5"
          >
            <Phone size={13} className="text-zinc-500" />
            Phone Number
          </label>
          <span className="text-[10px] text-zinc-500 flex items-center gap-1">
            <Lock size={10} /> Verified ID
          </span>
        </div>
        <div className="relative">
          <input
            id="phone"
            type="tel"
            value={initialUser.phone || ""}
            readOnly
            disabled
            className="w-full bg-[#15171b] border border-zinc-800/40 rounded-2xl px-4 py-3.5 text-zinc-400 cursor-not-allowed text-sm font-mono select-none"
          />
        </div>
        <p className="text-[10px] text-zinc-500 px-1">
          Your phone number is your primary DuoPay account credential.
        </p>
      </div>

      {/* Email Address */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="email"
          className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 px-1"
        >
          <Mail size={13} className="text-zinc-500" />
          Email Address (Optional)
        </label>
        <div className="relative">
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your.email@example.com"
            className="w-full bg-[#121316] border border-zinc-800/80 rounded-2xl px-4 py-3.5 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm font-medium transition-all"
          />
        </div>
      </div>

      {/* Form Action Buttons */}
      <div className="flex flex-col gap-3 mt-4">
        <button
          type="submit"
          disabled={loading}
          className="w-full min-h-[48px] bg-blue-600 hover:bg-blue-500 active:scale-98 text-white rounded-2xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving Changes...</span>
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              <span>Save Changes</span>
            </>
          )}
        </button>

        <Link
          href="/profile"
          className="w-full min-h-[44px] flex items-center justify-center text-sm font-semibold text-zinc-400 hover:text-zinc-200 active:bg-zinc-900 rounded-2xl transition-colors border border-transparent"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
