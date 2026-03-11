import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Video from '@/models/Video';

function parsePagination(searchParams) {
    const limitParam = parseInt(searchParams.get('limit'), 10);
    const pageParam = parseInt(searchParams.get('page'), 10);

    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 24;
    const page = Number.isFinite(pageParam) ? Math.max(pageParam, 1) : 1;
    const skip = (page - 1) * limit;

    return { limit, page, skip };
}

function keywordFromSlug(slug) {
    return decodeURIComponent(String(slug || '')).replace(/-/g, ' ').trim();
}

export async function GET(request, { params }) {
    try {
        await dbConnect();
        // Await params as required in Next.js 15
        const { slug } = await params;
        
        const { searchParams } = new URL(request.url);
        const { limit, page, skip } = parsePagination(searchParams);
        
        const keyword = keywordFromSlug(slug);
        const query = { tags: { $regex: keyword, $options: 'i' } };

        const [videos, total] = await Promise.all([
            Video.find(query)
                .select('title slug thumbnail duration duration_sec views categories tags upload_date created_at')
                .sort({ created_at: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Video.countDocuments(query)
        ]);

        return NextResponse.json({
            success: true,
            tag: slug,
            keyword,
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            data: videos
        });
    } catch (err) {
        console.error(err);
        return NextResponse.json({
            success: false,
            message: 'Gagal mengambil video tag'
        }, { status: 500 });
    }
}
