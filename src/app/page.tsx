'use client'

import { useAuth } from '@/contexts/AuthContext'
import ChatInterface from '@/components/ChatInterface'
import FileUpload from '@/components/FileUpload'
import FileList from '@/components/FileList'
import { LogOut, User } from 'lucide-react'
import { useState } from 'react'

export default function HomePage() {
  const { user, logout } = useAuth()
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const handleLogout = async () => {
    await logout()
  }

  const handleFileUpload = () => {
    setRefreshTrigger(prev => prev + 1)
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-white shadow-sm flex-shrink-0">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-3 flex justify-between items-center">
          <h1 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">BrainBin</h1>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-gray-600">
              <User className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline truncate max-w-[120px] lg:max-w-[200px]">
                {user?.email}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-gray-600 hover:text-gray-900 p-1 sm:p-0"
            >
              <LogOut className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 h-full">
          {/* Sidebar - Full width on mobile, 1/4 on desktop */}
          <div className="lg:col-span-1 space-y-4 sm:space-y-6">
            <FileUpload onUploadSuccess={handleFileUpload} />
            <FileList key={refreshTrigger} onFileUpload={handleFileUpload} />
          </div>

          {/* Main content - Full width on mobile, 3/4 on desktop */}
          <div className="lg:col-span-3 min-h-[500px]">
            <ChatInterface />
          </div>
        </div>
      </main>
    </div>
  )
}