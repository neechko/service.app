import { useEffect, useState, FormEvent, ChangeEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { Database } from '../types/database'
import { compressImage } from '../lib/imageUtils'

type Profile = Database['public']['Tables']['profiles']['Row']

export default function Profile() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [email, setEmail] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const [saving, setSaving] = useState<boolean>(false)
  const [uploadingAvatar, setUploadingAvatar] = useState<boolean>(false)
  const [success, setSuccess] = useState<string>('')
  const [error, setError] = useState<string>('')

  // Form state
  const [fullName, setFullName] = useState<string>('')
  const [phone, setPhone] = useState<string>('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)

  useEffect(() => {
    fetchProfile()
  }, [])

  async function fetchProfile() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      navigate('/login')
      return
    }

    setEmail(user.email || '')

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (data) {
      setProfile(data)
      setFullName(data.full_name || '')
      setPhone(data.phone || '')
    }

    setLoading(false)
  }

  async function handleUpdateProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let avatarUrl = profile?.avatar_url || null

    // Upload avatar baru jika ada
    if (avatarFile) {
      try {
        setUploadingAvatar(true)
        
        const fileToUpload = await compressImage(avatarFile)
        
        const fileName = `${user.id}/avatar-${Date.now()}.jpg`
        // Catatan: Pastikan Anda sudah membuat bucket bernama 'avatars' (Public) di Supabase Storage.
        // Jika belum, ganti 'avatars' menjadi 'screenshots' sesuai setup awal Anda.
        const filePath = `avatars/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('avatars') 
          .upload(filePath, fileToUpload, { 
            upsert: true,
            contentType: 'image/jpeg' // Pastikan tipe konten benar agar browser bisa merendernya
          })

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath)

        avatarUrl = publicUrl
      } catch (err) {
        setError('Failed to upload avatar: ' + (err as Error).message)
        setSaving(false)
        setUploadingAvatar(false)
        return
      }
      setUploadingAvatar(false)
    }

    // Update profil
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        phone: phone,
        avatar_url: avatarUrl,
      })
      .eq('id', user.id)

    if (updateError) {
      setError('Failed to update profile: ' + updateError.message)
    } else {
      setSuccess('Profile updated successfully!')
      setAvatarFile(null)
      fetchProfile()
    }

    setSaving(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-zinc-400">Profile not found.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">My Profile</h1>
          <p className="text-zinc-400">Manage your account information</p>
        </div>

        <div className="glass-card rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-4">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Avatar"
                className="w-20 h-20 rounded-full object-cover border-2 border-primary"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center">
                <span className="text-white font-bold text-2xl">
                  {profile.full_name?.[0]?.toUpperCase() || 'U'}
                </span>
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold text-white">{profile.full_name}</h2>
              <p className="text-zinc-400 text-sm">{email}</p>
              <span className="inline-block mt-1 px-2 py-0.5 bg-primary/10 text-primary-light text-xs font-medium rounded-md capitalize">
                {profile.role}
              </span>
            </div>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-6">Edit Profile</h3>

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

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)}
                required
                className="input-modern"
                placeholder="Your full name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Email (read-only)
              </label>
              <input
                type="email"
                value={email}
                disabled
                className="input-modern opacity-60 cursor-not-allowed"
              />
              <p className="text-xs text-zinc-500 mt-1">Email cannot be changed for security reasons.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                WhatsApp Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)}
                className="input-modern"
                placeholder="+62 812 3456 7890"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Avatar
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e: ChangeEvent<HTMLInputElement>) => setAvatarFile(e.target.files?.[0] || null)}
                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-100 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-white hover:file:bg-primary-hover"
              />
              <p className="text-xs text-zinc-500 mt-1">Leave empty to keep current avatar. Large images will be compressed automatically.</p>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={handleLogout}
                className="flex-1 bg-red-500/10 text-red-400 hover:bg-red-500/20 font-semibold py-2.5 rounded-lg transition-all"
              >
                Sign Out
              </button>
              <button
                type="submit"
                disabled={saving || uploadingAvatar}
                className="flex-1 bg-primary hover:bg-primary-hover disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-semibold py-2.5 rounded-lg transition-all"
              >
                {saving ? 'Saving...' : uploadingAvatar ? 'Compressing & Uploading...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}