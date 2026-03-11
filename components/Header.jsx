'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Header({ siteName, logoUrl, q }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  return (
    <header>
      <nav className="bg-black backdrop-blur-sm border-b border-gray-800 shadow-lg sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 group">
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt={`${siteName} Logo`}
                  className="w-8 h-8 rounded object-cover transform group-hover:rotate-12 transition bg-black"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              )}
              <span className="text-xl font-bold text-white tracking-tight hidden sm:inline">
                {siteName || 'KingBokep'}
              </span>
              <span className="text-xl font-bold text-white tracking-tight sm:hidden">
                {siteName || 'KingBokep'}
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-4 ml-6">
              <Link href="/" className="text-gray-300 hover:text-pink-500 transition font-medium px-3 py-1 rounded-lg hover:bg-black">Beranda</Link>
              <Link href="/category/bokep-terbaru" className="text-gray-300 hover:text-pink-500 transition font-medium px-3 py-1 rounded-lg hover:bg-black">Terbaru</Link>
              <Link href="/category/bokep-bocil" className="text-gray-300 hover:text-pink-500 transition font-medium px-3 py-1 rounded-lg hover:bg-black">Bocil</Link>
              <Link href="/tag/avtub" className="text-gray-300 hover:text-pink-500 transition font-medium px-3 py-1 rounded-lg hover:bg-black">AVTub</Link>
              <Link href="/category/bokep-viral" className="text-gray-300 hover:text-pink-500 transition font-medium px-3 py-1 rounded-lg hover:bg-black">Viral</Link>
            </div>
          </div>

          <div className="hidden md:flex flex-grow max-w-lg mx-6">
            <form action="/search" method="GET" className="flex w-full">
              <div className="relative w-full">
                <input
                  type="text"
                  name="q"
                  placeholder="Cari video..."
                  defaultValue={q || ''}
                  className="w-full bg-black text-gray-200 text-sm rounded-l-lg pl-4 pr-4 py-2.5 border border-gray-700 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-all placeholder-gray-500"
                />
              </div>
              <button type="submit" className="bg-pink-600 hover:bg-pink-700 text-white px-5 py-2.5 rounded-r-lg text-sm font-medium transition-colors flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
                <span className="hidden lg:inline">Cari</span>
              </button>
            </form>
          </div>

          <div className="flex items-center gap-3 md:hidden">
            <button aria-label="Search" onClick={() => { setIsSearchOpen(!isSearchOpen); setIsMenuOpen(false); }} className="p-2 rounded-lg text-gray-300 hover:bg-black transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
            </button>
            <button aria-label="Open Menu" onClick={() => { setIsMenuOpen(!isMenuOpen); setIsSearchOpen(false); }} className="p-2 rounded-lg text-gray-300 hover:bg-black transition">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
              </svg>
            </button>
          </div>
        </div>

        {isSearchOpen && (
          <div className="md:hidden container mx-auto px-4 pb-3 animate-slideDown">
            <form action="/search" method="GET" className="flex w-full">
              <div className="relative w-full">
                <input
                  type="text"
                  name="q"
                  placeholder="Cari video..."
                  defaultValue={q || ''}
                  className="w-full bg-black text-gray-200 text-sm rounded-l-lg pl-4 pr-4 py-2.5 border border-gray-700 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-all placeholder-gray-500"
                  autoFocus
                />
              </div>
              <button type="submit" className="bg-pink-600 hover:bg-pink-700 text-white px-4 py-2.5 rounded-r-lg text-sm font-medium transition-colors flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
              </button>
            </form>
          </div>
        )}
      </nav>

      {isMenuOpen && (
        <div className="md:hidden bg-black border-b border-gray-700 shadow-lg animate-slideDown">
          <div className="container mx-auto px-4 py-4">
            <div className="flex flex-col space-y-3">
              <Link href="/" className="text-gray-300 hover:text-pink-500 transition font-medium px-3 py-2 rounded-lg hover:bg-gray-700 flex items-center gap-2">Beranda</Link>
              <Link href="/category/bokep-terbaru" className="text-gray-300 hover:text-pink-500 transition font-medium px-3 py-2 rounded-lg hover:bg-gray-700 flex items-center gap-2">Terbaru</Link>
              <Link href="/tag/avtub" className="text-gray-300 hover:text-pink-500 transition font-medium px-3 py-2 rounded-lg hover:bg-gray-700 flex items-center gap-2">AVTub</Link>
              <Link href="/tag/sebokep" className="text-gray-300 hover:text-pink-500 transition font-medium px-3 py-2 rounded-lg hover:bg-gray-700 flex items-center gap-2">SeBokep</Link>
              <Link href="/category/bokep-viral" className="text-gray-300 hover:text-pink-500 transition font-medium px-3 py-2 rounded-lg hover:bg-gray-700 flex items-center gap-2">Viral</Link>
              <Link href="/category/bokep-indo" className="text-gray-300 hover:text-pink-500 transition font-medium px-3 py-2 rounded-lg hover:bg-gray-700 flex items-center gap-2">Bokep Indo</Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
