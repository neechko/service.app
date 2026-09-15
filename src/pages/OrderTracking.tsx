import { useEffect, useState, FormEvent, ChangeEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Database } from "../types/database";
import OrderChat from "../components/OrderChat";
import { compressImage } from "../lib/imageUtils";
import { showAlert } from "../lib/dialog";

type OrderTask = Database["public"]["Tables"]["order_tasks"]["Row"];

type Order = Database["public"]["Tables"]["orders"]["Row"] & {
  services: { name: string; category: string; description: string | null } | null;
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

  // ✅ State untuk Task Checklist
  const [tasks, setTasks] = useState<OrderTask[]>([]);
  const [updatingTask, setUpdatingTask] = useState<string | null>(null);
  
  // ✅ State untuk Menambahkan Task Baru
  const [showAddTaskModal, setShowAddTaskModal] = useState<boolean>(false);
  const [newTaskName, setNewTaskName] = useState<string>("");
  const [newTaskDesc, setNewTaskDesc] = useState<string>("");
  const [newTaskPriority, setNewTaskPriority] = useState<"high" | "normal" | "low">("normal");
  const [newTaskMins, setNewTaskMins] = useState<number>(30);
  const [addingTask, setAddingTask] = useState<boolean>(false);

  useEffect(() => {
    fetchOrder();
  }, [id]);

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
      .select(`*, services(name, category, description), consumer_profile:profiles!orders_consumer_id_fkey(full_name, phone), worker_profile:profiles!orders_worker_id_fkey(full_name, phone)`)
      .eq("id", id).single();

    if (error || !orderData) { setLoading(false); return; }

    setOrder(orderData as Order);
    setProgressPercentage(orderData.current_percentage || 0);

    const { data: progressData } = await supabase.from("progress_updates").select("*").eq("order_id", id).order("created_at", { ascending: false });
    setProgressUpdates((progressData as ProgressUpdate[]) || []);

    const { data: tasksData } = await supabase
      .from("order_tasks")
      .select("*")
      .eq("order_id", id)
      .order("priority_level", { ascending: true })
      .order("created_at", { ascending: true });
    setTasks((tasksData as OrderTask[]) || []);

    if (user.id === orderData.consumer_id) {
      const { data: reviewData } = await supabase.from("reviews").select("*").eq("order_id", id).single();
      setExistingReview(reviewData);
    }
    setLoading(false);
  }

  // ✅ Fungsi Tambah Task Baru (Agar tidak cuma pajangan)
  async function handleAddTask(e: FormEvent) {
    e.preventDefault();
    if (!newTaskName.trim() || !order) return;
    setAddingTask(true);
    try {
      const { error } = await supabase.from("order_tasks").insert([{
        order_id: order.id,
        task_name: newTaskName.trim(),
        description: newTaskDesc.trim(),
        priority_level: newTaskPriority,
        estimated_mins: newTaskMins
      }]);
      if (error) throw error;
      
      setShowAddTaskModal(false);
      setNewTaskName(""); setNewTaskDesc(""); setNewTaskPriority("normal"); setNewTaskMins(30);
      fetchOrder(); // Refresh daftar task
    } catch (err) {
      await showAlert({ title: "Error", message: "Failed to add task.", type: "danger" });
    }
    setAddingTask(false);
  }

  async function handleToggleTask(taskId: string, currentStatus: boolean) {
    setUpdatingTask(taskId);
    try {
      const updates: any = { is_completed: !currentStatus };
      if (!currentStatus) {
        updates.started_at = new Date().toISOString();
        updates.completed_at = new Date().toISOString();
      } else {
        updates.completed_at = null;
      }

      const { error } = await supabase.from("order_tasks").update(updates).eq("id", taskId);
      if (error) throw error;
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t)));
    } catch (err) {
      await showAlert({ title: "Error", message: "Failed to update task.", type: "danger" });
    }
    setUpdatingTask(null);
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
      const { error } = await supabase.from("reviews").insert([{ order_id: order.id, reviewer_id: currentUserId, reviewee_id: order.worker_id, rating: newRating, comment: newReviewComment.trim() }]);
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

        {/* ✅ TASK CHECKLIST (Sekarang dengan Tombol "Add Task" yang berfungsi) */}
        <div className="glass-card rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
              Task Checklist & Priority
            </h3>
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-400">{tasks.filter((t) => t.is_completed).length} / {tasks.length} Completed</span>
              {/* ✅ TOMBOL TAMBAH TASK (Hanya untuk Admin & Worker) */}
              {(userRole === "admin" || userRole === "worker") && (
                <button onClick={() => setShowAddTaskModal(true)} className="text-xs bg-primary hover:bg-primary-hover text-white px-3 py-1.5 rounded-lg transition-all flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                  Add Task
                </button>
              )}
            </div>
          </div>

          {tasks.length === 0 ? (
            <div className="text-center py-8 bg-surface/30 rounded-xl border border-border border-dashed">
              <p className="text-zinc-500 text-sm">No tasks added yet.</p>
              <p className="text-zinc-600 text-xs mt-1">Admin or Worker can add specific tasks using the button above.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => {
                const isHighPriority = task.priority_level === "high";
                const isCompleted = task.is_completed ?? false;
                return (
                  <div key={task.id} className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${isCompleted ? "bg-green-500/5 border-green-500/20" : "bg-surface/50 border-border hover:border-primary/30"}`}>
                    <button onClick={() => handleToggleTask(task.id, isCompleted)} disabled={updatingTask === task.id || userRole === "consumer"} className={`mt-1 w-5 h-5 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${isCompleted ? "bg-green-500 border-green-500 text-white" : "border-zinc-600 hover:border-primary bg-zinc-900"}`}>
                      {updatingTask === task.id ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : isCompleted ? <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> : null}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className={`font-medium text-sm ${isCompleted ? "text-zinc-500 line-through" : "text-white"}`}>{task.task_name}</h4>
                        {isHighPriority && !isCompleted && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 uppercase tracking-wider">High Priority</span>}
                      </div>
                      {task.description && <p className={`text-xs mb-2 ${isCompleted ? "text-zinc-600" : "text-zinc-400"}`}>{task.description}</p>}
                      <div className="flex flex-wrap gap-3 text-[11px] text-zinc-500">
                        <span className="flex items-center gap-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>Est: {task.estimated_mins ?? 0} mins</span>
                        {task.started_at && <span className="flex items-center gap-1 text-blue-400"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>Started: {new Date(task.started_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>}
                        {task.completed_at && <span className="flex items-center gap-1 text-green-400"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>Completed: {new Date(task.completed_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Progress Updates Timeline */}
        <div className="glass-card rounded-2xl p-6 mb-6">
          <h3 className="text-lg font-bold text-white mb-6">Progress Updates</h3>
          {progressUpdates.length === 0 ? (
            <div className="text-center py-8"><p className="text-zinc-500">No progress updates yet.</p><p className="text-zinc-600 text-sm mt-1">The worker will upload progress here.</p></div>
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
                <p className="text-zinc-500 text-xs mt-2">Reviewed on {formatDate(existingReview.created_at)}</p>
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
                  <textarea value={newReviewComment} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setNewReviewComment(e.target.value)} rows={3} className="input-modern w-full resize-none" placeholder="How was your experience with this worker?" />
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

        {/* ✅ MODAL TAMBAH TASK BARU */}
        {showAddTaskModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 fade-in">
            <div className="glass-card rounded-2xl p-6 w-full max-w-md">
              <h2 className="text-xl font-bold text-white mb-2">Add New Task</h2>
              <p className="text-zinc-400 text-sm mb-6">Define a specific task for this order.</p>
              <form onSubmit={handleAddTask} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">Task Name *</label>
                  <input type="text" value={newTaskName} onChange={(e) => setNewTaskName(e.target.value)} required placeholder="e.g., Clear Daily Commissions" className="input-modern w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">Description (Optional)</label>
                  <textarea value={newTaskDesc} onChange={(e) => setNewTaskDesc(e.target.value)} rows={2} placeholder="Additional details..." className="input-modern w-full resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1">Priority</label>
                    <select value={newTaskPriority} onChange={(e) => setNewTaskPriority(e.target.value as any)} className="input-modern w-full">
                      <option value="high">High</option>
                      <option value="normal">Normal</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1">Est. Minutes</label>
                    <input type="number" value={newTaskMins} onChange={(e) => setNewTaskMins(parseInt(e.target.value) || 0)} required min="1" className="input-modern w-full" />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowAddTaskModal(false)} className="flex-1 btn-secondary">Cancel</button>
                  <button type="submit" disabled={addingTask} className="flex-1 bg-primary hover:bg-primary-hover disabled:bg-zinc-800 text-white font-semibold py-2.5 rounded-lg transition-all">{addingTask ? "Adding..." : "Add Task"}</button>
                </div>
              </form>
            </div>
          </div>
        )}

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
                  <p className="text-xs text-zinc-500 mt-1">Large images will be compressed automatically.</p>
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