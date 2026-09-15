import { Link } from 'react-router-dom';

export default function HowToOrder() {
  const steps = [
    {
      step: '01',
      title: 'Browse & Select Packages',
      desc: 'Explore our catalog and choose the service you need. Each service may contain multiple packages (e.g., Archon Quest Part 1, Part 2). You can select multiple packages at once to combine them into a single order.',
      icon: (
        <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      )
    },
    {
      step: '02',
      title: 'Enter Account Details',
      desc: 'Provide your Game UID, Server, and any special notes. The total price will be calculated automatically based on the packages you selected.',
      icon: (
        <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      )
    },
    {
      step: '03',
      title: 'Review Cart & Checkout',
      desc: 'Add multiple services to your cart if needed. Review all items, confirm your account details, and proceed to checkout. You will receive a confirmation once the order is created.',
      icon: (
        <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      )
    },
    {
      step: '04',
      title: 'Track Progress in Real-Time',
      desc: 'Once a worker is assigned, you can monitor progress through an automated timeline showing estimated completion time. Communicate directly via the integrated chat system.',
      icon: (
        <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      step: '05',
      title: 'Complete & Review',
      desc: 'Once the order reaches 100%, it is marked as completed. You can then leave a rating and review to help other customers make informed decisions.',
      icon: (
        <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    }
  ];

  return (
    <div className="min-h-screen bg-background pb-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">How to Order</h1>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
            Ordering on Primora is simple, transparent, and secure. Follow these steps:
          </p>
        </div>

        <div className="space-y-8 mb-16">
          {steps.map((item, index) => (
            <div key={index} className="flex gap-6 items-start">
              <div className="flex-shrink-0 flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center">
                  {item.icon}
                </div>
                {index < steps.length - 1 && <div className="w-0.5 h-full bg-border mt-4 min-h-[40px]"></div>}
              </div>
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

        {/* Multi-Package Explanation */}
        <div className="glass-card rounded-2xl p-6 mb-8 border border-primary/20">
          <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Understanding Multi-Package Orders
          </h3>
          <p className="text-zinc-300 text-sm leading-relaxed mb-3">
            Some services (like long quests or multi-stage content) are divided into multiple packages. For example, an "Archon Quest Snezhnaya" service may have:
          </p>
          <ul className="text-sm text-zinc-400 space-y-1 mb-3 ml-4 list-disc">
            <li>Part 1 - Rp 50,000</li>
            <li>Part 2 - Rp 50,000</li>
          </ul>
          <p className="text-zinc-300 text-sm leading-relaxed">
            You can select <strong className="text-white">Part 1 only</strong>, <strong className="text-white">Part 2 only</strong>, or <strong className="text-white">both together</strong> in a single order. The total price is calculated automatically based on your selection.
          </p>
        </div>

        {/* Legal Disclaimer */}
        <div className="glass-card rounded-2xl p-6 border border-yellow-500/30 bg-yellow-500/5 mb-8">
          <h3 className="text-lg font-bold text-yellow-400 mb-2 flex items-center gap-2">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Disclaimer & Terms of Service
          </h3>
          <p className="text-zinc-300 text-sm leading-relaxed">
            This service is a <strong>game boosting / Joki service</strong>. We are not affiliated with any game developer. While we implement the highest security protocols, <strong>we are not responsible for any actions taken by game developers</strong> (such as bans, resets, or policy changes) that occur during or after the boosting process. By placing an order, you acknowledge and accept these risks.
          </p>
        </div>

        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-white font-bold py-3 px-8 rounded-xl transition-all transform hover:scale-105">
            <span>Start Ordering Now</span>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}