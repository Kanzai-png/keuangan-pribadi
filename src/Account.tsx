import { useState, useEffect } from 'react';
import { supabase } from './supabase';

interface AccountProps {
  user: any;
  notify: (type: 'success' | 'error' | 'warning', msg: string) => void;
}

export default function Account({ user, notify }: AccountProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [createdAt, setCreatedAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [user]);

  async function loadProfile() {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      // Profile might not exist for old users, create it
      if (error.code === 'PGRST116') {
        await supabase.from('profiles').insert({
          id: user.id,
          email: user.email,
          name: '',
        });
        setEmail(user.email);
        setCreatedAt(user.created_at || new Date().toISOString());
      } else {
        notify('error', 'Gagal load profil');
      }
    } else if (data) {
      setName(data.name || '');
      setEmail(data.email);
      setCreatedAt(data.created_at);
    }
    setLoading(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (error) {
      notify('error', 'Gagal update profil');
    } else {
      notify('success', 'Profil diupdate');
    }
    setSaving(false);
  }

  if (loading) return <div className="text-gray-400 text-center py-12">Loading profil...</div>;

  const joinDate = createdAt ? new Date(createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Profile Card */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-base font-semibold text-white mb-6">Informasi Akun</h2>
        <div className="space-y-4">
          <div className="flex items-center gap-4 p-4 bg-gray-800/50 rounded-lg">
            <div className="w-12 h-12 rounded-full bg-teal-600 flex items-center justify-center text-lg font-bold text-white">
              {(name || email || '?')[0].toUpperCase()}
            </div>
            <div>
              <p className="text-white font-medium">{name || 'Belum diisi'}</p>
              <p className="text-sm text-gray-400">{email}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-800/50 rounded-lg">
              <p className="text-xs text-gray-400 uppercase tracking-wide">User ID</p>
              <p className="text-sm text-gray-300 mt-1 font-mono truncate">{user.id}</p>
            </div>
            <div className="p-4 bg-gray-800/50 rounded-lg">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Bergabung</p>
              <p className="text-sm text-gray-300 mt-1">{joinDate}</p>
            </div>
            <div className="p-4 bg-gray-800/50 rounded-lg">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Email</p>
              <p className="text-sm text-gray-300 mt-1">{email}</p>
            </div>
            <div className="p-4 bg-gray-800/50 rounded-lg">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Status</p>
              <p className="text-sm text-teal-400 mt-1 font-medium">Aktif</p>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-base font-semibold text-white mb-4">Edit Profil</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Nama</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Masukkan nama kamu"
              className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-teal-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Email</label>
            <input type="email" value={email} disabled
              className="w-full px-3 py-2.5 bg-gray-800/50 border border-gray-700 rounded-lg text-sm text-gray-500 cursor-not-allowed" />
            <p className="text-xs text-gray-500 mt-1">Email tidak bisa diubah</p>
          </div>
          <button type="submit" disabled={saving}
            className="px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-sm font-medium disabled:opacity-50">
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </form>
      </div>

      {/* Security Info */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-base font-semibold text-white mb-4">Keamanan</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
            <div>
              <p className="text-sm text-gray-300">Password</p>
              <p className="text-xs text-gray-500">Terakhir diubah: -</p>
            </div>
            <span className="text-xs text-gray-500 px-2 py-1 bg-gray-700 rounded">Managed by Supabase</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
            <div>
              <p className="text-sm text-gray-300">Session</p>
              <p className="text-xs text-gray-500">Login aktif</p>
            </div>
            <span className="text-xs text-teal-400 px-2 py-1 bg-teal-900/30 rounded">Active</span>
          </div>
        </div>
      </div>
    </div>
  );
}
