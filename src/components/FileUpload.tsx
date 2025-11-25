'use client'

import { useState, useRef, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api' // ✅ Remove IngestBackgroundResponse import
import { Upload, FileText, X, AlertCircle, CheckCircle2 } from 'lucide-react'

interface FileUploadProps {
  onUploadSuccess?: () => void
}

export default function FileUpload({ onUploadSuccess }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [currentStage, setCurrentStage] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { user } = useAuth()

  const resetState = useCallback(() => {
    setUploadProgress(0)
    setCurrentStage('')
    setError('')
    setSuccess('')
    setIsUploading(false)
  }, [])

  const validateFile = (file: File): string => {
    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
    ]

    const maxSize = 50 * 1024 * 1024 // 50MB

    if (!validTypes.includes(file.type)) {
      return 'Invalid file type. Please upload PDF, Word, Excel, CSV, or text files.'
    }

    if (file.size > maxSize) {
      return 'File size too large. Maximum size is 50MB.'
    }

    if (file.size === 0) {
      return 'File is empty.'
    }

    return ''
  }

  const handleFile = async (file: File) => {
    if (!user) {
      setError('Please log in to upload files')
      return
    }

    resetState()
    setIsUploading(true)

    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
      setIsUploading(false)
      return
    }

    try {
      setCurrentStage('Starting upload...')
      setUploadProgress(10)

      // ✅ Use standard ingestion (no background processing)
      setCurrentStage('Uploading file...')
      setUploadProgress(30)

      const result = await apiClient.ingestFile(user.id, file)

      setUploadProgress(70)
      setCurrentStage('Processing file...')

      // ✅ SIMPLIFIED: Only handle success case
      if (result.status === 'success') {
        setUploadProgress(100)
        setSuccess('File uploaded and processed successfully!')
        setIsUploading(false)
        if (onUploadSuccess) onUploadSuccess()
      } else {
        // Handle other statuses if needed
        throw new Error(result.message || 'Upload failed with unknown error')
      }

    } catch (error) {
      console.error('Upload error:', error)
      
      let errorMessage = 'Upload failed'
      if (error instanceof Error) {
        if (error.message.includes('rate limit')) {
          errorMessage = 'Too many uploads. Please wait before uploading more files.'
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = 'Network error. Please check your connection and try again.'
        } else if (error.message.includes('File processing failed')) {
          errorMessage = 'The file could not be processed. It may be corrupted or in an unsupported format.'
        } else if (error.message.includes('Security check failed')) {
          errorMessage = 'The file did not pass security checks. Please upload a different file.'
        } else {
          errorMessage = error.message
        }
      }
      
      setError(errorMessage)
      setIsUploading(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFile(files[0])
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFile(files[0])
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleBrowseClick = () => {
    fileInputRef.current?.click()
  }

  if (!user) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <p className="text-gray-600">Please log in to upload files</p>
      </div>
    )
  }

  return (
    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Upload Documents
        </h2>
        <button
          onClick={resetState}
          disabled={isUploading}
          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
          title="Reset"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            onClick={() => setError('')}
            className="text-red-700 hover:text-red-900 flex-shrink-0"
          >
            ×
          </button>
        </div>
      )}

      {/* Success message */}
      {success && (
        <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-md flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{success}</span>
          <button
            onClick={() => setSuccess('')}
            className="text-green-700 hover:text-green-900 flex-shrink-0"
          >
            ×
          </button>
        </div>
      )}

      {/* Upload area */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-gray-50 hover:border-gray-400'
        } ${isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={isUploading ? undefined : handleBrowseClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileInput}
          accept=".pdf,.doc,.docx,.txt"
          disabled={isUploading}
        />
        
        <FileText className="mx-auto h-12 w-12 text-gray-400" />
        
        <div className="mt-4">
          <p className="text-sm font-medium text-gray-900">
            {isUploading ? 'Uploading...' : 'Drag and drop your files here'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            or click to browse
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Supports PDF, Word and text files (max 50MB)
          </p>
        </div>

        {/* Progress bar */}
        {isUploading && (
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-xs text-gray-600 mt-2">
              {currentStage} {uploadProgress}%
            </p>
          </div>
        )}
      </div>

      {/* File limits info */}
      <div className="mt-4 text-xs text-gray-500">
        <p>Free tier: Maximum 5 documents per user</p>
        <p>Large documents may take several minutes to process</p>
      </div>
    </div>
  )
}