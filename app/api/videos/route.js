export const runtime = 'nodejs';

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

export async function GET(request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(request.url);
        const { limit, page, skip } = parsePagination(searchParams);

        const [videos, total] = await Promise.all([
            Video.find()
                .select('title slug thumbnail duration duration_sec views categories tags upload_date created_at')
                .sort({ created_at: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Video.countDocuments()
        ]);

        return NextResponse.json({
            success: true,
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
            message: 'Gagal mengambil data video'
        }, { status: 500 });
    }
}
