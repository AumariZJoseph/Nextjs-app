const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL!

export interface UsageData {
  files_used: number;
  queries_used: number;
  files_limit: number;
  queries_limit: number;
}

export interface UserUsageResponse {
  status: string;
  usage: UsageData;
}

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

  // ✅ Query method with timeout - ADDED /api/v1
  async query(data: QueryRequest): Promise<QueryResponse> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 45000)

    try {
      return await this.request('/api/v1/query', {  // ✅ Added /api/v1
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

  // ✅ ADDED /api/v1 to all auth endpoints
  async login(data: LoginRequest): Promise<LoginResponse> {
    return this.request('/api/v1/auth/login', {  // ✅ Added /api/v1
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // ✅ Refresh token method - ADDED /api/v1
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
    return this.request('/api/v1/auth/refresh', {  // ✅ Added /api/v1
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
  }

  // ✅ ADDED /api/v1
  async logout(accessToken: string) {
    return this.request('/api/v1/auth/logout', {  // ✅ Added /api/v1
      method: 'POST',
      body: JSON.stringify({ access_token: accessToken }),
    })
  }

  // ✅ Standard file ingestion - ADDED /api/v1
  async ingestFile(userId: string, file: File): Promise<{ status: string; message?: string }> {
    const formData = new FormData()
    formData.append('user_id', userId)
    formData.append('file', file)

    const response = await fetch(`${API_BASE_URL}/api/v1/ingest`, {  // ✅ Added /api/v1
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

  // ✅ Background file ingestion - ADDED /api/v1
  async ingestFileBackground(
    userId: string,
    file: File
  ): Promise<IngestBackgroundResponse> {
    const formData = new FormData()
    formData.append('user_id', userId)
    formData.append('file', file)

    const response = await fetch(`${API_BASE_URL}/api/v1/ingest/background`, {  // ✅ Added /api/v1
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

  // ✅ Get background task status - ADDED /api/v1
  async getTaskStatus(taskId: string): Promise<TaskStatusResponse> {
    return this.request(`/api/v1/tasks/${taskId}`, { method: 'GET' }) as Promise<TaskStatusResponse>  // ✅ Added /api/v1
  }

  // ✅ ADDED /api/v1
  async getUserFiles(userId: string): Promise<FileListResponse> {
    return this.request(`/api/v1/files/${userId}`)  // ✅ Added /api/v1
  }

  // ✅ ADDED /api/v1
  async deleteUserFile(
    userId: string,
    filename: string
  ): Promise<{ status: string; message: string }> {
    return this.request(`/api/v1/files/${userId}/${filename}`, {  // ✅ Added /api/v1
      method: 'DELETE',
    })
  }

  // ✅ ADDED /api/v1
  async getAvailableFiles(
    userId: string
  ): Promise<{ status: string; files: string[] }> {
    return this.request(`/api/v1/files/${userId}`, {  // ✅ Added /api/v1
      method: 'GET',
    })
  }

async getUserUsage(userId: string): Promise<UserUsageResponse> {
    return this.request(`/api/v1/usage/${userId}`, { method: 'GET' }) as Promise<UserUsageResponse>;
}

  // ✅ Clear conversation context - ADDED /api/v1
  async clearConversationContext(
    userId: string
  ): Promise<{ status: string; message: string }> {
    return this.request(`/api/v1/query/clear-context/${userId}`, {  // ✅ Added /api/v1
      method: 'POST',
    })
  }

  // ✅ Health check endpoint - ADDED /api/v1
  async getHealth(): Promise<{ status: string; version: string; database: string }> {
    return this.request('/api/v1/health', { method: 'GET' })  // ✅ Added /api/v1
  }

  // ✅ Fetch user documents - ADDED /api/v1
  async getUserDocuments(userId: string): Promise<{ status: string; documents: unknown[] }> {
    return this.request(`/api/v1/ingest/documents/${userId}`, { method: 'GET' })  // ✅ Added /api/v1
  }
}

export const apiClient = new ApiClient()