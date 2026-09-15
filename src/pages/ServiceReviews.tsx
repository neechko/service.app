import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Database } from '../types/database';

type Review = Database['public']['Tables']['reviews']['Row'] & {
  consumer_profile?: { full_name: string | null } | null;
};

export default function ServiceReviews() {
  const { id } = useParams<{ id: string }>();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [serviceName, setServiceName] = useState<string>('');
  const [averageRating, setAverageRating] = useState<number>(0);
  const [ratingDistribution, setRatingDistribution] = useState<Record<number, number>>({ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchReviews();
  }, [id]);

  async function fetchReviews() {
    if (!id) return;
    setLoading(true);

    const { data: serviceData } = await supabase.from('services').select('name').eq('id', id).single();
    if (serviceData) setServiceName(serviceData.name);

    const { data: reviewsData } = await supabase
      .from('reviews')
      .select('*, consumer_profile:profiles!reviews_reviewer_id_fkey(full_name)')
      .eq('service_id', id)
      .order('created_at', { ascending: false });

    if (reviewsData) {
      setReviews(reviewsData);
      if (reviewsData.length > 0) {
        const avg = reviewsData.reduce((sum, r) => sum + (r.rating || 0), 0) / reviewsData.length;
        setAverageRating(avg);

        const dist: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        reviewsData.forEach((r) => {
          const rating = r.rating || 0;
          if (dist[rating] !== undefined) dist[rating]++;
        });
        setRatingDistribution(dist);
      }
    }
    setLoading(false);
  }

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <nav className="flex items-center gap-2 text-sm text-zinc-500 mb-8">
          <Link to="/" className="hover:text-zinc-300 transition">Home</Link>
          <span>/</span>
          <Link to={`/service/${id}`} className="hover:text-zinc-300 transition">{serviceName || 'Service'}</Link>
          <span>/</span>
          <span className="text-zinc-300">Reviews</span>
        </nav>

        <div className="glass-card rounded-2xl p-6 mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Customer Reviews</h1>
          <p className="text-zinc-400 mb-6">All reviews for: {serviceName}</p>

          {/* Rating Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 p-6 bg-surface/50 rounded-xl border border-border">
            <div className="text-center md:text-left">
              <p className="text-5xl font-bold text-white">{averageRating > 0 ? averageRating.toFixed(1) : '-'}</p>
              <div className="flex items-center justify-center md:justify-start gap-1 my-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <svg key={star} className={`w-5 h-5 ${star <= Math.round(averageRating) ? 'text-yellow-400' : 'text-zinc-600'}`} fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-sm text-zinc-400">{reviews.length} total reviews</p>
            </div>

            <div className="md:col-span-2 space-y-1">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = ratingDistribution[star] || 0;
                const percentage = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                return (
                  <div key={star} className="flex items-center gap-2 text-sm">
                    <span className="text-zinc-400 w-8">{star} star</span>
                    <div className="flex-1 bg-zinc-800 rounded-full h-2 overflow-hidden">
                      <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${percentage}%` }}></div>
                    </div>
                    <span className="text-zinc-400 w-8 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Reviews List */}
          {reviews.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-zinc-500">No reviews yet for this service.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div key={review.id} className="border-b border-border pb-4 last:border-0">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-white">{review.consumer_profile?.full_name || 'Anonymous'}</p>
                      <p className="text-xs text-zinc-500">{formatDate(review.created_at)}</p>
                    </div>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <svg key={star} className={`w-4 h-4 ${star <= (review.rating || 0) ? 'text-yellow-400' : 'text-zinc-600'}`} fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                  </div>
                  {review.comment && <p className="text-sm text-zinc-300">{review.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="text-center">
          <Link to={`/service/${id}`} className="btn-secondary inline-block">
            Back to Service
          </Link>
        </div>
      </div>
    </div>
  );
}