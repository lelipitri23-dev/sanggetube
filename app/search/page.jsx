import dbConnect from '@/lib/db';
import Video from '@/models/Video';
import VideoCard from '@/components/VideoCard';
import Pagination from '@/components/Pagination';
import Link from 'next/link';

export async function generateMetadata({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const q = (resolvedSearchParams.q || '').trim();
  const siteName = process.env.SITE_NAME || "BokepTube";

  return {
    title: `Pencarian: ${q} - ${siteName}`,
    robots: {
      index: false,
      follow: false
    }
  };
}

export default async function SearchPage({ searchParams }) {
  await dbConnect();
  
  const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
  const resolvedSearchParams = await searchParams;
  
  const q = (resolvedSearchParams.q || '').trim();
  const page = parseInt(resolvedSearchParams.page) || 1;
  const limit = 24;
  const skip = (page - 1) * limit;

  const query = q
      ? {
          $or: [
              { title: { $regex: q, $options: 'i' } },
              { tags: { $regex: q, $options: 'i' } }
          ]
      }
      : {};

  const [videos, totalVideos] = await Promise.all([
      Video.find(query).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
      Video.countDocuments(query)
  ]);

  const totalPages = Math.ceil(totalVideos / limit) || 1;

  return (
    <>
      <div className="flex items-center justify-between mb-8 border-b border-gray-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-8 bg-pink-600 rounded-full shadow-[0_0_10px_rgba(236,72,153,0.5)]"></div>
          <h1 className="text-2xl font-black text-white tracking-tight uppercase">
            Hasil Pencarian: <span className="text-pink-500">"{q}"</span>
          </h1>
        </div>
        <div className="hidden md:block text-xs text-gray-500 font-medium bg-gray-900 px-3 py-1 rounded-full border border-gray-800">
          {totalVideos.toLocaleString()} Hasil Ditemukan
        </div>
      </div>

      <div className="mb-8 bg-gray-900/50 border border-gray-800 rounded-xl p-4 md:p-6">
        <p className="text-gray-300 leading-relaxed text-sm md:text-base">
          Menampilkan hasil pencarian untuk "{q}".{' '}
          {videos.length > 0 
            ? `Ditemukan ${totalVideos} video yang sesuai dengan kata kunci Anda.` 
            : 'Coba gunakan kata kunci yang berbeda atau telusuri kategori video.'
          }
        </p>
      </div>

      {videos.length > 0 ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-5 mb-12">
            {videos.map((vid) => (
              <VideoCard key={vid._id.toString()} video={vid} siteUrl={siteUrl} />
            ))}
          </div>

          <Pagination 
            currentPage={page} 
            totalPages={totalPages} 
            searchParams={{ q, ...resolvedSearchParams }} 
          />
        </>
      ) : (
        <div className="min-h-[50vh] flex flex-col items-center justify-center text-center bg-gray-900/50 border border-gray-800 rounded-2xl p-10">
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="text-xl font-bold text-white mb-2">Tidak Ditemukan</h2>
          <p className="text-gray-500 mb-6">
            Maaf, tidak ada video yang cocok dengan kata kunci <span className="text-pink-500">"{q}"</span>.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/" className="px-6 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-full transition font-medium">
              Kembali ke Beranda
            </Link>
            <Link href="/category/bokep-terbaru" className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-full transition font-medium">
              Lihat Video Terbaru
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
