"use client";

import { useRef, useState } from "react";
import { uploadProfileImage } from "@/actions/user";
import { Camera, Image as ImageIcon, Check, X, Loader2 } from "lucide-react";

export default function ProfileImageUpload({
  currentImage,
  name,
}: {
  currentImage: string | null;
  name: string;
}) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState<string | null>(currentImage);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSheet, setShowSheet] = useState(false);

  // Client-side image compression using canvas
  const processAndCompress = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        return reject(new Error("Please select an image file (JPEG, PNG, or WebP)."));
      }

      // 15MB max raw file check
      if (file.size > 15 * 1024 * 1024) {
        return reject(new Error("Selected photo is too large. Please select a photo under 15MB."));
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Calculate proportional center-crop/fit within 320x320
          const targetSize = 320;
          let width = img.width;
          let height = img.height;

          const canvas = document.createElement("canvas");
          canvas.width = targetSize;
          canvas.height = targetSize;
          const ctx = canvas.getContext("2d");

          if (!ctx) {
            return reject(new Error("Failed to process image on device."));
          }

          // Center-crop to square
          let sx = 0,
            sy = 0,
            sSize = Math.min(width, height);
          if (width > height) {
            sx = (width - height) / 2;
          } else {
            sy = (height - width) / 2;
          }

          ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, targetSize, targetSize);

          // Compress to JPEG with 0.85 quality (~20KB-30KB)
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error("Could not load image."));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error("Could not read file."));
      reader.readAsDataURL(file);
    });
  };

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError(null);
    setIsCompressing(true);
    setShowSheet(false);

    try {
      const compressedDataUrl = await processAndCompress(file);
      setPreviewUrl(compressedDataUrl);
    } catch (err: any) {
      setError(err.message || "Failed to process photo.");
    } finally {
      setIsCompressing(false);
    }
  };

  const handleConfirmUpload = async () => {
    if (!previewUrl) return;

    setIsSaving(true);
    setError(null);

    const formData = new FormData();
    formData.append("dataUrl", previewUrl);

    try {
      await uploadProfileImage(formData);
      setActiveImage(previewUrl);
      setPreviewUrl(null);
    } catch (err: any) {
      setError(err.message || "Failed to upload photo. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      {/* Profile Avatar trigger */}
      <div
        className="relative mb-3 cursor-pointer active:scale-95 transition-transform group"
        onClick={() => setShowSheet(true)}
      >
        <div className="w-24 h-24 rounded-full bg-zinc-800 overflow-hidden border-2 border-zinc-700/80 shadow-lg flex items-center justify-center">
          {activeImage ? (
            <img
              src={activeImage}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-300 text-3xl font-bold bg-zinc-800">
              {name?.charAt(0) || "U"}
            </div>
          )}
        </div>
        <div className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full border-2 border-[#09090b] shadow-md flex items-center justify-center group-hover:scale-105 transition-transform">
          <Camera size={14} />
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 mb-3 bg-red-950/40 text-red-400 rounded-xl text-xs text-center border border-red-900/40">
          {error}
        </div>
      )}

      {/* Hidden Mobile File Inputs */}
      <input
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        ref={cameraInputRef}
        onChange={handleFilePicked}
      />
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,image/jpg"
        className="hidden"
        ref={galleryInputRef}
        onChange={handleFilePicked}
      />

      {/* Action Sheet: Camera or Gallery */}
      {showSheet && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-[#121316] border border-zinc-800 text-zinc-100 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl p-5 flex flex-col gap-3 animate-in slide-in-from-bottom-6 duration-200">
            <div className="flex justify-between items-center mb-1">
              <h3 className="font-bold text-base text-zinc-100">Change Profile Photo</h3>
              <button
                type="button"
                onClick={() => setShowSheet(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-100 rounded-full transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-zinc-400 mb-2">
              Select how you want to update your profile photo.
            </p>

            <button
              type="button"
              onClick={() => {
                cameraInputRef.current?.click();
              }}
              className="w-full flex items-center gap-3.5 px-4 py-3.5 bg-zinc-800/60 hover:bg-zinc-800 rounded-2xl font-semibold text-sm text-zinc-100 active:scale-98 transition-all border border-zinc-700/40"
            >
              <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center shrink-0">
                <Camera size={18} />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm text-zinc-100">Take Photo</p>
                <p className="text-[11px] text-zinc-400 font-normal">Use your phone camera</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                galleryInputRef.current?.click();
              }}
              className="w-full flex items-center gap-3.5 px-4 py-3.5 bg-zinc-800/60 hover:bg-zinc-800 rounded-2xl font-semibold text-sm text-zinc-100 active:scale-98 transition-all border border-zinc-700/40"
            >
              <div className="w-9 h-9 rounded-xl bg-zinc-700 text-zinc-300 flex items-center justify-center shrink-0">
                <ImageIcon size={18} />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm text-zinc-100">Choose from Photos</p>
                <p className="text-[11px] text-zinc-400 font-normal">Select from your photo gallery</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setShowSheet(false)}
              className="w-full py-3 mt-1 text-center font-semibold text-sm text-zinc-400 hover:text-zinc-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Photo Preview & Confirm Modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#121316] border border-zinc-800 text-zinc-100 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl p-6 flex flex-col items-center animate-in zoom-in-95 duration-200">
            <h3 className="font-bold text-base text-zinc-100 mb-1">Preview New Photo</h3>
            <p className="text-xs text-zinc-400 mb-6 text-center">
              Looking good! Would you like to set this as your profile photo?
            </p>

            <div className="w-32 h-32 rounded-full overflow-hidden border-2 border-zinc-700 shadow-inner mb-6 bg-zinc-800">
              <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
            </div>

            <div className="flex w-full gap-3">
              <button
                type="button"
                onClick={() => setPreviewUrl(null)}
                disabled={isSaving}
                className="flex-1 py-3 px-4 rounded-xl border border-zinc-700 text-zinc-300 font-semibold text-sm hover:bg-zinc-800 active:bg-zinc-800 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmUpload}
                disabled={isSaving}
                className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    <span>Save Photo</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
