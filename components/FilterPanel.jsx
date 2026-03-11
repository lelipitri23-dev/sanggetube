'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';

export default function FilterPanel({
  tags = [],
  categories = [],
  durationRanges = [],
  activeTag = '',
  activeCategory = '',
  activeDuration = '',
  activeSort = 'newest',
}) {
  const router = useRouter();
  const currentParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [tag,      setTag]      = useState(activeTag);
  const [category, setCategory] = useState(activeCategory);
  const [duration, setDuration] = useState(activeDuration);
  const [sort,     setSort]     = useState(activeSort);

  const applyFilter = () => {
    const params = new URLSearchParams();
    if (tag)      params.set('tag',      tag);
    if (category) params.set('category', category);
    if (duration) params.set('duration', duration);
    if (sort && sort !== 'newest') params.set('sort', sort);
    startTransition(() => router.push(`/filter?${params.toString()}`));
  };

  const resetFilter = () => {
    setTag('');
    setCategory('');
    setDuration('');
    setSort('newest');
    startTransition(() => router.push('/filter'));
  };

  const hasFilter = tag || category || duration || sort !== 'newest';

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 md:p-6 mb-2">
      <div className="flex items-center gap-2 mb-5">
        <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
        </svg>
        <span className="text-sm font-bold text-white uppercase tracking-wider">Filter Video</span>
        {hasFilter && (
          <span className="ml-auto text-xs text-purple-400 font-medium bg-purple-900/30 px-2 py-0.5 rounded-full border border-purple-800">
            Filter Aktif
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">

        {/* Sort */}
        <div>
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 block">Urutkan</label>
          <div className="flex gap-2">
            {[
              { value: 'newest',  label: 'Terbaru' },
              { value: 'popular', label: 'Popular' },
            ].map(s => (
              <button
                key={s.value}
                onClick={() => setSort(s.value)}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-all ${
                  sort === s.value
                    ? 'bg-purple-600 border-purple-500 text-white shadow-[0_0_10px_rgba(147,51,234,0.3)]'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-purple-600 hover:text-white'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Durasi */}
        <div>
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 block">Durasi</label>
          <select
            value={duration}
            onChange={e => setDuration(e.target.value)}
            className="w-full bg-gray-800 text-gray-200 text-sm rounded-lg px-3 py-2.5 border border-gray-700 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition"
          >
            {durationRanges.map(d => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>

        {/* Kategori */}
        <div>
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 block">Kategori</label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="w-full bg-gray-800 text-gray-200 text-sm rounded-lg px-3 py-2.5 border border-gray-700 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition"
          >
            <option value="">Semua Kategori</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Tag */}
        <div>
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 block">Tag</label>
          <select
            value={tag}
            onChange={e => setTag(e.target.value)}
            className="w-full bg-gray-800 text-gray-200 text-sm rounded-lg px-3 py-2.5 border border-gray-700 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition"
          >
            <option value="">Semua Tag</option>
            {tags.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Active Tag bubbles */}
      {tags.length > 0 && (
        <div className="mb-5">
          <p className="text-xs text-gray-500 mb-2 uppercase tracking-widest font-semibold">Tag Populer</p>
          <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto pr-1 scrollbar-thin">
            {tags.slice(0, 30).map(t => (
              <button
                key={t}
                onClick={() => setTag(tag === t ? '' : t)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-all font-medium ${
                  tag === t
                    ? 'bg-purple-600 border-purple-500 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-purple-500 hover:text-white'
                }`}
              >
                #{t}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={applyFilter}
          disabled={isPending}
          className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(147,51,234,0.3)] flex items-center justify-center gap-2"
        >
          {isPending ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
          Terapkan Filter
        </button>
        {hasFilter && (
          <button
            onClick={resetFilter}
            className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white text-sm font-medium rounded-xl border border-gray-700 transition"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
