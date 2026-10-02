"use client"

import { useRef, useState } from "react"
import { uploadProfileImage } from "@/actions/user"
import { Camera } from "lucide-react"

export default function ProfileImageUpload({ currentImage, name }: { currentImage: string | null, name: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    const formData = new FormData()
    formData.append("image", file)
    
    try {
      await uploadProfileImage(formData)
    } catch (err) {
      console.error(err)
      alert("Failed to upload image")
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="relative mb-4 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
      <div className="w-24 h-24 rounded-full bg-gray-200 overflow-hidden border-4 border-white shadow-sm flex items-center justify-center">
        {currentImage ? (
          <img src={currentImage} alt="Profile" className={`w-full h-full object-cover ${isUploading ? 'opacity-50' : ''}`} />
        ) : (
          <div className={`w-full h-full flex items-center justify-center text-gray-500 text-3xl font-bold ${isUploading ? 'opacity-50' : ''}`}>
            {name?.charAt(0) || 'U'}
          </div>
        )}
      </div>
      <div className="absolute bottom-0 right-0 bg-black text-white p-2 rounded-full border-2 border-white shadow-sm">
        <Camera size={14} />
      </div>
      <input 
        type="file" 
        accept="image/*" 
        className="hidden" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
      />
    </div>
  )
}
