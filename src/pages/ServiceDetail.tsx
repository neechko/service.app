import { useEffect, useState, FormEvent, ChangeEvent } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Database } from '../types/database'
import { showAlert } from '../lib/dialog'

type Service = Database['public']['Tables']['services']['Row']
type ServiceTier = Database['public']['Tables']['service_tiers']['Row']

export default function ServiceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  
  const [service, setService] = useState<Service | null>(null)
  const [tiers, setTiers] = useState<ServiceTier[]>([])
  const [selectedTier, setSelectedTier] = useState<ServiceTier | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [submitting, setSubmitting] = useState<boolean>(false)

  // Form State
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

  async function handleCreateOrder(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      await showAlert({ title: 'Login Required', message: 'Silakan login terlebih dahulu untuk memesan.', type: 'warning' })
      navigate('/login')
      return
    }

    if (!gameUid.trim() || !gameServer.trim()) {
      await showAlert({ title: 'Data Tidak Lengkap', message: 'Game UID dan Server wajib diisi.', type: 'warning' })
      return
    }

    setSubmitting(true)
    try {
      const finalPrice = calculatePrice()
      const tierName = selectedTier ? selectedTier.name : 'Standard'

      const { error } = await supabase.from('orders').insert([{
        consumer_id: user.id,
        service_id: service!.id,
        total_price: finalPrice,
        game_uid: gameUid.trim(),
        game_server: gameServer.trim(),
        notes: `${tierName} Package. Notes: ${notes.trim()}`,
        status: 'pending',
        current_percentage: 0
      }])

      if (error) throw error

      await showAlert({ title: 'Order Berhasil!', message: 'Order Anda telah dibuat. Silakan tunggu konfirmasi dari Admin.', type: 'success' })
      navigate('/orders')
    } catch (err) {
      await showAlert({ title: 'Error', message: 'Gagal membuat order: ' + (err as Error).message, type: 'danger' })
    }
    setSubmitting(false)
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
          {/* Left Column: Service Info & Tiers */}
          <div className="lg:col-span-2 space-y-6">
            <div className="glass-card rounded-2xl p-6">
              <h1 className="text-3xl font-bold text-white mb-2">{service.name}</h1>
              <p className="text-zinc-400 mb-6">{service.description || 'Tidak ada deskripsi.'}</p>

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

            {/* Disclaimer Kecil */}
            <div className="p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl">
              <p className="text-xs text-yellow-400/80">
                 <strong>Catatan:</strong>* Kami tidak bertanggung jawab atas tindakan developer game (banned/reset). Pastikan Anda menyetujui risiko ini sebelum memesan.
              </p>
            </div>
          </div>

          {/* Right Column: Order Form */}
          <div className="lg:col-span-1">
            <div className="glass-card rounded-2xl p-6 sticky top-24">
              <h3 className="text-xl font-bold text-white mb-4">Detail Pemesanan</h3>
              
              <div className="mb-6 p-4 bg-zinc-900/50 rounded-xl border border-border">
                <div className="flex justify-between mb-2">
                  <span className="text-zinc-400 text-sm">Paket:</span>
                  <span className="text-white text-sm font-medium">{selectedTier?.name || 'Standard'}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-zinc-400 text-sm">Estimasi:</span>
                  <span className="text-white text-sm font-medium">{calculateTime()} Jam</span>
                </div>
                <div className="border-t border-border my-2 pt-2 flex justify-between">
                  <span className="text-zinc-300 font-medium">Total Harga:</span>
                  <span className="text-xl font-bold text-primary">
                    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(calculatePrice())}
                  </span>
                </div>
              </div>

              <form onSubmit={handleCreateOrder} className="space-y-4">
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
                  disabled={submitting}
                  className="w-full bg-primary hover:bg-primary-hover disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-bold py-3 rounded-xl transition-all active:scale-[0.98]"
                >
                  {submitting ? 'Memproses...' : 'Buat Order Sekarang'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}