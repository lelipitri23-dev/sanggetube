export const runtime = 'nodejs';

import { Suspense } from 'react';
import dbConnect from '@/lib/db';
import Video from '@/models/Video';
import VideoCard from '@/components/VideoCard';
import Pagination from '@/components/Pagination';
import FilterPanel from '@/components/FilterPanel';

export const revalidate = 300;

export async function generateMetadata({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const siteName = process.env.SITE_NAME || 'BokepTube';
  const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
  const page = parseInt(resolvedSearchParams.page) || 1;
  const pageLabel = page > 1 ? ` - Halaman ${page}` : '';
  return {
    title: `Filter Video${pageLabel} - ${siteName}`,
    description: `Cari dan filter video bokep berdasarkan tag, kategori, dan durasi di ${siteName}.`,
    alternates: { canonical: `${siteUrl}/filter` },
    robots: 'noindex, follow', // filter page tidak perlu diindex
  };
}

// Range durasi (dalam detik)
const DURATION_RANGES = [
  { label: 'Semua Durasi', value: '' },
  { label: '< 5 menit',    value: '0-300' },
  { label: '5 - 10 menit', value: '300-600' },
  { label: '10 - 20 menit',value: '600-1200' },
  { label: '20 - 30 menit',value: '1200-1800' },
  { label: '30 - 60 menit',value: '1800-3600' },
  { label: '1 jam',        value: '3600-7200' },
  { label: '> 2 jam',      value: '7200-999999' },
];

export default async function FilterPage({ searchParams }) {
  await dbConnect();

  const siteUrl  = process.env.SITE_URL || 'http://localhost:3000';
  const resolved = await searchParams;

  const page     = parseInt(resolved.page) || 1;
  const limit    = 24;
  const skip     = (page - 1) * limit;
  const sortBy   = resolved.sort || 'newest'; // newest | popular
  const tagFilter      = resolved.tag      || '';
  const categoryFilter = resolved.category || '';
  const durationFilter = resolved.duration || '';

  // Build MongoDB query
  const query = {};
  if (tagFilter)      query.tags       = { $regex: tagFilter.replace(/-/g, ' '), $options: 'i' };
  if (categoryFilter) query.categories = { $regex: categoryFilter.replace(/-/g, ' '), $options: 'i' };
  if (durationFilter) {
    const [minSec, maxSec] = durationFilter.split('-').map(Number);
    query.duration_sec = { $gte: minSec, $lte: maxSec };
  }

  const sortQuery = sortBy === 'popular' ? { views: -1 } : { created_at: -1 };

  // Fetch videos + top 50 unique tags + top 50 unique categories for filter options
  const [videos, totalVideos, topTags, topCategories] = await Promise.all([
    Video.find(query).sort(sortQuery).skip(skip).limit(limit).lean(),
    Video.countDocuments(query),
    Video.aggregate([
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 60 },
    ]),
    Video.aggregate([
      { $unwind: '$categories' },
      { $group: { _id: '$categories', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 40 },
    ]),
  ]);

  const totalPages = Math.ceil(totalVideos / limit) || 1;

  return (
    <>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6 border-b border-gray-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-8 bg-purple-600 rounded-full shadow-[0_0_10px_rgba(147,51,234,0.5)]"></div>
          <h1 className="text-xl md:text-2xl font-black text-white tracking-tight uppercase">
            Filter Video
          </h1>
        </div>
        <div className="hidden md:block text-xs text-gray-500 font-medium bg-gray-900 px-3 py-1 rounded-full border border-gray-800">
          {totalVideos.toLocaleString()} Video
        </div>
      </div>

      {/* Filter Panel (Client Component) */}
      <Suspense fallback={<div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-2 h-40 animate-pulse" />}>
        <FilterPanel
          tags={topTags.map(t => t._id)}
          categories={topCategories.map(c => c._id)}
          durationRanges={DURATION_RANGES}
          activeTag={tagFilter}
          activeCategory={categoryFilter}
          activeDuration={durationFilter}
          activeSort={sortBy}
        />
      </Suspense>

      {/* Results */}
      {videos.length > 0 ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-5 mb-12 mt-6">
            {videos.map((vid) => (
              <VideoCard key={vid._id.toString()} video={vid} siteUrl={siteUrl} />
            ))}
          </div>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            basePath="/filter"
            searchParams={resolved}
          />
        </>
      ) : (
        <div className="min-h-[40vh] flex flex-col items-center justify-center text-center bg-gray-900/50 border border-gray-800 rounded-2xl p-10 mt-6">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-xl font-bold text-white mb-2">Tidak Ada Hasil</h3>
          <p className="text-gray-500 mb-6">Coba ubah kombinasi filter di atas.</p>
        </div>
      )}
    </>
  );
}
