import { useState, FormEvent, ChangeEvent } from "react";
import { supabase } from "../lib/supabase";
import { Link, useNavigate } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [isForgotPassword, setIsForgotPassword] = useState<boolean>(false);
  const navigate = useNavigate();

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    navigate("/");
  }

  async function handleResetPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${window.location.origin}/reset-password`,
      },
    );

    if (resetError) {
      setError(resetError.message);
    } else {
      setSuccess(
        "Link reset password telah dikirim ke email Anda. Silakan cek inbox/spam.",
      );
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-md fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-2xl items-center justify-center mb-4">
            <img
              src="/favicon.png"
              alt=""
              className="w-8 h-8 rounded-lg object-contain"
            />
          </div>
          <h1 className="text-3xl font-bold text-white">
            {isForgotPassword ? "Reset Password" : "Welcome Back"}
          </h1>
          <p className="text-zinc-500 mt-2">
            {isForgotPassword
              ? "Masukkan email Anda untuk menerima link reset."
              : "Sign in to your Primora account"}
          </p>
        </div>

        <div className="glass-card rounded-2xl p-8">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg text-sm mb-4">
              {success}
            </div>
          )}

          {isForgotPassword ? (
            // FORM RESET PASSWORD
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setEmail(e.target.value)
                  }
                  required
                  className="input-modern"
                  placeholder="you@example.com"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary-hover disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-semibold py-3 rounded-lg transition-all duration-200 active:scale-[0.98]"
              >
                {loading ? "Mengirim..." : "Kirim Link Reset"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsForgotPassword(false);
                  setError("");
                  setSuccess("");
                }}
                className="w-full text-center text-sm text-zinc-400 hover:text-white transition mt-4"
              >
                ← Kembali ke Login
              </button>
            </form>
          ) : (
            // FORM LOGIN BIASA
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setEmail(e.target.value)
                  }
                  required
                  className="input-modern"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setPassword(e.target.value)
                  }
                  required
                  minLength={6}
                  className="input-modern"
                  placeholder="Enter your password"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsForgotPassword(true)}
                  className="text-sm text-primary hover:text-primary-light transition"
                >
                  Lupa Password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary-hover disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-semibold py-3 rounded-lg transition-all duration-200 active:scale-[0.98]"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>
          )}

          {!isForgotPassword && (
            <div className="mt-6 text-center text-sm text-zinc-500">
              Don't have an account?{" "}
              <Link
                to="/register"
                className="text-primary hover:text-primary-light font-medium"
              >
                Create one
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
