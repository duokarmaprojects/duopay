"use client"

import { useState, useRef, useMemo } from "react"
import { addExpense } from "@/actions/expense"
import { Camera, Image as ImageIcon, UploadCloud, CheckCircle2, AlertTriangle, AlertCircle, Trash2, Edit2, ChevronRight, Check } from "lucide-react"
import { getReceiptExtractor } from "@/receipt/extractReceipt"
import { ExtractedReceipt, ReceiptItem } from "@/receipt/receiptTypes"
import { paiseToInr, inrToPaise, calculateEqualSplit } from "@/domain/money"

type Member = { id: string; name: string; image: string | null }

type Step = "IDLE" | "EXTRACTING" | "REVIEW" | "ASSIGN"

export function ReceiptScanner({ groupId, members, currentUserId }: { groupId: string, members: Member[], currentUserId: string }) {
  const [step, setStep] = useState<Step>("IDLE")
  const [receipt, setReceipt] = useState<ExtractedReceipt | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  // Edit states for review screen
  const [merchant, setMerchant] = useState("")
  const [totalInr, setTotalInr] = useState("")
  const [items, setItems] = useState<ReceiptItem[]>([])

  // Assignment states for assign screen
  // itemAssignments[itemId] = Set of userIds who share this item
  const [itemAssignments, setItemAssignments] = useState<Record<string, Set<string>>>({})
  const [payerId, setPayerId] = useState(currentUserId)
  
  const totalPaise = useMemo(() => inrToPaise(parseFloat(totalInr) || 0), [totalInr])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setStep("EXTRACTING")
    
    try {
      const extractor = getReceiptExtractor()
      const data = await extractor.extract(file)
      setReceipt(data)
      
      // Initialize edit states
      setMerchant(data.merchant || "")
      setTotalInr(data.totalPaise ? paiseToInr(data.totalPaise).toString() : "")
      setItems(data.items || [])
      
      // Initialize assignments (all empty)
      const initialAssigments: Record<string, Set<string>> = {}
      data.items.forEach(item => {
        initialAssigments[item.id] = new Set()
      })
      setItemAssignments(initialAssigments)

      setStep("REVIEW")
    } catch (err) {
      alert("Failed to read receipt. Please try entering manually.")
      setStep("IDLE")
    }
  }

  // --- REVIEW SCREEN ACTIONS ---
  const handleItemChange = (id: string, newName: string, newAmountInr: string) => {
    setItems(items.map(item => 
      item.id === id 
        ? { ...item, name: newName, amountPaise: inrToPaise(parseFloat(newAmountInr) || 0) } 
        : item
    ))
  }

  const handleRemoveItem = (id: string) => {
    setItems(items.filter(item => item.id !== id))
    const newAssignments = { ...itemAssignments }
    delete newAssignments[id]
    setItemAssignments(newAssignments)
  }

  const handleAddItem = () => {
    const newId = crypto.randomUUID()
    setItems([...items, { id: newId, name: "New Item", amountPaise: 0 }])
    setItemAssignments({ ...itemAssignments, [newId]: new Set() })
  }

  const itemsTotalPaise = items.reduce((sum, item) => sum + item.amountPaise, 0)
  const isMatch = Math.abs(itemsTotalPaise - totalPaise) < 1

  const proceedToAssignment = () => {
    if (!isMatch) {
      alert("Items total does not match the receipt total. Please review.")
      return
    }
    setStep("ASSIGN")
  }

  // --- ASSIGN SCREEN ACTIONS ---
  const toggleItemAssignment = (itemId: string, userId: string) => {
    const newSet = new Set(itemAssignments[itemId])
    if (newSet.has(userId)) newSet.delete(userId)
    else newSet.add(userId)
    
    setItemAssignments({ ...itemAssignments, [itemId]: newSet })
  }

  const toggleAssignAll = (itemId: string) => {
    const set = itemAssignments[itemId]
    if (set.size === members.length) {
      setItemAssignments({ ...itemAssignments, [itemId]: new Set() })
    } else {
      setItemAssignments({ ...itemAssignments, [itemId]: new Set(members.map(m => m.id)) })
    }
  }

  // Calculate live preview
  let finalShares: Record<string, number> = {}
  members.forEach(m => finalShares[m.id] = 0)
  let allItemsAssigned = true

  items.forEach(item => {
    const assignees = Array.from(itemAssignments[item.id] || [])
    if (assignees.length === 0) {
      allItemsAssigned = false
    } else {
      try {
        const itemSplit = calculateEqualSplit(item.amountPaise, assignees)
        for (const [userId, share] of Object.entries(itemSplit)) {
          finalShares[userId] += share
        }
      } catch (e) {
        allItemsAssigned = false
      }
    }
  })

  const totalAssignedPaise = Object.values(finalShares).reduce((a, b) => a + b, 0)
  const isReadyToSubmit = allItemsAssigned && Math.abs(totalAssignedPaise - totalPaise) < 1

  if (step === "IDLE") {
    return (
      <div className="flex flex-col items-center justify-center p-8 h-full bg-gray-50">
        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-gray-400 shadow-sm mb-6 border border-gray-100">
          <Camera size={40} />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Scan Receipt</h2>
        <p className="text-gray-500 text-center text-sm mb-8">
          Take a photo of your receipt or upload an existing image.
        </p>

        <div className="flex flex-col gap-4 w-full max-w-xs">
          <input 
            type="file" 
            accept="image/*" 
            capture="environment" 
            ref={cameraInputRef} 
            onChange={handleFileSelect} 
            className="hidden" 
          />
          <button 
            onClick={() => cameraInputRef.current?.click()}
            className="bg-black text-white font-semibold py-4 rounded-xl shadow-lg active:bg-gray-800 transition-colors w-full flex items-center justify-center gap-2"
          >
            <Camera size={18} />
            Take Photo
          </button>

          <input 
            type="file" 
            accept="image/*" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            className="hidden" 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="bg-white border border-gray-200 text-gray-700 font-semibold py-4 rounded-xl active:bg-gray-50 transition-colors w-full flex items-center justify-center gap-2"
          >
            <ImageIcon size={18} />
            Upload from Device
          </button>
        </div>
      </div>
    )
  }

  if (step === "EXTRACTING") {
    return (
      <div className="flex flex-col items-center justify-center p-8 h-full bg-gray-50">
        <div className="w-16 h-16 relative mb-6">
          <div className="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-black rounded-full border-t-transparent animate-spin"></div>
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">Reading receipt...</h2>
        
        <div className="flex flex-col gap-3 w-full max-w-xs mt-6 text-sm">
          <div className="flex items-center gap-3 text-gray-700"><CheckCircle2 size={16} className="text-emerald-500"/> Detecting merchant...</div>
          <div className="flex items-center gap-3 text-gray-700"><CheckCircle2 size={16} className="text-emerald-500"/> Finding total...</div>
          <div className="flex items-center gap-3 text-gray-400 animate-pulse"><UploadCloud size={16}/> Reading items...</div>
        </div>
      </div>
    )
  }

  if (step === "REVIEW") {
    return (
      <div className="flex flex-col h-full bg-gray-50 relative pb-32 overflow-y-auto">
        <div className="p-6 pb-2">
          <h2 className="text-xl font-bold text-gray-900">Review Receipt</h2>
          {receipt?.confidence !== "HIGH" && (
            <div className="mt-3 bg-orange-50 border border-orange-200 text-orange-700 p-3 rounded-xl flex items-start gap-2 text-sm">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <p>We couldn't perfectly read every detail. Please review carefully before continuing.</p>
            </div>
          )}
        </div>

        <div className="p-6 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">Merchant</label>
            <input 
              type="text" 
              value={merchant} 
              onChange={e => setMerchant(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:border-black focus:outline-none"
            />
          </div>
          
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">Receipt Total (₹)</label>
            <input 
              type="number" 
              step="0.01"
              value={totalInr} 
              onChange={e => setTotalInr(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-xl font-bold focus:border-black focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-2 mt-4">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-gray-700">Items</label>
              <button onClick={handleAddItem} className="text-xs font-bold text-black uppercase tracking-wide">
                + Add Item
              </button>
            </div>
            
            <div className="flex flex-col gap-2">
              {items.map((item, idx) => (
                <div key={item.id} className="flex items-center gap-2 bg-white p-2 rounded-xl border border-gray-200">
                  <input 
                    type="text" 
                    value={item.name}
                    onChange={e => handleItemChange(item.id, e.target.value, paiseToInr(item.amountPaise).toString())}
                    className="flex-1 bg-transparent px-2 py-1 outline-none text-sm font-medium"
                    placeholder="Item name"
                  />
                  <span className="text-gray-400 font-medium">₹</span>
                  <input 
                    type="number" 
                    step="0.01"
                    value={item.amountPaise === 0 ? "" : paiseToInr(item.amountPaise)}
                    onChange={e => handleItemChange(item.id, item.name, e.target.value)}
                    className="w-20 bg-transparent px-1 py-1 outline-none text-sm text-right font-bold"
                    placeholder="0.00"
                  />
                  <button onClick={() => handleRemoveItem(item.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-4 flex justify-between items-center p-4 bg-gray-100 rounded-xl">
              <span className="font-semibold text-gray-700">Sum of Items</span>
              <div className="flex items-center gap-2">
                <span className={`font-bold ${isMatch ? 'text-emerald-600' : 'text-red-500'}`}>
                  ₹{paiseToInr(itemsTotalPaise).toFixed(2)}
                </span>
                {!isMatch && <AlertCircle size={16} className="text-red-500" />}
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 pb-24 flex flex-col items-center">
           <p className="text-sm text-gray-500 mb-3">Don't want to assign individual items?</p>
           <button 
             onClick={() => window.location.href = `/expenses/add?groupId=${groupId}&mode=manual&amount=${totalInr}&desc=${encodeURIComponent(merchant)}`}
             className="text-sm font-bold text-black uppercase tracking-wider active:text-gray-600 transition-colors"
           >
             Split entire receipt
           </button>
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 max-w-md mx-auto z-20 flex gap-3">
          <button
            onClick={() => setStep("IDLE")}
            className="flex-1 bg-white border border-gray-200 text-gray-900 font-semibold py-4 rounded-xl active:bg-gray-50 transition-colors"
          >
            Retake
          </button>
          <button
            onClick={proceedToAssignment}
            className="flex-1 bg-black text-white font-semibold py-4 rounded-xl shadow-lg active:bg-gray-800 transition-colors"
          >
            Continue
          </button>
        </div>
      </div>
    )
  }

  if (step === "ASSIGN") {
    return (
      <div className="flex flex-col h-full bg-gray-50 relative pb-64 overflow-y-auto">
        <div className="p-6 pb-2">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Who had what?</h2>
          <p className="text-sm text-gray-500">Assign items to participants to automatically split the receipt.</p>
        </div>

        <div className="px-4 flex flex-col gap-4 mt-2">
          {items.map(item => {
            const assignees = itemAssignments[item.id] || new Set()
            return (
              <div key={item.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                  <span className="font-semibold text-gray-900 text-sm truncate pr-2">{item.name}</span>
                  <span className="font-bold text-gray-900">₹{paiseToInr(item.amountPaise)}</span>
                </div>
                <div className="p-3">
                  <div className="flex flex-wrap gap-2 mb-2">
                    {members.map(m => {
                      const isAssigned = assignees.has(m.id)
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => toggleItemAssignment(item.id, m.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                            isAssigned 
                              ? 'bg-black text-white border-black' 
                              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          {m.id === currentUserId ? "You" : m.name.split(' ')[0]}
                        </button>
                      )
                    })}
                  </div>
                  <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-50">
                    <button 
                      onClick={() => toggleAssignAll(item.id)}
                      className="text-[11px] font-bold uppercase tracking-wider text-gray-400 active:text-gray-900"
                    >
                      {assignees.size === members.length ? 'Clear All' : 'Select Everyone'}
                    </button>
                    <span className="text-xs font-medium text-gray-500">
                      {assignees.size > 0 
                        ? `₹${paiseToInr(calculateEqualSplit(item.amountPaise, Array.from(assignees))[Array.from(assignees)[0]])} each`
                        : <span className="text-red-500 flex items-center gap-1"><AlertCircle size={12}/> Unassigned</span>}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 max-w-md mx-auto z-20 pb-safe">
          {/* Payer Selection */}
          <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-gray-50">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Paid by</span>
            <select 
              value={payerId}
              onChange={(e) => setPayerId(e.target.value)}
              className="text-sm font-semibold bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 outline-none"
            >
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.id === currentUserId ? "You" : m.name}</option>
              ))}
            </select>
          </div>
          
          {/* Split Preview Panel */}
          <div className="px-4 py-3">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Split Preview</span>
              <span className={`text-xs font-bold ${isReadyToSubmit ? 'text-emerald-500' : 'text-red-500'}`}>
                {paiseToInr(totalAssignedPaise).toFixed(2)} / {paiseToInr(totalPaise).toFixed(2)}
              </span>
            </div>
            
            <div className="flex overflow-x-auto gap-3 pb-3 scrollbar-hide">
              {members.map(m => (
                <div key={m.id} className="flex flex-col items-center flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-gray-100 mb-1 flex items-center justify-center text-xs font-bold text-gray-500 overflow-hidden">
                    {m.image ? <img src={m.image} alt="" className="w-full h-full object-cover"/> : m.name.charAt(0)}
                  </div>
                  <span className="text-[10px] text-gray-500 font-medium truncate max-w-[50px]">
                    {m.id === currentUserId ? "You" : m.name.split(' ')[0]}
                  </span>
                  <span className="text-xs font-bold text-gray-900 mt-0.5">₹{paiseToInr(finalShares[m.id] || 0)}</span>
                </div>
              ))}
            </div>

            <form action={addExpense}>
              <input type="hidden" name="groupId" value={groupId} />
              <input type="hidden" name="description" value={merchant || "Receipt Scan"} />
              <input type="hidden" name="amount" value={totalInr} />
              <input type="hidden" name="payerId" value={payerId} />
              <input type="hidden" name="splitMethod" value="EXACT" />
              {/* Prepare participants and exact split data for server action */}
              {members.map(m => (
                finalShares[m.id] > 0 && <input key={`p_${m.id}`} type="hidden" name="participants" value={m.id} />
              ))}
              <input type="hidden" name="splitData" value={JSON.stringify(finalShares)} />

              <button
                type="submit"
                disabled={!isReadyToSubmit}
                className="w-full bg-black text-white font-semibold py-3.5 rounded-xl shadow-lg active:bg-gray-800 transition-colors disabled:opacity-50 mt-1"
              >
                Create Expense
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return null;
}
