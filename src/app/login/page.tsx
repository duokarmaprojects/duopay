import { signIn } from "@/lib/auth"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { InstallPwaButton } from "@/components/ui/InstallPwaButton"

export default async function LoginPage() {
  const session = await auth()
  
  if (session) {
    redirect('/')
  }

  return (
    <div className="flex flex-col items-center justify-center flex-1 p-6 bg-white">
      <div className="w-full max-w-sm flex flex-col items-center">
        <div className="w-20 h-20 bg-black text-white rounded-2xl flex items-center justify-center text-3xl font-bold mb-6">
          D
        </div>
        <h1 className="text-3xl font-bold mb-2">DuoPay</h1>
        <p className="text-gray-500 mb-10 text-center">
          Split. Simplify. Get to ₹0.
        </p>

        <form
          action={async (formData) => {
            "use server"
            await signIn("credentials", formData)
          }}
          className="w-full flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Phone Number</label>
            <input 
              name="phone" 
              type="tel" 
              required 
              placeholder="+91 9876543210" 
              className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>
          <div className="flex flex-col gap-1 mb-2">
            <label className="text-sm font-medium text-gray-700">Name (if new user)</label>
            <input 
              name="name" 
              type="text" 
              placeholder="e.g. Rahul" 
              className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-3 bg-black hover:bg-gray-800 text-white font-semibold py-3.5 px-4 rounded-xl transition-colors"
          >
            Continue with Phone
          </button>
          
          <InstallPwaButton />
        </form>
      </div>
    </div>
  )
}
