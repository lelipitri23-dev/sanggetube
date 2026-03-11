import { NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';
import vm from 'vm';
import CryptoJS from 'crypto-js';

// Server-side cache since decryption is heavy
const streamCache = new Map();

const STREAM18_BASE = 'https://stream18.net';

/**
 * Strategy 1: Direct token extraction from #token div and file.js
 * The stream18.net embed has:
 *   - #token div → this is the `idhls` parameter for the m3u8 playlist
 *   - `s` parameter is a session key derived from file.js
 */
async function extractFromStream18(embedUrl, html, $) {
  // 1. Get the idhls token from #token div
  const tokenEl = $('#token');
  const idhls = tokenEl.text().trim();
  
  if (!idhls) {
    throw new Error('No #token found in stream18 page');
  }

  console.log('[stream18] Found token (idhls):', idhls.substring(0, 20) + '...');

  // 2. Find file.js src
  let fileJsUrl = null;
  $('script').each((i, el) => {
    const src = $(el).attr('src');
    if (src && src.includes('file.js')) {
      fileJsUrl = src.startsWith('http') ? src : `${STREAM18_BASE}/${src.replace(/^\//, '')}`;
    }
  });

  if (!fileJsUrl) {
    // try to guess
    fileJsUrl = `${STREAM18_BASE}/file.js`;
  }

  console.log('[stream18] Fetching file.js from:', fileJsUrl);

  // 3. Fetch file.js to run it in a VM and get the 's' session parameter
  let sParam = null;

  try {
    const { data: fileJsContent } = await axios.get(fileJsUrl, {
      headers: {
        'Referer': embedUrl,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 8000
    });

    // Try to extract the 's' parameter pattern from file.js
    // Look for the hlsplaylist.php URL construction
    const sMatch = fileJsContent.match(/hlsplaylist\.php[^"']*[?&]s=([^&"']+)/);
    if (sMatch) {
      sParam = sMatch[1];
    }

    // If not found by regex, run a VM to capture it
    if (!sParam) {
      let capturedUrl = null;
      const fileVmContext = {
        window: { 
          location: { hostname: 'stream18.net', href: embedUrl, replace: ()=>{} }, 
          attachEvent: null,
          addEventListener: ()=>{}
        },
        document: { 
          getElementById: (id) => {
            if (id === 'token') return { innerHTML: idhls, textContent: idhls, innerText: idhls };
            if (id === 'stream') return { innerHTML: '', textContent: '' };
            return null;
          },
          readyState: 'complete',
          cookie: ''
        },
        $: (sel) => {
          if (sel === '#token') return { html: ()=> idhls, text: ()=> idhls, length: 1 };
          return { html: ()=> '', text: ()=> '', length: 0 };
        },
        jQuery: (sel) => {
          if (sel === '#token') return { html: ()=> idhls, text: ()=> idhls, length: 1 };
          return { html: ()=> '', text: ()=> '', length: 0 };
        },
        CryptoJS: CryptoJS,
        jwplayer: function() {
          return {
            setup: (cfg) => {
              const firstSource = (cfg.playlist?.[0]?.sources || cfg.sources || [])[0];
              if (firstSource?.file) capturedUrl = firstSource.file;
            },
            remove: ()=>{},
            on: ()=>{},
            load: ()=>{}
          };
        },
        XMLHttpRequest: class {
          open(m, url) { this._url = url; }
          setRequestHeader() {}
          send() { this.status = 404; this.responseText = '{}'; if (this.onload) this.onload(); }
        },
        fetch: async () => ({ json: async () => ({}) }),
        setTimeout: (fn) => { try { fn(); } catch(e) {} },
        setInterval: ()=>{},
        clearInterval: ()=>{},
        console: { log: ()=>{}, error: ()=>{}, warn: ()=>{} },
        JSON: JSON,
        btoa: (s) => Buffer.from(s).toString('base64'),
        atob: (s) => Buffer.from(s, 'base64').toString('utf8'),
        encodeURIComponent: encodeURIComponent,
        decodeURIComponent: decodeURIComponent,
        localStorage: { getItem: ()=> null, setItem: ()=>{}, removeItem: ()=>{} },
        navigator: { userAgent: 'Mozilla/5.0' },
        isNaN: isNaN,
        Date: Date,
        Math: Math,
      };
      fileVmContext.self = fileVmContext.window;
      fileVmContext.window.top = fileVmContext.window;
      
      try {
        vm.createContext(fileVmContext);
        vm.runInContext(fileJsContent, fileVmContext, { timeout: 5000 });
        if (capturedUrl) {
          const urlObj = new URL(capturedUrl);
          sParam = urlObj.searchParams.get('s');
        }
      } catch(vmErr) {
        // VM execution failed - continue
        console.warn('[stream18] file.js VM error:', vmErr.message?.substring(0, 100));
      }
    }
  } catch (fetchErr) {
    console.warn('[stream18] file.js fetch error:', fetchErr.message);
  }

  // 4. If still no sParam, try extracting from inline scripts in main page
  if (!sParam) {
    $('script').each((i, el) => {
      const content = $(el).html() || '';
      const match = content.match(/hlsplaylist\.php[^"']*[?&]s=([A-Za-z0-9+/=]+)/);
      if (match) sParam = match[1];
    });
  }

  // 5. Build the final m3u8 URL
  // If no sParam found, we can still try without it (some streams work that way)
  let m3u8Url;
  if (sParam) {
    m3u8Url = `${STREAM18_BASE}/hlsplaylist.php?&s=${encodeURIComponent(sParam)}&idhls=${encodeURIComponent(idhls)}.m3u8`;
  } else {
    // Fallback: try constructing URL with just idhls
    m3u8Url = `${STREAM18_BASE}/hlsplaylist.php?&idhls=${encodeURIComponent(idhls)}.m3u8`;
  }

  console.log('[stream18] Final m3u8 URL:', m3u8Url);

  return [{
    src: m3u8Url,
    type: 'application/x-mpegURL',
    label: 'Auto'
  }];
}

/**
 * Strategy 2: VM execution of the main eval block
 */
async function extractViaVM(evalBlock) {
  let finalData = null;
  
  const context = {
    window: { 
      location: { hostname: 'stream18.net', replace: ()=>{} },
      attachEvent: null,
      addEventListener: ()=>{},
      outerWidth: 1366,
      outerHeight: 768,
      innerWidth: 1366,
      innerHeight: 768
    },
    document: { readyState: 'complete' },
    setTimeout: (fn) => { try { fn(); } catch(e) {} },
    setInterval: ()=>{},
    clearInterval: ()=>{},
    isNaN: isNaN,
    Date: Date,
    Math: Math,
    jwplayer: function() { 
      return { 
        remove: ()=>{},
        setup: function(config){
          if (config) {
            finalData = config;
            throw new Error('PAYLOAD_FOUND');
          }
        },
        on: ()=>{},
        load: ()=>{},
        play: ()=>{}
      }; 
    },
    CryptoJS: CryptoJS,
    console: { log: ()=>{}, error: ()=>{}, warn: ()=>{} }, 
    JSON: JSON,
    btoa: (s) => Buffer.from(s).toString('base64'),
    atob: (s) => Buffer.from(s, 'base64').toString('utf8'),
    encodeURIComponent: encodeURIComponent,
    decodeURIComponent: decodeURIComponent,
    isSandboxed: ()=> false,
    $: (sel) => ({ ready: (cb)=>{ try{cb();}catch(e){} }, tooltip: ()=>{} }),
    jQuery: (sel) => ({ ready: (cb)=>{ try{cb();}catch(e){} }, tooltip: ()=>{} }),
    module: {},
    CustomEvent: function(){},
    navigator: { userAgent: 'Mozilla/5.0' },
    localStorage: { setItem: ()=>{}, getItem: ()=> null, removeItem: ()=>{} }
  };
  
  context.window.top = context.window;
  context.self = context.window;
  vm.createContext(context);

  try {
    vm.runInContext(evalBlock, context, { timeout: 8000 });
  } catch (e) {
    if (e.message !== 'PAYLOAD_FOUND') {
      throw e;
    }
  }

  if (!finalData) return [];
  
  let streams = [];
  const targetArray = finalData.playlist || finalData.sources;
  
  if (Array.isArray(targetArray) && targetArray.length > 0) {
    const sources = targetArray[0].sources || targetArray;
    streams = sources
      .filter(s => s && s.file)
      .map(s => ({ src: s.file, type: s.type || 'application/x-mpegURL', label: s.label || 'Auto' }));
  }

  return streams;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json({ success: false, message: 'URL is required' }, { status: 400 });
  }

  if (streamCache.has(targetUrl)) {
    const cachedData = streamCache.get(targetUrl);
    if (Date.now() < cachedData.expiresAt) {
      return NextResponse.json({ success: true, data: cachedData.data });
    } else {
      streamCache.delete(targetUrl);
    }
  }

  try {
    const { data: html } = await axios.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.google.com/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      timeout: 12000
    });

    const $ = cheerio.load(html);
    let streams = [];

    // --- Strategy 1: stream18.net token-based extraction ---
    if (targetUrl.includes('stream18.net')) {
      try {
        streams = await extractFromStream18(targetUrl, html, $);
      } catch(e) {
        console.warn('[proxy] stream18 Strategy 1 failed:', e.message);
      }
    }

    // --- Strategy 2: eval/packed JS VM extraction ---
    if (streams.length === 0) {
      let evalBlock = null;
      $('script').each((i, el) => {
        const content = $(el).html();
        if (content && content.includes('eval(function(p,a,c,k,e,')) {
          evalBlock = content;
        }
      });

      if (evalBlock) {
        try {
          streams = await extractViaVM(evalBlock);
        } catch(e) {
          console.warn('[proxy] VM Strategy 2 failed:', e.message);
        }
      }
    }

    // --- Strategy 3: Direct regex scan for HLS URLs ---
    if (streams.length === 0) {
      const hlsMatch = html.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/g);
      if (hlsMatch) {
        streams = [...new Set(hlsMatch)].map(url => ({
          src: url,
          type: 'application/x-mpegURL',
          label: 'Auto'
        }));
      }
    }

    if (streams.length > 0) {
      const resultPayload = { streams, tracks: [], originalUrl: targetUrl };
      
      streamCache.set(targetUrl, {
        data: resultPayload,
        expiresAt: Date.now() + 2 * 60 * 60 * 1000
      });

      return NextResponse.json({ success: true, data: resultPayload });
    } else {
      return NextResponse.json({ 
        success: false, 
        message: 'Could not extract stream from any strategy',
        debug: { hasToken: !!$('#token').text().trim() }
      }, { status: 500 });
    }

  } catch (err) {
    console.error('[proxy] Exception:', err.message);
    return NextResponse.json({ success: false, message: 'Proxy Exception: ' + err.message }, { status: 500 });
  }
}
