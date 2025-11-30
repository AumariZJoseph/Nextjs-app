'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient, type UsageData } from '@/lib/api'

interface TrialStatusProps {
  refreshTrigger?: number
}

export default function TrialStatus({ refreshTrigger = 0 }: TrialStatusProps) {
    const { user } = useAuth()
    const [usage, setUsage] = useState<UsageData>({
        files_used: 0,
        queries_used: 0,
        files_limit: 3,
        queries_limit: 20,
    })
    const [isJoiningWaitlist, setIsJoiningWaitlist] = useState(false)
    const [waitlistMessage, setWaitlistMessage] = useState('')

    useEffect(() => {
        const fetchUsage = async () => {
            if (user) {
                try {
                    const response = await apiClient.getUserUsage(user.id)
                    setUsage(response.usage)
                } catch (error) {
                    console.error('Error fetching usage:', error)
                }
            }
        }

        fetchUsage()
        const interval = setInterval(fetchUsage, 30000)
        return () => clearInterval(interval)
    }, [user, refreshTrigger])

    const handleJoinWaitlist = async () => {
        if (!user) return
        
        setIsJoiningWaitlist(true)
        setWaitlistMessage('')
        
        try {
            const response = await apiClient.joinWaitlist(user.id, user.email)
            setWaitlistMessage(response.message)
        } catch (error) {
            setWaitlistMessage('Failed to join waitlist. Please try again.')
        } finally {
            setIsJoiningWaitlist(false)
        }
    }

    if (!user) return null

    const isTrialComplete = usage.queries_used >= usage.queries_limit
    const isFileLimitReached = usage.files_used >= usage.files_limit

    return (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="font-semibold text-blue-900">Free Trial</h3>
                    <p className="text-sm text-blue-700">
                        Files: {usage.files_used}/{usage.files_limit} •{' '}
                        Queries: {usage.queries_used}/{usage.queries_limit}
                    </p>
                    {isFileLimitReached && !isTrialComplete && (
                        <p className="text-xs text-orange-600 mt-1">
                            File limit reached. You can still ask questions!
                        </p>
                    )}
                    {waitlistMessage && (
                        <p className="text-xs text-green-600 mt-1">{waitlistMessage}</p>
                    )}
                </div>

                {/* ✅ ALWAYS show waitlist button, but change style based on trial status */}
                <div className="flex items-center gap-2">
                    {!waitlistMessage ? (
                        <button
                            onClick={handleJoinWaitlist}
                            disabled={isJoiningWaitlist}
                            className={`
                                px-3 py-1 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed
                                ${isTrialComplete 
                                    ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                                }
                            `}
                        >
                            {isJoiningWaitlist 
                                ? 'Joining...' 
                                : isTrialComplete 
                                    ? 'Trial Complete - Join Waitlist for Full Version' 
                                    : 'Join Waitlist for Full Version'
                            }
                        </button>
                    ) : (
                        <div className="bg-green-100 border border-green-300 rounded px-3 py-1">
                            <p className="text-sm text-green-800 font-medium">On Waitlist! 🎉</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}