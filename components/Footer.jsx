import Link from 'next/link';

const popularTags = [
  'AVTub', 'SeBokep', 'SangeTube', 'RumahBokep', 'PureBokep',
  'NoBokep', 'NgenTub', 'LingBokep', 'Indo18', 'BroBokep',
  'BokepSin', 'BokepKing',
];

const categories = [
  'Bokep Terbaru', 'Bokep Indo', 'Bokep Tiktok',
  'Bokep Viral', 'Bokep SMP', 'Bokep Jilbab',
  'Bokep Hijab', 'Bokep Bocil', 'Bokep SMA',
  'Bokep Guru', 'Bokep Ngintip', 'Bokep Thailand',
];

const quickLinks = [
  { label: 'Beranda', href: '/' },
  { label: 'Terbaru', href: '/terbaru' },
  { label: 'Terpopuler', href: '/popular' },
  { label: 'Filter', href: '/filter' },
];

export default function Footer({ siteName = 'KingBokep' }) {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-gray-950 text-gray-400 border-t border-gray-800 mt-auto">

      {/* Top Section */}
      <div className="container mx-auto px-4 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">

          {/* Brand + Quick Links */}
          <div className="flex flex-col gap-4">
            <div>
              <span className="text-white font-bold text-xl tracking-tight">
                {siteName}
              </span>
              <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                Nonton video bokep terbaru setiap hari. Update cepat, kualitas terbaik.
              </p>
            </div>
            <div>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest block mb-2">
                Menu
              </span>
              <ul className="flex flex-col gap-1.5">
                {quickLinks.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-400 hover:text-pink-500 transition-colors flex items-center gap-1.5"
                    >
                      <span className="text-pink-600">›</span>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Categories */}
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest block mb-3">
              Kategori
            </span>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {categories.map((cat) => (
                <li key={cat}>
                  <Link
                    href={`/category/${cat.toLowerCase().replace(/\s+/g, '-')}`}
                    className="text-sm text-gray-400 hover:text-pink-500 transition-colors flex items-center gap-1.5 truncate"
                  >
                    <span className="text-pink-600 flex-shrink-0">›</span>
                    {cat}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Popular Tags */}
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest block mb-3">
              Tag Populer
            </span>
            <div className="flex flex-wrap gap-2">
              {popularTags.map((tag) => (
                <Link
                  key={tag}
                  href={`/tag/${tag.toLowerCase().replace(/\s+/g, '-')}`}
                  className="text-xs bg-gray-900 border border-gray-700 hover:border-pink-500 hover:text-pink-400 text-gray-400 px-2.5 py-1 rounded-md transition-colors"
                >
                  {tag}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-gray-800">
        <div className="container mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-500 text-center sm:text-left">
            &copy; {year}{' '}
            <span className="text-gray-300 font-medium">{siteName}</span>
            . All rights reserved.
          </p>
          <p className="text-xs text-gray-600 text-center sm:text-right max-w-sm">
            Disclaimer: Site ini tidak menyimpan file apapun. Konten disediakan oleh pihak ketiga.
          </p>
        </div>
      </div>
    </footer>
  );
}
