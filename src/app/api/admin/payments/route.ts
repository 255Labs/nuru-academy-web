import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { jwtVerify } from 'jose';

/**
 * Admin API endpoint: GET /api/nrx-ctrl-9f4a/payments
 *
 * Lists all track purchases with user details.
 * Requires:
 *  - Valid authentication (Bearer token)
 *  - User role = 'admin' in profiles table
 *
 * Returns an array of payment records or 403 if not authorized.
 */

// Fix #10: correct publishable key env var name (was ANON_KEY which doesn't exist in this project)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

interface JWTPayload {
  sub: string;
  aud?: string;
  role?: string;
  email?: string;
  iat?: number;
  exp?: number;
}

export async function GET(request: NextRequest) {
  // Fix #2: fail fast inside the handler (not at module level which crashes the build)
  // if the JWT secret isn't configured.
  if (!process.env.SUPABASE_JWT_SECRET) {
    console.error("SUPABASE_JWT_SECRET is not configured — admin payments endpoint disabled.");
    return NextResponse.json(
      { error: "Admin payments endpoint not configured. Set SUPABASE_JWT_SECRET." },
      { status: 503 }
    );
  }
  const JWT_SECRET = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET);

  try {
    // Step 1: Extract and validate auth token
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);

    let payload: JWTPayload;
    try {
      const verified = await jwtVerify(token, JWT_SECRET);
      payload = verified.payload as JWTPayload;
    } catch {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const userId = payload.sub;
    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid token: no user ID' },
        { status: 401 }
      );
    }

    // Step 2: Create Supabase client with user token (Fix #10: correct key name)
    const supabase = createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    // Step 3: Fetch user profile to verify admin role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    if (profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions: admin role required' },
        { status: 403 }
      );
    }

    // Step 4: Create admin client with service role key
    const adminClient = createClient(
      SUPABASE_URL,
      process.env.SUPABASE_SECRET_KEY!
    );

    const { data, error } = await adminClient.rpc('admin_list_payments', {});

    if (error) {
      console.error('admin_list_payments() error:', error);
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      count: Array.isArray(data) ? data.length : 0,
    });
  } catch (error) {
    console.error('Unexpected error in admin payments endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Only allow GET requests
export async function POST() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}
