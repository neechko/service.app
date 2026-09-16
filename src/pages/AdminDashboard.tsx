import { useEffect, useState, FormEvent, ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Database } from "../types/database";
import { showConfirm, showAlert } from "../lib/dialog";

type Service = Database["public"]["Tables"]["services"]["Row"];
type Category = Database["public"]["Tables"]["categories"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

// ✅ Tipe untuk Package/Service Tier (mengikuti schema database terbaru)
type Package = Database["public"]["Tables"]["service_tiers"]["Row"] & {
  services: { name: string } | null;
};

type Order = Database["public"]["Tables"]["orders"]["Row"] & {
  services: { name: string } | null;
  profiles: { full_name: string; phone: string | null } | null;
};

type ServiceForm = {
  name: string;
  category: string;
  description: string;
  base_price: number;
  estimated_hours: number;
  is_active: boolean;
};

type CategoryForm = {
  name: string;
  slug: string;
  description: string;
  is_active: boolean;
};

// ✅ PERBAIKAN: Ganti price_modifier dengan fixed_price dan estimated_hours
type PackageForm = {
  service_id: string;
  name: string;
  description: string;
  fixed_price: number;
  estimated_hours: number;
  is_active: boolean;
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [orders, setOrders] = useState<Order[]>([]);
  const [workers, setWorkers] = useState<Profile[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);

  // ✅ State untuk Packages
  const [packages, setPackages] = useState<Package[]>([]);
  const [showAddPackage, setShowAddPackage] = useState<boolean>(false);
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);

  // ✅ State form sudah sesuai dengan PackageForm yang baru
  const [packageForm, setPackageForm] = useState<PackageForm>({
    service_id: "",
    name: "",
    description: "",
    fixed_price: 0,
    estimated_hours: 1,
    is_active: true,
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [assigningOrder, setAssigningOrder] = useState<Order | null>(null);
  const [selectedWorker, setSelectedWorker] = useState<string>("");

  const [editingService, setEditingService] = useState<Service | null>(null);
  const [showAddService, setShowAddService] = useState<boolean>(false);
  const [serviceForm, setServiceForm] = useState<ServiceForm>({
    name: "",
    category: "",
    description: "",
    base_price: 0,
    estimated_hours: 1,
    is_active: true,
  });

  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showAddCategory, setShowAddCategory] = useState<boolean>(false);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>({
    name: "",
    slug: "",
    description: "",
    is_active: true,
  });

  const [showWorkerStatsModal, setShowWorkerStatsModal] =
    useState<boolean>(false);
  const [editingWorker, setEditingWorker] = useState<Profile | null>(null);
  const [savingWorkerStats, setSavingWorkerStats] = useState<boolean>(false);
  const [workerStatsForm, setWorkerStatsForm] = useState({
    seniority_level: "junior",
    max_capacity: 3,
    current_active_orders: 0,
    is_available: true,
    is_on_leave: false,
  });

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "orders", label: "Orders" },
    { id: "users", label: "Users" },
    { id: "workers", label: "Workers" },
    { id: "services", label: "Services" },
    { id: "packages", label: "Packages" },
    { id: "categories", label: "Categories" },
  ];

  useEffect(() => {
    fetchAllData();
  }, []);

  async function fetchAllData() {
    setLoading(true);
    const [
      ordersRes,
      workersRes,
      servicesRes,
      categoriesRes,
      usersRes,
      packagesRes,
    ] = await Promise.all([
      supabase
        .from("orders")
        .select("*, services(name), profiles:consumer_id(full_name, phone)")
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("*").eq("role", "worker"),
      supabase
        .from("services")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("categories").select("*").order("name"),
      supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("service_tiers")
        .select("*, services(name)")
        .order("created_at", { ascending: false }),
    ]);

    setOrders((ordersRes.data as Order[]) || []);
    setWorkers(workersRes.data || []);
    setServices(servicesRes.data || []);
    setCategories(categoriesRes.data || []);
    setUsers(usersRes.data || []);
    setPackages((packagesRes.data as Package[]) || []);
    setLoading(false);
  }

  async function handleChangeRole(userId: string, newRole: string) {
    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", userId);
    if (error)
      await showAlert({
        title: "Error",
        message: "Failed to update role: " + error.message,
        type: "danger",
      });
    else fetchAllData();
  }

  async function handleDeleteUser(userId: string, userName: string) {
    const confirmed = await showConfirm({
      title: "Delete User",
      message: `Are you sure you want to delete user "${userName}"?\nThis will remove their profile data.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      type: "danger",
    });
    if (!confirmed) return;
    const { error } = await supabase.from("profiles").delete().eq("id", userId);
    if (error)
      await showAlert({
        title: "Error",
        message: "Failed to delete user: " + error.message,
        type: "danger",
      });
    else fetchAllData();
  }

  async function handleAssignWorker() {
    if (!assigningOrder || !selectedWorker) return;
    const { error } = await supabase
      .from("orders")
      .update({ worker_id: selectedWorker, status: "paid" })
      .eq("id", assigningOrder.id);
    if (error)
      await showAlert({
        title: "Error",
        message: "Failed: " + error.message,
        type: "danger",
      });
    else {
      await showAlert({
        title: "Success",
        message: "Worker assigned successfully!",
        type: "success",
      });
      setAssigningOrder(null);
      setSelectedWorker("");
      fetchAllData();
    }
  }

  async function handleSaveWorkerStats(e: FormEvent) {
    e.preventDefault();
    if (!editingWorker) return;
    setSavingWorkerStats(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          seniority_level: workerStatsForm.seniority_level,
          max_capacity: workerStatsForm.max_capacity,
          current_active_orders: workerStatsForm.current_active_orders,
          is_available: workerStatsForm.is_available,
          is_on_leave: workerStatsForm.is_on_leave,
        })
        .eq("id", editingWorker.id);
      if (error) throw error;
      setShowWorkerStatsModal(false);
      setEditingWorker(null);
      fetchAllData();
    } catch (err) {
      await showAlert({
        title: "Error",
        message: "Failed to update worker stats.",
        type: "danger",
      });
    }
    setSavingWorkerStats(false);
  }

  // Services CRUD
  function openAddService() {
    setServiceForm({
      name: "",
      category: categories[0]?.slug || "",
      description: "",
      base_price: 0,
      estimated_hours: 1,
      is_active: true,
    });
    setShowAddService(true);
  }
  function openEditService(service: Service) {
    setServiceForm({
      name: service.name,
      category: service.category,
      description: service.description || "",
      base_price: service.base_price,
      estimated_hours: service.estimated_hours || 1,
      is_active: service.is_active ?? true,
    });
    setEditingService(service);
  }
  async function handleSaveService(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (editingService) {
      const { error } = await supabase
        .from("services")
        .update(serviceForm)
        .eq("id", editingService.id);
      if (error)
        await showAlert({
          title: "Error",
          message: "Failed: " + error.message,
          type: "danger",
        });
      else {
        setEditingService(null);
        fetchAllData();
      }
    } else {
      const { error } = await supabase.from("services").insert([serviceForm]);
      if (error)
        await showAlert({
          title: "Error",
          message: "Failed: " + error.message,
          type: "danger",
        });
      else {
        setShowAddService(false);
        fetchAllData();
      }
    }
  }
  async function handleToggleActive(service: Service) {
    await supabase
      .from("services")
      .update({ is_active: !service.is_active })
      .eq("id", service.id);
    fetchAllData();
  }
  async function handleDeleteService(service: Service) {
    const confirmed = await showConfirm({
      title: "Delete Service",
      message: `Delete "${service.name}"?`,
      type: "danger",
    });
    if (!confirmed) return;
    await supabase.from("services").delete().eq("id", service.id);
    fetchAllData();
  }

  // Categories CRUD
  function openAddCategory() {
    setCategoryForm({ name: "", slug: "", description: "", is_active: true });
    setShowAddCategory(true);
  }
  function openEditCategory(category: Category) {
    setCategoryForm({
      name: category.name,
      slug: category.slug,
      description: category.description || "",
      is_active: category.is_active ?? true,
    });
    setEditingCategory(category);
  }
  function generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
  }
  async function handleSaveCategory(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (editingCategory) {
      const { error } = await supabase
        .from("categories")
        .update(categoryForm)
        .eq("id", editingCategory.id);
      if (error)
        await showAlert({
          title: "Error",
          message: "Failed: " + error.message,
          type: "danger",
        });
      else {
        setEditingCategory(null);
        fetchAllData();
      }
    } else {
      const { error } = await supabase
        .from("categories")
        .insert([categoryForm]);
      if (error)
        await showAlert({
          title: "Error",
          message: "Failed: " + error.message,
          type: "danger",
        });
      else {
        setShowAddCategory(false);
        fetchAllData();
      }
    }
  }
  async function handleToggleCategoryActive(category: Category) {
    await supabase
      .from("categories")
      .update({ is_active: !category.is_active })
      .eq("id", category.id);
    fetchAllData();
  }
  async function handleDeleteCategory(category: Category) {
    const { data } = await supabase
      .from("services")
      .select("id")
      .eq("category", category.slug);
    if (data && data.length > 0) {
      await showAlert({
        title: "Cannot Delete",
        message: `${data.length} services still use this category.`,
        type: "warning",
      });
      return;
    }
    const confirmed = await showConfirm({
      title: "Delete Category",
      message: `Delete "${category.name}"?`,
      type: "danger",
    });
    if (!confirmed) return;
    await supabase.from("categories").delete().eq("id", category.id);
    fetchAllData();
  }

  // ✅ Packages CRUD (Diperbaiki total)
  function openAddPackage() {
    setPackageForm({
      service_id: "",
      name: "",
      description: "",
      fixed_price: 0,
      estimated_hours: 1,
      is_active: true,
    });
    setEditingPackage(null);
    setShowAddPackage(true);
  }

  function openEditPackage(pkg: Package) {
    setPackageForm({
      service_id: pkg.service_id || "",
      name: pkg.name,
      description: pkg.description || "",
      fixed_price: pkg.fixed_price || 0,
      estimated_hours: pkg.estimated_hours || 1,
      is_active: pkg.is_active ?? true,
    });
    setEditingPackage(pkg);
    setShowAddPackage(true);
  }

  async function handleSavePackage(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (editingPackage) {
      const { error } = await supabase
        .from("service_tiers")
        .update(packageForm)
        .eq("id", editingPackage.id);
      if (error)
        await showAlert({
          title: "Error",
          message: "Failed: " + error.message,
          type: "danger",
        });
      else {
        setShowAddPackage(false);
        setEditingPackage(null);
        fetchAllData();
      }
    } else {
      const { error } = await supabase
        .from("service_tiers")
        .insert([packageForm]);
      if (error)
        await showAlert({
          title: "Error",
          message: "Failed: " + error.message,
          type: "danger",
        });
      else {
        setShowAddPackage(false);
        fetchAllData();
      }
    }
  }

  async function handleTogglePackageActive(pkg: Package) {
    await supabase
      .from("service_tiers")
      .update({ is_active: !pkg.is_active })
      .eq("id", pkg.id);
    fetchAllData();
  }

  async function handleDeletePackage(pkg: Package) {
    const confirmed = await showConfirm({
      title: "Delete Package",
      message: `Delete "${pkg.name}"?`,
      type: "danger",
    });
    if (!confirmed) return;
    await supabase.from("service_tiers").delete().eq("id", pkg.id);
    fetchAllData();
  }

  const formatRupiah = (angka: number | null | undefined) => {
    if (!angka) return "Rp 0";
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(angka);
  };

  const formatCompactRupiah = (angka: number | null | undefined) => {
    if (!angka) return "Rp 0";
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      notation: "compact",
      compactDisplay: "short",
      maximumFractionDigits: 1, // Menampilkan 1 angka di belakang koma (misal: 1,5 Jt)
    }).format(angka);
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const stats = {
    totalOrders: orders.length,
    activeOrders: orders.filter(
      (o) => o.status !== "completed" && o.status !== "cancelled",
    ).length,
    totalRevenue: orders
      .filter((o) => o.status === "completed")
      .reduce((sum, o) => sum + (o.total_price || 0), 0),
    totalWorkers: workers.length,
  };

  if (loading)
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
      </div>
    );

  return (
    <div className="min-h-screen bg-background pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Admin Dashboard
          </h1>
          <p className="text-zinc-400">Manage your Primora operations</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="glass-card rounded-xl p-5">
            <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">
              Total Orders
            </p>
            <p className="text-2xl font-bold text-white">{stats.totalOrders}</p>
          </div>
          <div className="glass-card rounded-xl p-5">
            <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">
              Active Orders
            </p>
            <p className="text-2xl font-bold text-primary-light">
              {stats.activeOrders}
            </p>
          </div>
          <div className="glass-card rounded-xl p-5">
            <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">
              Total Revenue
            </p>
            <p className="text-2xl font-bold gradient-text">
              {formatCompactRupiah(stats.totalRevenue)}
            </p>
          </div>
          <div className="glass-card rounded-xl p-5">
            <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">
              Workers
            </p>
            <p className="text-2xl font-bold text-white">
              {stats.totalWorkers}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-border overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 font-medium text-sm transition-all whitespace-nowrap ${activeTab === tab.id ? "text-white border-b-2 border-primary" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="glass-card rounded-2xl p-6">
            <h3 className="font-bold text-white mb-4">Recent Orders</h3>
            {orders.slice(0, 5).map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between py-3 border-b border-border last:border-0"
              >
                <div>
                  <p className="text-white font-medium text-sm">
                    {order.services?.name || "Unknown Service"}
                  </p>
                  <p className="text-zinc-500 text-xs">
                    {order.profiles?.full_name || "Unknown"} •{" "}
                    {formatDate(order.created_at)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-white font-semibold text-sm">
                    {formatRupiah(order.total_price)}
                  </p>
                  <p className="text-xs text-zinc-500 capitalize">
                    {(order.status || "pending").replace("_", " ")}
                  </p>
                </div>
              </div>
            ))}
            {orders.length === 0 && (
              <p className="text-zinc-500 text-center py-8">No orders yet.</p>
            )}
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === "orders" && (
          <div className="space-y-4">
            {orders.length === 0 ? (
              <div className="glass-card rounded-2xl p-12 text-center">
                <p className="text-zinc-400">No orders yet.</p>
              </div>
            ) : (
              orders.map((order) => (
                <div key={order.id} className="glass-card rounded-2xl p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-white">
                        {order.services?.name || "Unknown Service"}
                      </h3>
                      <p className="text-zinc-500 text-sm">
                        Order #{order.id.slice(0, 8)}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-md text-xs font-semibold uppercase border ${order.status === "completed" ? "bg-green-500/10 text-green-400 border-green-500/30" : order.status === "in_progress" ? "bg-blue-500/10 text-blue-400 border-blue-500/30" : order.status === "paid" ? "bg-purple-500/10 text-purple-400 border-purple-500/30" : "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"}`}
                    >
                      {(order.status || "pending").replace("_", " ")}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                      <p className="text-zinc-500 text-xs">Customer</p>
                      <p className="text-white">
                        {order.profiles?.full_name || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-zinc-500 text-xs">Worker</p>
                      <p className="text-white">
                        {order.worker_id
                          ? workers.find((w) => w.id === order.worker_id)
                              ?.full_name || "Unknown"
                          : "Unassigned"}
                      </p>
                    </div>
                    <div>
                      <p className="text-zinc-500 text-xs">Amount</p>
                      <p className="text-white font-semibold">
                        {formatRupiah(order.total_price)}
                      </p>
                    </div>
                    <div>
                      <p className="text-zinc-500 text-xs">Progress</p>
                      <p className="text-primary-light font-semibold">
                        {order.current_percentage || 0}%
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate("/order/" + order.id)}
                      className="flex-1 btn-secondary text-sm"
                    >
                      View Details
                    </button>
                    <button
                      onClick={() => setAssigningOrder(order)}
                      className={`flex-1 text-white font-semibold py-2 rounded-lg text-sm transition-all ${order.worker_id ? "bg-orange-500 hover:bg-orange-600" : "bg-primary hover:bg-primary-hover"}`}
                    >
                      {order.worker_id ? "Reassign Worker" : "Assign Worker"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Users Tab */}
        {activeTab === "users" && (
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-zinc-400 uppercase bg-surface/50">
                  <tr>
                    <th className="px-6 py-3">User</th>
                    <th className="px-6 py-3">Email</th>
                    <th className="px-6 py-3">Role</th>
                    <th className="px-6 py-3">Joined</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-border hover:bg-surface/30 transition"
                    >
                      <td className="px-6 py-4 font-medium text-white">
                        <div className="flex items-center gap-3">
                          {user.avatar_url ? (
                            <img
                              src={user.avatar_url}
                              alt=""
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center text-white font-bold text-xs">
                              {user.full_name?.[0]?.toUpperCase() || "U"}
                            </div>
                          )}
                          {user.full_name || "Unknown"}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-zinc-400">
                        {user.email || "-"}
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={user.role || "consumer"}
                          onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                            handleChangeRole(user.id, e.target.value)
                          }
                          className="bg-surface border border-border text-white text-xs rounded-lg px-2 py-1 focus:ring-primary focus:border-primary"
                        >
                          <option value="consumer">Consumer</option>
                          <option value="worker">Worker</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 text-zinc-400">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() =>
                            handleDeleteUser(user.id, user.full_name || "User")
                          }
                          className="text-red-400 hover:text-red-300 text-xs font-medium px-3 py-1 rounded hover:bg-red-500/10 transition"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {users.length === 0 && (
              <div className="p-8 text-center text-zinc-500">
                No users found.
              </div>
            )}
          </div>
        )}

        {/* Workers Tab */}
        {activeTab === "workers" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workers.length === 0 ? (
              <div className="col-span-full glass-card rounded-2xl p-12 text-center">
                <p className="text-zinc-400">No workers registered.</p>
              </div>
            ) : (
              workers.map((worker) => {
                const load = worker.current_active_orders || 0;
                const cap = worker.max_capacity || 3;
                return (
                  <div
                    key={worker.id}
                    className="glass-card rounded-2xl p-6 relative group"
                  >
                    <button
                      onClick={() => {
                        setEditingWorker(worker);
                        setWorkerStatsForm({
                          seniority_level: worker.seniority_level || "junior",
                          max_capacity: worker.max_capacity || 3,
                          current_active_orders:
                            worker.current_active_orders || 0,
                          is_available: worker.is_available ?? true,
                          is_on_leave: worker.is_on_leave ?? false,
                        });
                        setShowWorkerStatsModal(true);
                      }}
                      className="absolute top-4 right-4 p-2 bg-surface hover:bg-surface-hover rounded-lg border border-border transition-all"
                      title="Edit Worker Stats"
                    >
                      <svg
                        className="w-4 h-4 text-zinc-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    </button>
                    <div className="mb-3">
                      {worker.avatar_url ? (
                        <img
                          src={worker.avatar_url}
                          alt={worker.full_name}
                          className="w-12 h-12 rounded-full object-cover border-2 border-primary"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center">
                          <span className="text-white font-bold text-lg">
                            {worker.full_name?.[0]?.toUpperCase() || "W"}
                          </span>
                        </div>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-white">
                      {worker.full_name}
                    </h3>
                    <p className="text-zinc-400 text-sm">
                      {worker.phone || "No phone"}
                    </p>
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-500">Status:</span>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${worker.is_on_leave ? "bg-red-500/10 text-red-400" : worker.is_available ? "bg-green-500/10 text-green-400" : "bg-yellow-500/10 text-yellow-400"}`}
                        >
                          {worker.is_on_leave
                            ? "On Leave"
                            : worker.is_available
                              ? "Available"
                              : "Busy"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-500">Seniority:</span>
                        <span className="text-white capitalize">
                          {worker.seniority_level || "Junior"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-500">Current Load:</span>
                        <span className="text-primary-light font-bold">
                          {load} / {cap}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Services Tab */}
        {activeTab === "services" && (
          <div className="space-y-4">
            <div className="flex justify-end mb-4">
              <button
                onClick={openAddService}
                className="bg-primary hover:bg-primary-hover text-white font-semibold px-5 py-2.5 rounded-lg transition-all"
              >
                Add New Service
              </button>
            </div>
            {services.map((service) => (
              <div key={service.id} className="glass-card rounded-2xl p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-white">
                        {service.name}
                      </h3>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-md ${service.is_active ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}
                      >
                        {service.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="text-zinc-400 text-sm mb-2">
                      {service.description || "No description provided."}
                    </p>
                    <div className="flex gap-4 text-xs text-zinc-500">
                      <span>
                        Category:{" "}
                        <span className="text-zinc-300">
                          {service.category}
                        </span>
                      </span>
                      <span>
                        Estimate:{" "}
                        <span className="text-zinc-300">
                          {service.estimated_hours || 1}h
                        </span>
                      </span>
                    </div>
                  </div>
                  <p className="text-xl font-bold gradient-text ml-4">
                    {formatRupiah(service.base_price)}
                  </p>
                </div>
                <div className="flex gap-2 pt-4 border-t border-border">
                  <button
                    onClick={() => handleToggleActive(service)}
                    className={`flex-1 text-sm font-medium py-2 rounded-lg transition ${service.is_active ? "bg-red-500/10 text-red-400 hover:bg-red-500/20" : "bg-green-500/10 text-green-400 hover:bg-green-500/20"}`}
                  >
                    {service.is_active ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    onClick={() => openEditService(service)}
                    className="flex-1 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 text-sm font-medium py-2 rounded-lg transition"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteService(service)}
                    className="flex-1 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-sm font-medium py-2 rounded-lg transition"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ✅ Packages Tab (Diperbaiki untuk menampilkan Fixed Price & Est. Hours) */}
        {activeTab === "packages" && (
          <div className="space-y-4">
            <div className="flex justify-end mb-4">
              <button
                onClick={openAddPackage}
                className="bg-primary hover:bg-primary-hover text-white font-semibold px-5 py-2.5 rounded-lg transition-all"
              >
                Add New Package
              </button>
            </div>
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-zinc-400 uppercase bg-surface/50">
                    <tr>
                      <th className="px-6 py-3">Package Name</th>
                      <th className="px-6 py-3">Service</th>
                      <th className="px-6 py-3">Fixed Price</th>
                      <th className="px-6 py-3">Est. Hours</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {packages.map((pkg) => (
                      <tr
                        key={pkg.id}
                        className="border-b border-border hover:bg-surface/30 transition"
                      >
                        <td className="px-6 py-4 font-medium text-white">
                          {pkg.name}
                        </td>
                        <td className="px-6 py-4 text-zinc-400">
                          {pkg.services?.name || "Unknown"}
                        </td>
                        <td className="px-6 py-4 text-zinc-300">
                          {formatRupiah(pkg.fixed_price || 0)}
                        </td>
                        <td className="px-6 py-4 text-zinc-300">
                          {pkg.estimated_hours || 1}h
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-1 rounded text-xs ${pkg.is_active ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}
                          >
                            {pkg.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right flex justify-end gap-2">
                          <button
                            onClick={() => openEditPackage(pkg)}
                            className="text-blue-400 hover:text-blue-300 text-xs font-medium px-3 py-1 rounded hover:bg-blue-500/10 transition"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeletePackage(pkg)}
                            className="text-red-400 hover:text-red-300 text-xs font-medium px-3 py-1 rounded hover:bg-red-500/10 transition"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {packages.length === 0 && (
                  <div className="p-8 text-center text-zinc-500">
                    No packages found. Add one to get started.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Categories Tab */}
        {activeTab === "categories" && (
          <div className="space-y-4">
            <div className="flex justify-end mb-4">
              <button
                onClick={openAddCategory}
                className="bg-primary hover:bg-primary-hover text-white font-semibold px-5 py-2.5 rounded-lg transition-all"
              >
                Add New Category
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map((category) => (
                <div key={category.id} className="glass-card rounded-2xl p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-white">
                        {category.name}
                      </h3>
                      <p className="text-xs text-zinc-500 mt-1">
                        slug: {category.slug}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-md ${category.is_active ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}
                    >
                      {category.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  {category.description && (
                    <p className="text-sm text-zinc-400 mb-4">
                      {category.description}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleToggleCategoryActive(category)}
                      className={`flex-1 text-xs font-medium py-2 rounded-lg transition ${category.is_active ? "bg-red-500/10 text-red-400 hover:bg-red-500/20" : "bg-green-500/10 text-green-400 hover:bg-green-500/20"}`}
                    >
                      {category.is_active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      onClick={() => openEditCategory(category)}
                      className="flex-1 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 text-xs font-medium py-2 rounded-lg transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(category)}
                      className="flex-1 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-medium py-2 rounded-lg transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Assign Worker Modal */}
        {assigningOrder && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 fade-in">
            <div className="glass-card rounded-2xl p-6 w-full max-w-md">
              <h2 className="text-xl font-bold text-white mb-2">
                {assigningOrder.worker_id ? "Reassign Worker" : "Assign Worker"}
              </h2>
              <p className="text-zinc-400 text-sm mb-6">
                {assigningOrder.services?.name || "Unknown Service"}
              </p>
              {workers.length === 0 ? (
                <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 px-4 py-3 rounded-lg text-sm mb-4">
                  No workers registered yet.
                </div>
              ) : (
                <>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Select Worker (Sorted by Priority)
                  </label>
                  <select
                    value={selectedWorker}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                      setSelectedWorker(e.target.value)
                    }
                    className="input-modern mb-4"
                  >
                    <option value="">-- Select Worker --</option>
                    {[...workers]
                      .sort((a, b) => {
                        if (a.is_available !== b.is_available)
                          return a.is_available ? -1 : 1;
                        if (a.is_on_leave !== b.is_on_leave)
                          return a.is_on_leave ? 1 : -1;
                        const aLoad =
                          (a.current_active_orders || 0) /
                          (a.max_capacity || 3);
                        const bLoad =
                          (b.current_active_orders || 0) /
                          (b.max_capacity || 3);
                        if (aLoad !== bLoad) return aLoad - bLoad;
                        const weight: Record<string, number> = {
                          senior: 3,
                          mid: 2,
                          junior: 1,
                        };
                        const aWeight =
                          weight[a.seniority_level || "junior"] || 1;
                        const bWeight =
                          weight[b.seniority_level || "junior"] || 1;
                        return bWeight - aWeight;
                      })
                      .map((worker) => {
                        const load = worker.current_active_orders || 0;
                        const cap = worker.max_capacity || 3;
                        const isFull = load >= cap;
                        return (
                          <option
                            key={worker.id}
                            value={worker.id}
                            disabled={isFull && !assigningOrder.worker_id}
                          >
                            {worker.full_name}{" "}
                            {worker.seniority_level &&
                              `[${worker.seniority_level.toUpperCase()}]`}{" "}
                            - Load: {load}/{cap}{" "}
                            {worker.is_on_leave ? "(ON LEAVE)" : ""}
                          </option>
                        );
                      })}
                  </select>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setAssigningOrder(null);
                        setSelectedWorker("");
                      }}
                      className="flex-1 btn-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAssignWorker}
                      disabled={!selectedWorker}
                      className="flex-1 bg-primary hover:bg-primary-hover disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-semibold py-2.5 rounded-lg transition-all"
                    >
                      {assigningOrder.worker_id ? "Reassign" : "Assign"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Worker Stats Modal */}
        {showWorkerStatsModal && editingWorker && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 fade-in">
            <div className="glass-card rounded-2xl p-6 w-full max-w-md">
              <h2 className="text-xl font-bold text-white mb-2">
                Edit Worker Stats
              </h2>
              <p className="text-zinc-400 text-sm mb-6">
                {editingWorker.full_name}
              </p>
              <form onSubmit={handleSaveWorkerStats} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">
                    Seniority Level
                  </label>
                  <select
                    value={workerStatsForm.seniority_level}
                    onChange={(e) =>
                      setWorkerStatsForm({
                        ...workerStatsForm,
                        seniority_level: e.target.value,
                      })
                    }
                    className="input-modern w-full"
                  >
                    <option value="junior">Junior</option>
                    <option value="mid">Mid</option>
                    <option value="senior">Senior</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">
                    Max Capacity (Orders)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={workerStatsForm.max_capacity}
                    onChange={(e) =>
                      setWorkerStatsForm({
                        ...workerStatsForm,
                        max_capacity: parseInt(e.target.value) || 1,
                      })
                    }
                    className="input-modern w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">
                    Current Load (Active Orders)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={workerStatsForm.current_active_orders}
                    onChange={(e) =>
                      setWorkerStatsForm({
                        ...workerStatsForm,
                        current_active_orders: parseInt(e.target.value) || 0,
                      })
                    }
                    className="input-modern w-full"
                  />
                  <p className="text-xs text-zinc-500 mt-1">
                    You can adjust this manually if the auto-sync fails.
                  </p>
                </div>
                <div className="flex flex-col gap-3 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={workerStatsForm.is_available}
                      onChange={(e) =>
                        setWorkerStatsForm({
                          ...workerStatsForm,
                          is_available: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded border-zinc-600 text-primary focus:ring-primary bg-zinc-900"
                    />
                    <span className="text-sm text-zinc-300">
                      Available for new orders
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={workerStatsForm.is_on_leave}
                      onChange={(e) =>
                        setWorkerStatsForm({
                          ...workerStatsForm,
                          is_on_leave: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded border-zinc-600 text-red-500 focus:ring-red-500 bg-zinc-900"
                    />
                    <span className="text-sm text-zinc-300">
                      Currently on leave
                    </span>
                  </label>
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowWorkerStatsModal(false)}
                    className="flex-1 btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingWorkerStats}
                    className="flex-1 bg-primary hover:bg-primary-hover disabled:bg-zinc-800 text-white font-semibold py-2.5 rounded-lg transition-all"
                  >
                    {savingWorkerStats ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Service Modal */}
        {(showAddService || editingService) && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 fade-in">
            <div className="glass-card rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-white mb-6">
                {editingService ? "Edit Service" : "Add New Service"}
              </h2>
              <form onSubmit={handleSaveService} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Service Name
                  </label>
                  <input
                    type="text"
                    value={serviceForm.name}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setServiceForm({ ...serviceForm, name: e.target.value })
                    }
                    required
                    placeholder="e.g. Spiral Abyss Floor 12"
                    className="input-modern"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Category
                  </label>
                  <select
                    value={serviceForm.category}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                      setServiceForm({
                        ...serviceForm,
                        category: e.target.value,
                      })
                    }
                    required
                    className="input-modern"
                  >
                    <option value="">-- Select Category --</option>
                    {categories
                      .filter((c) => c.is_active)
                      .map((cat) => (
                        <option key={cat.id} value={cat.slug}>
                          {cat.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={serviceForm.description}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                      setServiceForm({
                        ...serviceForm,
                        description: e.target.value,
                      })
                    }
                    rows={3}
                    placeholder="Service description..."
                    className="input-modern resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      Price (IDR)
                    </label>
                    <input
                      type="number"
                      value={serviceForm.base_price}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setServiceForm({
                          ...serviceForm,
                          base_price: parseInt(e.target.value) || 0,
                        })
                      }
                      required
                      min="0"
                      className="input-modern"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      Estimate (hours)
                    </label>
                    <input
                      type="number"
                      value={serviceForm.estimated_hours}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setServiceForm({
                          ...serviceForm,
                          estimated_hours: parseInt(e.target.value) || 1,
                        })
                      }
                      required
                      min="1"
                      className="input-modern"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={serviceForm.is_active}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setServiceForm({
                        ...serviceForm,
                        is_active: e.target.checked,
                      })
                    }
                    className="w-4 h-4"
                  />
                  <label htmlFor="is_active" className="text-sm text-zinc-300">
                    Active (visible in catalog)
                  </label>
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddService(false);
                      setEditingService(null);
                    }}
                    className="flex-1 btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-primary hover:bg-primary-hover text-white font-semibold py-2.5 rounded-lg transition-all"
                  >
                    {editingService ? "Update" : "Add"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Category Modal */}
        {(showAddCategory || editingCategory) && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 fade-in">
            <div className="glass-card rounded-2xl p-6 w-full max-w-md">
              <h2 className="text-xl font-bold text-white mb-6">
                {editingCategory ? "Edit Category" : "Add New Category"}
              </h2>
              <form onSubmit={handleSaveCategory} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Category Name
                  </label>
                  <input
                    type="text"
                    value={categoryForm.name}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      const name = e.target.value;
                      setCategoryForm({
                        ...categoryForm,
                        name,
                        slug: generateSlug(name),
                      });
                    }}
                    required
                    placeholder="e.g. Boss Battle"
                    className="input-modern"
                  />
                  <p className="text-xs text-zinc-500 mt-1">
                    Auto slug:{" "}
                    <code className="bg-zinc-800 px-2 py-0.5 rounded">
                      {categoryForm.slug || "..."}
                    </code>
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={categoryForm.description}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                      setCategoryForm({
                        ...categoryForm,
                        description: e.target.value,
                      })
                    }
                    rows={2}
                    placeholder="Brief description..."
                    className="input-modern resize-none"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="category_is_active"
                    checked={categoryForm.is_active}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setCategoryForm({
                        ...categoryForm,
                        is_active: e.target.checked,
                      })
                    }
                    className="w-4 h-4"
                  />
                  <label
                    htmlFor="category_is_active"
                    className="text-sm text-zinc-300"
                  >
                    Active
                  </label>
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddCategory(false);
                      setEditingCategory(null);
                    }}
                    className="flex-1 btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-primary hover:bg-primary-hover text-white font-semibold py-2.5 rounded-lg transition-all"
                  >
                    {editingCategory ? "Update" : "Add"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ✅ Package Modal (Sudah benar menggunakan fixed_price & estimated_hours) */}
        {(showAddPackage || editingPackage) && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 fade-in">
            <div className="glass-card rounded-2xl p-6 w-full max-w-md">
              <h2 className="text-xl font-bold text-white mb-6">
                {editingPackage ? "Edit Package" : "Add New Package"}
              </h2>
              <form onSubmit={handleSavePackage} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">
                    Service
                  </label>
                  <select
                    value={packageForm.service_id}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                      setPackageForm({
                        ...packageForm,
                        service_id: e.target.value,
                      })
                    }
                    required
                    className="input-modern w-full"
                  >
                    <option value="">Select Service</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">
                    Package Name
                  </label>
                  <input
                    type="text"
                    value={packageForm.name}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setPackageForm({ ...packageForm, name: e.target.value })
                    }
                    required
                    placeholder="e.g., Floor 9, Floor 12"
                    className="input-modern w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">
                    Description (Optional)
                  </label>
                  <textarea
                    value={packageForm.description}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                      setPackageForm({
                        ...packageForm,
                        description: e.target.value,
                      })
                    }
                    rows={2}
                    placeholder="e.g., Complete all chambers"
                    className="input-modern w-full resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">
                    Fixed Price (IDR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={packageForm.fixed_price || 0}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setPackageForm({
                        ...packageForm,
                        fixed_price: parseInt(e.target.value) || 0,
                      })
                    }
                    required
                    className="input-modern w-full"
                  />
                  <p className="text-xs text-zinc-500 mt-1">
                    Set the exact price for this package (e.g., 10000 for Rp
                    10,000)
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">
                    Estimated Hours
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={packageForm.estimated_hours || 1}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setPackageForm({
                        ...packageForm,
                        estimated_hours: parseInt(e.target.value) || 1,
                      })
                    }
                    required
                    className="input-modern w-full"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="pkg_is_active"
                    checked={packageForm.is_active}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setPackageForm({
                        ...packageForm,
                        is_active: e.target.checked,
                      })
                    }
                    className="w-4 h-4"
                  />
                  <label
                    htmlFor="pkg_is_active"
                    className="text-sm text-zinc-300"
                  >
                    Active (visible in catalog)
                  </label>
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddPackage(false);
                      setEditingPackage(null);
                    }}
                    className="flex-1 btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-primary hover:bg-primary-hover text-white font-semibold py-2.5 rounded-lg transition-all"
                  >
                    {editingPackage ? "Update" : "Add"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
