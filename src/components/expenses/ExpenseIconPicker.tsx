"use client"

import { useState } from "react";
import { ExpenseCategory, getExpenseCategory } from "@/domain/expenseIcon";
import { ExpenseIcon, getExpenseIconDetails } from "./ExpenseIcon";

interface Props {
  currentCategory: ExpenseCategory | "AUTO";
  onSelect: (category: ExpenseCategory | "AUTO") => void;
  description: string;
}

const ALL_CATEGORIES: ExpenseCategory[] = [
  "FOOD", "COFFEE", "GROCERIES", "TRAVEL", "FLIGHT", "HOTEL", "TRANSPORT", 
  "FUEL", "ENTERTAINMENT", "SHOPPING", "RENT", "HEALTH", "GYM", "BILLS", 
  "EDUCATION", "GIFT", "ELECTRONICS", "HOME", "OTHER"
];

export function ExpenseIconPicker({ currentCategory, onSelect, description }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  // If in AUTO mode, derive the category from the description dynamically
  const displayedCategory = currentCategory === "AUTO" ? getExpenseCategory(description) : currentCategory;

  return (
    <div className="relative shrink-0">
      <button 
        type="button" 
        onClick={() => setIsOpen(!isOpen)}
        className="relative group active:scale-95 transition-transform"
      >
        <div key={displayedCategory} className="animate-in fade-in zoom-in duration-200">
          <ExpenseIcon 
            category={displayedCategory} 
            description={description} 
            size={24} 
            className="w-14 h-14 rounded-2xl bg-gray-50 dark:bg-[#1a222c] border border-gray-100 dark:border-gray-800"
          />
        </div>
        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white dark:bg-[#111820] border border-gray-200 dark:border-gray-700 rounded-full flex items-center justify-center shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
        </div>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-16 left-0 z-50 bg-white border border-gray-100 shadow-xl rounded-2xl p-2 w-64 max-h-64 overflow-y-auto grid grid-cols-4 gap-1">
            <button
              type="button"
              onClick={() => { onSelect("AUTO"); setIsOpen(false); }}
              className={`flex flex-col items-center justify-center p-2 rounded-xl text-[10px] font-medium gap-1 ${currentCategory === "AUTO" ? "bg-gray-100" : "hover:bg-gray-50"}`}
            >
              <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold text-xs">A</div>
              <span>Auto</span>
            </button>
            {ALL_CATEGORIES.map(cat => {
              const details = getExpenseIconDetails(cat);
              const Icon = details.Icon;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => { onSelect(cat); setIsOpen(false); }}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl text-[10px] font-medium gap-1 ${currentCategory === cat ? "bg-gray-100" : "hover:bg-gray-50"}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${details.bgClass}`}>
                    <Icon size={14} />
                  </div>
                  <span className="truncate w-full text-center">{details.label}</span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  );
}
