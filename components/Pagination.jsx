import Link from 'next/link';

export default function Pagination({ currentPage, totalPages, basePath = '', searchParams = {} }) {
  if (totalPages <= 1) return null;

  const createPageUrl = (page) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', page);
    return `${basePath}?${params.toString()}`;
  };

  return (
    <div className="flex justify-center items-center gap-2 mt-8 mb-12">
      {currentPage > 1 && (
        <Link 
          href={createPageUrl(currentPage - 1)} 
          className="px-4 py-2 bg-gray-800 hover:bg-pink-600 text-white rounded text-sm transition font-medium"
        >
          Prev
        </Link>
      )}
      
      <span className="px-4 py-2 bg-gray-900 text-pink-500 border border-gray-800 rounded text-sm font-bold">
        {currentPage}
      </span>

      {currentPage < totalPages && (
        <Link 
          href={createPageUrl(currentPage + 1)} 
          className="px-4 py-2 bg-gray-800 hover:bg-pink-600 text-white rounded text-sm transition font-medium"
        >
          Next
        </Link>
      )}
    </div>
  );
}
