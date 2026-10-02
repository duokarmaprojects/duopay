"use client"

import { useState } from "react"
import { Palette, ChevronRight, Check } from "lucide-react"
import { useTheme } from "../theme-provider"

export default function AppearanceSettings() {
  const [isOpen, setIsOpen] = useState(false)
  const { theme, setTheme } = useTheme()

  return (
    <>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-white border-b border-gray-50 active:bg-gray-50 transition-colors last:rounded-b-2xl last:border-b-0"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-50 text-gray-600">
            <Palette size={20} />
          </div>
          <div className="text-left">
            <p className="font-semibold text-sm text-gray-900">Appearance</p>
            <p className="text-xs mt-0.5 text-gray-500 capitalize">{theme} Mode</p>
          </div>
        </div>
        <ChevronRight size={20} className={`text-gray-300 transition-transform ${isOpen ? "rotate-90" : ""}`} />
      </button>

      {isOpen && (
        <div className="bg-gray-50 border-b border-gray-100 p-2">
          <div className="flex flex-col gap-1 bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 p-1">
            {(['light', 'dark', 'system'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className="flex items-center justify-between p-3 rounded-lg text-sm font-medium hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${theme === t ? 'border-black' : 'border-gray-300'}`}>
                    {theme === t && <div className="w-2.5 h-2.5 bg-black rounded-full" />}
                  </div>
                  <span className="capitalize text-gray-900">{t}</span>
                </div>
                {theme === t && <Check size={16} className="text-black" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
