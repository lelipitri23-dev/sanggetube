export const runtime = 'nodejs';

import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import dbConnect from '@/lib/db';
import Video from '@/models/Video';
import VideoPlayer from '@/components/VideoPlayer';

// Cache page for 1 hour (3600 seconds)
export const revalidate = 3600;

const formatDuration = (sec) => {
  if (!sec) return "00:00";
  const date = new Date(0);
  date.setSeconds(sec);
  return sec > 3600 ? date.toISOString().substr(11, 8) : date.toISOString().substr(14, 5);
};

export async function generateMetadata({ params }) {
  const { slug } = await params;
  await dbConnect();
  
  const video = await Video.findOne({ slug }).lean();
  if (!video) return {};

  const siteName = process.env.SITE_NAME || "BokepTube";
  const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
  
  const metaImage = video.thumbnail?.startsWith('http') 
    ? video.thumbnail 
    : `${siteUrl}/${video.thumbnail || 'uploads/default-poster.jpg'}`;

  const durationText = video.duration_sec ? `${video.duration_sec} detik` : '60 detik';
  const categoriesText = video.categories && video.categories.length > 0 ? video.categories.join(', ') : 'bokep terbaru';
  const seoDescription = `Bokep Indo ${video.title} dengan durasi ${durationText}. Nonton videonya hanya disini secara gratis tanpa iklan. ${siteName} menyediakan koleksi video ${categoriesText}. Update setiap hari.`;

  return {
    title: `${video.title} - ${siteName}`,
    description: seoDescription,
    alternates: {
      canonical: `${siteUrl}/video/${video.slug}`
    },
    openGraph: {
      title: `${video.title} - ${siteName}`,
      description: seoDescription,
      url: `${siteUrl}/video/${video.slug}`,
      siteName: siteName,
      images: [
        {
          url: metaImage,
          width: 854,
          height: 480,
        }
      ],
      type: 'video.other',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${video.title} - ${siteName}`,
      description: seoDescription,
      images: [metaImage],
    }
  };
}

export default async function SingleVideo({ params }) {
  const { slug } = await params;
  await dbConnect();
  
  // 1. Update views
  await Video.updateOne({ slug }, { $inc: { views: 1 } }).exec();

  // 2. Fetch video
  const video = await Video.findOne({ slug }).lean();
  if (!video) {
    notFound();
  }

  // 3. Fetch related
  const categories = Array.isArray(video.categories) ? video.categories.filter(Boolean) : [];
  const tags = Array.isArray(video.tags) ? video.tags.filter(Boolean) : [];
  const recommendationQuery = { _id: { $ne: video._id } };

  if (categories.length > 0 || tags.length > 0) {
    recommendationQuery.$or = [];
    if (categories.length > 0) recommendationQuery.$or.push({ categories: { $in: categories } });
    if (tags.length > 0) recommendationQuery.$or.push({ tags: { $in: tags } });
  }

  let related = await Video.aggregate([
    { $match: recommendationQuery },
    { $sample: { size: 8 } },
    { $project: { title: 1, slug: 1, thumbnail: 1, duration_sec: 1, views: 1, upload_date: 1 } }
  ]);

  if (related.length < 8) {
    const excludedIds = [video._id, ...related.map(item => item._id)];
    const fallback = await Video.aggregate([
      { $match: { _id: { $nin: excludedIds } } },
      { $sample: { size: 8 - related.length } },
      { $project: { title: 1, slug: 1, thumbnail: 1, duration_sec: 1, views: 1, upload_date: 1 } }
    ]);
    related = related.concat(fallback);
  }

  const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
  const siteName = process.env.SITE_NAME || "BokepTube";
  const embedUrlFull = `https:${video.embed_url}`;
  
  const posterOriginal = video.thumbnail?.startsWith('http') 
    ? video.thumbnail 
    : `${siteUrl}/${video.thumbnail || 'uploads/default-poster.jpg'}`;

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-8 pb-12">
        <div className="w-full lg:w-[70%]">
          <nav className="flex text-sm text-gray-400 mb-4" aria-label="Breadcrumb">
            <ol className="inline-flex items-center space-x-1 md:space-x-2">
              <li className="inline-flex items-center">
                <Link href="/" className="hover:text-pink-500 transition-colors">Home</Link>
              </li>
              <li>
                <span className="text-gray-600 mx-2">/</span>
              </li>
              <li className="truncate max-w-[200px] md:max-w-md text-gray-200">
                <span className="text-gray-500">Video</span>
                <span className="text-gray-600 mx-2">/</span>
                {video.title}
              </li>
            </ol>
          </nav>

          <div dangerouslySetInnerHTML={{__html: `<!-- START NATIVE PLAYER -->`}} />
          <VideoPlayer embedUrl={embedUrlFull} title={video.title} poster={posterOriginal} />

          <div className="mt-6 border-b border-gray-800 pb-6">
            <h1 className="text-xl md:text-2xl lg:text-3xl font-black text-white leading-tight mb-4 tracking-tight">
              {video.title}
            </h1>

            <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-gray-400">
              <div className="flex items-center gap-1.5 bg-gray-900 border border-gray-700 px-3 py-1.5 rounded-full">
                <svg className="w-4 h-4 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <span>{(video.views || 0).toLocaleString()} x Ditonton</span>
              </div>

              <div className="flex items-center gap-1.5 bg-gray-900 border border-gray-700 px-3 py-1.5 rounded-full">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>{new Date(video.upload_date).toLocaleDateString('id-ID', {
                  day: 'numeric', month: 'long', year: 'numeric'
                })}</span>
              </div>

              <div className="flex items-center gap-1.5 bg-gray-900 border border-gray-700 px-3 py-1.5 rounded-full">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{formatDuration(video.duration_sec)}</span>
              </div>
            </div>
          </div>

          {video.categories && video.categories.length > 0 && (
            <div className="mb-4 mt-6">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Kategori:</h3>
              <div className="flex flex-wrap gap-2">
                {Array.from(new Set(video.categories)).map(cat => (
                  <Link 
                    key={cat} 
                    href={`/category/${cat.toLowerCase().trim().replace(/ /g, '-')}`}
                    className="group bg-blue-900/20 hover:bg-blue-600 text-blue-300 hover:text-white text-xs font-medium px-3 py-1.5 rounded-full transition-all border border-blue-900 hover:border-blue-500 flex items-center gap-1"
                  >
                    <span>📂</span> {cat}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {video.tags && video.tags.length > 0 && (
            <div className="mb-6 mt-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Tags:</h3>
              <div className="flex flex-wrap gap-2">
                {Array.from(new Set(video.tags)).map(tag => (
                  <Link 
                    key={tag} 
                    href={`/tag/${tag.toLowerCase().trim().replace(/ /g, '-')}`}
                    className="group hover:bg-pink-600 text-gray-300 hover:text-white text-xs font-medium px-3 py-1.5 rounded-full transition-all border border-gray-700 hover:border-pink-500"
                  >
                    <span className="text-pink-500 group-hover:text-white mr-1">#</span>{tag}
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 bg-gray-900/50 border border-gray-800 p-4 rounded-xl">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-pink-500 rounded-full"></span> Deskripsi Video
            </h3>
            <div className="text-gray-300 leading-snug text-sm whitespace-pre-wrap">
              {video.description || ''}
            </div>
          </div>

          <div className="mt-6 bg-gray-900/30 border border-gray-800 p-4 rounded-xl">
            <p className="text-gray-400 text-sm leading-relaxed">
              Nonton video <strong>{video.title}</strong> dengan durasi {formatDuration(video.duration_sec)}.
              {video.categories && video.categories.length > 0 && (
                <> Video ini termasuk dalam kategori: {video.categories.join(', ')}.</>
              )}
              Streaming video bokep terbaru dan terlengkap hanya di {siteName}.
            </p>
          </div>
        </div>

        <aside className="w-full lg:w-[30%]">
          <div className="lg:sticky lg:top-24 space-y-6">
            <div className="bg-gray-900/50 border border-gray-800 p-4 rounded-xl">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-pink-500">Video</span> Serupa
              </h3>

              <div className="space-y-3">
                {related.map(rel => {
                  let thumb = rel.thumbnail || '/uploads/default-poster.jpg';
                  if (!thumb.startsWith('http') && siteUrl) thumb = `${siteUrl}/${thumb}`;

                  return (
                    <Link 
                      key={rel._id.toString()} 
                      href={`/video/${rel.slug}`} 
                      className="flex gap-3 group bg-gray-900/30 hover:bg-gray-800 p-2 rounded-xl transition-all border border-transparent hover:border-gray-700"
                    >
                      <div className="relative w-32 h-[4.5rem] flex-shrink-0 overflow-hidden rounded-lg bg-gray-800">
                        <img 
                          src={thumb} 
                          className="w-full h-full object-cover group-hover:scale-110 transition duration-500" 
                          alt={rel.title} 
                          loading="lazy" 
                        />
                        <div className="absolute bottom-1 right-1 bg-black/80 backdrop-blur-sm text-[9px] font-bold px-1.5 py-0.5 rounded text-white border border-white/10">
                          {formatDuration(rel.duration_sec)}
                        </div>
                      </div>

                      <div className="flex flex-col justify-center min-w-0">
                        <h4 className="text-xs font-bold text-gray-200 group-hover:text-pink-400 line-clamp-2 leading-snug mb-1">
                          {rel.title}
                        </h4>
                        <div className="flex items-center gap-2 text-[10px] text-gray-500">
                          <span>{new Date(rel.upload_date).toLocaleDateString('id-ID', {
                            day: 'numeric', month: 'short'
                          })}</span>
                          <span className="text-gray-600">•</span>
                          <span>{(rel.views || 0).toLocaleString()} views</span>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>
        </aside>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "VideoObject",
            "name": video.title,
            "description": video.description ? video.description : 'Nonton video ' + video.title,
            "thumbnailUrl": video.thumbnail?.startsWith('http') ? video.thumbnail : `${siteUrl}/${video.thumbnail}`,
            "uploadDate": new Date(video.upload_date).toISOString(),
            "duration": video.duration,
            "contentUrl": `${siteUrl}/video/${video.slug}`,
            "embedUrl": embedUrlFull,
            "interactionStatistic": {
              "@type": "InteractionCounter",
              "interactionType": "https://schema.org/WatchAction",
              "userInteractionCount": video.views || 0
            },
            "author": {
              "@type": "Organization",
              "name": siteName
            }
          })
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              {
                "@type": "ListItem",
                "position": 1,
                "name": "Home",
                "item": siteUrl
              },
              {
                "@type": "ListItem",
                "position": 2,
                "name": video.title,
                "item": `${siteUrl}/video/${video.slug}`
              }
            ]
          })
        }}
      />
    </>
  );
}
