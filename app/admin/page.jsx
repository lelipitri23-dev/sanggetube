import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminClient from './AdminClient';

export const metadata = {
  title: 'Admin Scraper Panel - Node.js',
  robots: {
    index: false,
    follow: false
  }
};

export default async function AdminPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session');

  if (!session || session.value !== 'authenticated') {
    redirect('/admin/login');
  }

  return (
    <div className="bg-gray-100 font-sans min-h-screen">
      <nav className="bg-gray-800 p-4 shadow-lg">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-white text-xl font-bold">Admin Panel</h1>
          <div className="flex gap-4">
            <a href="/" className="text-pink-400 hover:text-white">Lihat Website &rarr;</a>
            <a href="/api/admin/logout" className="text-red-400 hover:text-white text-sm">Logout</a>
          </div>
        </div>
      </nav>

      <main className="container mx-auto mt-10 p-6 bg-white rounded-lg shadow-xl max-w-4xl">
        <h2 className="text-2xl font-bold mb-6 text-gray-800 border-b pb-2">Scraper Video Massal</h2>
        <AdminClient />
      </main>
    </div>
  );
}
