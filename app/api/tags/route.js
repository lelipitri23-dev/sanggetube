import { NextResponse } from 'next/server';
import slugify from 'slugify';
import dbConnect from '@/lib/db';
import Video from '@/models/Video';

export async function GET() {
    try {
        await dbConnect();
        
        const tags = await Video.aggregate([
            { $unwind: '$tags' },
            { $match: { tags: { $type: 'string', $ne: '' } } },
            { $group: { _id: '$tags', totalVideos: { $sum: 1 } } },
            { $sort: { totalVideos: -1, _id: 1 } }
        ]);

        const data = tags.map((item) => ({
            name: item._id,
            slug: slugify(item._id, { lower: true, strict: true }),
            totalVideos: item.totalVideos
        }));

        return NextResponse.json({
            success: true,
            total: data.length,
            data
        });
    } catch (err) {
        console.error(err);
        return NextResponse.json({
            success: false,
            message: 'Gagal mengambil data tag'
        }, { status: 500 });
    }
}
