export const runtime = 'nodejs';

import dbConnect from '@/lib/db';
import Video from '@/models/Video';
import VideoCard from '@/components/VideoCard';
import Pagination from '@/components/Pagination';
import Link from 'next/link';

// Cache category pages for 30 minutes
export const revalidate = 1800;

export async function generateMetadata({ params, searchParams }) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const page = parseInt(resolvedSearchParams.page) || 1;
  const displayCat = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const siteName = process.env.SITE_NAME || "BokepTube";
  const pageLabel = page > 1 ? ` - Halaman ${page}` : "";
  
  const seoDescription = `Kumpulan ${displayCat} dengan berbagai jenis adegan. Koleksi ${displayCat} terlengkap. Update terbaru setiap hari. Nonton ${displayCat} gratis tanpa iklan di ${siteName}.`;

  return {
    title: `${displayCat}${pageLabel} - ${siteName}`,
    description: seoDescription + pageLabel,
  };
}

export default async function CategoryPage({ params, searchParams }) {
  await dbConnect();
  
  const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
  const siteName = process.env.SITE_NAME || "BokepTube";
  
  const { slug } = await params;
  const displayCat = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  
  const resolvedSearchParams = await searchParams;
  const page = parseInt(resolvedSearchParams.page) || 1;
  const limit = 24;
  const skip = (page - 1) * limit;

  const query = { categories: { $regex: slug.replace(/-/g, ' '), $options: 'i' } };
  
  const [videos, totalVideos] = await Promise.all([
    Video.find(query).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    Video.countDocuments(query)
  ]);

  const totalPages = Math.ceil(totalVideos / limit) || 1;

  const seoDescription = `Kumpulan ${displayCat} dengan berbagai jenis adegan.\nKoleksi ${displayCat} terlengkap.\nUpdate terbaru setiap hari. Nonton ${displayCat} gratis tanpa iklan di ${siteName}.`;

  return (
    <>
      <div className="flex items-center justify-between mb-8 border-b border-gray-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-8 bg-blue-600 rounded-full shadow-[0_0_10px_rgba(37,99,235,0.5)]"></div>
          <h2 className="text-2xl font-black text-white tracking-tight uppercase">
            Kategori: <span className="text-blue-500">{displayCat}</span>
          </h2>
        </div>
        <div className="hidden md:block text-xs text-gray-500 font-medium bg-gray-900 px-3 py-1 rounded-full border border-gray-800">
          {totalVideos.toLocaleString()} Video
        </div>
      </div>

      <div className="mb-8 bg-gray-900/50 border border-gray-800 rounded-xl p-4 md:p-6">
        <p className="text-gray-300 leading-relaxed text-sm md:text-base">
          {seoDescription.split('\n').map((line, i) => <span key={i}>{line}<br/></span>)}
        </p>
      </div>

      {videos.length > 0 ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-5 mb-12">
            {videos.map((vid) => (
              <VideoCard key={vid._id.toString()} video={vid} siteUrl={siteUrl} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-8 mb-20">
              {page > 1 && (
                <Link 
                  href={`/category/${slug}?page=${page - 1}`}
                  className="w-10 h-10 flex items-center justify-center bg-gray-800 text-white rounded-lg hover:bg-blue-600 transition shadow-lg border border-gray-700"
                >
                  &larr;
                </Link>
              )}
              
              <div className="px-6 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm font-medium shadow-inner">
                <span className="text-blue-500 font-bold">{page}</span>
                <span className="text-gray-600 mx-2">/</span>
                <span className="text-gray-400">{totalPages}</span>
              </div>

              {page < totalPages && (
                <Link 
                  href={`/category/${slug}?page=${page + 1}`}
                  className="w-10 h-10 flex items-center justify-center bg-gray-800 text-white rounded-lg hover:bg-blue-600 transition shadow-lg border border-gray-700"
                >
                  &rarr;
                </Link>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="min-h-[50vh] flex flex-col items-center justify-center text-center bg-gray-900/50 border border-gray-800 rounded-2xl p-10">
          <div className="text-6xl mb-4">📂</div>
          <h3 className="text-xl font-bold text-white mb-2">Kategori Kosong</h3>
          <p className="text-gray-500 mb-6">
            Belum ada video di kategori <span className="text-blue-500">{displayCat}</span>.
          </p>
          <Link href="/" className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition font-medium">
            Kembali ke Beranda
          </Link>
        </div>
      )}
    </>
  );
}
