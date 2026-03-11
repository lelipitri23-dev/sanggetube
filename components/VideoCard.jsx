import Link from 'next/link';
import Image from 'next/image';

export default function VideoCard({ video, siteUrl }) {
  let thumb = video.thumbnail || '/uploads/default-poster.jpg';
  if (!thumb.startsWith('http') && siteUrl) {
    thumb = `${siteUrl}/${thumb}`;
  } else if (!thumb.startsWith('http')) {
    thumb = `http://localhost:3000/${thumb}`;
  }

  const views = video.views || 0;
  
  // Format duration manually here
  const formatDuration = (sec) => {
    if (!sec) return "00:00";
    const date = new Date(0);
    date.setSeconds(sec);
    return sec > 3600 ? date.toISOString().substr(11, 8) : date.toISOString().substr(14, 5);
  };
  const duration = formatDuration(video.duration_sec);

  let tagClasses = '';
  if (video.tags && Array.isArray(video.tags)) {
    tagClasses = video.tags.map(t => 'tag-' + t.toLowerCase().trim().replace(/ /g, '-')).join(' ');
  }

  const ratingPercent = Math.floor(Math.random() * (100 - 85 + 1) + 85);
  const uploadDate = video.upload_date ? new Date(video.upload_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : 'Unknown';

  return (
    <article 
      className={`group relative bg-gray-900 rounded-lg overflow-hidden border border-gray-800 hover:border-pink-500/50 hover:shadow-[0_0_15px_rgba(236,72,153,0.15)] transition-all duration-300 ${tagClasses}`}
      data-video-id={video._id?.toString()}
    >
      <Link href={`/video/${video.slug}`} title={video.title} className="block">
        <div className="relative w-full aspect-video overflow-hidden bg-gray-800">
          <img 
            src={thumb} 
            alt={video.title}
            className="w-full h-full object-cover transform group-hover:scale-110 transition duration-700 ease-out"
            loading="lazy"
          />
          
          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-all"></div>

          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="bg-pink-600/90 rounded-full p-2 shadow-lg backdrop-blur-sm">
              <svg className="w-6 h-6 text-white pl-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M4.5 2.69l11.01 7.31L4.5 17.31V2.69z"></path>
              </svg>
            </div>
          </div>

          <div className="absolute bottom-1.5 left-1.5 bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] text-white flex items-center gap-1 border border-white/10">
            <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
            <span>{views.toLocaleString()}</span>
          </div>

          <div className="absolute bottom-1.5 right-1.5 bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] text-white font-mono border border-white/10">
            {duration}
          </div>
        </div>

        <div className="w-full h-1 bg-gray-800 relative">
           <div className="h-full bg-green-500 absolute top-0 left-0" style={{ width: `${ratingPercent}%` }}></div>
        </div>

        <div className="p-3">
          <header>
            <h2 className="font-bold text-sm leading-snug h-10 line-clamp-2 mb-2 text-white">
              {video.title}
            </h2>
          </header>
          
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-800">
            <span className="text-[10px] text-gray-500">
              {uploadDate}
            </span>
            
            <div className="flex items-center gap-1 text-[10px] text-gray-400">
              <svg className="w-3 h-3 text-green-500/80" fill="currentColor" viewBox="0 0 20 20"><path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z"></path></svg>
              <span>{ratingPercent}%</span>
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
}
