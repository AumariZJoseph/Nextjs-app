// frontend/src/lib/api.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL!

// ✅ Query types
export interface QueryRequest {
  user_id: string
  question: string
}

export interface QueryResponse {
  answer: string
  success: boolean
  error_message?: string
}

// ✅ Auth-related types
export interface LoginRequest {
  email: string
  password: string
}

export interface UserMetadata {
  [key: string]: unknown // Safer than `any`
}

export interface AuthUser {
  id: string
  email: string
  user_metadata: UserMetadata
}

export interface AuthData {
  access_token: string
  refresh_token: string
  user: AuthUser
  expires_at: string
  expires_in_hours: number
}

export interface LoginResponse {
  status: string
  data?: AuthData
  message?: string
}

// ✅ File-related types
export interface FileListResponse {
  status: string
  files: string[]
}

// ✅ Task result typing
export interface TaskResult {
  [key: string]: unknown
}

// ✅ Health check response typing
export interface HealthResponse {
  status: string
  version: string
  database: string
}

// ✅ Document response typing
export interface DocumentResponse {
  status: string
  documents: unknown[]
}

class ApiClient {
  // ✅ Base request method with safe typing
  private async request<T = unknown>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`

    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      })

      const data = (await response.json().catch(() => ({}))) as T

      if (!response.ok) {
        const errorData = data as Record<string, unknown>
        const errorMessage =
          (errorData.detail as string) ||
          (errorData.error as string) ||
          (errorData.message as string) ||
          `API error: ${response.statusText}`

        throw new Error(errorMessage)
      }

      return data
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error
      } else if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        throw new Error('Network error: Cannot connect to the server')
      } else {
        throw new Error('Unknown error occurred')
      }
    }
  }

  // ✅ Query method with timeout
  async query(data: QueryRequest): Promise<QueryResponse> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 45000)

    try {
      return await this.request<QueryResponse>('/query', {
        method: 'POST',
        body: JSON.stringify(data),
        signal: controller.signal,
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout: The server took too long to respond')
      }
      throw error
    } finally {
      clearTimeout(timeoutId)
    }
  }

  // ✅ Auth endpoints
  async login(data: LoginRequest): Promise<LoginResponse> {
    return this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async refreshToken(
    refreshToken: string
  ): Promise<{
    status: string
    data?: Omit<AuthData, 'user'> // Exclude user for refresh endpoint
    message?: string
  }> {
    return this.request(`/auth/refresh`, {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
  }

  async logout(accessToken: string): Promise<{ status: string; message?: string }> {
    return this.request('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ access_token: accessToken }),
    })
  }

  // ✅ File ingestion
  async ingestFile(userId: string, file: File): Promise<{ status: string; message?: string }> {
    const formData = new FormData()
    formData.append('user_id', userId)
    formData.append('file', file)

    const response = await fetch(`${API_BASE_URL}/ingest`, {
      method: 'POST',
      body: formData,
    })

    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>

    if (!response.ok) {
      const errorMessage =
        (data.detail as string) ||
        (data.error as string) ||
        (data.message as string) ||
        `Upload failed: ${response.statusText}`
      throw new Error(errorMessage)
    }

    return data as { status: string; message?: string }
  }

  // ✅ Background file ingestion
  async ingestFileBackground(
    userId: string,
    file: File
  ): Promise<{
    status: 'processing' | 'success'
    task_id?: string
    message: string
  }> {
    const formData = new FormData()
    formData.append('user_id', userId)
    formData.append('file', file)

    const response = await fetch(`${API_BASE_URL}/ingest/background`, {
      method: 'POST',
      body: formData,
    })

    const data = (await response.json()) as Record<string, unknown>

    if (!response.ok) {
      const errorMessage =
        (data.detail as string) ||
        (data.error as string) ||
        (data.message as string) ||
        `Upload failed: ${response.statusText}`
      throw new Error(errorMessage)
    }

    return data as {
      status: 'processing' | 'success'
      task_id?: string
      message: string
    }
  }

  // ✅ Background task status
  async getTaskStatus(
    taskId: string
  ): Promise<{
    status: 'queued' | 'processing' | 'completed' | 'failed'
    progress?: number
    error?: string
    result?: TaskResult
  }> {
    return this.request(`/tasks/${taskId}`, { method: 'GET' })
  }

  // ✅ File management
  async getUserFiles(userId: string): Promise<FileListResponse> {
    return this.request(`/files/${userId}`)
  }

  async deleteUserFile(
    userId: string,
    filename: string
  ): Promise<{ status: string; message: string }> {
    return this.request(`/files/${userId}/${filename}`, {
      method: 'DELETE',
    })
  }

  async getAvailableFiles(userId: string): Promise<FileListResponse> {
    return this.request(`/files/${userId}`, { method: 'GET' })
  }

  // ✅ Conversation context clearing
  async clearConversationContext(
    userId: string
  ): Promise<{ status: string; message: string }> {
    return this.request(`/query/clear-context/${userId}`, {
      method: 'POST',
    })
  }

  // ✅ Health check
  async getHealth(): Promise<HealthResponse> {
    return this.request(`/health`, { method: 'GET' })
  }

  // ✅ User documents
  async getUserDocuments(userId: string): Promise<DocumentResponse> {
    return this.request(`/ingest/documents/${userId}`, { method: 'GET' })
  }
}

export const apiClient = new ApiClient()
