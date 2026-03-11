import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  const cookieStore = await cookies();
  cookieStore.delete('admin_session');
  
  return NextResponse.redirect(new URL('/admin/login', process.env.SITE_URL || 'http://localhost:3000'));
}
