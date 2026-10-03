export default function AppLoading() {
  return (
    <div className="flex flex-col flex-1 bg-gray-50 pb-20 animate-pulse">
      {/* Header skeleton */}
      <header className="bg-white px-6 pt-8 pb-6 border-b border-gray-100 sticky top-0 z-10">
        <div className="flex justify-between items-center mb-6">
          <div className="w-10 h-10 rounded-full bg-gray-200" />
          <div className="w-24 h-7 bg-gray-100 rounded-full" />
        </div>

        {/* Balance cards skeleton */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-100 h-28 rounded-2xl p-4 flex flex-col justify-between">
            <div className="w-16 h-3 bg-gray-200 rounded" />
            <div className="w-24 h-7 bg-gray-200 rounded" />
          </div>
          <div className="bg-gray-100 h-28 rounded-2xl p-4 flex flex-col justify-between">
            <div className="w-16 h-3 bg-gray-200 rounded" />
            <div className="w-24 h-7 bg-gray-200 rounded" />
          </div>
        </div>
      </header>

      {/* Main content skeleton */}
      <div className="flex-1 px-6 py-6">
        <div className="w-full bg-gray-200 h-[52px] rounded-xl mb-8" />

        <div className="flex items-center justify-between mb-4">
          <div className="w-28 h-5 bg-gray-200 rounded" />
          <div className="w-14 h-4 bg-gray-100 rounded" />
        </div>

        <div className="grid gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gray-100" />
              <div className="flex-1 space-y-2">
                <div className="w-32 h-4 bg-gray-100 rounded" />
                <div className="w-20 h-3 bg-gray-50 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom navigation skeleton */}
      <nav className="fixed bottom-0 w-full max-w-md mx-auto bg-white border-t border-gray-100 flex justify-between px-6 pb-[env(safe-area-inset-bottom)] pt-2 z-20">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex flex-col items-center p-2">
            <div className="w-6 h-6 rounded-full bg-gray-100" />
            <div className="w-8 h-2 bg-gray-100 rounded mt-1.5" />
          </div>
        ))}
      </nav>
    </div>
  );
}
