export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Video from '@/models/Video';

export async function GET(request, { params }) {
    try {
        await dbConnect();
        // Await the params before using them as required by Next.js 15
        const { slug } = await params;
        
        const video = await Video.findOne({ slug })
            .select('title slug description embed_url thumbnail duration duration_sec views categories tags upload_date created_at')
            .lean();

        if (!video) {
            return NextResponse.json({
                success: false,
                message: 'Video tidak ditemukan'
            }, { status: 404 });
        }

        const categories = Array.isArray(video.categories) ? video.categories.filter(Boolean) : [];
        const tags = Array.isArray(video.tags) ? video.tags.filter(Boolean) : [];
        const recommendationQuery = {
            _id: { $ne: video._id }
        };

        if (categories.length > 0 || tags.length > 0) {
            recommendationQuery.$or = [];
            if (categories.length > 0) recommendationQuery.$or.push({ categories: { $in: categories } });
            if (tags.length > 0) recommendationQuery.$or.push({ tags: { $in: tags } });
        }

        let recommendations = await Video.aggregate([
            { $match: recommendationQuery },
            { $sample: { size: 6 } },
            {
                $project: {
                    title: 1,
                    slug: 1,
                    thumbnail: 1,
                    duration: 1,
                    duration_sec: 1,
                    views: 1,
                    categories: 1,
                    tags: 1,
                    upload_date: 1,
                    created_at: 1
                }
            }
        ]);

        if (recommendations.length < 6) {
            const excludedIds = [video._id, ...recommendations.map((item) => item._id)];
            const fallback = await Video.aggregate([
                { $match: { _id: { $nin: excludedIds } } },
                { $sample: { size: 6 - recommendations.length } },
                {
                    $project: {
                        title: 1,
                        slug: 1,
                        thumbnail: 1,
                        duration: 1,
                        duration_sec: 1,
                        views: 1,
                        categories: 1,
                        tags: 1,
                        upload_date: 1,
                        created_at: 1
                    }
                }
            ]);
            recommendations = recommendations.concat(fallback);
        }

        return NextResponse.json({
            success: true,
            data: video,
            recommendations
        });
    } catch (err) {
        console.error(err);
        return NextResponse.json({
            success: false,
            message: 'Gagal mengambil detail video'
        }, { status: 500 });
    }
}
