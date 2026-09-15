import { useEffect, useState, FormEvent, ChangeEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Database } from "../types/database";
import OrderChat from "../components/OrderChat";
import { compressImage } from "../lib/imageUtils";
import { showAlert } from "../lib/dialog";

type Order = Database["public"]["Tables"]["orders"]["Row"] & {
  services: { name: string; category: string; description: string | null; estimated_hours: number } | null;
  consumer_profile: { full_name: string; phone: string | null } | null;
  worker_profile: { full_name: string; phone: string | null } | null;
};

type ProgressUpdate = Database["public"]["Tables"]["progress_updates"]["Row"];
type Review = Database["public"]["Tables"]["reviews"]["Row"];

export default function OrderTracking() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [order, setOrder] = useState<Order | null>(null);
  const [progressUpdates, setProgressUpdates] = useState<ProgressUpdate[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  const [showProgressModal, setShowProgressModal] = useState<boolean>(false);
  const [progressPercentage, setProgressPercentage] = useState<number>(0);
  const [progressNotes, setProgressNotes] = useState<string>("");
  const [progressFile, setProgressFile] = useState<File | null>(null);
  const [uploadingProgress, setUploadingProgress] = useState<boolean>(false);

  const [existingReview, setExistingReview] = useState<Review | null>(null);
  const [newRating, setNewRating] = useState<number>(5);
  const [newReviewComment, setNewReviewComment] = useState<string>("");
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);

  useEffect(() => { fetchOrder(); }, [id]);

  async function fetchOrder() {
    if (!id) return;
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/login"); return; }
    setCurrentUserId(user.id);

    const { data: profileData } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profileData) setUserRole(profileData.role);

    const { data: orderData, error } = await supabase
      .from("orders")
      .select(`*, services(name, category, description, estimated_hours), consumer_profile:profiles!orders_consumer_id_fkey(full_name, phone), worker_profile:profiles!orders_worker_id_fkey(full_name, phone)`)
      .eq("id", id).single();

    if (error || !orderData) { setLoading(false); return; }

    setOrder(orderData as Order);
    setProgressPercentage(orderData.current_percentage || 0);

    const { data: progressData } = await supabase.from("progress_updates").select("*").eq("order_id", id).order("created_at", { ascending: false });
    setProgressUpdates((progressData as ProgressUpdate[]) || []);

    if (user.id === orderData.consumer_id) {
      const { data: reviewData } = await supabase.from("reviews").select("*").eq("order_id", id).single();
      setExistingReview(reviewData);
    }
    setLoading(false);
  }

  async function handleProgressUpdate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!progressFile) {
      await showAlert({ title: "Missing Screenshot", message: "Screenshot proof is required!", type: "warning" });
      return;
    }
    setUploadingProgress(true);
    try {
      const fileToUpload = await compressImage(progressFile);
      const fileName = `${order!.id}/${userRole}-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from("screenshots").upload(`progress/${fileName}`, fileToUpload, { contentType: "image/jpeg" });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from("screenshots").getPublicUrl(`progress/${fileName}`);
      const { error: progressError } = await supabase.from("progress_updates").insert([{ order_id: order!.id, percentage: progressPercentage, screenshot_url: publicUrl, notes: progressNotes || `Update by ${userRole}` }]);
      if (progressError) throw progressError;

      const newStatus = progressPercentage === 100 ? "completed" : "in_progress";
      await supabase.from("orders").update({ current_percentage: progressPercentage, status: newStatus, completed_at: progressPercentage === 100 ? new Date().toISOString() : null }).eq("id", order!.id);

      await showAlert({ title: "Success", message: "Progress updated successfully!", type: "success" });
      setShowProgressModal(false);
      setProgressFile(null);
      setProgressNotes("");
      fetchOrder();
    } catch (err) {
      await showAlert({ title: "Error", message: "Failed to update progress: " + (err as Error).message, type: "danger" });
    }
    setUploadingProgress(false);
  }

  async function handleSubmitReview(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!order || !currentUserId) return;
    setSubmittingReview(true);
    try {
      const { error } = await supabase.from("reviews").insert([{ 
        order_id: order.id, 
        reviewer_id: currentUserId, 
        reviewee_id: order.worker_id, 
        service_id: order.service_id, // ✅ Pastikan service_id terkirim
        rating: newRating, 
        comment: newReviewComment.trim() 
      }]);
      if (error) throw error;
      await showAlert({ title: "Thank You!", message: "Your review has been submitted.", type: "success" });
      fetchOrder();
    } catch (err) {
      await showAlert({ title: "Error", message: "Failed to submit review.", type: "danger" });
    }
    setSubmittingReview(false);
  }

  const formatRupiah = (angka: number | null | undefined) => {
    if (!angka) return "Rp 0";
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(angka);
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const getStatusStyle = (status: string | null | undefined) => {
    const styles: Record<string, string> = {
      completed: "bg-green-500/10 text-green-400 border-green-500/30",
      in_progress: "bg-blue-500/10 text-blue-400 border-blue-500/30",
      paid: "bg-purple-500/10 text-purple-400 border-purple-500/30",
      pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
      cancelled: "bg-red-500/10 text-red-400 border-red-500/30",
    };
    return styles[status || "pending"] || styles.pending;
  };

  const isAuthorized = order && currentUserId && (order.consumer_id === currentUserId || order.worker_id === currentUserId || userRole === "admin");

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin"></div></div>;
  if (!order || !isAuthorized) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="text-center"><p className="text-zinc-400 mb-4">Order not found or you don't have access.</p><button onClick={() => navigate(-1)} className="text-primary hover:underline">← Go Back</button></div></div>;

  return (
    <div className="min-h-screen bg-background pb-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <nav className="flex items-center gap-2 text-sm text-zinc-500 mb-8">
          <button onClick={() => navigate(-1)} className="hover:text-zinc-300 transition flex items-center gap-1">← Back</button>
          <span>/</span><span className="text-zinc-300">Order #{order.id.slice(0, 8)}</span>
        </nav>

        {/* Header */}
        <div className="glass-card rounded-2xl p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">{order.services?.name || "Unknown Service"}</h1>
              <p className="text-zinc-500 text-sm">Order #{order.id}</p>
            </div>
            <span className={`px-3 py-1 rounded-md text-xs font-semibold uppercase border w-fit ${getStatusStyle(order.status)}`}>
              {(order.status || "pending").replace("_", " ")}
            </span>
          </div>
          <div className="mb-4">
            <div className="flex justify-between text-xs mb-2"><span className="text-zinc-400">Overall Progress</span><span className="text-primary-light font-bold">{order.current_percentage || 0}%</span></div>
            <div className="w-full bg-zinc-900 rounded-full h-3 overflow-hidden"><div className="h-3 rounded-full bg-gradient-to-r from-primary to-purple-500 transition-all duration-500" style={{ width: `${order.current_percentage || 0}%` }}></div></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border">
            <div><p className="text-xs text-zinc-500 mb-1">Customer</p><p className="text-white font-medium">{order.consumer_profile?.full_name || "-"}</p><p className="text-zinc-400 text-sm">{order.consumer_profile?.phone || "-"}</p></div>
            <div><p className="text-xs text-zinc-500 mb-1">Worker</p><p className="text-white font-medium">{order.worker_profile?.full_name || "Unassigned"}</p><p className="text-zinc-400 text-sm">{order.worker_profile?.phone || "-"}</p></div>
            <div><p className="text-xs text-zinc-500 mb-1">Game UID</p><p className="text-white font-medium">{order.game_uid || "-"}</p></div>
            <div><p className="text-xs text-zinc-500 mb-1">Server</p><p className="text-white font-medium capitalize">{order.game_server || "-"}</p></div>
            <div><p className="text-xs text-zinc-500 mb-1">Total Price</p><p className="text-xl font-bold gradient-text">{formatRupiah(order.total_price)}</p></div>
            <div><p className="text-xs text-zinc-500 mb-1">Order Date</p><p className="text-white font-medium">{formatDate(order.created_at)}</p></div>
          </div>
          {order.notes && <div className="mt-4 pt-4 border-t border-border"><p className="text-xs text-zinc-500 mb-1">Customer Notes</p><p className="text-zinc-300 italic">"{order.notes}"</p></div>}
          {order.status === "cancelled" && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-400 font-semibold text-sm mb-1 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                Order Cancelled
              </p>
              {order.cancel_reason && <p className="text-red-300 text-sm italic mb-2 ml-7">Reason: "{order.cancel_reason}"</p>}
              {order.cancelled_at && <p className="text-red-400/70 text-xs ml-7">Cancelled at: {formatDate(order.cancelled_at)}</p>}
            </div>
          )}
        </div>

        {/* ✅ AUTOMATED TIMELINE (Menggunakan total_estimated_hours) */}
        <div className="glass-card rounded-2xl p-6 mb-6 border border-border">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Automated Schedule & Fairness Tracker
          </h3>

          {!order.assigned_at ? (
            <div className="text-center py-6 bg-surface/30 rounded-xl border border-border border-dashed">
              <p className="text-zinc-500 text-sm">Order has not been assigned to a worker yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <div className="w-0.5 h-full bg-border my-1"></div>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Assigned to Worker</p>
                  <p className="text-xs text-zinc-400">{formatDate(order.assigned_at)}</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 rounded-full bg-primary"></div>
                  <div className="w-0.5 h-full bg-border my-1"></div>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Estimated Duration</p>
                  {/* ✅ PERBAIKAN: Gunakan total_estimated_hours dari order */}
                  <p className="text-xs text-zinc-400">{order.total_estimated_hours || order.services?.estimated_hours || 1} Hours (Total from selected packages)</p>
                </div>
              </div>

              {order.expected_completion_at && order.status !== 'completed' && order.status !== 'cancelled' && (
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-3 h-3 rounded-full ${new Date() > new Date(order.expected_completion_at) ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-white">Target Deadline</p>
                      {new Date() > new Date(order.expected_completion_at) ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 uppercase">OVERDUE</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/30 uppercase">ON TRACK</span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">{formatDate(order.expected_completion_at)}</p>
                    
                    <div className="mt-2 w-full bg-zinc-900 rounded-full h-2 overflow-hidden">
                      {(() => {
                        const start = new Date(order.assigned_at!).getTime();
                        const end = new Date(order.expected_completion_at!).getTime();
                        const now = new Date().getTime();
                        const total = end - start;
                        const elapsed = now - start;
                        const percentage = Math.min(100, Math.max(0, (elapsed / total) * 100));
                        return (
                          <div className={`h-2 rounded-full transition-all duration-1000 ${percentage >= 100 ? 'bg-red-500' : (percentage >= 75 ? 'bg-yellow-500' : 'bg-primary')}`} style={{ width: `${percentage}%` }}></div>
                        );
                      })()}
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1 text-right">Time Elapsed</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Progress Updates Timeline */}
        <div className="glass-card rounded-2xl p-6 mb-6">
          <h3 className="text-lg font-bold text-white mb-6">Progress Updates</h3>
          {progressUpdates.length === 0 ? (
            <div className="text-center py-8"><p className="text-zinc-500">No progress updates yet.</p></div>
          ) : (
            <div className="space-y-6">
              {progressUpdates.map((update) => (
                <div key={update.id} className="relative pl-8 border-l-2 border-primary/30 pb-6 last:pb-0">
                  <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-primary border-2 border-background"></div>
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div><p className="text-primary-light font-bold text-lg">{update.percentage}% Complete</p><p className="text-zinc-500 text-xs">{formatDate(update.created_at)}</p></div>
                  </div>
                  {update.notes && <p className="text-zinc-300 text-sm mb-3">{update.notes}</p>}
                  {update.screenshot_url && <a href={update.screenshot_url} target="_blank" rel="noopener noreferrer" className="block max-w-sm"><img src={update.screenshot_url} alt="Progress" className="w-full rounded-lg border border-border hover:border-primary/50 transition-all" /></a>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Review Section */}
        {order.status === "completed" && currentUserId === order.consumer_id && (
          <div className="glass-card rounded-2xl p-6 mb-6 border border-primary/20">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
              {existingReview ? "Your Review" : "Rate This Service"}
            </h3>
            {existingReview ? (
              <div className="bg-surface/50 rounded-xl p-4 border border-border">
                <div className="flex items-center gap-1 mb-2">
                  {[1, 2, 3, 4, 5].map((star) => (<svg key={star} className={`w-5 h-5 ${star <= (existingReview.rating || 0) ? "text-yellow-400" : "text-zinc-600"}`} fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>))}
                </div>
                <p className="text-zinc-300 italic">"{existingReview.comment}"</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitReview} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Rating</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (<button key={star} type="button" onClick={() => setNewRating(star)} className="focus:outline-none transition-transform hover:scale-110"><svg className={`w-8 h-8 ${star <= newRating ? "text-yellow-400" : "text-zinc-600"}`} fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg></button>))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Comment (Optional)</label>
                  <textarea value={newReviewComment} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setNewReviewComment(e.target.value)} rows={3} className="input-modern w-full resize-none" placeholder="How was your experience?" />
                </div>
                <button type="submit" disabled={submittingReview} className="bg-primary hover:bg-primary-hover disabled:bg-zinc-800 text-white font-semibold py-2.5 px-6 rounded-lg transition-all">{submittingReview ? "Submitting..." : "Submit Review"}</button>
              </form>
            )}
          </div>
        )}

        {/* Chat & Action Buttons */}
        <div className="flex flex-col gap-6">
          {(order.consumer_id === currentUserId || order.worker_id === currentUserId || userRole === "admin") && <OrderChat order={order} currentUserId={currentUserId!} userRole={userRole || ""} />}
          <div className="flex gap-3">
            <button onClick={() => navigate(-1)} className="flex-1 btn-secondary text-center py-2.5 rounded-lg transition-all">← Go Back</button>
            {(userRole === "worker" || userRole === "admin") && order.status !== "completed" && order.status !== "cancelled" && (
              <button onClick={() => setShowProgressModal(true)} className="flex-1 bg-primary hover:bg-primary-hover text-white font-semibold py-2.5 rounded-lg transition-all text-center">{userRole === "admin" ? "Admin Update Progress" : "Update Progress"}</button>
            )}
          </div>
        </div>

        {/* Modal Update Progress */}
        {showProgressModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 fade-in">
            <div className="glass-card rounded-2xl p-6 w-full max-w-md">
              <h2 className="text-xl font-bold text-white mb-2">{userRole === "admin" ? "Admin Update Progress" : "Update Progress"}</h2>
              <p className="text-zinc-400 text-sm mb-6">{order!.services?.name}</p>
              <form onSubmit={handleProgressUpdate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Progress Percentage</label>
                  <select value={progressPercentage} onChange={(e: ChangeEvent<HTMLSelectElement>) => setProgressPercentage(parseInt(e.target.value))} className="input-modern w-full">
                    <option value={25}>25%</option><option value={50}>50%</option><option value={75}>75%</option><option value={100}>100% (Completed)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Screenshot Proof (Required)</label>
                  <input type="file" accept="image/*" onChange={(e: ChangeEvent<HTMLInputElement>) => setProgressFile(e.target.files?.[0] || null)} required className="w-full bg-zinc-900/50 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-100 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-white hover:file:bg-primary-hover" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Notes (Optional)</label>
                  <textarea value={progressNotes} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setProgressNotes(e.target.value)} rows={2} placeholder="Notes for the customer..." className="input-modern w-full resize-none" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowProgressModal(false)} className="flex-1 btn-secondary">Cancel</button>
                  <button type="submit" disabled={uploadingProgress} className="flex-1 bg-primary hover:bg-primary-hover disabled:bg-zinc-800 text-white font-semibold py-2.5 rounded-lg transition-all">{uploadingProgress ? "Compressing & Uploading..." : "Submit Update"}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}