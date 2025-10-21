'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { apiClient, LoginRequest } from '@/lib/api'
import { useRouter } from 'next/navigation'

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
  const router = useRouter()

  // Check token expiration and refresh if needed
  const checkTokenExpiration = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (session) {
      // Check if token is about to expire (within 5 minutes)
      const expiresAt = new Date(session.expires_at! * 1000)
      const now = new Date()
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000)
      
      if (expiresAt < fiveMinutesFromNow) {
        console.log('Token about to expire, refreshing...')
        return await refreshToken()
      }
    }
    return true
  }

  const refreshToken = async (): Promise<boolean> => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.refresh_token) {
        const result = await apiClient.refreshToken(session.refresh_token)
        if (result.status === 'success' && result.data) {
          // Update session with new tokens
          await supabase.auth.setSession({
            access_token: result.data.access_token,
            refresh_token: result.data.refresh_token,
          })
          console.log('Token refreshed successfully')
          return true
        }
      }
    } catch (error) {
      console.error('Token refresh failed:', error)
      // If refresh fails, log the user out
      await logout()
    }
    return false
  }

  useEffect(() => {
    console.log('AuthProvider useEffect running')
    
    const getSession = async () => {
      console.log('Checking for existing session...')
      try {
        // Check token expiration first
        await checkTokenExpiration()
        
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Error getting session:', error)
          return
        }
        
        console.log('Session data:', session)
        
        if (session?.user) {
          console.log('User found in session:', session.user.email)
          setUser({
            id: session.user.id,
            email: session.user.email!,
          })
        } else {
          console.log('No user in session')
          setUser(null)
        }
      } catch (error) {
        console.error('Error in getSession:', error)
      } finally {
        setLoading(false)
        console.log('Auth loading complete')
      }
    }

    getSession()

    // Set up token refresh interval (check every minute)
    const refreshInterval = setInterval(() => {
      checkTokenExpiration()
    }, 60 * 1000) // 1 minute

    // Listen for changes on auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session)
        
        if (session?.user) {
          console.log('User authenticated via state change:', session.user.email)
          setUser({
            id: session.user.id,
            email: session.user.email!,
          })
        } else {
          console.log('User signed out via state change')
          setUser(null)
        }
        setLoading(false)
      }
    )

    return () => {
      console.log('AuthProvider cleanup')
      clearInterval(refreshInterval)
      subscription.unsubscribe()
    }
  }, [])

  const login = async (credentials: LoginRequest) => {
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
        
        if (error) {
          console.error('setSession error:', error)
          throw error
        }
        
        if (newSession) {
          console.log('User authenticated, updating state:', newSession.user.email)
          setUser({
            id: newSession.user.id,
            email: newSession.user.email!,
          })
          
          // Set cookies with expiration
          const expires = new Date(result.data.expires_at)
          document.cookie = `sb-access-token=${result.data.access_token}; path=/; expires=${expires.toUTCString()}`
          document.cookie = `sb-refresh-token=${result.data.refresh_token}; path=/; expires=${expires.toUTCString()}`
          
          const urlParams = new URLSearchParams(window.location.search)
          const redirectTo = urlParams.get('from') || '/'
          
          console.log('Redirecting to:', redirectTo)
          window.location.href = redirectTo
        }
      } else {
        const errorMsg = result.message || 'Login failed'
        console.error('Login API error:', errorMsg)
        throw new Error(errorMsg)
      }
    } catch (error) {
      console.error('Login process error:', error)
      throw error
    }
  }

  const register = async (credentials: LoginRequest) => {
    console.log('Registration attempt with:', credentials.email)
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      })
      
      const result = await response.json()
      console.log('Registration API response:', result)
      
      if (result.status === 'success') {
        if (result.data && result.data.access_token) {
          console.log('Registration successful with immediate login')
          
          const { data: { session: newSession }, error } = await supabase.auth.setSession({
            access_token: result.data.access_token,
            refresh_token: result.data.refresh_token,
          })
          
          console.log('setSession result:', { newSession, error })
          
          if (error) {
            console.error('setSession error:', error)
            throw error
          }
          
          if (newSession) {
            console.log('User authenticated, updating state:', newSession.user.email)
            setUser({
              id: newSession.user.id,
              email: newSession.user.email!,
            })
            
            // Set cookies with expiration
            const expires = new Date(result.data.expires_at)
            document.cookie = `sb-access-token=${result.data.access_token}; path=/; expires=${expires.toUTCString()}`
            document.cookie = `sb-refresh-token=${result.data.refresh_token}; path=/; expires=${expires.toUTCString()}`
            
            const urlParams = new URLSearchParams(window.location.search)
            const redirectTo = urlParams.get('from') || '/'
            
            console.log('Redirecting to:', redirectTo)
            window.location.href = redirectTo
          }
        } else {
          console.log('Registration successful, email confirmation required')
          return {
            requiresConfirmation: true,
            message: result.message || 'Please check your email for confirmation',
          }
        }
      } else {
        const errorMsg = result.message || 'Registration failed'
        console.error('Registration API error:', errorMsg)
        throw new Error(errorMsg)
      }
    } catch (error) {
      console.error('Registration process error:', error)
      throw error
    }
  }

  const logout = async () => {
    console.log('Logout initiated')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        console.log('Calling backend logout API')
        await apiClient.logout(session.access_token)
      }
      
      console.log('Signing out from Supabase')
      await supabase.auth.signOut()
      
      // Clear cookies with past expiration
      document.cookie = 'sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
      document.cookie = 'sb-refresh-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
      
      setUser(null)
      console.log('User state cleared, redirecting to login')
      window.location.href = '/login'
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

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