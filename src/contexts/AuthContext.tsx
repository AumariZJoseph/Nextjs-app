'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { apiClient, LoginRequest } from '@/lib/api'

interface User {
  id: string
  email: string
}

interface AuthContextType {
  user: User | null
  login: (credentials: LoginRequest) => Promise<void>
  register: (credentials: LoginRequest) => Promise<void | { requiresConfirmation: boolean; message: string }>
  logout: () => Promise<void>
  refreshToken: () => Promise<boolean>
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // ✅ Simplified logout - only frontend signOut
  const logout = useCallback(async () => {
    console.log('Logout initiated')
    try {
      // Use only frontend signOut - it handles token refresh internally
      console.log('Signing out from Supabase')
      await supabase.auth.signOut()

      // Clear cookies to ensure middleware sees the logout
      document.cookie = 'sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
      document.cookie = 'sb-refresh-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'

      // Clear local state
      setUser(null)
      
      console.log('User state cleared, redirecting to login')
      window.location.href = '/login'
    } catch (error) {
      console.error('Logout error:', error)
      // Even if there's an error, ensure we clear state and redirect
      setUser(null)
      window.location.href = '/login'
    }
  }, [])

  // ✅ refreshToken for manual refresh if needed
  const refreshToken = useCallback(async (): Promise<boolean> => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.refresh_token) {
        const result = await apiClient.refreshToken(session.refresh_token)
        if (result.status === 'success' && result.data) {
          await supabase.auth.setSession({
            access_token: result.data.access_token,
            refresh_token: result.data.refresh_token,
          })
          
          // ✅ Update cookies after refresh
          const expires = new Date(result.data.expires_at)
          document.cookie = `sb-access-token=${result.data.access_token}; path=/; expires=${expires.toUTCString()}`
          document.cookie = `sb-refresh-token=${result.data.refresh_token}; path=/; expires=${expires.toUTCString()}`
          
          console.log('Token refreshed successfully')
          return true
        }
      }
    } catch (error) {
      console.error('Token refresh failed:', error)
      await logout()
    }
    return false
  }, [logout])

  // ✅ checkTokenExpiration for proactive refresh (only used on app start)
  const checkTokenExpiration = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      const expiresAt = new Date(session.expires_at! * 1000)
      const now = new Date()
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000)

      if (expiresAt < fiveMinutesFromNow) {
        console.log('Token about to expire, refreshing...')
        return await refreshToken()
      }
    }
    return true
  }, [refreshToken])

  // ✅ Fixed login function with proper cookie setting
  const login = useCallback(async (credentials: LoginRequest) => {
    console.log('Login attempt with:', credentials.email)

    try {
      const result = await apiClient.login(credentials)
      console.log('Login API response:', result)

      if (result.status === 'success' && result.data) {
        console.log('Login successful, setting session with tokens')

        const { data: { session: newSession }, error } = await supabase.auth.setSession({
          access_token: result.data.access_token,
          refresh_token: result.data.refresh_token,
        })

        console.log('setSession result:', { newSession, error })

        if (error) throw error

        if (newSession) {
          setUser({
            id: newSession.user.id,
            email: newSession.user.email!,
          })

          // ✅ CRITICAL: Set cookies for middleware
          const expires = new Date(result.data.expires_at)
          document.cookie = `sb-access-token=${result.data.access_token}; path=/; expires=${expires.toUTCString()}`
          document.cookie = `sb-refresh-token=${result.data.refresh_token}; path=/; expires=${expires.toUTCString()}`

          // ✅ FIX: Ensure redirect happens after state update
          const urlParams = new URLSearchParams(window.location.search)
          const redirectTo = urlParams.get('from') || '/'
          
          // Use setTimeout to ensure React state updates complete
          setTimeout(() => {
            window.location.href = redirectTo
          }, 100)
        }
      } else {
        throw new Error(result.message || 'Login failed')
      }
    } catch (error) {
      console.error('Login process error:', error)
      throw error
    }
  }, [])

  // ✅ Fixed register function with proper cookie setting
  const register = useCallback(async (credentials: LoginRequest) => {
    console.log('Registration attempt with:', credentials.email)

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      })

      const result = await response.json()
      console.log('Registration API response:', result)

      if (result.status === 'success') {
        if (result.data && result.data.access_token) {
          const { data: { session: newSession }, error } = await supabase.auth.setSession({
            access_token: result.data.access_token,
            refresh_token: result.data.refresh_token,
          })

          if (error) throw error

          if (newSession) {
            setUser({
              id: newSession.user.id,
              email: newSession.user.email!,
            })

            // ✅ CRITICAL: Set cookies for middleware
            const expires = new Date(result.data.expires_at)
            document.cookie = `sb-access-token=${result.data.access_token}; path=/; expires=${expires.toUTCString()}`
            document.cookie = `sb-refresh-token=${result.data.refresh_token}; path=/; expires=${expires.toUTCString()}`

            // ✅ FIX: Same redirect fix for register
            const urlParams = new URLSearchParams(window.location.search)
            const redirectTo = urlParams.get('from') || '/'
            
            setTimeout(() => {
              window.location.href = redirectTo
            }, 100)
          }
        } else {
          return {
            requiresConfirmation: true,
            message: result.message || 'Please check your email for confirmation',
          }
        }
      } else {
        throw new Error(result.message || 'Registration failed')
      }
    } catch (error) {
      console.error('Registration process error:', error)
      throw error
    }
  }, [])

  // ✅ Auth state handling and initialization
  useEffect(() => {
    console.log('AuthProvider useEffect running')

    const getSession = async () => {
      console.log('Checking for existing session...')
      try {
        await checkTokenExpiration()

        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) {
          console.error('Error getting session:', error)
          return
        }

        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email!,
          })
        } else {
          setUser(null)
        }
      } catch (error) {
        console.error('Error in getSession:', error)
      } finally {
        setLoading(false)
      }
    }

    getSession()

    // ✅ No auto-refresh interval - Supabase handles this automatically
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session)
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email!,
          })
        } else {
          setUser(null)
        }
        setLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [checkTokenExpiration])

  const value: AuthContextType = {
    user,
    login,
    register,
    logout,
    refreshToken,
    loading,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}