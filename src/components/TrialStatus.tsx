'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient, type UsageData } from '@/lib/api'

interface TrialStatusProps {
  refreshTrigger?: number  // ✅ Add this prop
}

export default function TrialStatus({ refreshTrigger = 0 }: TrialStatusProps) {
    const { user } = useAuth()
    const [usage, setUsage] = useState<UsageData>({
        files_used: 0,
        queries_used: 0,
        files_limit: 3,
        queries_limit: 20,
    })

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

        // Refresh every 30 seconds
        const interval = setInterval(fetchUsage, 30000)
        return () => clearInterval(interval)
    }, [user, refreshTrigger]) // ✅ Add refreshTrigger to dependencies

    if (!user) return null

    return (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="font-semibold text-blue-900">Free Trial</h3>
                    <p className="text-sm text-blue-700">
                        Files: {usage.files_used}/{usage.files_limit} •{' '}
                        Queries: {usage.queries_used}/{usage.queries_limit}
                    </p>
                </div>

                {(usage.files_used >= usage.files_limit ||
                  usage.queries_used >= usage.queries_limit) && (
                    <div className="bg-orange-100 border border-orange-300 rounded px-3 py-1">
                        <p className="text-sm text-orange-800 font-medium">Trial Complete</p>
                    </div>
                )}
            </div>
        </div>
    )
}