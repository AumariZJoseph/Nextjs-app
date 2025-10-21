const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL!

export interface QueryRequest {
  user_id: string
  question: string
}

export interface QueryResponse {
  answer: string
  success: boolean
  error_message?: string
}

export interface LoginRequest {
  email: string
  password: string
}

// Define proper types instead of using 'any'
export interface UserMetadata {
  [key: string]: unknown
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

export interface FileListResponse {
  status: string
  files: string[]
}

// Define interfaces for background ingestion
export interface IngestBackgroundResponse {
  status: 'processing' | 'success'
  task_id?: string
  message: string
}

export interface TaskStatusResponse {
  status: 'queued' | 'processing' | 'completed' | 'failed'
  progress?: number
  error?: string
  result?: unknown
}

class ApiClient {
  // ✅ Base request method with proper error typing
  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE_URL}${endpoint}`

    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      })

      const data = await response.json().catch(() => ({})) // Prevent crash if response isn't JSON

      // ✅ Handle backend error messages
      if (!response.ok) {
        const errorMessage =
          data.detail ||
          data.error ||
          data.message ||
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
      return await this.request('/query', {
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

  async login(data: LoginRequest): Promise<LoginResponse> {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // ✅ Refresh token method
  async refreshToken(
    refreshToken: string
  ): Promise<{
    status: string
    data?: {
      access_token: string
      refresh_token: string
      expires_at: string
      expires_in_hours: number
    }
    message?: string
  }> {
    return this.request('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
  }

  async logout(accessToken: string) {
    return this.request('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ access_token: accessToken }),
    })
  }

  // ✅ Standard file ingestion
  async ingestFile(userId: string, file: File): Promise<{ status: string; message?: string }> {
    const formData = new FormData()
    formData.append('user_id', userId)
    formData.append('file', file)

    const response = await fetch(`${API_BASE_URL}/ingest`, {
      method: 'POST',
      body: formData,
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      const errorMessage =
        data.detail ||
        data.error ||
        data.message ||
        `Upload failed: ${response.statusText}`
      throw new Error(errorMessage)
    }

    return data
  }

  // ✅ Background file ingestion
  async ingestFileBackground(
    userId: string,
    file: File
  ): Promise<IngestBackgroundResponse> {
    const formData = new FormData()
    formData.append('user_id', userId)
    formData.append('file', file)

    const response = await fetch(`${API_BASE_URL}/ingest/background`, {
      method: 'POST',
      body: formData,
    })

    const data = await response.json()

    if (!response.ok) {
      const errorMessage =
        data.detail ||
        data.error ||
        data.message ||
        `Upload failed: ${response.statusText}`
      throw new Error(errorMessage)
    }

    return data as IngestBackgroundResponse
  }

  // ✅ Get background task status
  async getTaskStatus(taskId: string): Promise<TaskStatusResponse> {
    return this.request(`/tasks/${taskId}`, { method: 'GET' }) as Promise<TaskStatusResponse>
  }

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

  async getAvailableFiles(
    userId: string
  ): Promise<{ status: string; files: string[] }> {
    return this.request(`/files/${userId}`, {
      method: 'GET',
    })
  }

  // ✅ Clear conversation context
  async clearConversationContext(
    userId: string
  ): Promise<{ status: string; message: string }> {
    return this.request(`/query/clear-context/${userId}`, {
      method: 'POST',
    })
  }

  // ✅ Health check endpoint
  async getHealth(): Promise<{ status: string; version: string; database: string }> {
    return this.request('/health', { method: 'GET' })
  }

  // ✅ Fetch user documents
  async getUserDocuments(userId: string): Promise<{ status: string; documents: unknown[] }> {
    return this.request(`/ingest/documents/${userId}`, { method: 'GET' })
  }
}

export const apiClient = new ApiClient()