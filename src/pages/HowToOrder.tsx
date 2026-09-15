import { Link } from 'react-router-dom'

export default function HowToOrder() {
  const steps = [
    {
      step: '01',
      title: 'Pilih Layanan & Paket',
      desc: 'Jelajahi katalog kami dan pilih jasa yang Anda butuhkan. Setiap layanan memiliki beberapa pilihan paket (misal: Regular, Express, Premium) dengan harga dan estimasi waktu yang berbeda.',
      icon: (
        <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      )
    },
    {
      step: '02',
      title: 'Isi Detail Akun',
      desc: 'Masukkan Game UID, Server, dan catatan khusus. Pastikan data yang Anda masukkan sudah benar agar proses boosting berjalan lancar dan aman.',
      icon: (
        <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      )
    },
    {
      step: '03',
      title: 'Konfirmasi & Tunggu Worker',
      desc: 'Setelah order dibuat, Admin akan menugaskan Worker terbaik yang tersedia berdasarkan kapasitas dan keahlian. Anda bisa memantau progres secara real-time.',
      icon: (
        <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      step: '04',
      title: 'Pantau Progres & Selesai',
      desc: 'Pantau kemajuan order di halaman "My Orders". Worker akan mengupload bukti screenshot. Setelah mencapai 100%, order selesai dan Anda bisa memberikan ulasan.',
      icon: (
        <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    }
  ]

  return (
    <div className="min-h-screen bg-background pb-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">How to Order</h1>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
            Proses pemesanan di Primora sangat mudah, transparan, dan aman. Ikuti 4 langkah sederhana berikut:
          </p>
        </div>

        {/* Steps Timeline */}
        <div className="space-y-8 mb-16">
          {steps.map((item, index) => (
            <div key={index} className="flex gap-6 items-start">
              {/* Step Number & Icon */}
              <div className="flex-shrink-0 flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center">
                  {item.icon}
                </div>
                {index < steps.length - 1 && (
                  <div className="w-0.5 h-full bg-border mt-4 min-h-[40px]"></div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 pt-2">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-primary font-bold text-sm tracking-wider">STEP {item.step}</span>
                  <h3 className="text-xl font-bold text-white">{item.title}</h3>
                </div>
                <p className="text-zinc-400 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Legal Disclaimer */}
        <div className="glass-card rounded-2xl p-6 border border-yellow-500/30 bg-yellow-500/5 mb-8">
          <h3 className="text-lg font-bold text-yellow-400 mb-2 flex items-center gap-2">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Disclaimer & Syarat Layanan
          </h3>
          <p className="text-zinc-300 text-sm leading-relaxed">
            Layanan ini adalah <strong>jasa titip main (boosting)</strong>. Kami tidak berafiliasi dengan developer game manapun. 
            Meskipun kami menerapkan protokol keamanan tertinggi, <strong>kami tidak bertanggung jawab atas tindakan sepihak dari developer game</strong> (seperti banned, reset rank, atau perubahan kebijakan) yang terjadi selama atau setelah proses boosting. 
            Dengan memesan, Anda menyetujui risiko ini.
          </p>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-white font-bold py-3 px-8 rounded-xl transition-all transform hover:scale-105"
          >
            <span>Mulai Pesan Sekarang</span>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  )
}