"use client"

import { useState, useMemo } from "react"
import { X, Search, Plus, Pencil } from "lucide-react"
import { GROUP_ICONS, GroupIconCategory, resolveGroupIcon } from "@/data/groupIcons"
import { GroupIcon } from "./GroupIcon"

export function GroupIconPicker({ name = "image", defaultValue = "" }: { name?: string, defaultValue?: string }) {
  const [selected, setSelected] = useState(defaultValue)
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const handleSelect = (iconId: string) => {
    setSelected(iconId)
    setIsOpen(false)
    setSearchQuery("")
  }

  // Group icons by category or filter by search
  const displayedIcons = useMemo(() => {
    if (!searchQuery.trim()) {
      const grouped = GROUP_ICONS.reduce((acc, icon) => {
        if (!acc[icon.category]) acc[icon.category] = []
        acc[icon.category].push(icon)
        return acc
      }, {} as Record<string, typeof GROUP_ICONS>)
      return grouped
    }

    // Search mode
    const lowerQ = searchQuery.toLowerCase()
    const filtered = GROUP_ICONS.filter(i => 
      i.label.toLowerCase().includes(lowerQ) || 
      i.keywords.some(k => k.toLowerCase().includes(lowerQ))
    )
    return { "Search Results": filtered }
  }, [searchQuery])

  const hasSelection = !!selected
  const currentIconDef = hasSelection ? resolveGroupIcon(selected) : null

  return (
    <>
      <input type="hidden" name={name} value={selected} />
      
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={hasSelection ? "Change group icon" : "Choose group icon"}
        className="relative flex flex-col items-center justify-center gap-2 w-32 h-32 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#1a222c] hover:bg-gray-100 dark:hover:bg-[#222b36] transition-all active:scale-95 group shadow-sm overflow-hidden"
      >
        <div className="absolute top-2 right-2 text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
          {hasSelection ? <Pencil size={14} /> : <Plus size={14} />}
        </div>

        <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-white dark:bg-[#111820] shadow-sm border border-gray-100 dark:border-gray-800 text-gray-900 dark:text-white">
          {hasSelection && currentIconDef ? (
            <currentIconDef.icon size={24} strokeWidth={2} />
          ) : (
            <Plus size={24} strokeWidth={2} className="text-gray-400" />
          )}
        </div>
        
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
          {hasSelection ? "Change icon" : "Choose icon"}
        </span>
      </button>
      
      <p className="text-xs text-gray-500 mt-2 text-center">
        Pick an icon to help identify your group.
      </p>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4 animate-in fade-in duration-200">
          <div 
            className="w-full max-w-lg bg-white dark:bg-[#111820] rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 flex flex-col max-h-[85vh] sm:max-h-[80vh]"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-white dark:bg-[#111820] shrink-0">
              <h2 className="font-bold text-gray-900 dark:text-white text-lg">Choose an icon</h2>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-50 dark:bg-gray-900 rounded-full transition-colors shadow-sm border border-gray-200 dark:border-gray-800"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 shrink-0 bg-white dark:bg-[#111820]">
              <div className="relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text"
                  placeholder="Search icons..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-[#1a222c] border border-gray-200 dark:border-gray-800 rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white text-sm dark:text-white"
                  autoFocus
                />
              </div>
            </div>

            <div className="p-2 sm:p-4 overflow-y-auto flex-1 bg-white dark:bg-[#111820]">
              {Object.keys(displayedIcons).length === 0 ? (
                <div className="py-12 text-center text-gray-500">
                  No icons found for "{searchQuery}"
                </div>
              ) : (
                <div className="flex flex-col gap-6 pb-8">
                  {Object.entries(displayedIcons).map(([category, icons]) => (
                    <div key={category}>
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-2">
                        {category}
                      </h3>
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                        {icons.map(iconDef => {
                          const IconComponent = iconDef.icon
                          const isSelected = selected === iconDef.id
                          return (
                            <button
                              key={iconDef.id}
                              type="button"
                              onClick={() => handleSelect(iconDef.id)}
                              className={`aspect-square flex flex-col items-center justify-center gap-1.5 rounded-xl transition-all active:scale-90 ${
                                isSelected 
                                  ? 'bg-black text-white dark:bg-white dark:text-black shadow-md' 
                                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1a222c]'
                              }`}
                            >
                              <IconComponent size={24} strokeWidth={isSelected ? 2.5 : 2} />
                              <span className="text-[10px] font-medium truncate w-full text-center px-1">
                                {iconDef.label}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
