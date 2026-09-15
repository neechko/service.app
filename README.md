
---

# Service.app (Primora)

**Service.app** is a enterprise-grade web platform designed to seamlessly connect game players (Consumers) with professional boosters (Workers) for game boosting services (starting with Genshin Impact, with scalability for other titles). 

Built with a focus on **fairness, transparency, and automation**, the platform features dynamic pricing packages, an automated deadline tracker, smart worker assignment algorithms, and a full shopping cart experience.

---

## Key Features

### Consumer Experience
- **Dynamic Service Packages**: Choose from multiple tiers (e.g., Regular, Express, Premium) with dynamic pricing, similar to modern e-commerce platforms.
- **Shopping Cart System**: Add multiple services to a cart, input game credentials (UID/Server) per item, and checkout in a single, seamless transaction.
- **Automated Timeline Tracker**: Real-time visual progress bar showing "Time Elapsed" and "Target Deadline" (with **ON TRACK** / **OVERDUE** indicators) for complete transparency.
- **Public Reviews & Ratings**: Leave star ratings and comments after order completion, which are displayed publicly on service pages to build community trust.
- **Order Cancellation**: Cancel pending/paid orders with a logged reason, visible in both the order list and detail views.
- **Interactive "How to Order" Guide**: A dedicated, professionally designed page outlining the process and legal disclaimers.

### Worker Efficiency
- **Smart Dashboard**: View assigned orders with clear customer details, game credentials, and chat history.
- **Progress Updates with Compression**: Upload progress screenshots that are **automatically compressed client-side** to save storage space and bandwidth, while maintaining proof of work.
- **Task Visibility**: View automated schedule expectations to manage time effectively.

### Admin Control & Fairness
- **Smart Worker Assignment**: When assigning orders, workers are **automatically sorted by priority**: 
  1. Availability (Not on leave)
  2. Workload Ratio (`Current Load / Max Capacity`)
  3. Seniority Level (Senior > Mid > Junior)
- **Worker Stats Management**: Directly edit a worker's Seniority, Max Capacity, Current Load, and Leave Status from the UI without touching the database.
- **Comprehensive CRUD**: Full management of Services, Service Packages (Tiers), Categories, Users, and Orders.
- **Admin Takeover**: Ability to update progress or reassign orders at any time.

### System & Performance
- **Custom Themed Dialogs**: Replaced intrusive native browser `alert()`/`confirm()` with beautiful, dark-themed glassmorphism modals.
- **Automated Database Triggers**: 
  - Auto-calculates order deadlines based on service `estimated_hours`.
  - Auto-increments/decrements worker `current_active_orders` on assignment/completion.
  - Auto-updates worker `average_rating` and `total_reviews` upon new review submission.
- **Strict Row Level Security (RLS)**: Granular, production-ready database policies ensuring users can only access/modify data they are authorized to.

---

## Tech Stack

- **Frontend Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS (with custom glassmorphism utilities)
- **Routing**: React Router DOM
- **State Management**: React Context API (for Shopping Cart)
- **Backend & Database**: Supabase (PostgreSQL, Authentication, Row Level Security, Storage)
- **Utilities**: Client-side image compression, Custom Dialog System

---

## Prerequisites

Before running the project locally, ensure you have the following installed:
- **Node.js** (v18 or higher recommended)
- **npm** or **pnpm** / **yarn**
- A **Supabase** account and an active project
- **Supabase CLI** (Optional, but recommended for generating TypeScript types)

---

## Installation and Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/neechko/service.app.git
   cd service.app/primora-web
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory and add your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Setup Database & Storage:**
   - Go to your **Supabase Dashboard** → **SQL Editor**.
   - Copy and run the **entire updated script** from `database.sql` (v2.0). This creates all tables (`service_tiers`, `reviews`, etc.), indexes, automated triggers, and strict RLS policies.
   - Go to **Storage** and create two new **Public** buckets:
     1. `screenshots` (For order progress proofs)
     2. `avatars` (For user profile pictures)

5. **Generate TypeScript Types (Recommended):**
   ```bash
   npx supabase gen types typescript --project-id YOUR_PROJECT_ID --schema public > src/types/database.ts
   ```

6. **Run the development server:**
   ```bash
   npm run dev
   ```
   Open your browser and navigate to `http://localhost:5173`.

---

## Deployment

This project is optimized for deployment on **Vercel**.

1. Push your code to your GitHub repository.
2. Import the project into your Vercel dashboard.
3. Add the Environment Variables (`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`) in the Vercel project settings.
4. **Crucial**: Go to your Supabase Dashboard → **Authentication** → **URL Configuration**, and update the **Site URL** and **Redirect URLs** to match your new Vercel production domain (e.g., `https://your-app.vercel.app/**`).

---

## License

This project is proprietary and confidential. All rights reserved. Unauthorized copying, distribution, or modification of this software is strictly prohibited.

--- 