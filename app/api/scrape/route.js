export const runtime = 'nodejs';

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Video from '@/models/Video';
import axios from 'axios';
import * as cheerio from 'cheerio';
import slugify from 'slugify';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

// Helper to download and save thumbnail to Cloudflare R2
async function uploadFromUrl(url, slug) {
  if (!url) return '';
  try {
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
        'Referer': url // Needed for some CDN restrictions
      },
      timeout: 10000
    });

    const extension = url.split('.').pop().split('?')[0] || 'jpg';
    const filename = `thumbnails/${slug}-${Date.now()}.${extension}`;
    
    let contentType = 'image/jpeg';
    if (extension === 'png') contentType = 'image/png';
    else if (extension === 'gif') contentType = 'image/gif';
    else if (extension === 'webp') contentType = 'image/webp';

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: filename,
      Body: response.data,
      ContentType: contentType,
    });

    await s3Client.send(command);

    return `${R2_PUBLIC_URL}/${filename}`;
  } catch (error) {
    console.error(`Thumbnail upload error for ${url}:`, error.message);
    // Return original URL if failed to download
    return url;
  }
}

// Convert ISO 8601 duration to seconds
// Supports: PT1H2M30S and P0DT0H12M36S formats
function isoToSeconds(isoDuration) {
  if (!isoDuration) return 0;
  // Full ISO 8601: P[n]DT[n]H[n]M[n]S
  const fullRegex = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)(?:\.\d+)?S)?/;
  const match = isoDuration.match(fullRegex);
  if (!match) return 0;

  const days    = parseInt(match[1]) || 0;
  const hours   = parseInt(match[2]) || 0;
  const minutes = parseInt(match[3]) || 0;
  const seconds = parseInt(match[4]) || 0;

  return days * 86400 + hours * 3600 + minutes * 60 + seconds;
}


export async function POST(req) {
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session');

  // Verify authentication
  if (!session || session.value !== 'authenticated') {
    return new NextResponse('❌ Unauthorized', { status: 401 });
  }

  try {
    const { url } = await req.json();
    if (!url) return new NextResponse('❌ URL kosong!', { status: 400 });

    await dbConnect();

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
      }, 
      timeout: 20000
    });

    const $ = cheerio.load(response.data);
    
    // Check for Cloudflare block
    if ($('title').text().includes('Just a moment...')) {
      return new NextResponse('❌ Cloudflare Blocked');
    }

    const title = $('meta[itemprop="name"]').attr('content') || $('title').text();
    if (!title) return new NextResponse('❌ Judul Missing');

    const cleanTitle = title.trim();
    
    // Check for duplicates
    const existing = await Video.findOne({ title: cleanTitle });
    if (existing) {
      return new NextResponse(`⚠️ Duplicate: ${cleanTitle.substring(0, 20)}...`);
    }

    const rawDuration = $('meta[itemprop="duration"]').attr('content') || 'PT0S';
    const durationSec = isoToSeconds(rawDuration);

    const rawThumbnail = $('meta[itemprop="thumbnailUrl"]').attr('content');
    const slug = slugify(cleanTitle, { lower: true, strict: true });
    
    // Try to download thumbnail locally
    const thumbUrl = await uploadFromUrl(rawThumbnail, slug);

    const newVideo = new Video({
      title: cleanTitle,
      slug,
      description: $('meta[itemprop="description"]').attr('content') || '',
      embed_url: $('meta[itemprop="embedURL"]').attr('content') || '',
      thumbnail: thumbUrl, 
      duration: rawDuration, 
      duration_sec: durationSec,
      tags: $('a[href*="/tag/"]').map((i, el) => $(el).text().trim()).get(),
      categories: $('a[href*="/category/"]').map((i, el) => $(el).text().trim()).get(),
      upload_date: new Date()
    });

    await newVideo.save();

    return new NextResponse(`✅ Success: ${cleanTitle.substring(0, 40)}`);
  } catch (err) {
    console.error('Scraper Error:', err.message);
    return new NextResponse(`❌ Error: ${err.message}`);
  }
}
