// src/middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  console.log(`Middleware triggered for: ${req.nextUrl.pathname}`)
  
  // Check for the specific Supabase auth cookies manually
  const accessToken = req.cookies.get('sb-access-token')
  const refreshToken = req.cookies.get('sb-refresh-token')
  
  console.log('Auth cookies - access token:', !!accessToken, 'refresh token:', !!refreshToken)
  
  // Check if we have both auth tokens
  const isAuthenticated = !!(accessToken && refreshToken)
  console.log('User authenticated:', isAuthenticated)

  // If user is not signed in and the current path is not /login, redirect to /login
  if (!isAuthenticated && req.nextUrl.pathname !== '/login') {
    console.log('Redirecting to login: No auth tokens found')
    const redirectUrl = new URL('/login', req.url)
    redirectUrl.searchParams.set('from', req.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // If user is signed in and the current path is /login, redirect to /
  if (isAuthenticated && req.nextUrl.pathname === '/login') {
    console.log('Redirecting to home: User already authenticated')
    
    // Check if there's a redirect URL in the query params
    const from = req.nextUrl.searchParams.get('from')
    if (from && from !== '/login') {
      console.log('Redirecting to original URL:', from)
      return NextResponse.redirect(new URL(from, req.url))
    }
    
    return NextResponse.redirect(new URL('/', req.url))
  }

  console.log('Allowing request to proceed')
  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/login'],
}