'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push('/admin');
        router.refresh(); // Force refresh to apply cookie state
      } else {
        const data = await res.json();
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('An error occurred during login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-100 font-sans min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-xl overflow-hidden">
        <div className="bg-gray-800 p-6 text-center">
          <h1 className="text-white text-2xl font-bold">🔒 Admin Access</h1>
          <p className="text-gray-400 text-sm mt-1">Silakan masukkan kode akses</p>
        </div>

        <div className="p-8 pb-4">
          <form onSubmit={handleLogin}>
            {error && (
              <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-3 mb-4 text-sm" role="alert">
                <p>{error}</p>
              </div>
            )}

            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
                Password
              </label>
              <input 
                className="shadow appearance-none border rounded w-full py-3 px-4 text-gray-700 mb-3 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200" 
                id="password" 
                type="password" 
                name="password" 
                placeholder="••••••••"
                required
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between">
              <button 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg focus:outline-none focus:shadow-outline transition duration-200 flex justify-center items-center gap-2 disabled:opacity-50" 
                type="submit"
                disabled={loading}
              >
                <span>{loading ? 'Processing...' : 'Masuk Panel'}</span>
                {!loading && <span>&rarr;</span>}
              </button>
            </div>
          </form>
        </div>
        
        <div className="bg-gray-50 px-8 py-4 border-t border-gray-200 text-center">
          <Link href="/" className="text-xs text-gray-500 hover:text-blue-600">
            Kembali ke Beranda Utama
          </Link>
        </div>
      </div>
    </div>
  );
}
