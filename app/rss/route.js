export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Video from '@/models/Video';

export const revalidate = 300; // Cache for 5 minutes

function escapeXml(unsafe) {
    if (!unsafe) return '';
    return unsafe.replace(/[<>&'"]/g, c => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });
}

export async function GET() {
    try {
        await dbConnect();
        const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
        const siteName = process.env.SITE_NAME || 'BokepTube';

        const videos = await Video.find().sort({ created_at: -1 }).limit(50).lean();

        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
    <channel>
        <title>${escapeXml(siteName)} RSS Feed</title>
        <link>${siteUrl}</link>
        <description>Feed terbaru dari ${escapeXml(siteName)}</description>
        <language>id-ID</language>
        <atom:link href="${siteUrl}/rss" rel="self" type="application/rss+xml" />`;

        videos.forEach(vid => {
            let thumbUrl = `${siteUrl}/uploads/default-poster.jpg`;
            if (vid.thumbnail) {
                thumbUrl = vid.thumbnail.startsWith('http') ? vid.thumbnail : `${siteUrl}/${vid.thumbnail}`;
            }

            xml += `
        <item>
            <title><![CDATA[${vid.title}]]></title>
            <link>${siteUrl}/video/${vid.slug}</link>
            <guid>${siteUrl}/video/${vid.slug}</guid>
            <description><![CDATA[
                <img src="${thumbUrl}" width="320" /><br/>
                ${(vid.description || '').substring(0, 200)}...
            ]]></description>
            <pubDate>${new Date(vid.upload_date || vid.created_at).toUTCString()}</pubDate>
        </item>`;
        });

        xml += `
    </channel>
</rss>`;

        return new NextResponse(xml, {
            headers: {
                'Content-Type': 'application/xml; charset=utf-8',
                'Cache-Control': 's-maxage=300, stale-while-revalidate'
            }
        });
    } catch (err) {
        console.error('RSS Error:', err);
        return new NextResponse('Error generating RSS', { status: 500 });
    }
}
