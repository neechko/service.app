import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Database } from '../types/database'

// 1. Ambil tipe baris (Row) dari file database.ts yang sudah kita generate
type Service = Database['public']['Tables']['services']['Row']
type Category = Database['public']['Tables']['categories']['Row']

export default function Catalog() {
  // 2. TAMBAHKAN <TipeData> di setiap useState agar TypeScript tahu isinya nanti seperti apa
  const [services, setServices] = useState<Service[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(true)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setIsLoading(true)

    const [servicesRes, categoriesRes] = await Promise.all([
      supabase.from('services').select('*').eq('is_active', true).order('base_price', { ascending: true }),
      supabase.from('categories').select('*').eq('is_active', true).order('name')
    ])

    if (servicesRes.data) setServices(servicesRes.data)
    if (categoriesRes.data) setCategories(categoriesRes.data)
    setIsLoading(false)
  }

  // 3. Tambahkan tipe pada parameter fungsi
  const formatRupiah = (angka: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(angka)
  }

  const getCategoryName = (slug: string) => {
    const cat = categories.find(c => c.slug === slug)
    return cat ? cat.name : slug
  }

  // Filter services
  const filteredServices = services.filter((service) => {
    const matchCategory = selectedCategory === 'all' || service.category === selectedCategory
    const matchSearch = service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      service.description?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchCategory && matchSearch
  })

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative border-b border-border overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary-light text-xs font-medium px-3 py-1.5 rounded-full mb-6">
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse"></span>
              Trusted by 500+ Genshin Players
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
              <span className="text-zinc-500">{'>'}</span> Joki Genshin Impact{' '}
              <span className="gradient-text">Service</span>
              <span className="cursor-blink"></span>
            </h1>
            <p className="text-lg text-zinc-400 mb-8 max-w-2xl">
              Transparent pricing, real-time progress tracking, and verified workers. Your account security is our top priority.
            </p>

            {/* Search Bar */}
            <div className="relative max-w-xl">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search services..."
                className="input-modern pl-12 py-4"
              />
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Category Filter */}
        <div className="flex flex-wrap gap-2 mb-10">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              selectedCategory === 'all'
                ? 'bg-primary text-white'
                : 'bg-surface hover:bg-surface-hover text-zinc-400'
            }`}
          >
            All Services
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.slug)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedCategory === cat.slug
                  ? 'bg-primary text-white'
                  : 'bg-surface hover:bg-surface-hover text-zinc-400'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="glass-card rounded-2xl p-6 h-64 pulse-soft"></div>
            ))}
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-zinc-500 text-lg">No services found.</p>
            <p className="text-zinc-600 text-sm mt-2">Try adjusting your search or filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredServices.map((service) => (
              <div
                key={service.id}
                className="group glass-card rounded-2xl overflow-hidden hover:border-primary/50 transition-all duration-300 fade-in"
              >
                <div className="p-6 flex flex-col h-full">
                  {/* Category Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary-light text-xs font-medium px-2.5 py-1 rounded-md">
                      {getCategoryName(service.category)}
                    </span>
                    <span className="text-xs text-zinc-500">
                      ~{service.estimated_hours}h
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-grow">
                    <h3 className="text-lg font-bold text-white mb-2 group-hover:text-primary transition">
                      {service.name}
                    </h3>
                    <p className="text-sm text-zinc-400 leading-relaxed line-clamp-2">
                      {service.description}
                    </p>
                  </div>

                  {/* Footer */}
                  <div className="pt-4 mt-4 border-t border-border flex items-center justify-between">
                    <div>
                      <p className="text-xs text-zinc-500 mb-0.5">Starting at</p>
                      <p className="text-xl font-bold text-white">
                        {formatRupiah(service.base_price)}
                      </p>
                    </div>
                    <Link
                      to={`/service/${service.id}`}
                      className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white font-semibold px-4 py-2.5 rounded-lg text-sm transition-all group/btn"
                    >
                      Order Now
                      <svg className="w-4 h-4 group-hover/btn:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-border mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded animated-gradient flex items-center justify-center">
                <img
                  src="/favicon.png"
                  alt=""
                  className="w-8 h-8 rounded-lg object-contain"
                />
              </div>
              <span className="text-sm text-zinc-500">
                © 2026 Primora. All rights reserved.
              </span>
            </div>
            <div className="flex gap-6 text-sm text-zinc-500">
              <a href="#" className="hover:text-zinc-300 transition">Terms</a>
              <a href="#" className="hover:text-zinc-300 transition">Privacy</a>
              <a href="#" className="hover:text-zinc-300 transition">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}