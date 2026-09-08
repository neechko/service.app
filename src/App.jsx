import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Register from './pages/Register'
import Catalog from './pages/Catalog'
import ServiceDetail from './pages/ServiceDetail'
import OrderTracking from './pages/OrderTracking'
import MyOrders from './pages/MyOrders'
import WorkerDashboard from './pages/WorkerDashboard'
import AdminDashboard from './pages/AdminDashboard'
import Profile from './pages/Profile'

function App() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    checkUser()

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          fetchProfile(session.user.id)
        } else {
          setProfile(null)
        }
      }
    )

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession()
    setUser(session?.user ?? null)
    if (session?.user) {
      await fetchProfile(session.user.id)
    }
    setLoading(false)
  }

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setMobileMenuOpen(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
          <p className="text-zinc-500 text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      {user && (
        <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <Link to="/" className="flex items-center gap-2 group">
                <div className="w-8 h-8 rounded-lg animated-gradient flex items-center justify-center">
                  <img
                    src="/favicon.png"
                    alt=""
                    className="w-8 h-8 rounded-lg object-contain"
                  />
                </div>
                <span className="text-xl font-bold text-white group-hover:text-primary transition">
                  Primora
                </span>
              </Link>

              {/* Desktop Menu */}
              <div className="hidden md:flex items-center gap-2">
                {/* My Orders - hanya untuk consumer */}
                {profile?.role === 'consumer' && (
                  <Link to="/orders" className="btn-ghost text-sm">
                    My Orders
                  </Link>
                )}

                {/* Worker Panel */}
                {profile?.role === 'worker' && (  // ← GANTI dari 'joki'
                  <Link to="/worker" className="btn-ghost text-sm">  {/* ← GANTI /joki jadi /worker */}
                    Worker Panel
                  </Link>
                )}

                {/* Admin Panel */}
                {profile?.role === 'admin' && (
                  <Link to="/admin" className="btn-ghost text-sm">
                    Admin Panel
                  </Link>
                )}

                {/* Profile Button */}
                <Link to="/profile" className="flex items-center gap-2 ml-2 pl-3 border-l border-border">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt="Avatar"
                      className="w-8 h-8 rounded-full object-cover border border-primary"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center">
                      <span className="text-white font-bold text-xs">
                        {profile?.full_name?.[0]?.toUpperCase() || 'U'}
                      </span>
                    </div>
                  )}
                  <div className="text-left">
                    <p className="text-sm font-medium text-white leading-tight">
                      {profile?.full_name || 'User'}
                    </p>
                    <p className="text-xs text-zinc-500 capitalize">
                      {profile?.role || 'User'}
                    </p>
                  </div>
                </Link>

                <button
                  onClick={handleLogout}
                  className="btn-ghost text-sm ml-2"
                >
                  Sign Out
                </button>
              </div>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 text-zinc-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
                </svg>
              </button>
            </div>

            {/* Mobile Menu */}
            {mobileMenuOpen && (
              <div className="md:hidden py-4 border-t border-border space-y-2 fade-in">
                {profile?.role === 'consumer' && (
                  <Link to="/orders" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-zinc-300 hover:bg-surface-hover rounded-lg">
                    My Orders
                  </Link>
                )}
                {profile?.role === 'worker' && (  // ← GANTI dari 'joki'
                  <Link to="/worker" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-zinc-300 hover:bg-surface-hover rounded-lg">
                    Worker Panel
                  </Link>
                )}
                {profile?.role === 'admin' && (
                  <Link to="/admin" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-zinc-300 hover:bg-surface-hover rounded-lg">
                    Admin Panel
                  </Link>
                )}
                <Link to="/profile" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-zinc-300 hover:bg-surface-hover rounded-lg">
                  My Profile
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2 text-red-400 hover:bg-surface-hover rounded-lg"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </nav>
      )}

      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to="/" /> : <Register />} />
        <Route path="/" element={user ? <Catalog /> : <Navigate to="/login" />} />
        <Route path="/service/:id" element={user ? <ServiceDetail /> : <Navigate to="/login" />} />
        <Route path="/order/:id" element={user ? <OrderTracking /> : <Navigate to="/login" />} />
        <Route path="/orders" element={user && profile?.role === 'consumer' ? <MyOrders /> : <Navigate to="/" />} />
        <Route path="/worker" element={user && profile?.role === 'worker' ? <WorkerDashboard /> : <Navigate to="/" />} />
        <Route path="/admin" element={user && profile?.role === 'admin' ? <AdminDashboard /> : <Navigate to="/" />} />
        <Route path="/profile" element={user ? <Profile /> : <Navigate to="/login" />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App