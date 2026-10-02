import Link from "next/link"

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">
          🔒
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
        <p className="text-gray-500 mb-8">
          You do not have permission to view this page. This area is restricted to administrators only.
        </p>
        <Link 
          href="/"
          className="inline-block bg-black text-white font-medium px-6 py-3 rounded-xl hover:bg-gray-800 transition-colors"
        >
          Return to Dashboard
        </Link>
      </div>
    </div>
  )
}
