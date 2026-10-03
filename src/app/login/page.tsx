import { signIn, auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { LoginForm } from "./LoginForm"

export default async function LoginPage() {
  const session = await auth()
  
  if (session) {
    redirect('/')
  }

  async function handleLogin(formData: FormData) {
    "use server"
    await signIn("credentials", formData)
  }

  return (
    <div className="flex flex-col flex-1 w-full min-h-[100dvh] bg-[#09090b] text-white justify-between items-center px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] selection:bg-zinc-800 selection:text-white overflow-hidden">
      <div className="w-full flex-1 flex flex-col justify-center items-center">
        <LoginForm loginAction={handleLogin} />
      </div>
    </div>
  )
}
