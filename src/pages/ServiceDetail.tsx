import { useEffect, useState, FormEvent } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Database } from '../types/database';
import { showAlert } from '../lib/dialog';
import { useCart } from '../context/CartContext';

type Service = Database['public']['Tables']['services']['Row'];
type ServiceTier = Database['public']['Tables']['service_tiers']['Row'];
type Review = Database['public']['Tables']['reviews']['Row'] & {
  consumer_profile?: { full_name: string | null } | null;
};

export default function ServiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToCart } = useCart();

  const [service, setService] = useState<Service | null>(null);
  const [tiers, setTiers] = useState<ServiceTier[]>([]);
  const [selectedTierIds, setSelectedTierIds] = useState<string[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [averageRating, setAverageRating] = useState<number>(0);
  const [totalReviewCount, setTotalReviewCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  const [userRole, setUserRole] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true);

  const [gameUid, setGameUid] = useState<string>('');
  const [gameServer, setGameServer] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    fetchServiceData();
    checkUserRole();
  }, [id]);

  async function checkUserRole() {
    setCheckingAuth(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (profile) setUserRole(profile.role);
    }
    setCheckingAuth(false);
  }

  async function fetchServiceData() {
    if (!id) return;
    setLoading(true);

    const { data: serviceData } = await supabase.from('services').select('*').eq('id', id).single();

    if (serviceData) {
      setService(serviceData);

      const { data: tiersData } = await supabase
        .from('service_tiers')
        .select('*')
        .eq('service_id', id)
        .eq('is_active', true)
        .order('price_modifier', { ascending: true });

      setTiers(tiersData || []);

      const { count } = await supabase
        .from('reviews')
        .select('*', { count: 'exact', head: true })
        .eq('service_id', id);
      setTotalReviewCount(count || 0);

      const { data: reviewsData } = await supabase
        .from('reviews')
        .select('*, consumer_profile:profiles!reviews_reviewer_id_fkey(full_name)')
        .eq('service_id', id)
        .order('created_at', { ascending: false })
        .limit(3);

      if (reviewsData) {
        setReviews(reviewsData);
        if (reviewsData.length > 0) {
          const avg = reviewsData.reduce((sum, r) => sum + (r.rating || 0), 0) / reviewsData.length;
          setAverageRating(avg);
        }
      }
    }
    setLoading(false);
  }

  const handleToggleTier = (tierId: string) => {
    setSelectedTierIds((prev) =>
      prev.includes(tierId) ? prev.filter((id) => id !== tierId) : [...prev, tierId]
    );
  };

  const calculatePrice = () => {
    if (!service) return 0;
    return selectedTierIds.reduce((total, tierId) => {
      const tier = tiers.find((t) => t.id === tierId);
      if (!tier) return total;
      return total + Math.round(service.base_price * (tier.price_modifier || 1));
    }, 0);
  };

  const calculateTotalHours = () => {
    return selectedTierIds.reduce((total, tierId) => {
      const tier = tiers.find((t) => t.id === tierId);
      if (!tier) return total;
      return total + (tier.estimated_hours || service?.estimated_hours || 1);
    }, 0);
  };

  const getSelectedTierNames = () => {
    return selectedTierIds
      .map((tierId) => tiers.find((t) => t.id === tierId)?.name)
      .filter(Boolean) as string[];
  };

  async function handleAddToCart(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      await showAlert({ title: 'Login Required', message: 'Please login to add items to cart.', type: 'warning' });
      navigate('/login');
      return;
    }

    // ✅ FIX: Cegah Worker/Admin memesan
    if (userRole !== 'consumer') {
      await showAlert({ 
        title: 'Access Restricted', 
        message: 'Ordering services is only available for Consumer accounts. Please use a consumer account to place an order.', 
        type: 'warning' 
      });
      return;
    }

    // ✅ FIX: Logika Package
    // Jika ada tiers, user WAJIB pilih minimal satu. Jika tidak ada tiers, lewati cek ini (anggap base price).
    if (tiers.length > 0 && selectedTierIds.length === 0) {
      await showAlert({ title: 'No Package Selected', message: 'Please select at least one package.', type: 'warning' });
      return;
    }

    if (!gameUid.trim() || !gameServer.trim()) {
      await showAlert({ title: 'Incomplete Details', message: 'Game UID and Server are required.', type: 'warning' });
      return;
    }

    // Tentukan data yang akan masuk ke cart
    let finalPrice = service!.base_price;
    let finalTierNames: string[] = ['Standard Service'];
    let finalTierIds: string[] = [];
    let finalHours = service?.estimated_hours || 1;

    if (tiers.length > 0) {
      finalPrice = calculatePrice();
      finalTierNames = getSelectedTierNames();
      finalTierIds = selectedTierIds;
      finalHours = calculateTotalHours();
    }

    addToCart({
      serviceId: service!.id,
      serviceName: service!.name,
      tierIds: finalTierIds,
      tierNames: finalTierNames,
      price: finalPrice,
      estimatedHours: finalHours,
      gameUid: gameUid.trim(),
      gameServer: gameServer.trim(),
      notes: notes.trim()
    });

    await showAlert({
      title: 'Added to Cart',
      message: `${service!.name} has been added to your cart.`,
      type: 'success'
    });

    setGameUid('');
    setGameServer('');
    setNotes('');
  }

  const formatRupiah = (angka: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);

  if (loading || !service) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <nav className="flex items-center gap-2 text-sm text-zinc-500 mb-8">
          <Link to="/" className="hover:text-zinc-300 transition">Home</Link>
          <span>/</span>
          <span className="text-zinc-300">{service.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {/* Header */}
            <div className="glass-card rounded-2xl p-6">
              <h1 className="text-3xl font-bold text-white mb-2">{service.name}</h1>

              <Link to={`/service/${id}/reviews`} className="flex items-center gap-2 mb-4 group">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <svg key={star} className={`w-5 h-5 ${star <= Math.round(averageRating) ? 'text-yellow-400' : 'text-zinc-600'}`} fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <span className="text-sm text-zinc-400 group-hover:text-primary transition">
                  {averageRating > 0 ? averageRating.toFixed(1) : 'No ratings'} ({totalReviewCount} reviews)
                </span>
                {totalReviewCount > 0 && (
                  <svg className="w-4 h-4 text-zinc-500 group-hover:text-primary transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </Link>

              <p className="text-zinc-400 mb-6 leading-relaxed">{service.description || 'No description provided.'}</p>

              {/* ✅ Logic Tampilan Package */}
              {tiers.length > 0 ? (
                <div>
                  <h3 className="text-lg font-bold text-white mb-2">Available Packages</h3>
                  <p className="text-xs text-zinc-500 mb-4">You can select multiple packages to combine them into one order.</p>
                  <div className="space-y-3">
                    {tiers.map((tier) => {
                      const isSelected = selectedTierIds.includes(tier.id);
                      const tierPrice = Math.round(service.base_price * (tier.price_modifier || 1));

                      return (
                        <div key={tier.id} onClick={() => handleToggleTier(tier.id)} className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex justify-between items-center ${isSelected ? 'border-primary bg-primary/10' : 'border-border bg-surface hover:border-zinc-600'}`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'bg-primary border-primary' : 'border-zinc-600 bg-zinc-900'}`}>
                              {isSelected && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                            </div>
                            <div>
                              <p className="font-bold text-white">{tier.name}</p>
                              <p className="text-sm text-zinc-400">{tier.description || `Est. ${tier.estimated_hours || service.estimated_hours} hours`}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-primary">{formatRupiah(tierPrice)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-zinc-900/50 rounded-xl border border-border">
                  <p className="text-zinc-400 text-sm">Standard Service (Base Package)</p>
                  <p className="text-2xl font-bold text-primary mt-1">{formatRupiah(service.base_price)}</p>
                </div>
              )}
            </div>

            {reviews.length > 0 && (
              <div className="glass-card rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">Recent Reviews</h3>
                  {totalReviewCount > 3 && (
                    <Link to={`/service/${id}/reviews`} className="text-sm text-primary hover:underline flex items-center gap-1">
                      View all {totalReviewCount} reviews
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                    </Link>
                  )}
                </div>
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <div key={review.id} className="border-b border-border pb-4 last:border-0">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-white">{review.consumer_profile?.full_name || 'Anonymous'}</p>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <svg key={star} className={`w-4 h-4 ${star <= (review.rating || 0) ? 'text-yellow-400' : 'text-zinc-600'}`} fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                          ))}
                        </div>
                      </div>
                      <p className="text-sm text-zinc-300">{review.comment}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl">
              <p className="text-xs text-yellow-400/80">
                <strong>Note:</strong> We are not responsible for any actions taken by game developers (bans, resets, etc.). By ordering, you acknowledge and accept these risks.
              </p>
            </div>
          </div>

          {/* Right Column: Order Summary */}
          <div className="lg:col-span-1">
            {checkingAuth ? (
              <div className="glass-card rounded-2xl p-6 sticky top-24 flex justify-center">
                <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
              </div>
            ) : userRole && userRole !== 'consumer' ? (
              // ✅ Tampilan jika Worker/Admin login
              <div className="glass-card rounded-2xl p-6 sticky top-24 text-center border border-red-500/30 bg-red-500/5">
                <svg className="w-12 h-12 text-red-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h3 className="text-lg font-bold text-white mb-2">Ordering Restricted</h3>
                <p className="text-sm text-zinc-400">
                  Ordering services is only available for <strong className="text-white">Consumer</strong> accounts. 
                  Please switch to a consumer account to place an order.
                </p>
              </div>
            ) : (
              // ✅ Tampilan Normal untuk Consumer
              <div className="glass-card rounded-2xl p-6 sticky top-24">
                <h3 className="text-xl font-bold text-white mb-4">Order Summary</h3>

                <div className="mb-6 p-4 bg-zinc-900/50 rounded-xl border border-border space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Service:</span>
                    <span className="text-white font-medium text-right">{service.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Packages:</span>
                    <span className="text-white font-medium text-right">
                      {tiers.length > 0 ? (selectedTierIds.length > 0 ? getSelectedTierNames().join(', ') : 'None selected') : 'Standard'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Est. Time:</span>
                    <span className="text-white font-medium">{tiers.length > 0 ? calculateTotalHours() : (service.estimated_hours || 1)} Hours</span>
                  </div>
                  <div className="border-t border-border my-2 pt-2 flex justify-between items-center">
                    <span className="text-zinc-300 font-medium">Total Price:</span>
                    <span className="text-2xl font-bold text-primary">{formatRupiah(tiers.length > 0 ? calculatePrice() : service.base_price)}</span>
                  </div>
                </div>

                <form onSubmit={handleAddToCart} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1">Game UID / ID *</label>
                    <input type="text" value={gameUid} onChange={(e) => setGameUid(e.target.value)} required className="input-modern" placeholder="e.g., 123456789" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1">Server *</label>
                    <input type="text" value={gameServer} onChange={(e) => setGameServer(e.target.value)} required className="input-modern" placeholder="e.g., Asia, NA, Server 1" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1">Additional Notes</label>
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="input-modern resize-none" placeholder="Any specific requests..." />
                  </div>

                  <button type="submit" className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Add to Cart
                  </button>
                  <p className="text-xs text-zinc-500 text-center">You can review your cart before checkout.</p>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}