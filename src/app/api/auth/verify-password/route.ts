import bcryptjs from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/auth/verify-password
 * Проверяет соответствие пароля с его хешем на сервере (server-side)
 */
export async function POST(request: NextRequest) {
  try {
    const { password, hash } = await request.json();

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      );
    }

    if (!hash || typeof hash !== 'string') {
      return NextResponse.json(
        { error: 'Hash is required' },
        { status: 400 }
      );
    }

    const isMatch = await bcryptjs.compare(password, hash);

    return NextResponse.json(
      { isMatch },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error verifying password:', error);
    return NextResponse.json(
      { error: 'Failed to verify password' },
      { status: 500 }
    );
  }
}
