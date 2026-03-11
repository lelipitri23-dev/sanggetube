export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Video from '@/models/Video';

export const revalidate = 3600; // Cache for 1 hour

export async function GET() {
    try {
        await dbConnect();
        const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
        const limit = 300; // Videos per sitemap

        const totalVideos = await Video.countDocuments();
        const totalPages = Math.ceil(totalVideos / limit);

        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

        // Generate at least 1 sitemap file
        const loopCount = totalPages === 0 ? 1 : totalPages;
        const now = new Date().toISOString();

        for (let i = 1; i <= loopCount; i++) {
            xml += `
    <sitemap>
        <loc>${siteUrl}/sitemap-video${i}.xml</loc>
        <lastmod>${now}</lastmod>
    </sitemap>`;
        }

        xml += `\n</sitemapindex>`;

        return new NextResponse(xml, {
            headers: {
                'Content-Type': 'application/xml; charset=utf-8',
                'Cache-Control': 's-maxage=3600, stale-while-revalidate'
            }
        });
    } catch (err) {
        console.error('Sitemap Index Error:', err);
        return new NextResponse('Error generating sitemap index', { status: 500 });
    }
}
