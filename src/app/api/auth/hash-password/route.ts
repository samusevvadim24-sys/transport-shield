import bcryptjs from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/auth/hash-password
 * Хеширует пароль на сервере (server-side)
 */
export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      );
    }

    if (password.trim().length < 1) {
      return NextResponse.json(
        { error: 'Password cannot be empty' },
        { status: 400 }
      );
    }

    const hashedPassword = await bcryptjs.hash(password, 10);

    return NextResponse.json(
      { hashedPassword },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error hashing password:', error);
    return NextResponse.json(
      { error: 'Failed to hash password' },
      { status: 500 }
    );
  }
}
