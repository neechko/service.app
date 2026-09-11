import { useEffect, useState, FormEvent, ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Database } from '../types/database'

// Tipe Order dengan relasi services dan profiles (consumer)
type Order = Database['public']['Tables']['orders']['Row'] & {
  services: {
    name: string
  } | null
  profiles: {
    full_name: string
    phone: string | null
  } | null
}

export default function WorkerDashboard() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [percentage, setPercentage] = useState<number>(25)
  const [notes, setNotes] = useState<string>('')
  const [screenshot, setScreenshot] = useState<File | null>(null)
  const [uploading, setUploading] = useState<boolean>(false)
  const [success, setSuccess] = useState<string>('')
  const [error, setError] = useState<string>('')

  useEffect(() => {
    fetchOrders()
  }, [])

  async function fetchOrders() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      navigate('/login')
      return
    }

    const { data } = await supabase
      .from('orders')
      .select('*, services(name), profiles:consumer_id(full_name, phone)')
      .eq('worker_id', user.id)
      .neq('status', 'completed')
      .order('created_at', { ascending: false })

    setOrders((data as Order[]) || [])
    setLoading(false)
  }

  async function handleUploadProgress(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setUploading(true)
    setError('')
    setSuccess('')

    if (!screenshot) {
      setError('Screenshot is required!')
      setUploading(false)
      return
    }

    try {
      const fileExt = screenshot.name.split('.').pop()
      const fileName = `${selectedOrder!.id}/${Date.now()}.${fileExt}`
      const filePath = `progress/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('screenshots')
        .upload(filePath, screenshot)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('screenshots')
        .getPublicUrl(filePath)

      const { error: progressError } = await supabase
        .from('progress_updates')
        .insert([{
          order_id: selectedOrder!.id,
          percentage: percentage,
          screenshot_url: publicUrl,
          notes: notes,
        }])

      if (progressError) throw progressError

      const { error: orderError } = await supabase
        .from('orders')
        .update({ 
          current_percentage: percentage,
          status: percentage === 100 ? 'completed' : 'in_progress',
          completed_at: percentage === 100 ? new Date().toISOString() : null,
        })
        .eq('id', selectedOrder!.id)

      if (orderError) throw orderError

      setSuccess(`Progress updated to ${percentage}%!`)
      setNotes('')
      setScreenshot(null)
      
      setTimeout(() => {
        fetchOrders()
        setSelectedOrder(null)
      }, 2000)

    } catch (err) {
      setError('Failed to upload: ' + (err as Error).message)
    }

    setUploading(false)
  }

  const formatRupiah = (angka: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(angka)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Worker Dashboard</h1>
          <p className="text-zinc-400">Manage your assigned orders and update progress</p>
        </div>

        {orders.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-800 flex items-center justify-center">
              <svg className="w-8 h-8 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <p className="text-zinc-400 text-lg">No orders assigned yet.</p>
            <p className="text-zinc-500 text-sm mt-2">New orders will appear here once admin assigns them to you.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {orders.map((order) => (
              <div key={order.id} className="glass-card rounded-2xl p-6 fade-in">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white">{order.services?.name}</h3>
                    <p className="text-zinc-500 text-sm">Order #{order.id.slice(0, 8)}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-md text-xs font-semibold uppercase border ${
                    order.status === 'completed' ? 'bg-green-500/10 text-green-400 border-green-500/30' :
                    order.status === 'in_progress' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                    'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                  }`}>
                    {(order.status || 'pending').replace('_', ' ')}
                  </span>
                </div>

                <div className="space-y-2 text-sm mb-4">
                  <div className="flex justify-between py-1.5 border-b border-border">
                    <span className="text-zinc-400">Customer</span>
                    <span className="text-white">{order.profiles?.full_name || '-'}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border">
                    <span className="text-zinc-400">WhatsApp</span>
                    <span className="text-white">{order.profiles?.phone || '-'}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border">
                    <span className="text-zinc-400">Game UID</span>
                    <span className="text-white">{order.game_uid || '-'}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border">
                    <span className="text-zinc-400">Server</span>
                    <span className="text-white capitalize">{order.game_server || '-'}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-zinc-400">Total Amount</span>
                    <span className="text-white font-bold">{formatRupiah(order.total_price)}</span>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-zinc-500">Current Progress</span>
                    <span className="text-primary-light font-semibold">{order.current_percentage}%</span>
                  </div>
                  <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden">
                    <div 
                      className="h-2 rounded-full bg-gradient-to-r from-primary to-purple-500 transition-all"
                      style={{ width: `${order.current_percentage}%` }}
                    ></div>
                  </div>
                </div>

                {order.notes && (
                  <div className="bg-zinc-900/50 p-3 rounded-lg border border-border mb-4">
                    <p className="text-xs text-zinc-500 mb-1">Customer Notes:</p>
                    <p className="text-sm text-zinc-300 italic">"{order.notes}"</p>
                  </div>
                )}

                <button
                  onClick={() => setSelectedOrder(order)}
                  className="w-full bg-primary hover:bg-primary-hover text-white font-semibold py-2.5 rounded-lg transition-all"
                >
                  Update Progress
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Upload Modal */}
        {selectedOrder && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 fade-in">
            <div className="glass-card rounded-2xl p-6 w-full max-w-md">
              <h2 className="text-xl font-bold text-white mb-2">Update Progress</h2>
              <p className="text-zinc-400 text-sm mb-6">{selectedOrder.services?.name}</p>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm mb-4">
                  {error}
                </div>
              )}

              {success && (
                <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg text-sm mb-4">
                  {success}
                </div>
              )}

              <form onSubmit={handleUploadProgress} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Progress Percentage
                  </label>
                  <select
                    value={percentage}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => setPercentage(parseInt(e.target.value))}
                    className="input-modern"
                  >
                    <option value={25}>25%</option>
                    <option value={50}>50%</option>
                    <option value={75}>75%</option>
                    <option value={100}>100% (Complete)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Screenshot Proof (Required)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setScreenshot(e.target.files?.[0] || null)}
                    required
                    className="w-full bg-zinc-900/50 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-100 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-white hover:file:bg-primary-hover"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="e.g. Chamber 1 cleared with 3 stars..."
                    className="input-modern resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOrder(null)
                      setError('')
                      setSuccess('')
                      setScreenshot(null)
                      setNotes('')
                    }}
                    className="flex-1 btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploading}
                    className="flex-1 bg-primary hover:bg-primary-hover disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-semibold py-2.5 rounded-lg transition-all"
                  >
                    {uploading ? 'Uploading...' : 'Upload'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}