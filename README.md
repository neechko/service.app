# Service.app

Service.app is a web-based platform designed to connect game players (consumers) with professional boosters (workers) for Genshin Impact services "Maybe in the future there will be other games added". The platform provides a secure ordering system, real-time progress tracking, and an integrated communication channel between users.

## Features

*   **Public Catalog:** Users can browse available services and pricing without requiring an account.
*   **Role-Based Access Control:** Distinct dashboards and workflows for Consumers, Workers, and Administrators.
*   **Order Management:** Consumers can place, track, and cancel orders. Workers can update progress and upload proof of completion.
*   **Integrated Chat:** A secure, order-specific chat system allowing consumers and assigned workers to share credentials and updates.
*   **Admin Dashboard:** Comprehensive tools for administrators to manage users, services, categories, and assign workers to orders.

## Tech Stack

*   **Frontend Framework:** React with TypeScript
*   **Build Tool:** Vite
*   **Styling:** Tailwind CSS
*   **Routing:** React Router DOM
*   **Backend & Database:** Supabase (PostgreSQL, Authentication, Storage)

## Prerequisites

Before running the project locally, ensure you have the following installed:
*   Node.js (v16 or higher)
*   npm (Node Package Manager)
*   A Supabase account and project

## Installation and Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/neechko/service.app.git
    cd service.app/primora-web
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables:**
    Create a `.env` file in the root directory and add your Supabase credentials:
    ```env
    VITE_SUPABASE_URL=your_supabase_project_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
    ```

4.  **Setup Database:**
    *   Go to your Supabase Dashboard -> SQL Editor.
    *   Run the SQL script provided in `database.sql` to create the necessary tables, indexes, triggers, and Row Level Security (RLS) policies.
    *   Go to Storage and create a new **Public** bucket named `screenshots` for progress image uploads.

5.  **Run the development server:**
    ```bash
    npm run dev
    ```
    Open your browser and navigate to `http://localhost:5173`.

## Deployment

This project is configured for deployment on Vercel. 
1. Push the code to your GitHub repository.
2. Import the project into Vercel.
3. Ensure the Environment Variables (`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`) are added in the Vercel project settings.
4. Configure the Site URL and Redirect URLs in your Supabase Authentication settings to match your Vercel domain.

## License

This project is proprietary and confidential. All rights reserved.