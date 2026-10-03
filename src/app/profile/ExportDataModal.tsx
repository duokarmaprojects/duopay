"use client"

import { useState } from "react"
import { Download, FileText, FileSpreadsheet, Loader2 } from "lucide-react"
import { exportUserData } from "@/actions/export"

export default function ExportDataModal() {
  const [loading, setLoading] = useState(false)

  const handleExport = async (format: "CSV" | "JSON") => {
    setLoading(true)
    try {
      const res = await exportUserData(format)
      const blob = new Blob([res.data], { type: res.mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = res.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e: any) {
      alert(e.message || "Failed to export data")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-between p-4 border-b border-gray-50 last:border-b-0">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
          <Download size={20} />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-gray-900">Export Your Data</h4>
          <p className="text-xs text-gray-500">Download expenses & settlements</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => handleExport("CSV")}
          disabled={loading}
          className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-1 active:scale-95 transition-all disabled:opacity-50"
          title="Download as CSV spreadsheet"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <FileSpreadsheet size={13} />}
          <span>CSV</span>
        </button>

        <button
          onClick={() => handleExport("JSON")}
          disabled={loading}
          className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-1 active:scale-95 transition-all disabled:opacity-50"
          title="Download as JSON raw data"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <FileText size={13} />}
          <span>JSON</span>
        </button>
      </div>
    </div>
  )
}
