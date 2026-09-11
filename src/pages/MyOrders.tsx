import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Database } from '../types/database'

// Tipe Order dengan relasi service
type Order = Database['public']['Tables']['orders']['Row'] & {
  services: {
    name: string
    category: string
  } | null
}

export default function MyOrders() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [filter, setFilter] = useState<string>('all')

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
      .select('*, services(name, category)')
      .eq('consumer_id', user.id)
      .order('created_at', { ascending: false })

    setOrders((data as Order[]) || [])
    setLoading(false)
  }

  async function handleCancelOrder(orderId: string, orderStatus: string) {
    if (orderStatus === 'in_progress') {
      alert('Cannot cancel: Worker is already working on this order. Please contact support or use the chat.')
      return
    }
    if (orderStatus === 'completed' || orderStatus === 'cancelled') {
      alert('This order cannot be cancelled.')
      return
    }

    const reason = prompt('Please provide a reason for cancellation (optional):')
    if (reason === null) return // User membatalkan prompt

    setLoading(true)
    const { error } = await supabase
      .from('orders')
      .update({ 
        status: 'cancelled',
        cancel_reason: reason.trim() || 'No reason provided',
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', orderId)

    if (error) {
      alert('Failed to cancel order: ' + error.message)
    } else {
      alert('Order cancelled successfully.')
      fetchOrders() // Refresh list
    }
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
      month: 'short', day: 'numeric', year: 'numeric'
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

  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true
    if (filter === 'active') return order.status !== 'completed' && order.status !== 'cancelled'
    return order.status === filter
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">My Orders</h1>
          <p className="text-zinc-400">Track and manage all your boosting orders</p>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { id: 'all', label: 'All Orders' },
            { id: 'active', label: 'Active' },
            { id: 'pending', label: 'Pending' },
            { id: 'in_progress', label: 'In Progress' },
            { id: 'completed', label: 'Completed' },
            { id: 'cancelled', label: 'Cancelled' }, 
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                filter === tab.id
                  ? 'bg-primary text-white'
                  : 'bg-surface hover:bg-surface-hover text-zinc-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-800 flex items-center justify-center">
              <svg className="w-8 h-8 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-zinc-400 text-lg mb-2">No orders found</p>
            <p className="text-zinc-500 text-sm mb-6">
              {filter === 'all' 
                ? "You haven't placed any orders yet."
                : `No ${filter.replace('_', ' ')} orders.`}
            </p>
            <Link to="/" className="btn-primary inline-block">
              Browse Services
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <div
                key={order.id}
                className="glass-card rounded-2xl p-6 hover:border-primary/50 transition-all fade-in"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-white">
                        {order.services?.name || 'Unknown Service'}
                      </h3>
                      <span className={`px-2.5 py-0.5 rounded-md text-xs font-semibold uppercase border ${getStatusStyle(order.status)}`}>
                        {(order.status || 'pending').replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
                      <span>Order #{order.id.slice(0, 8)}</span>
                      <span>•</span>
                      <span>{formatDate(order.created_at)}</span>
                      <span>•</span>
                      <span className="text-primary-light font-semibold">{order.current_percentage || 0}% complete</span>
                    </div>

                    {/* Mini Progress Bar */}
                    <div className="mt-3 w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="h-1.5 rounded-full bg-gradient-to-r from-primary to-purple-500 transition-all"
                        style={{ width: `${order.current_percentage || 0}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="text-right flex flex-col items-end gap-2">
                    <p className="text-xl font-bold gradient-text">
                      {formatRupiah(order.total_price)}
                    </p>
                    <div className="flex items-center gap-3">
                      {(order.status === 'pending' || order.status === 'paid') && (
                        <button
                          onClick={() => handleCancelOrder(order.id, order.status || 'pending')}
                          className="text-xs text-red-400 hover:text-red-300 font-medium px-2 py-1 rounded hover:bg-red-500/10 transition"
                        >
                          Cancel
                        </button>
                      )}
                      
                      <Link
                        to={`/order/${order.id}`}
                        className="text-xs text-zinc-400 hover:text-primary transition flex items-center gap-1"
                      >
                        View details →
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}