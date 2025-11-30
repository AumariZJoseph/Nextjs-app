'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, User, Bot } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'

interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: Date
}

// ✅ ChatInterfaceProps with optional onQuery callback
interface ChatInterfaceProps {
  onQuery?: () => void
}

// Component to render sources without using lookahead regex
const SourceReferences = ({ content }: { content: string }) => {
  const sourcesIndex = content.indexOf('SOURCES:')
  if (sourcesIndex === -1) return <div className="whitespace-pre-wrap">{content}</div>

  const mainContent = content.slice(0, sourcesIndex).trim()
  const sourcesText = content.slice(sourcesIndex + 'SOURCES:'.length).trim()

  // Split sources without lookahead
  const sources = sourcesText
    .split(/\n\nSource \d+/)
    .filter(s => s.trim())
    .map((s, i) => `Source ${i + 1}${s}`)

  return (
    <div className="mt-2">
      <div className="whitespace-pre-wrap">{mainContent}</div>
      <div className="mt-4 pt-4 border-t border-gray-200">
        <h4 className="font-semibold text-sm text-gray-700 mb-2">Sources:</h4>
        <div className="space-y-2 text-sm">
          {sources.map((source, index) => (
            <div key={index} className="bg-gray-50 p-2 rounded">
              <div className="whitespace-pre-wrap">{source}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function ChatInterface({ onQuery }: ChatInterfaceProps) { // ✅ Destructure prop
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { user } = useAuth()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !user) return

    // ✅ Check query limit
    try {
      const usageResponse = await apiClient.getUserUsage(user.id)
      if (usageResponse.usage.queries_used >= 20) {
        const limitMessage: Message = {
          id: Date.now().toString(),
          content:
            "🚀 **Trial Complete!**\n\nYou've used all 20 free queries.\nJoin our waitlist to be notified when the full version launches!",
          role: 'assistant',
          timestamp: new Date()
        }
        setMessages(prev => [...prev, limitMessage])
        return
      }
    } catch (error) {
      console.error('Error checking usage:', error)
    }

    // Frontend validation
    if (input.trim().length < 2) {
      const validationMessage: Message = {
        id: Date.now().toString(),
        content: "Please ask a longer question (at least 2 characters).",
        role: 'assistant',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, validationMessage])
      return
    }

    if (input.length > 5000) {
      const validationMessage: Message = {
        id: Date.now().toString(),
        content: "Question is too long. Please keep it under 5000 characters.",
        role: 'assistant',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, validationMessage])
      return
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      role: 'user',
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      // Clear context flow
      if (input.toLowerCase().includes('clear context') || input.toLowerCase().includes('start over')) {
        await apiClient.clearConversationContext(user.id)
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: "Conversation context cleared. I'm ready for a new topic.",
          role: 'assistant',
          timestamp: new Date()
        }
        setMessages(prev => [...prev, assistantMessage])
        return
      }

      // Regular query
      const response = await apiClient.query({
        user_id: user.id,
        question: input
      })

      if (response.success) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: response.answer,
          role: 'assistant',
          timestamp: new Date()
        }
        setMessages(prev => [...prev, assistantMessage])

        // ✅ Call onQuery callback if provided
        if (onQuery) onQuery()
      } else {
        throw new Error(response.error_message || 'Failed to get response')
      }
    } catch (error) {
      let errorContent = "I encountered an error processing your question. Please try again."
      if (error instanceof Error) {
        if (error.message.includes('No documents found') || error.message.includes('knowledge base')) {
          errorContent = "I don't have a knowledge base yet. Please upload documents first."
        } else if (error.message.includes('rate limit') || error.message.includes('Too many requests') || error.message.includes('busy')) {
          errorContent = "I'm processing too many requests right now. Please wait a moment and try again."
        } else if (error.message.includes('Invalid question') || error.message.includes('Please provide')) {
          errorContent = "Please ask a clearer question with more details."
        } else if (error.message.includes('timeout') || error.message.includes('taking too long')) {
          errorContent = "The AI service is taking longer than usual to respond. Please try again."
        } else if (error.message.includes('unavailable')) {
          errorContent = "The AI service is currently unavailable. Please try again in a few minutes."
        } else {
          errorContent = `I encountered an error: ${error.message}. Please try again or rephrase your question.`
        }
      }

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: errorContent,
        role: 'assistant',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md h-full flex flex-col min-h-[400px]">
      {/* Header */}
      <div className="p-3 sm:p-4 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 text-center sm:text-left w-full sm:w-auto">
          All your documents, one brain to query.
        </h2>
        <button
          onClick={async () => {
            if (user) {
              await apiClient.clearConversationContext(user.id)
              setMessages([])
            }
          }}
          className="px-3 py-1.5 text-xs sm:text-sm bg-blue-600 text-white rounded hover:bg-blue-700 whitespace-nowrap"
        >
          Clear Context
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 min-h-0">
        {messages.length === 0 ? (
          <div className="text-center text-gray-900 mt-4 sm:mt-8 text-sm sm:text-base">
            Ask a question about your documents to get started.
          </div>
        ) : (
          messages.map(message => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] xs:max-w-xs sm:max-w-md lg:max-w-lg rounded-lg p-3 ${
                  message.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'
                }`}
              >
                <div className="flex items-start gap-2">
                  {message.role === 'assistant' && <Bot className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                  <div className="whitespace-pre-wrap text-sm sm:text-base break-words">
                    {message.role === 'assistant' ? <SourceReferences content={message.content} /> : message.content}
                  </div>
                  {message.role === 'user' && <User className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                </div>
                <div className="text-xs text-gray-900 mt-1 opacity-70">
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-800 rounded-lg p-3 max-w-[85%] xs:max-w-xs sm:max-w-md lg:max-w-lg">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4" />
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="p-3 sm:p-4 border-t">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask a question about your documents..."
            className="flex-1 border border-gray-300 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="bg-blue-600 text-white rounded-lg px-3 sm:px-4 py-2 flex items-center gap-1 sm:gap-2 disabled:bg-blue-400 disabled:cursor-not-allowed hover:bg-blue-700 transition text-sm sm:text-base whitespace-nowrap"
          >
            <Send className="w-4 h-4" />
            <span className="hidden xs:inline">Send</span>
          </button>
        </div>
      </form>
    </div>
  )
}
