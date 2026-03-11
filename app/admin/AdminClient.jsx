'use client';

import { useState, useRef, useEffect } from 'react';

export default function AdminClient() {
  const [urls, setUrls] = useState('');
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState([{ type: 'info', text: 'Menunggu input...' }]);
  const [isScraping, setIsScraping] = useState(false);
  const logContainerRef = useRef(null);
  
  // Video Management State
  const [videos, setVideos] = useState([]);
  const [isLoadingVideos, setIsLoadingVideos] = useState(true);
  const [editingVideo, setEditingVideo] = useState(null);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const videosPerPage = 20;

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    fetchVideos(currentPage);
  }, [currentPage]);

  const fetchVideos = async (page = 1) => {
    setIsLoadingVideos(true);
    try {
      const res = await fetch(`/api/videos?limit=${videosPerPage}&page=${page}`);
      const data = await res.json();
      if (data.success) {
        setVideos(data.data);
        setCurrentPage(data.page);
        setTotalPages(data.totalPages);
      }
    } catch (err) {
      console.error('Failed to fetch videos', err);
    }
    setIsLoadingVideos(false);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
       setCurrentPage(prev => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
       setCurrentPage(prev => prev - 1);
    }
  };

  const handleDelete = async (id, title) => {
    if (!confirm(`Hapus video "${title}"?`)) return;
    
    try {
      const res = await fetch(`/api/admin/videos/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchVideos(currentPage); // Refresh current page automatically
      } else {
        alert(data.message || 'Gagal menghapus');
      }
    } catch (err) {
      alert('Error saat menghapus');
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingVideo) return;
    
    try {
      const res = await fetch(`/api/admin/videos/${editingVideo._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingVideo)
      });
      const data = await res.json();
      
      if (data.success) {
        setVideos(videos.map(v => v._id === editingVideo._id ? data.data : v));
        setEditingVideo(null); // Close modal
      } else {
        alert(data.message || 'Gagal update');
      }
    } catch (err) {
      alert('Error saat update');
    }
  };

  const addLog = (type, text) => {
    setLogs(prev => [...prev, { type, text }]);
  };

  const clearLogs = () => {
    setLogs([{ type: 'info', text: 'Menunggu input...' }]);
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    } else {
      setFile(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isScraping) return;

    let finalUrls = urls.split('\n').map(u => u.trim()).filter(Boolean);

    if (file) {
      const text = await file.text();
      const fileUrls = text.split('\n').map(u => u.trim()).filter(Boolean);
      finalUrls = [...new Set([...finalUrls, ...fileUrls])];
    }

    if (finalUrls.length === 0) {
      alert('Masukkan URL!');
      return;
    }

    startBatchProcess(finalUrls);
  };

  const startBatchProcess = async (urlsToProcess) => {
    setIsScraping(true);
    clearLogs();
    addLog('info', `Memulai scraping ${urlsToProcess.length} URL...`);
    
    let done = 0;
    let success = 0;
    let failed = 0;

    for (const url of urlsToProcess) {
      const currentIndex = done + 1;
      addLog('loading', `[${currentIndex}/${urlsToProcess.length}] Scrape: ${url.substring(0, 50)}...`);

      try {
        const response = await fetch('/api/scrape', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });
        
        const result = await response.text();
        
        if (result.includes('✅')) {
            success++;
            addLog('success', result);
        } else {
            failed++;
            addLog('error', result);
        }
      } catch (err) {
        failed++;
        addLog('error', `❌ Error: ${err.message}`);
      }

      done++;
      setProgress(Math.round((done / urlsToProcess.length) * 100));
      
      // Delay 500ms between requests
      await new Promise(r => setTimeout(r, 500));
    }

    addLog('complete', `🏁 SELESAI! (Berhasil: ${success}, Gagal: ${failed})`);
    setIsScraping(false);
    
    // Refresh video list after scraping
    fetchVideos(currentPage);
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-gray-700 text-sm font-bold mb-2">List URL (Satu per baris):</label>
          <textarea 
            rows="5" 
            className="w-full py-2 px-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" 
            placeholder="https://example.com/video1..."
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            disabled={isScraping}
          />
        </div>
        
        <div className="border-t pt-6">
          <label className="block text-gray-700 text-sm font-bold mb-2">Upload File .txt:</label>
          <input 
            type="file" 
            accept=".txt" 
            onChange={handleFileChange}
            disabled={isScraping}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 border border-gray-300 rounded-md p-2"
          />
        </div>
        
        <button 
          type="submit" 
          disabled={isScraping}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-3 px-6 rounded-lg transition flex items-center justify-center gap-2"
        >
          <span>🚀</span> {isScraping ? 'Mencari...' : 'Mulai Scrape'}
        </button>
      </form>

      <div className="mt-8 border-t pt-6">
        <h3 className="text-xl font-bold mb-4">Worker Progress</h3>
        <div className="mb-2 flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">
            Progress: <span>{progress}%</span>
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden relative">
          <div 
            className="bg-green-600 h-full transition-all duration-300 absolute left-0 top-0" 
            style={{ width: `${progress}%` }}
          />
        </div>
        
        <div className="mt-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Log Proses</span>
            <button 
                type="button" 
                onClick={clearLogs} 
                className="text-xs bg-gray-200 py-1 px-3 rounded hover:bg-gray-300 transition"
            >
              Clear
            </button>
          </div>
          <div 
            ref={logContainerRef}
            className="bg-gray-900 font-mono text-xs p-4 rounded-lg h-64 overflow-y-auto border border-gray-700 space-y-1"
          >
            {logs.map((log, index) => (
              <div 
                key={index}
                className={`
                  ${log.type === 'info' ? 'text-blue-400' : ''}
                  ${log.type === 'loading' ? 'text-gray-500' : ''}
                  ${log.type === 'success' ? 'text-green-400 border-b border-gray-800 py-1' : ''}
                  ${log.type === 'error' ? 'text-red-500 border-b border-gray-800 py-1' : ''}
                  ${log.type === 'complete' ? 'text-white font-bold mt-4' : ''}
                `}
              >
                {log.text}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Video Management Section */}
      <div className="mt-12 border-t pt-8">
         <div className="flex justify-between items-center mb-6">
             <h3 className="text-xl font-bold">Kelola Video</h3>
             <div className="flex items-center gap-4">
                 <button onClick={() => fetchVideos(currentPage)} className="bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded text-sm transition">Refresh</button>
             </div>
         </div>
         
         {isLoadingVideos ? (
             <p className="text-gray-500 text-center py-8">Memuat video...</p>
         ) : (
             <>
                 <div className="overflow-x-auto">
                     <table className="min-w-full bg-white border border-gray-200 shadow-sm rounded-lg overflow-hidden">
                         <thead className="bg-gray-50 border-b">
                             <tr>
                                 <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Thumbnail</th>
                                 <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Judul</th>
                                 <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tgl Scrape</th>
                                 <th className="py-3 px-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                             </tr>
                         </thead>
                         <tbody className="divide-y divide-gray-200">
                            {videos.map(video => (
                                <tr key={video._id} className="hover:bg-gray-50">
                                    <td className="py-2 px-4">
                                        <img src={video.thumbnail} alt="thumb" className="h-12 w-20 object-cover rounded bg-gray-200" />
                                    </td>
                                    <td className="py-2 px-4">
                                        <div className="text-sm font-medium text-gray-900 truncate max-w-xs" title={video.title}>{video.title}</div>
                                        <div className="text-xs text-blue-500 truncate max-w-xs">{video.slug}</div>
                                    </td>
                                    <td className="py-2 px-4 text-sm text-gray-500">
                                        {new Date(video.created_at).toLocaleDateString('id-ID')}
                                    </td>
                                    <td className="py-2 px-4 text-right space-x-2">
                                        <button 
                                            onClick={() => setEditingVideo(video)}
                                            className="text-blue-600 hover:text-blue-900 text-sm bg-blue-50 px-2 py-1 rounded border border-blue-100"
                                        >
                                            Edit
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(video._id, video.title)}
                                            className="text-red-600 hover:text-red-900 text-sm bg-red-50 px-2 py-1 rounded border border-red-100"
                                        >
                                            Hapus
                                        </button>
                                    </td>
                                </tr>
                            ))}
                         </tbody>
                     </table>
                 </div>

                 {/* Pagination Controls */}
                 <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                     <span className="text-sm text-gray-600 font-medium bg-gray-100 px-3 py-1 rounded-full">
                         Halaman {currentPage} dari {totalPages}
                     </span>
                     <div className="flex gap-2">
                         <button 
                            onClick={handlePrevPage}
                            disabled={currentPage === 1}
                            className="px-4 py-2 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition font-medium text-sm text-gray-700"
                         >
                             &larr; Prev
                         </button>
                         <button 
                            onClick={handleNextPage}
                            disabled={currentPage === totalPages}
                            className="px-4 py-2 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition font-medium text-sm text-gray-700"
                         >
                             Next &rarr;
                         </button>
                     </div>
                 </div>
             </>
         )}
      </div>

      {/* Edit Modal */}
      {editingVideo && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                  <h3 className="text-xl font-bold mb-4 border-b pb-2">Edit Video</h3>
                  <form onSubmit={handleEditSubmit} className="space-y-4">
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Judul</label>
                          <input type="text" className="w-full border rounded px-3 py-2" 
                              value={editingVideo.title || ''} 
                              onChange={e => setEditingVideo({...editingVideo, title: e.target.value})} required/>
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                          <input type="text" className="w-full border rounded px-3 py-2 text-gray-500 bg-gray-50" 
                              value={editingVideo.slug || ''} 
                              onChange={e => setEditingVideo({...editingVideo, slug: e.target.value})} required/>
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Iframe URL</label>
                          <input type="text" className="w-full border rounded px-3 py-2" 
                              value={editingVideo.embed_url || ''} 
                              onChange={e => setEditingVideo({...editingVideo, embed_url: e.target.value})}/>
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Thumbnail URL</label>
                          <input type="text" className="w-full border rounded px-3 py-2" 
                              value={editingVideo.thumbnail || ''} 
                              onChange={e => setEditingVideo({...editingVideo, thumbnail: e.target.value})}/>
                      </div>
                      
                      <div className="flex justify-end gap-3 pt-4 border-t">
                          <button type="button" onClick={() => setEditingVideo(null)} className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-50 transition">
                              Batal
                          </button>
                          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition font-medium">
                              Simpan Perubahan
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </>
  );
}
