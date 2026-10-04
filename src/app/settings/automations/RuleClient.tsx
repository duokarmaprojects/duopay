"use client"

import { useState } from "react"
import { createRule, updateRule, deleteRule } from "@/actions/automation"
import { Plus, Trash2, Edit2, Check, X, AlertCircle } from "lucide-react"

type Rule = {
  id: string
  name: string
  merchantName: string | null
  minAmount: number | null
  maxAmount: number | null
  source: string | null
  groupId: string | null
  setCategory: string | null
  priority: number
  isActive: boolean
}

export default function RuleClient({ initialRules }: { initialRules: Rule[] }) {
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>, id?: string) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const formData = new FormData(e.currentTarget)
    try {
      if (id) {
        await updateRule(id, formData)
        setEditingId(null)
      } else {
        await createRule(formData)
        setIsAdding(false)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    if (confirm("Are you sure you want to delete this rule?")) {
      setLoading(true)
      try {
        await deleteRule(id)
      } catch (err: any) {
        alert(err.message)
      } finally {
        setLoading(false)
      }
    }
  }

  function RuleForm({ rule, onCancel }: { rule?: Rule; onCancel: () => void }) {
    return (
      <form onSubmit={(e) => handleSubmit(e, rule?.id)} className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-gray-100 dark:border-zinc-800 shadow-sm flex flex-col gap-4 mb-4">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm">
            <AlertCircle size={16} />
            {error}
          </div>
        )}
        
        <div>
          <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1 block">Rule Name</label>
          <input required name="name" defaultValue={rule?.name} placeholder="e.g. Uber Rides" className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1 block">Merchant Contains</label>
            <input name="merchantName" defaultValue={rule?.merchantName || ""} placeholder="e.g. Uber" className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1 block">Set Category</label>
            <select required name="setCategory" defaultValue={rule?.setCategory || "TRANSPORT"} className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white">
              <option value="FOOD">Food & Dining</option>
              <option value="TRANSPORT">Transportation</option>
              <option value="GROCERIES">Groceries</option>
              <option value="SHOPPING">Shopping</option>
              <option value="ENTERTAINMENT">Entertainment</option>
              <option value="TRAVEL">Travel</option>
              <option value="BILLS">Bills & Utilities</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1 block">Min Amount (Paise)</label>
            <input type="number" name="minAmount" defaultValue={rule?.minAmount || ""} placeholder="0" className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1 block">Max Amount (Paise)</label>
            <input type="number" name="maxAmount" defaultValue={rule?.maxAmount || ""} placeholder="No limit" className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white" />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" name="isActive" defaultChecked={rule ? rule.isActive : true} className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black dark:border-zinc-700 dark:bg-zinc-800" />
            <span className="text-sm font-medium text-gray-700 dark:text-zinc-300">Rule Active</span>
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} disabled={loading} className="px-4 py-2 text-sm font-bold text-gray-600 dark:text-zinc-400 bg-gray-100 dark:bg-zinc-800 rounded-xl hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="px-4 py-2 text-sm font-bold text-white bg-black dark:bg-white dark:text-black rounded-xl hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center gap-2">
              <Check size={16} />
              Save
            </button>
          </div>
        </div>
      </form>
    )
  }

  return (
    <div>
      {isAdding ? (
        <RuleForm onCancel={() => setIsAdding(false)} />
      ) : (
        <button onClick={() => setIsAdding(true)} className="w-full mb-4 py-4 flex items-center justify-center gap-2 text-sm font-bold text-black dark:text-white bg-white dark:bg-zinc-900 border-2 border-dashed border-gray-200 dark:border-zinc-800 rounded-2xl hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
          <Plus size={18} />
          Create New Rule
        </button>
      )}

      <div className="flex flex-col gap-3">
        {initialRules.map(rule => editingId === rule.id ? (
          <RuleForm key={rule.id} rule={rule} onCancel={() => setEditingId(null)} />
        ) : (
          <div key={rule.id} className={`bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-gray-100 dark:border-zinc-800 shadow-sm flex flex-col gap-2 ${!rule.isActive && 'opacity-60'}`}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 dark:text-zinc-100">{rule.name}</h3>
              <div className="flex items-center gap-1">
                <button onClick={() => setEditingId(rule.id)} className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-zinc-100 transition-colors">
                  <Edit2 size={16} />
                </button>
                <button onClick={() => handleDelete(rule.id)} disabled={loading} className="p-2 text-red-400 hover:text-red-600 transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {rule.merchantName && (
                <span className="text-xs font-medium bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 px-2 py-1 rounded-md">
                  Merchant: {rule.merchantName}
                </span>
              )}
              {rule.setCategory && (
                <span className="text-xs font-medium bg-black dark:bg-white text-white dark:text-black px-2 py-1 rounded-md">
                  Set: {rule.setCategory}
                </span>
              )}
            </div>
          </div>
        ))}
        {initialRules.length === 0 && !isAdding && (
          <div className="text-center py-10 text-gray-500 dark:text-zinc-500 text-sm">
            No rules created yet.
          </div>
        )}
      </div>
    </div>
  )
}
