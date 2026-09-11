import { useEffect, useState, FormEvent, ChangeEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Database } from '../types/database'
import OrderChat from '../components/OrderChat'
import { compressImage } from '../lib/imageUtils' 

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

  const [showProgressModal, setShowProgressModal] = useState<boolean>(false)
  const [progressPercentage, setProgressPercentage] = useState<number>(0)
  const [progressNotes, setProgressNotes] = useState<string>('')
  const [progressFile, setProgressFile] = useState<File | null>(null)
  const [uploadingProgress, setUploadingProgress] = useState<boolean>(false)

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

    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileData) setUserRole(profileData.role)

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
    setProgressPercentage(orderData.current_percentage || 0)

    const { data: progressData } = await supabase
      .from('progress_updates')
      .select('*')
      .eq('order_id', id)
      .order('created_at', { ascending: false })

    setProgressUpdates((progressData as ProgressUpdate[]) || [])
    setLoading(false)
  }

  async function handleProgressUpdate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!progressFile) {
      alert('Screenshot bukti progres wajib diupload!')
      return
    }

    setUploadingProgress(true)
    try {
      const fileToUpload = await compressImage(progressFile)
      
      // Paksa ekstensi menjadi .jpg agar konsisten dengan hasil kompresi
      const fileName = `${order!.id}/${userRole}-${Date.now()}.jpg`
      const filePath = `progress/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('screenshots')
        .upload(filePath, fileToUpload, {
          contentType: 'image/jpeg' // Pastikan tipe konten benar
        })
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('screenshots').getPublicUrl(filePath)

      // 3. Insert ke tabel progress_updates
      const { error: progressError } = await supabase
        .from('progress_updates')
        .insert([{
          order_id: order!.id,
          percentage: progressPercentage,
          screenshot_url: publicUrl,
          notes: progressNotes || `Update oleh ${userRole}`,
        }])
      if (progressError) throw progressError

      // 4. Update status & persentase di tabel orders
      const newStatus = progressPercentage === 100 ? 'completed' : 'in_progress'
      const { error: orderError } = await supabase.from('orders').update({
        current_percentage: progressPercentage,
        status: newStatus,
        completed_at: progressPercentage === 100 ? new Date().toISOString() : null,
      }).eq('id', order!.id)
      
      if (orderError) throw orderError

      alert('Progres berhasil diupdate!')
      setShowProgressModal(false)
      setProgressFile(null)
      setProgressNotes('')
      fetchOrder() // Refresh data halaman
    } catch (err) {
      alert('Gagal update progres: ' + (err as Error).message)
    }
    setUploadingProgress(false)
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
          <button onClick={() => navigate(-1)} className="text-primary hover:underline">
            ← Go Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-zinc-500 mb-8">
          <button onClick={() => navigate(-1)} className="hover:text-zinc-300 transition flex items-center gap-1">
            ← Back
          </button>
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
        <div className="glass-card rounded-2xl p-6 mb-6">
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
                    <a href={update.screenshot_url} target="_blank" rel="noopener noreferrer" className="block max-w-sm">
                      <img src={update.screenshot_url} alt={`Progress ${update.percentage}%`} className="w-full rounded-lg border border-border hover:border-primary/50 transition-all" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6">
          {/* Chat Section */}
          {(order.consumer_id === currentUserId || order.worker_id === currentUserId || userRole === 'admin') && (
            <OrderChat 
              order={order} 
              currentUserId={currentUserId!} 
              userRole={userRole || ''} 
            />
          )}

          {/* Action Buttons Area */}
          <div className="flex gap-3">
            <button 
              onClick={() => navigate(-1)} 
              className="flex-1 btn-secondary text-center py-2.5 rounded-lg transition-all"
            >
              ← Go Back
            </button>

            {(userRole === 'worker' || userRole === 'admin') && order.status !== 'completed' && order.status !== 'cancelled' && (
              <button 
                onClick={() => setShowProgressModal(true)}
                className="flex-1 bg-primary hover:bg-primary-hover text-white font-semibold py-2.5 rounded-lg transition-all text-center"
              >
                {userRole === 'admin' ? 'Admin Update Progress' : 'Update Progress'}
              </button>
            )}
          </div>
        </div>

        {/* Modal Update Progress */}
        {showProgressModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 fade-in">
            <div className="glass-card rounded-2xl p-6 w-full max-w-md">
              <h2 className="text-xl font-bold text-white mb-2">
                {userRole === 'admin' ? 'Admin Update Progress' : 'Update Progress'}
              </h2>
              <p className="text-zinc-400 text-sm mb-6">{order!.services?.name}</p>

              <form onSubmit={handleProgressUpdate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Persentase Progres</label>
                  <select
                    value={progressPercentage}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => setProgressPercentage(parseInt(e.target.value))}
                    className="input-modern w-full"
                  >
                    <option value={25}>25%</option>
                    <option value={50}>50%</option>
                    <option value={75}>75%</option>
                    <option value={100}>100% (Selesai)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Screenshot Bukti (Wajib)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setProgressFile(e.target.files?.[0] || null)}
                    required
                    className="w-full bg-zinc-900/50 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-100 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-white hover:file:bg-primary-hover"
                  />
                  <p className="text-xs text-zinc-500 mt-1">Large images will be compressed automatically to save space.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Catatan (Opsional)</label>
                  <textarea
                    value={progressNotes}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setProgressNotes(e.target.value)}
                    rows={2}
                    placeholder="Catatan untuk customer..."
                    className="input-modern w-full resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowProgressModal(false)} className="flex-1 btn-secondary">Batal</button>
                  <button 
                    type="submit" 
                    disabled={uploadingProgress} 
                    className="flex-1 bg-primary hover:bg-primary-hover disabled:bg-zinc-800 text-white font-semibold py-2.5 rounded-lg transition-all"
                  >
                    {uploadingProgress ? 'Compressing & Uploading...' : 'Kirim Update'}
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