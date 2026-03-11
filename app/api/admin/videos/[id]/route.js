export const runtime = 'nodejs';

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Video from '@/models/Video';

async function checkAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session');
  return session && session.value === 'authenticated';
}

export async function DELETE(req, { params }) {
  if (!(await checkAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const { id } = await params;
    await dbConnect();
    const deletedVideo = await Video.findByIdAndDelete(id);

    if (!deletedVideo) {
      return NextResponse.json({ success: false, message: 'Video not found' }, { status: 404 });
    }

    // Optional: Delete from S3/R2 if we want to clean up thumbnail
    return NextResponse.json({ success: true, message: 'Video deleted successfully' });
  } catch (error) {
    console.error('Delete Error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  if (!(await checkAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    await dbConnect();

    // Allow updating mostly anything
    const updatedVideo = await Video.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true, runValidators: true }
    );

    if (!updatedVideo) {
      return NextResponse.json({ success: false, message: 'Video not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updatedVideo });
  } catch (error) {
    console.error('Update Error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
