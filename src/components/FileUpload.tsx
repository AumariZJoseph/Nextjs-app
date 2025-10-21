// components/FileUpload.tsx
'use client'

import { useState, useEffect } from 'react'
import { Upload, FileText, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'

interface FileUploadProps {
  onUploadSuccess?: () => void
}

interface ProcessingTask {
  taskId: string
  filename: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  progress?: number
  error?: string
}

export default function FileUpload({ onUploadSuccess }: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [currentStage, setCurrentStage] = useState('')
  const [processingTasks, setProcessingTasks] = useState<ProcessingTask[]>([])
  const { user } = useAuth()

  // Poll for task status updates
  useEffect(() => {
    if (processingTasks.length === 0) return

    const activeTasks = processingTasks.filter(task => 
      task.status === 'queued' || task.status === 'processing'
    )

    if (activeTasks.length === 0) return

    const pollInterval = setInterval(async () => {
      for (const task of activeTasks) {
        try {
          const status = await apiClient.getTaskStatus(task.taskId)
          
          setProcessingTasks(prev => prev.map(t => 
            t.taskId === task.taskId 
              ? { 
                  ...t, 
                  status: status.status,
                  progress: status.progress || t.progress,
                  error: status.error 
                }
              : t
          ))

          // If task completed successfully
          if (status.status === 'completed') {
            setUploadSuccess(`File "${task.filename}" processed successfully!`)
            if (onUploadSuccess) {
              onUploadSuccess()
            }
          }

          // If task failed
          if (status.status === 'failed') {
            setUploadError(`Failed to process "${task.filename}": ${status.error || 'Unknown error'}`)
          }
        } catch (error) {
          console.error(`Failed to poll task ${task.taskId}:`, error)
        }
      }
    }, 2000) // Poll every 2 seconds

    return () => clearInterval(pollInterval)
  }, [processingTasks, onUploadSuccess])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !user) return

    // Frontend file size validation (3MB)
    const MAX_FILE_SIZE = 3 * 1024 * 1024
    if (file.size > MAX_FILE_SIZE) {
      setUploadError(
        `File size exceeds 3MB limit. Your file: ${(file.size / 1024 / 1024).toFixed(2)}MB`
      )
      return
    }

    // File type validation
    const allowedExtensions = ['.pdf', '.docx', '.doc', '.txt', '.csv', '.xlsx', '.xls']
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
      setUploadError(
        `File type not supported. Please upload: ${allowedExtensions.join(', ')}`
      )
      return
    }

    setIsUploading(true)
    setUploadError('')
    setUploadSuccess('')
    setUploadProgress(0)
    setCurrentStage('Preparing...')

    try {
      // Define upload stages for frontend progress
      const stages = [
        'Uploading to storage...',
        'Starting background processing...'
      ]

      let currentStageIndex = 0
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90 // Stop at 90% until background processing completes
          }
          return prev + 10
        })

        // Update stage every ~30% progress
        if (uploadProgress % 30 === 0 && currentStageIndex < stages.length - 1) {
          currentStageIndex++
          setCurrentStage(stages[currentStageIndex])
        }
      }, 500)

      // Call backend API - try background processing first
      let result
      try {
        // Try background processing endpoint
        result = await apiClient.ingestFileBackground(user.id, file)
      } catch (backgroundError) {
        // Fallback to regular processing if background endpoint not available
        console.warn('Background processing not available, falling back to synchronous:', backgroundError)
        result = await apiClient.ingestFile(user.id, file)
      }

      clearInterval(progressInterval)
      
      if (result.status === 'processing' && result.task_id) {
        // Background processing started
        setUploadProgress(100)
        setCurrentStage('Processing in background...')
        
        // Add to processing tasks
        const newTask: ProcessingTask = {
          taskId: result.task_id,
          filename: file.name,
          status: 'queued',
          progress: 0
        }
        
        setProcessingTasks(prev => [...prev, newTask])
        setUploadSuccess(`File "${file.name}" is being processed. You can continue using the app.`)
      } else if (result.status === 'success') {
        // Synchronous processing completed
        setUploadProgress(100)
        setCurrentStage('Complete!')
        setUploadSuccess(`File "${file.name}" uploaded successfully!`)
        if (onUploadSuccess) {
          onUploadSuccess()
        }
      } else {
        throw new Error(result.message || 'Upload failed with unknown status')
      }

    } catch (error) {
      let errorMessage = 'Upload failed'
      
      if (error instanceof Error) {
        // Use the specific error message from backend
        if (error.message.includes('Security check failed')) {
          errorMessage = 'File rejected for security reasons. Please upload a different file.'
        } else if (error.message.includes('File type')) {
          errorMessage = 'File type not supported or file appears to be corrupted.'
        } else if (error.message.includes('File size')) {
          errorMessage = 'File size exceeds limit. Please upload a smaller file.'
        } else if (error.message.includes('rate limit')) {
          errorMessage = 'Too many file operations. Please wait before uploading more files.'
        } else {
          errorMessage = error.message
        }
      }
      
      setUploadError(errorMessage)
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
      setCurrentStage('')
      event.target.value = ''
    }
  }

  const removeCompletedTask = (taskId: string) => {
    setProcessingTasks(prev => prev.filter(task => task.taskId !== taskId))
  }

  const getTaskStatusIcon = (task: ProcessingTask) => {
    switch (task.status) {
      case 'queued':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
      case 'processing':
        return <Loader2 className="w-4 h-4 animate-spin text-yellow-500" />
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      default:
        return <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
    }
  }

  const getTaskStatusText = (task: ProcessingTask) => {
    switch (task.status) {
      case 'queued':
        return 'Queued for processing'
      case 'processing':
        return `Processing... ${task.progress || 0}%`
      case 'completed':
        return 'Processing complete'
      case 'failed':
        return `Failed: ${task.error || 'Unknown error'}`
      default:
        return 'Unknown status'
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md">
      <h2 className="text-lg font-semibold p-4 border-b flex items-center gap-2 text-gray-900">
        <FileText className="w-5 h-5" />
        Upload Document
      </h2>

      <div className="p-4">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-900 mb-2 text-sm">Drag and drop your file here</p>
          <p className="text-gray-700 text-xs mb-4">
            Limit: 5 files maximum, 3MB per file
          </p>

          <label className="bg-blue-600 text-white px-4 py-2 rounded-md cursor-pointer hover:bg-blue-700 transition disabled:bg-blue-400 disabled:cursor-not-allowed text-sm inline-block">
            {isUploading ? 'Uploading...' : 'Browse Files'}
            <input
              type="file"
              className="hidden"
              onChange={handleFileUpload}
              disabled={isUploading}
              accept=".pdf,.docx,.doc,.txt,.csv,.xlsx,.xls"
            />
          </label>

          <p className="text-gray-700 text-xs mt-4">
            Supported formats: PDF, DOCX, DOC, TXT, CSV, XLSX, XLS
          </p>
        </div>

        {/* Progress bar */}
        {isUploading && (
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              {currentStage} {uploadProgress}%
            </p>
          </div>
        )}

        {/* Background processing tasks */}
        {processingTasks.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-900 mb-2">
              Background Processing ({processingTasks.length})
            </h3>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {processingTasks.map(task => (
                <div
                  key={task.taskId}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded-md text-xs"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {getTaskStatusIcon(task)}
                    <span className="truncate text-gray-900" title={task.filename}>
                      {task.filename}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-gray-600 text-xs">
                      {getTaskStatusText(task)}
                    </span>
                    {(task.status === 'completed' || task.status === 'failed') && (
                      <button
                        onClick={() => removeCompletedTask(task.taskId)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error and success messages */}
        {uploadError && (
          <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md flex items-center gap-2 text-sm">
            <X className="w-4 h-4 flex-shrink-0" />
            {uploadError}
          </div>
        )}

        {uploadSuccess && (
          <div className="mt-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-md text-sm">
            {uploadSuccess}
          </div>
        )}
      </div>
    </div>
  )
}