import { NextResponse } from 'next/server';
import slugify from 'slugify';
import dbConnect from '@/lib/db';
import Video from '@/models/Video';

export async function GET() {
    try {
        await dbConnect();
        
        const categories = await Video.aggregate([
            { $unwind: '$categories' },
            { $match: { categories: { $type: 'string', $ne: '' } } },
            { $group: { _id: '$categories', totalVideos: { $sum: 1 } } },
            { $sort: { totalVideos: -1, _id: 1 } }
        ]);

        const data = categories.map((item) => ({
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
            message: 'Gagal mengambil data kategori'
        }, { status: 500 });
    }
}
