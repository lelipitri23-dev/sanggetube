export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Video from '@/models/Video';

export const revalidate = 3600;

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

function cleanSlug(str) {
    return str.replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-').toLowerCase();
}

export async function GET(req, { params }) {
    try {
        await dbConnect();
        const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
        const siteName = process.env.SITE_NAME || 'BokepTube';
        const { page } = await params;
        const pageNum = parseInt(page) || 1;
        const limit = 300;
        const skip = (pageNum - 1) * limit;

        const videos = await Video.find()
            .select('slug upload_date title thumbnail created_at embed_url description duration_sec tags categories')
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        if (videos.length === 0 && pageNum > 1) {
            return new NextResponse('Sitemap page not found', { status: 404 });
        }

        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" 
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">`;

        // LOGIKA KHUSUS HALAMAN 1 (Home, Categories, Tags)
        if (pageNum === 1) {
            const today = new Date().toISOString().split('T')[0];

            xml += `
    <url>
        <loc>${siteUrl}/</loc>
        <lastmod>${today}</lastmod>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
    </url>`;

            const categories = await Video.distinct('categories');
            categories.forEach(cat => {
                if (cat) {
                    const safeSlug = cleanSlug(cat);
                    const catUrl = escapeXml(`${siteUrl}/category/${safeSlug}`);
                    xml += `
    <url>
        <loc>${catUrl}</loc>
        <lastmod>${today}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.9</priority>
    </url>`;
                }
            });

            const tags = await Video.distinct('tags');
            tags.forEach(tag => {
                if (tag) {
                    const safeSlug = cleanSlug(tag);
                    const tagUrl = escapeXml(`${siteUrl}/tag/${safeSlug}`);
                    xml += `
    <url>
        <loc>${tagUrl}</loc>
        <lastmod>${today}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.9</priority>
    </url>`;
                }
            });
        }

        // VIDEO LIST
        videos.forEach(vid => {
            const pageUrl = `${siteUrl}/video/${vid.slug}`;
            const safePageUrl = escapeXml(pageUrl);

            let thumbUrl = `${siteUrl}/uploads/default-poster.jpg`;
            if (vid.thumbnail) {
                thumbUrl = vid.thumbnail.startsWith('http') ? vid.thumbnail : `${siteUrl}/${vid.thumbnail}`;
            }
            const safeThumbUrl = escapeXml(thumbUrl);

            const embedUrlFull = vid.embed_url?.startsWith('//') ? `https:${vid.embed_url}` : (vid.embed_url || '');
            const safePlayerLoc = escapeXml(embedUrlFull);

            let videoTags = '';
            if (vid.tags && vid.tags.length > 0) {
                vid.tags.slice(0, 32).forEach(tag => {
                    videoTags += `<video:tag><![CDATA[${tag}]]></video:tag>`;
                });
            }

            const date = new Date(vid.upload_date || vid.created_at).toISOString().split('T')[0];
            const fullDate = new Date(vid.created_at).toISOString();

            xml += `
    <url>
        <loc>${safePageUrl}</loc>
        <lastmod>${date}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
        <image:image>
            <image:loc>${safeThumbUrl}</image:loc>
            <image:title><![CDATA[${vid.title}]]></image:title>
        </image:image>
        <video:video>
            <video:thumbnail_loc>${safeThumbUrl}</video:thumbnail_loc>
            <video:title><![CDATA[${vid.title}]]></video:title>
            <video:description><![CDATA[${(vid.description || '').substring(0, 2000)}]]></video:description>
            <video:player_loc allow_embed="yes" autoplay="ap=1">${safePlayerLoc}</video:player_loc>
            <video:duration>${Math.round(vid.duration_sec || 0)}</video:duration>
            <video:publication_date>${fullDate}</video:publication_date>
            <video:family_friendly>no</video:family_friendly>
            <video:uploader info="${siteUrl}">${siteName}</video:uploader>
            ${videoTags}
        </video:video>
    </url>`;
        });

        xml += `\n</urlset>`;

        return new NextResponse(xml, {
            headers: {
                'Content-Type': 'application/xml; charset=utf-8',
                'Cache-Control': 's-maxage=3600, stale-while-revalidate',
            }
        });

    } catch (err) {
        console.error('Sitemap Video Error:', err);
        return new NextResponse('Error generating sitemap page', { status: 500 });
    }
}
