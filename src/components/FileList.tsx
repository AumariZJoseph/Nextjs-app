'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api'
import { FileText, RefreshCw, Trash2, AlertCircle } from 'lucide-react'

interface FileListProps {
  onFileUpload?: () => void;
}

export default function FileList({ onFileUpload }: FileListProps) {
  const [files, setFiles] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)
  const [deletingFile, setDeletingFile] = useState<string | null>(null)
  const { user } = useAuth()

  const fetchFiles = async () => {
    if (!user) return

    setLoading(true)
    setError('')
    try {
      const response = await apiClient.getUserFiles(user.id)
      if (response.status === 'success') {
        setFiles(response.files)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch files')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFiles()
  }, [user])

  // ✅ Updated delete handling
  const handleDelete = async (filename: string) => {
    if (
      !user ||
      !confirm(`Are you sure you want to delete ${filename}? This will remove the file from your knowledge base.`)
    ) return

    setDeletingFile(filename)
    setError('')
    try {
      const response = await apiClient.deleteUserFile(user.id, filename)
      if (response.status === 'success') {
        await new Promise(resolve => setTimeout(resolve, 1000))
        await fetchFiles()
        if (onFileUpload) onFileUpload()
      } else {
        setError(response.message || 'Failed to delete file')
      }
    } catch (error) {
      let errorMessage = 'Failed to delete file'

      if (error instanceof Error) {
        if (error.message.includes('rate limit')) {
          errorMessage = 'Too many file operations. Please wait before deleting more files.'
        } else {
          errorMessage = error.message
        }
      }

      setError(errorMessage)
    } finally {
      setDeletingFile(null)
    }
  }

  const processKnowledgeBase = async () => {
    if (!user) return

    setProcessing(true)
    setError('')
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/ingest/process/${user.id}`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      if (result.status === 'success') {
        alert('Knowledge base processed successfully!')
        await fetchFiles()
      } else {
        throw new Error(result.message || 'Processing failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed')
    } finally {
      setProcessing(false)
    }
  }

  if (!user) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <p className="text-gray-900">Please log in to view your files</p>
      </div>
    )
  }

  return (
    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-3 sm:mb-4 text-gray-900">
        <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2">
          <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-gray-900" />
          Your Documents ({files.length}/5)
        </h2>
        <button
          onClick={fetchFiles}
          disabled={loading}
          className="p-1 sm:p-2 text-gray-600 hover:text-gray-900 disabled:opacity-50"
          title="Refresh file list"
        >
          <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-3 sm:mb-4 p-2 sm:p-3 bg-red-100 border border-red-400 text-red-700 rounded-md flex items-center gap-2 text-xs sm:text-sm">
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

      {/* Deletion message */}
      {deletingFile && (
        <div className="mb-3 sm:mb-4 p-2 sm:p-3 bg-blue-100 border border-blue-400 text-blue-700 rounded-md text-xs sm:text-sm">
          Removing {deletingFile}...
        </div>
      )}

      {/* Files list */}
      {loading ? (
        <div className="text-gray-900 text-sm sm:text-base">Loading files...</div>
      ) : files.length === 0 ? (
        <div className="text-gray-900 text-sm sm:text-base">No documents uploaded yet</div>
      ) : (
        <ul className="space-y-2 max-h-48 sm:max-h-60 lg:max-h-72 overflow-y-auto">
          {files.map((file) => (
            <li key={file} className="flex justify-between items-center p-2 sm:p-3 bg-gray-50 rounded-md hover:bg-gray-100 text-sm">
              <span className="truncate flex-1 text-gray-900" title={file}>
                {file}
              </span>
              <button
                onClick={() => handleDelete(file)}
                disabled={deletingFile !== null}
                className="p-1 text-red-600 hover:text-red-800 ml-2 disabled:opacity-50 flex-shrink-0"
                title="Delete file"
              >
                <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Process button */}
      <button
        onClick={processKnowledgeBase}
        disabled={processing || files.length === 0}
        className="mt-3 sm:mt-4 w-full bg-green-600 text-white py-2 px-3 sm:px-4 rounded-md disabled:bg-green-300 hover:bg-green-700 transition text-sm sm:text-base"
      >
        {processing ? 'Processing...' : 'Process Knowledge Base'}
      </button>
    </div>
  )
}