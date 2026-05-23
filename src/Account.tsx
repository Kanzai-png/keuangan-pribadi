import { useUser } from '@clerk/clerk-react';

interface AccountProps {
  user: any;
  notify: (type: 'success' | 'error' | 'warning', msg: string) => void;
}

export default function Account({ user }: AccountProps) {
  const { isLoaded } = useUser();

  if (!isLoaded) return <div className="text-gray-400 text-center py-12">Loading...</div>;

  const email = user?.primaryEmailAddress?.emailAddress || '-';
  const name = user?.fullName || user?.firstName || '';
  const avatar = user?.imageUrl;
  const createdAt = user?.createdAt ? new Date(user.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-';
  const userId = user?.id || '-';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Profile Card */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-base font-semibold text-white mb-6">Informasi Akun</h2>
        <div className="space-y-4">
          <div className="flex items-center gap-4 p-4 bg-gray-800/50 rounded-lg">
            {avatar ? (
              <img src={avatar} alt="Avatar" className="w-12 h-12 rounded-full" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-teal-600 flex items-center justify-center text-lg font-bold text-white">
                {(name || email || '?')[0].toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-white font-medium">{name || 'Belum diisi'}</p>
              <p className="text-sm text-gray-400">{email}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-800/50 rounded-lg">
              <p className="text-xs text-gray-400 uppercase tracking-wide">User ID</p>
              <p className="text-sm text-gray-300 mt-1 font-mono truncate">{userId}</p>
            </div>
            <div className="p-4 bg-gray-800/50 rounded-lg">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Bergabung</p>
              <p className="text-sm text-gray-300 mt-1">{createdAt}</p>
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

      {/* Manage Account */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-base font-semibold text-white mb-4">Kelola Akun</h2>
        <p className="text-sm text-gray-400 mb-4">Untuk mengubah nama, email, atau password, gunakan panel Clerk:</p>
        <button onClick={() => { if ((window as any).Clerk) (window as any).Clerk.openUserProfile(); }}
          className="px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-sm font-medium transition-colors">
          Buka Pengaturan Akun
        </button>
      </div>

      {/* Security Info */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-base font-semibold text-white mb-4">Keamanan</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
            <div>
              <p className="text-sm text-gray-300">Autentikasi</p>
              <p className="text-xs text-gray-500">Email + Password</p>
            </div>
            <span className="text-xs text-teal-400 px-2 py-1 bg-teal-900/30 rounded">Secured by Clerk</span>
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
