export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Video from '@/models/Video';

function parsePagination(query) {
    const limitParam = parseInt(query.get('limit'), 10);
    const pageParam = parseInt(query.get('page'), 10);

    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 24;
    const page = Number.isFinite(pageParam) ? Math.max(pageParam, 1) : 1;
    const skip = (page - 1) * limit;

    return { limit, page, skip };
}

function escapeRegex(text) {
    return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function GET(request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(request.url);
        
        const q = String(searchParams.get('q') || '').trim();
        if (!q) {
            return NextResponse.json({
                success: false,
                message: 'Parameter q wajib diisi'
            }, { status: 400 });
        }

        const { limit, page, skip } = parsePagination(searchParams);
        const safeKeyword = escapeRegex(q);
        const query = {
            $or: [
                { title: { $regex: safeKeyword, $options: 'i' } },
                { tags: { $regex: safeKeyword, $options: 'i' } },
                { categories: { $regex: safeKeyword, $options: 'i' } }
            ]
        };

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
            q,
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
            message: 'Gagal mencari video'
        }, { status: 500 });
    }
}
