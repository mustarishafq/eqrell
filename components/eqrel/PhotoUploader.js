'use client'

import { useState, useRef } from 'react'
import { Upload, X, Loader2, Check, AlertCircle } from 'lucide-react'

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
const UPLOAD_URL = CLOUD_NAME ? `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload` : null
const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10MB

/**
 * Direct-to-Cloudinary photo uploader.
 * - Uses XMLHttpRequest for real upload progress
 * - Multiple files, sequential
 * - Returns array of secure_url via onUploaded callback
 * - Never touches our server for the file bytes (only URL saved after)
 */
export default function PhotoUploader({ onUploaded, disabled = false, labels = {} }) {
  const [items, setItems] = useState([]) // [{ file, progress, url, publicId, status, error }]
  const [busy, setBusy] = useState(false)
  const inputRef = useRef(null)

  const L = {
    pick:      labels.pick      || 'Upload gambar',
    uploading: labels.uploading || 'Uploading...',
    done:      labels.done      || 'Selesai',
    error:     labels.error     || 'Gagal',
    tooLarge:  labels.tooLarge  || 'Fail terlalu besar (max 10MB)',
    noConfig:  labels.noConfig  || 'Cloudinary belum dikonfigurasi',
    remove:    labels.remove    || 'Buang',
  }

  if (!UPLOAD_URL) {
    return (
      <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-center gap-2">
        <AlertCircle className="w-4 h-4" /> {L.noConfig}
      </div>
    )
  }

  const uploadOne = (file, onProgress) => new Promise((resolve, reject) => {
    const form = new FormData()
    form.append('file', file)
    form.append('upload_preset', UPLOAD_PRESET)
    const xhr = new XMLHttpRequest()
    xhr.open('POST', UPLOAD_URL, true)
    xhr.responseType = 'json'
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded * 100) / e.total))
    }
    xhr.onload = () => {
      const res = xhr.response ?? (() => { try { return JSON.parse(xhr.responseText || '{}') } catch { return {} } })()
      if (xhr.status >= 200 && xhr.status < 300 && res?.secure_url) {
        resolve({ secure_url: res.secure_url, public_id: res.public_id, width: res.width, height: res.height, format: res.format })
      } else {
        reject(new Error(res?.error?.message || `Upload failed (${xhr.status})`))
      }
    }
    xhr.onerror = () => reject(new Error('Network error'))
    xhr.send(form)
  })

  const handlePick = async (fileList) => {
    if (!fileList || fileList.length === 0) return
    const picked = Array.from(fileList).map(file => ({
      file, progress: 0, status: 'queued',
    }))
    setItems(picked)
    setBusy(true)

    const successfulUrls = []
    for (let i = 0; i < picked.length; i++) {
      const file = picked[i].file
      if (file.size > MAX_FILE_BYTES) {
        setItems(prev => prev.map((p, idx) => idx === i ? { ...p, status: 'error', error: L.tooLarge } : p))
        continue
      }
      setItems(prev => prev.map((p, idx) => idx === i ? { ...p, status: 'uploading' } : p))
      try {
        const res = await uploadOne(file, (progress) => {
          setItems(prev => prev.map((p, idx) => idx === i ? { ...p, progress } : p))
        })
        setItems(prev => prev.map((p, idx) => idx === i ? { ...p, status: 'done', progress: 100, url: res.secure_url, publicId: res.public_id } : p))
        successfulUrls.push(res.secure_url)
      } catch (e) {
        setItems(prev => prev.map((p, idx) => idx === i ? { ...p, status: 'error', error: e.message } : p))
      }
    }
    setBusy(false)
    if (onUploaded && successfulUrls.length > 0) onUploaded(successfulUrls)

    // Clear the input so the same file can be re-picked
    if (inputRef.current) inputRef.current.value = ''
    // Clear items after 3s so preview grid in parent takes over
    setTimeout(() => setItems([]), 3000)
  }

  return (
    <div className="space-y-2">
      {/* Upload button */}
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
        className="w-full rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 hover:bg-emerald-100/60 transition-colors p-4 flex flex-col items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {busy ? (
          <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
        ) : (
          <Upload className="w-6 h-6 text-emerald-600" />
        )}
        <span className="text-sm font-extrabold text-emerald-900">{L.pick}</span>
        <span className="text-[10px] text-emerald-800/60">JPG · PNG · HEIC · WebP · Max 10MB</span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        className="hidden"
        onChange={(e) => handlePick(e.target.files)}
      />

      {/* Progress items */}
      {items.length > 0 && (
        <div className="space-y-1.5">
          {items.map((it, idx) => (
            <div key={idx} className="rounded-xl bg-white border border-eq-cream p-2 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-eq-cream flex items-center justify-center flex-shrink-0">
                {it.status === 'uploading' && <Loader2 className="w-3.5 h-3.5 text-emerald-600 animate-spin" />}
                {it.status === 'done' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                {it.status === 'error' && <X className="w-3.5 h-3.5 text-red-500" />}
                {it.status === 'queued' && <Upload className="w-3.5 h-3.5 text-gray-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold text-emerald-900 truncate">{it.file.name}</div>
                {it.status === 'uploading' && (
                  <div className="h-1 bg-eq-cream rounded-full overflow-hidden mt-0.5">
                    <div className="h-full bg-emerald-500 transition-all" style={{ width: `${it.progress}%` }} />
                  </div>
                )}
                {it.error && <div className="text-[10px] text-red-500">{it.error}</div>}
                {it.status === 'done' && <div className="text-[10px] text-emerald-600">✓ {L.done}</div>}
              </div>
              {it.status === 'uploading' && (
                <div className="text-[10px] font-bold text-emerald-700 tabular-nums flex-shrink-0">{it.progress}%</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
