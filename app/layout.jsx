import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = {
  metadataBase: new URL(process.env.SITE_URL || 'http://localhost:3000'),
  title: 'KingBokep - Streaming Video Bokep Terbaru',
  description: 'Nonton Bokep Terbaru 2025. KingBokep adalah situs Bokep, Bokep Indo, Bokep Jepang, bokep bocil, bokep viral terlengkap dan terupdate.',
  robots: 'index, follow',
  openGraph: {
    type: 'website',
    title: 'KingBokep - Streaming Video Bokep Terbaru',
    description: 'Nonton Bokep Terbaru 2025. KingBokep adalah situs Bokep...',
    images: [{ url: '/uploads/default-poster.jpg' }],
  },
  twitter: {
    card: 'summary_large_image',
  }
};

export default function RootLayout({ children }) {
  const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
  const siteName = process.env.SITE_NAME || 'BokepTube';
  const logoUrl = `${siteUrl}/uploads/logo.png`;

  return (
    <html lang="en-US">
      <body className="bg-black text-gray-200 font-sans min-h-screen flex flex-col selection:bg-pink-500 selection:text-white">
        <Header siteName={siteName} logoUrl={logoUrl} q="" />
        
        <main className="flex-grow container mx-auto px-4 py-6">
          {children}
        </main>
        
        <Footer siteName={siteName} />

        {/* Analytics Script equivalent */}
        <script type="text/javascript" dangerouslySetInnerHTML={{
          __html: `
            var _Hasync= _Hasync|| [];
            _Hasync.push(['Histats.start', '1,5007710,4,0,0,0,00010000']);
            _Hasync.push(['Histats.fasi', '1']);
            _Hasync.push(['Histats.track_hits', '']);
            (function() {
            var hs = document.createElement('script'); hs.type = 'text/javascript'; hs.async = true;
            hs.src = ('//s10.histats.com/js15_as.js');
            (document.getElementsByTagName('head')[0] || document.getElementsByTagName('body')[0]).appendChild(hs);
            })();
          `
        }} />
      </body>
    </html>
  );
}
