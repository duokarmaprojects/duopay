import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, UserCircle2 } from "lucide-react";
import ProfileImageUpload from "../upload-form";
import EditProfileClient from "./EditProfileClient";

export const metadata = {
  title: "Edit Profile - DuoPay",
};

export default async function EditProfilePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      phone: true,
      upiId: true,
      email: true,
      image: true,
    },
  });

  if (!user) {
    redirect("/login?expired=1");
  }

  return (
    <div className="flex flex-col flex-1 bg-[#09090b] text-zinc-100 min-h-screen">
      {/* Header */}
      <header className="bg-[#121316] px-4 py-4 flex items-center justify-between border-b border-zinc-800/80 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link
            href="/profile"
            className="p-2 -ml-2 text-zinc-400 hover:text-zinc-100 transition-colors rounded-full hover:bg-zinc-800"
            aria-label="Back to Profile"
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-600/20 text-blue-400 rounded-lg">
              <UserCircle2 size={16} />
            </div>
            <h1 className="text-xl font-bold text-zinc-100 tracking-tight">
              Edit Profile
            </h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6 max-w-md mx-auto w-full flex flex-col items-center">
        {/* Profile Photo Editor */}
        <div className="mb-6 flex flex-col items-center">
          <ProfileImageUpload
            currentImage={
              user.image?.startsWith("data:")
                ? `/api/users/${user.id}/avatar`
                : user.image || null
            }
            name={user.name || "User"}
          />
          <span className="text-xs text-zinc-400 mt-1 font-medium">
            Tap to change profile photo
          </span>
        </div>

        {/* Profile Edit Form */}
        <div className="w-full">
          <EditProfileClient
            initialUser={{
              name: user.name,
              phone: user.phone,
              upiId: user.upiId,
              email: user.email,
            }}
          />
        </div>
      </div>
    </div>
  );
}
