import { useEffect, useState, useRef, FormEvent, ChangeEvent } from 'react'
import { supabase } from '../lib/supabase'
import { Database } from '../types/database'

type Message = Database['public']['Tables']['messages']['Row'] & {
  sender: {
    full_name: string
    role: string
  } | null
}

type Order = Database['public']['Tables']['orders']['Row']

interface OrderChatProps {
  order: Order
  currentUserId: string
  userRole: string
}

export default function OrderChat({ order, currentUserId, userRole }: OrderChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const [sending, setSending] = useState<boolean>(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchMessages()
    
    // Polling setiap 3 detik untuk pesan baru (bisa upgrade ke Supabase Realtime nanti)
    const interval = setInterval(fetchMessages, 3000)
    return () => clearInterval(interval)
  }, [order.id])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  async function fetchMessages() {
    const { data } = await supabase
      .from('messages')
      .select('*, sender:profiles!messages_sender_id_fkey(full_name, role)')
      .eq('order_id', order.id)
      .order('created_at', { ascending: true })

    if (data) {
      setMessages(data as Message[])
    }
    setLoading(false)
  }

  async function handleSendMessage(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!newMessage.trim() || sending) return

    setSending(true)
    const { error } = await supabase
      .from('messages')
      .insert([{
        order_id: order.id,
        sender_id: currentUserId,
        content: newMessage.trim(),
      }])

    if (error) {
      alert('Failed to send: ' + error.message)
    } else {
      setNewMessage('')
      await fetchMessages()
    }
    setSending(false)
  }

  const formatTime = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="glass-card rounded-2xl p-6">
      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        Order Chat
      </h3>

      {/* Chat Messages Area */}
      <div className="h-80 overflow-y-auto bg-zinc-900/50 rounded-lg p-4 mb-4 space-y-3">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-zinc-500 text-sm">No messages yet.</p>
            <p className="text-zinc-600 text-xs mt-1">Start the conversation below.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === currentUserId
            const senderRole = msg.sender?.role || 'unknown'
            
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                  {!isMe && (
                    <div className="flex items-center gap-1 mb-1 ml-1">
                      <span className="text-xs font-medium text-primary-light">
                        {msg.sender?.full_name || 'Unknown'}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        senderRole === 'admin' ? 'bg-purple-500/20 text-purple-400' :
                        senderRole === 'worker' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-zinc-700 text-zinc-400'
                      }`}>
                        {senderRole}
                      </span>
                    </div>
                  )}
                  <div className={`px-3 py-2 rounded-lg ${
                    isMe 
                      ? 'bg-primary text-white rounded-br-sm' 
                      : 'bg-surface text-zinc-100 rounded-bl-sm border border-border'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                  </div>
                  <span className="text-[10px] text-zinc-500 mt-1 px-1">
                    {formatTime(msg.created_at)}
                  </span>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSendMessage} className="flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setNewMessage(e.target.value)}
          placeholder="Type your message..."
          disabled={sending}
          className="input-modern flex-1"
          maxLength={1000}
        />
        <button
          type="submit"
          disabled={!newMessage.trim() || sending}
          className="bg-primary hover:bg-primary-hover disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-semibold px-5 py-2.5 rounded-lg transition-all"
        >
          {sending ? '...' : 'Send'}
        </button>
      </form>

      <p className="text-xs text-zinc-500 mt-2 text-center">
        💡 Share credentials securely here. Messages are only visible to order participants.
      </p>
    </div>
  )
}