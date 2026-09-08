import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ServiceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [service, setService] = useState(null)
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [ordering, setOrdering] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [uid, setUid] = useState('')
  const [server, setServer] = useState('asia')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    fetchService()
  }, [id])

  async function fetchService() {
    const [serviceRes, categoriesRes] = await Promise.all([
      supabase.from('services').select('*').eq('id', id).single(),
      supabase.from('categories').select('*')
    ])

    if (serviceRes.error) {
      setError('Service not found')
    } else {
      setService(serviceRes.data)
    }
    if (categoriesRes.data) setCategories(categoriesRes.data)
    setLoading(false)
  }

  async function handleOrder(e) {
    e.preventDefault()
    setOrdering(true)
    setError('')
    setSuccess('')

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setError('Please sign in to place an order')
      setOrdering(false)
      return
    }


    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileData?.role === 'admin') {
      setError('Admin accounts cannot place orders. Please use a customer account.')
      setOrdering(false)
      return
    }

    if (profileData?.role === 'worker') {
      setError('Worker accounts cannot place orders. Workers provide services, not consume them.')
      setOrdering(false)
      return
    }

    const { data, error: orderError } = await supabase
      .from('orders')
      .insert([{
        consumer_id: user.id,
        service_id: id,
        total_price: service.base_price,
        account_email: uid,
        account_password: server,
        notes: notes,
        status: 'pending',
        current_percentage: 0,
      }])
      .select()

    if (orderError) {
      setError('Failed to create order: ' + orderError.message)
      setOrdering(false)
    } else {
      setSuccess('Order placed successfully! Redirecting...')
      setTimeout(() => navigate('/order/' + data[0].id), 2000)
    }
  }

  const formatRupiah = (angka) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(angka)
  }

  const getCategoryName = (slug) => {
    const cat = categories.find(c => c.slug === slug)
    return cat ? cat.name : slug
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
      </div>
    )
  }

  if (!service) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400 mb-4">Service not found.</p>
          <Link to="/" className="text-primary hover:underline">Back to catalog</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-zinc-500 mb-8">
          <Link to="/" className="hover:text-zinc-300 transition">Services</Link>
          <span>/</span>
          <span className="text-zinc-300">{service.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* LEFT: Service Info */}
          <div className="lg:col-span-2 space-y-6 fade-in">
            <div>
              <span className="inline-flex items-center bg-primary/10 text-primary-light text-xs font-medium px-2.5 py-1 rounded-md mb-4">
                {getCategoryName(service.category)}
              </span>
              <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                {service.name}
              </h1>
              <p className="text-zinc-400 leading-relaxed text-lg">
                {service.description}
              </p>
            </div>

            {/* Details Card */}
            <div className="glass-card rounded-2xl p-6">
              <h3 className="font-semibold text-white mb-4">Service Details</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-zinc-400 text-sm">Estimated Duration</span>
                  <span className="text-white font-medium">{service.estimated_hours} hours</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-zinc-400 text-sm">Category</span>
                  <span className="text-white font-medium">{getCategoryName(service.category)}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-zinc-400 text-sm">Price</span>
                  <span className="text-2xl font-bold gradient-text">{formatRupiah(service.base_price)}</span>
                </div>
              </div>
            </div>

            {/* Security Guarantee */}
            <div className="glass-card rounded-2xl p-6">
              <h3 className="font-semibold text-white mb-4">Security Guarantee</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  'Verified & experienced boosters',
                  'Real-time progress tracking',
                  'Funds held until completion',
                  'No cheats or hacks used',
                  'Money-back guarantee',
                  '24/7 customer support'
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-zinc-300">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT: Order Form */}
          <div className="fade-in">
            <div className="glass-card rounded-2xl p-6 lg:sticky lg:top-24">
              <h2 className="text-xl font-bold text-white mb-6">Place Your Order</h2>

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

              <form onSubmit={handleOrder} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Genshin Impact UID
                  </label>
                  <input
                    type="text"
                    value={uid}
                    onChange={(e) => setUid(e.target.value)}
                    required
                    placeholder="e.g. 812345678"
                    className="input-modern"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Server
                  </label>
                  <select
                    value={server}
                    onChange={(e) => setServer(e.target.value)}
                    className="input-modern"
                  >
                    <option value="asia">Asia</option>
                    <option value="america">America</option>
                    <option value="europe">Europe</option>
                    <option value="tw_hk_mo">TW/HK/MO</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Additional Notes (optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="e.g. Don't use resin, skip daily, etc."
                    className="input-modern resize-none"
                  />
                </div>

                {/* Order Summary */}
                <div className="bg-zinc-900/50 rounded-lg p-4 border border-border">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-zinc-400">Service Fee</span>
                    <span className="text-white">{formatRupiah(service.base_price)}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-zinc-400">Admin Fee</span>
                    <span className="text-green-400">Free</span>
                  </div>
                  <div className="border-t border-border pt-2 mt-2 flex justify-between">
                    <span className="text-white font-semibold">Total</span>
                    <span className="text-xl font-bold gradient-text">{formatRupiah(service.base_price)}</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={ordering}
                  className="w-full bg-primary hover:bg-primary-hover disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-semibold py-3.5 rounded-lg transition-all duration-200 active:scale-[0.98]"
                >
                  {ordering ? 'Processing...' : 'Place Order'}
                </button>

                <p className="text-xs text-zinc-500 text-center">
                  By placing an order, you agree to Primora's Terms & Conditions
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}