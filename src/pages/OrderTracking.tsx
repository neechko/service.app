import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Database } from '../types/database'

// Tipe Order dengan relasi lengkap
type Order = Database['public']['Tables']['orders']['Row'] & {
  services: {
    name: string
    category: string
    description: string | null
  } | null
  consumer_profile: {
    full_name: string
    phone: string | null
  } | null
  worker_profile: {
    full_name: string
    phone: string | null
  } | null
}

type ProgressUpdate = Database['public']['Tables']['progress_updates']['Row']

export default function OrderTracking() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [order, setOrder] = useState<Order | null>(null)
  const [progressUpdates, setProgressUpdates] = useState<ProgressUpdate[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    fetchOrder()
  }, [id])

  async function fetchOrder() {
    if (!id) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      navigate('/login')
      return
    }

    setCurrentUserId(user.id)

    // Ambil role user
    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileData) setUserRole(profileData.role)

    // Ambil detail order dengan relasi
    const { data: orderData, error } = await supabase
      .from('orders')
      .select(`
        *,
        services(name, category, description),
        consumer_profile:profiles!orders_consumer_id_fkey(full_name, phone),
        worker_profile:profiles!orders_worker_id_fkey(full_name, phone)
      `)
      .eq('id', id)
      .single()

    if (error || !orderData) {
      setLoading(false)
      return
    }

    setOrder(orderData as Order)

    // Ambil progress updates
    const { data: progressData } = await supabase
      .from('progress_updates')
      .select('*')
      .eq('order_id', id)
      .order('created_at', { ascending: false })

    setProgressUpdates((progressData as ProgressUpdate[]) || [])
    setLoading(false)
  }

  const formatRupiah = (angka: number | null | undefined) => {
    if (!angka) return 'Rp 0'
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(angka)
  }

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusStyle = (status: string | null | undefined) => {
    const styles: Record<string, string> = {
      completed: 'bg-green-500/10 text-green-400 border-green-500/30',
      in_progress: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      paid: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
      pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
      cancelled: 'bg-red-500/10 text-red-400 border-red-500/30',
    }
    return styles[status || 'pending'] || styles.pending
  }

  // Cek apakah user ini pemilik order (consumer atau worker yang ditugaskan)
  const isAuthorized = order && currentUserId && (
    order.consumer_id === currentUserId ||
    order.worker_id === currentUserId ||
    userRole === 'admin'
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
      </div>
    )
  }

  if (!order || !isAuthorized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400 mb-4">Order not found or you don't have access.</p>
          <Link to="/" className="text-primary hover:underline">Back to catalog</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-zinc-500 mb-8">
          <Link to="/" className="hover:text-zinc-300 transition">Home</Link>
          <span>/</span>
          <Link to="/orders" className="hover:text-zinc-300 transition">My Orders</Link>
          <span>/</span>
          <span className="text-zinc-300">Order #{order.id.slice(0, 8)}</span>
        </nav>

        {/* Header */}
        <div className="glass-card rounded-2xl p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">{order.services?.name || 'Unknown Service'}</h1>
              <p className="text-zinc-500 text-sm">Order #{order.id}</p>
            </div>
            <span className={`px-3 py-1 rounded-md text-xs font-semibold uppercase border w-fit ${getStatusStyle(order.status)}`}>
              {(order.status || 'pending').replace('_', ' ')}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex justify-between text-xs mb-2">
              <span className="text-zinc-400">Overall Progress</span>
              <span className="text-primary-light font-bold">{order.current_percentage || 0}%</span>
            </div>
            <div className="w-full bg-zinc-900 rounded-full h-3 overflow-hidden">
              <div
                className="h-3 rounded-full bg-gradient-to-r from-primary to-purple-500 transition-all duration-500"
                style={{ width: `${order.current_percentage || 0}%` }}
              ></div>
            </div>
          </div>

          {/* Order Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border">
            <div>
              <p className="text-xs text-zinc-500 mb-1">Customer</p>
              <p className="text-white font-medium">{order.consumer_profile?.full_name || '-'}</p>
              <p className="text-zinc-400 text-sm">{order.consumer_profile?.phone || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Worker</p>
              <p className="text-white font-medium">{order.worker_profile?.full_name || 'Unassigned'}</p>
              <p className="text-zinc-400 text-sm">{order.worker_profile?.phone || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Game UID</p>
              <p className="text-white font-medium">{order.game_uid || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Server</p>
              <p className="text-white font-medium capitalize">{order.game_server || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Total Price</p>
              <p className="text-xl font-bold gradient-text">{formatRupiah(order.total_price)}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Order Date</p>
              <p className="text-white font-medium">{formatDate(order.created_at)}</p>
            </div>
          </div>

          {order.notes && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-zinc-500 mb-1">Customer Notes</p>
              <p className="text-zinc-300 italic">"{order.notes}"</p>
            </div>
          )}
        </div>

        {/* Progress Updates Timeline */}
        <div className="glass-card rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-6">Progress Updates</h3>

          {progressUpdates.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-zinc-500">No progress updates yet.</p>
              <p className="text-zinc-600 text-sm mt-1">The worker will upload progress here.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {progressUpdates.map((update) => (
                <div key={update.id} className="relative pl-8 border-l-2 border-primary/30 pb-6 last:pb-0">
                  {/* Timeline Dot */}
                  <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-primary border-2 border-background"></div>

                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <p className="text-primary-light font-bold text-lg">{update.percentage}% Complete</p>
                      <p className="text-zinc-500 text-xs">{formatDate(update.created_at)}</p>
                    </div>
                  </div>

                  {update.notes && (
                    <p className="text-zinc-300 text-sm mb-3">{update.notes}</p>
                  )}

                  {update.screenshot_url && (
                    <a
                      href={update.screenshot_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block max-w-sm"
                    >
                      <img
                        src={update.screenshot_url}
                        alt={`Progress ${update.percentage}%`}
                        className="w-full rounded-lg border border-border hover:border-primary/50 transition-all"
                      />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex gap-3">
          <Link to="/orders" className="flex-1 btn-secondary text-center">
            ← Back to My Orders
          </Link>
          {userRole === 'worker' && order.worker_id === currentUserId && order.status !== 'completed' && (
            <Link to="/worker" className="flex-1 bg-primary hover:bg-primary-hover text-white font-semibold py-2.5 rounded-lg transition-all text-center">
              Update Progress
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}