export const runtime = 'nodejs';

import dbConnect from '@/lib/db';
import Video from '@/models/Video';
import VideoCard from '@/components/VideoCard';
import Pagination from '@/components/Pagination';

export const revalidate = 60;

export async function generateMetadata({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const page = parseInt(resolvedSearchParams.page) || 1;
  const siteName = process.env.SITE_NAME || 'BokepTube';
  const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
  const pageLabel = page > 1 ? ` - Halaman ${page}` : '';

  return {
    title: `Video Terbaru${pageLabel} - ${siteName}`,
    description: `Nonton video bokep terbaru yang baru saja di-upload di ${siteName}.${pageLabel}`,
    alternates: {
      canonical: `${siteUrl}/terbaru${page > 1 ? `?page=${page}` : ''}`,
    },
    openGraph: {
      title: `Video Terbaru${pageLabel} - ${siteName}`,
      description: `Video bokep terbaru di ${siteName}.`,
      images: [{ url: `${siteUrl}/og-image.jpg` }],
    },
  };
}

export default async function TerbaruPage({ searchParams }) {
  await dbConnect();

  const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
  const resolvedSearchParams = await searchParams;
  const page = parseInt(resolvedSearchParams.page) || 1;
  const limit = 24;
  const skip = (page - 1) * limit;

  const [videos, totalVideos] = await Promise.all([
    Video.find().sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    Video.countDocuments(),
  ]);

  const totalPages = Math.ceil(totalVideos / limit);

  return (
    <>
      <div className="flex items-center justify-between mb-6 border-b border-gray-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-8 bg-pink-600 rounded-full shadow-[0_0_10px_rgba(236,72,153,0.5)]"></div>
          <h1 className="text-xl md:text-2xl font-black text-white tracking-tight uppercase">
            Video Terbaru
            {page > 1 && (
              <span className="text-gray-500 text-lg font-medium ml-2">/ Halaman {page}</span>
            )}
          </h1>
        </div>
        <div className="hidden md:block text-xs text-gray-500 font-medium bg-gray-900 px-3 py-1 rounded-full border border-gray-800">
          Total: {totalVideos.toLocaleString()}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-5 mb-12">
        {videos.map((vid) => (
          <VideoCard key={vid._id.toString()} video={vid} siteUrl={siteUrl} />
        ))}
      </div>

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        basePath="/terbaru"
        searchParams={resolvedSearchParams}
      />
    </>
  );
}
