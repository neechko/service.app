import { useEffect, useState, FormEvent } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Database } from '../types/database'
import { showAlert } from '../lib/dialog'
import { useCart } from '../context/CartContext' // ✅ Import Context Keranjang

type Service = Database['public']['Tables']['services']['Row']
type ServiceTier = Database['public']['Tables']['service_tiers']['Row']
type Review = Database['public']['Tables']['reviews']['Row'] & {
  consumer_profile?: { full_name: string | null } | null
}

export default function ServiceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { addToCart } = useCart() // ✅ Gunakan fungsi addToCart
  
  const [service, setService] = useState<Service | null>(null)
  const [tiers, setTiers] = useState<ServiceTier[]>([])
  const [selectedTier, setSelectedTier] = useState<ServiceTier | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [averageRating, setAverageRating] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)

  // Form State untuk Keranjang
  const [gameUid, setGameUid] = useState<string>('')
  const [gameServer, setGameServer] = useState<string>('')
  const [notes, setNotes] = useState<string>('')

  useEffect(() => {
    fetchServiceData()
  }, [id])

  async function fetchServiceData() {
    if (!id) return
    setLoading(true)

    // 1. Ambil detail service
    const { data: serviceData } = await supabase
      .from('services')
      .select('*')
      .eq('id', id)
      .single()

    if (serviceData) {
      setService(serviceData)
      
      // 2. Ambil paket/tiers untuk service ini
      const { data: tiersData } = await supabase
        .from('service_tiers')
        .select('*')
        .eq('service_id', id)
        .eq('is_active', true)
        .order('price_modifier', { ascending: true })

      if (tiersData && tiersData.length > 0) {
        setTiers(tiersData)
        setSelectedTier(tiersData[0]) // Default pilih tier pertama
      }

      // 3. ✅ Ambil ulasan publik untuk service ini
      const { data: reviewsData } = await supabase
        .from('reviews')
        .select('*, consumer_profile:profiles!reviews_reviewer_id_fkey(full_name)')
        .eq('service_id', id)
        .order('created_at', { ascending: false })
        .limit(5) // Tampilkan 5 ulasan terbaru
      
      if (reviewsData) {
        setReviews(reviewsData)
        if (reviewsData.length > 0) {
          const avg = reviewsData.reduce((sum, r) => sum + (r.rating || 0), 0) / reviewsData.length
          setAverageRating(avg)
        }
      }
    }
    setLoading(false)
  }

  // Hitung harga dinamis berdasarkan tier
  const calculatePrice = () => {
    if (!service) return 0
    if (selectedTier && selectedTier.price_modifier) {
      return Math.round(service.base_price * selectedTier.price_modifier)
    }
    return service.base_price
  }

  const calculateTime = () => {
    if (selectedTier?.estimated_hours) return selectedTier.estimated_hours
    return service?.estimated_hours || 1
  }

  // ✅ Fungsi Tambah ke Keranjang (Bukan langsung create order)
  async function handleAddToCart(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      await showAlert({ title: 'Login Required', message: 'Silakan login terlebih dahulu untuk menambahkan ke keranjang.', type: 'warning' })
      navigate('/login')
      return
    }

    if (!gameUid.trim() || !gameServer.trim()) {
      await showAlert({ title: 'Data Tidak Lengkap', message: 'Game UID dan Server wajib diisi.', type: 'warning' })
      return
    }

    const tierName = selectedTier ? selectedTier.name : 'Standard'
    
    // Masukkan ke context keranjang
    addToCart({
      serviceId: service!.id,
      serviceName: service!.name,
      tierId: selectedTier?.id || '',
      tierName: tierName,
      price: calculatePrice(),
      estimatedHours: calculateTime(),
      gameUid: gameUid.trim(),
      gameServer: gameServer.trim(),
      notes: notes.trim()
    })

    await showAlert({ title: 'Berhasil!', message: `${service!.name} (${tierName}) telah ditambahkan ke keranjang.`, type: 'success' })
    
    // Opsional: Reset form agar user bisa menambah layanan lain dengan UID berbeda
    setGameUid('')
    setGameServer('')
    setNotes('')
  }

  if (loading || !service) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
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
          <span className="text-zinc-300">{service.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Service Info, Tiers & Reviews */}
          <div className="lg:col-span-2 space-y-6">
            <div className="glass-card rounded-2xl p-6">
              <h1 className="text-3xl font-bold text-white mb-2">{service.name}</h1>
              
              {/* ✅ Rating Summary */}
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <svg key={star} className={`w-5 h-5 ${star <= Math.round(averageRating) ? 'text-yellow-400' : 'text-zinc-600'}`} fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <span className="text-sm text-zinc-400">({reviews.length} ulasan)</span>
              </div>

              <p className="text-zinc-400 mb-6 leading-relaxed">{service.description || 'Tidak ada deskripsi.'}</p>

              {/* Tier Selection */}
              {tiers.length > 0 ? (
                <div>
                  <h3 className="text-lg font-bold text-white mb-4">Pilih Paket Layanan</h3>
                  <div className="space-y-3">
                    {tiers.map((tier) => {
                      const isSelected = selectedTier?.id === tier.id
                      const tierPrice = Math.round(service.base_price * (tier.price_modifier || 1))
                      
                      return (
                        <div
                          key={tier.id}
                          onClick={() => setSelectedTier(tier)}
                          className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex justify-between items-center ${
                            isSelected 
                              ? 'border-primary bg-primary/10' 
                              : 'border-border bg-surface hover:border-zinc-600'
                          }`}
                        >
                          <div>
                            <p className="font-bold text-white">{tier.name}</p>
                            <p className="text-sm text-zinc-400">{tier.description || `Estimasi: ${tier.estimated_hours || service.estimated_hours} jam`}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-primary">
                              {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(tierPrice)}
                            </p>
                            {isSelected && <span className="text-xs text-primary-light">Dipilih</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-zinc-900/50 rounded-xl border border-border">
                  <p className="text-zinc-400 text-sm">Hanya tersedia 1 paket standar.</p>
                  <p className="text-2xl font-bold text-primary mt-1">
                    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(service.base_price)}
                  </p>
                </div>
              )}
            </div>

            {/* ✅ Public Reviews Section */}
            <div className="glass-card rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">Ulasan Pelanggan</h3>
              {reviews.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-4">Belum ada ulasan untuk layanan ini.</p>
              ) : (
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <div key={review.id} className="border-b border-border pb-4 last:border-0">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-white">{review.consumer_profile?.full_name || 'Anonim'}</p>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <svg key={star} className={`w-4 h-4 ${star <= (review.rating || 0) ? 'text-yellow-400' : 'text-zinc-600'}`} fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                        </div>
                      </div>
                      <p className="text-sm text-zinc-300">{review.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Disclaimer */}
            <div className="p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl">
              <p className="text-xs text-yellow-400/80">
                <strong>Catatan:</strong> Kami tidak bertanggung jawab atas tindakan developer game (banned/reset). Pastikan Anda menyetujui risiko ini sebelum memesan.
              </p>
            </div>
          </div>

          {/* Right Column: Cart Summary Form */}
          <div className="lg:col-span-1">
            <div className="glass-card rounded-2xl p-6 sticky top-24">
              <h3 className="text-xl font-bold text-white mb-4">Detail Pemesanan</h3>
              
              <div className="mb-6 p-4 bg-zinc-900/50 rounded-xl border border-border space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Layanan:</span>
                  <span className="text-white font-medium">{service.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Paket:</span>
                  <span className="text-white font-medium">{selectedTier?.name || 'Standard'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Estimasi:</span>
                  <span className="text-white font-medium">{calculateTime()} Jam</span>
                </div>
                <div className="border-t border-border my-2 pt-2 flex justify-between items-center">
                  <span className="text-zinc-300 font-medium">Total Harga:</span>
                  <span className="text-2xl font-bold text-primary">
                    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(calculatePrice())}
                  </span>
                </div>
              </div>

              <form onSubmit={handleAddToCart} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">Game UID / ID *</label>
                  <input
                    type="text"
                    value={gameUid}
                    onChange={(e) => setGameUid(e.target.value)}
                    required
                    className="input-modern"
                    placeholder="Contoh: 123456789"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">Server *</label>
                  <input
                    type="text"
                    value={gameServer}
                    onChange={(e) => setGameServer(e.target.value)}
                    required
                    className="input-modern"
                    placeholder="Contoh: Asia, NA, Server 1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">Catatan Tambahan</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="input-modern resize-none"
                    placeholder="Contoh: Jangan gunakan karakter X, main jam 8 malam, dll."
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Tambah ke Keranjang
                </button>
                <p className="text-xs text-zinc-500 text-center mt-2">Anda dapat meninjau keranjang dan melakukan checkout nanti.</p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}