import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function OrderTracking() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState(null)
  const [service, setService] = useState(null)
  const [progresses, setProgresses] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOrderData()
  }, [id])

  async function fetchOrderData() {
    setLoading(true)
    
    const { data: orderData } = await supabase
      .from('orders')
      .select('*, services(*)')
      .eq('id', id)
      .single()

    if (!orderData) {
      setLoading(false)
      return
    }

    setOrder(orderData)
    setService(orderData.services)

    const { data: progressData } = await supabase
      .from('progress_updates')
      .select('*')
      .eq('order_id', id)
      .order('created_at', { ascending: true })

    setProgresses(progressData || [])
    setLoading(false)
  }

  const getProgressColor = (percentage) => {
    if (percentage < 30) return 'from-red-500 to-red-600'
    if (percentage < 70) return 'from-amber-500 to-orange-500'
    return 'from-green-500 to-emerald-500'
  }

  const getStatusStyle = (status) => {
    const styles = {
      completed: 'bg-green-500/10 text-green-400 border-green-500/30',
      in_progress: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      paid: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
      pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    }
    return styles[status] || styles.pending
  }

  const formatRupiah = (angka) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(angka)
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400 mb-4">Order not found.</p>
          <Link to="/" className="text-primary hover:underline">Back to catalog</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-zinc-500 mb-8">
          <Link to="/" className="hover:text-zinc-300 transition">Services</Link>
          <span>/</span>
          <span className="text-zinc-300">Order Tracking</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* LEFT: Progress */}
          <div className="lg:col-span-2 space-y-6 fade-in">
            {/* Main Status Card */}
            <div className="glass-card rounded-2xl p-6 glow-indigo">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-white mb-1">{service?.name}</h1>
                  <p className="text-zinc-500 text-sm">Order #{order.id.slice(0, 8)}</p>
                </div>
                <span className={`px-3 py-1 rounded-md text-xs font-semibold uppercase border ${getStatusStyle(order.status)}`}>
                  {order.status.replace('_', ' ')}
                </span>
              </div>

              {/* Progress Bar */}
              <div>
                <div className="flex justify-between text-sm mb-3">
                  <span className="text-zinc-400 font-medium">Completion Progress</span>
                  <span className="text-2xl font-bold gradient-text">{order.current_percentage}%</span>
                </div>
                <div className="w-full bg-zinc-900 rounded-full h-3 overflow-hidden">
                  <div 
                    className={`h-3 rounded-full bg-gradient-to-r ${getProgressColor(order.current_percentage)} transition-all duration-1000 ease-out`}
                    style={{ width: `${order.current_percentage}%` }}
                  ></div>
                </div>
                <p className="text-xs text-zinc-500 mt-3">
                  {order.current_percentage === 100 
                    ? 'Order completed! Please verify your account.' 
                    : 'Your worker is working on your order. Updates will appear below.'}
                </p>
              </div>
            </div>

            {/* Timeline */}
            <div className="glass-card rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-6">Progress Timeline</h3>

              {progresses.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-800 flex items-center justify-center">
                    <svg className="w-8 h-8 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-zinc-500">No updates yet. Your worker will start soon.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {progresses.map((prog, index) => (
                    <div key={prog.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-3 h-3 rounded-full bg-primary ring-4 ring-primary/20"></div>
                        {index !== progresses.length - 1 && <div className="w-0.5 flex-1 bg-border my-1"></div>}
                      </div>
                      
                      <div className="flex-1 bg-zinc-900/50 rounded-xl p-4 border border-border">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-lg font-bold gradient-text">{prog.percentage}% Complete</span>
                          <span className="text-xs text-zinc-500">{formatDate(prog.created_at)}</span>
                        </div>
                        {prog.notes && (
                          <p className="text-zinc-300 text-sm mb-3">{prog.notes}</p>
                        )}
                        {prog.screenshot_url && (
                          <div>
                            <img 
                              src={prog.screenshot_url} 
                              alt="Progress proof" 
                              className="rounded-lg border border-border max-w-full h-auto max-h-64 object-cover hover:opacity-90 transition cursor-pointer"
                              onClick={() => window.open(prog.screenshot_url, '_blank')}
                            />
                            <p className="text-xs text-zinc-500 mt-1">Click to enlarge</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Order Summary */}
          <div className="fade-in">
            <div className="glass-card rounded-2xl p-6 lg:sticky lg:top-24">
              <h3 className="font-bold text-white mb-4">Order Summary</h3>
              
              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-zinc-400">UID / Account Email</span>
                  <span className="text-white text-right">{order.account_email || '-'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-zinc-400">Server</span>
                  <span className="text-white capitalize">{order.account_password || '-'}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-zinc-400">Total Amount</span>
                  <span className="text-lg font-bold gradient-text">{formatRupiah(order.total_price)}</span>
                </div>
              </div>

              {order.notes && (
                <div className="mt-4 bg-zinc-900/50 p-3 rounded-lg border border-border">
                  <p className="text-xs text-zinc-500 mb-1">Your Notes:</p>
                  <p className="text-sm text-zinc-300 italic">"{order.notes}"</p>
                </div>
              )}

              {order.current_percentage === 100 && order.status !== 'completed' && (
                <button className="w-full mt-6 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition-all">
                  Confirm Completion & Rate
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}