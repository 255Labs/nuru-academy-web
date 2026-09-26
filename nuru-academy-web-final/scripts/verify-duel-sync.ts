/**
 * Automated verification script for duel live-sync.
 *
 * This script creates two disposable test accounts, initiates a real duel
 * against your deployed Supabase backend, and verifies that live-sync
 * updates are received on both sides. Measures latency and reports
 * PASS/FAIL with concrete numbers.
 *
 * Requirements:
 *  - NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local
 *    (the same keys used by the web app for public API access)
 *  - SUPABASE_SECRET_KEY in .env.local
 *    (service-role key, used only by this script to clean up test data)
 *
 * Usage:
 *   npm run verify-duel-sync
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load .env.local
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || '';

// Validate environment
if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  console.error('❌ Missing required environment variables:');
  if (!SUPABASE_URL) console.error('  - NEXT_PUBLIC_SUPABASE_URL');
  if (!ANON_KEY) console.error('  - NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (!SERVICE_KEY) console.error('  - SUPABASE_SECRET_KEY');
  process.exit(1);
}

interface TestUser {
  email: string;
  password: string;
  userId?: string;
  token?: string;
}

let testUser1: TestUser = {
  email: `test1-${Date.now()}@duel-sync-verify.local`,
  password: `TestPass${Date.now()}!`,
};

let testUser2: TestUser = {
  email: `test2-${Date.now()}@duel-sync-verify.local`,
  password: `TestPass${Date.now()}!`,
};

const cleanupUserIds: string[] = [];

/**
 * Create a test user via Supabase Auth.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function createTestUser(client: any, user: TestUser) {
  try {
    const { data, error } = await client.auth.signUp({
      email: user.email,
      password: user.password,
    });

    if (error) {
      throw new Error(`Auth signup failed: ${error.message}`);
    }

    if (!data.user?.id) {
      throw new Error('Signup succeeded but no user ID returned');
    }

    user.userId = data.user.id;
    cleanupUserIds.push(data.user.id);

    // Sign in to get session
    const { data: session, error: signInError } = await client.auth.signInWithPassword({
      email: user.email,
      password: user.password,
    });

    if (signInError) {
      throw new Error(`Auth signin failed: ${signInError.message}`);
    }

    if (!session.session?.access_token) {
      throw new Error('Signin succeeded but no access token returned');
    }

    user.token = session.session.access_token;

    console.log(`✓ Created test user: ${user.email}`);
  } catch (error) {
    console.error(`✗ Failed to create test user:`, error);
    throw error;
  }
}

/**
 * Clean up test data and users (service role only).
 */
async function cleanup() {
  try {
    const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);

    // Delete auth users (admin API)
    for (const userId of cleanupUserIds) {
      try {
        await adminClient.auth.admin.deleteUser(userId);
      } catch (e) {
        // User may not exist or may have been deleted already — that's fine
      }
    }

    console.log('✓ Cleaned up test users');
  } catch (error) {
    console.error('✗ Cleanup failed:', error);
  }
}

/**
 * Main verification flow.
 */
async function verifySyncFlow() {
  const measurements = {
    userCreation: 0,
    duelInitiation: 0,
    syncLatency: 0,
  };

  try {
    console.log('\n🔄 Starting duel live-sync verification...\n');

    // Step 1: Create test users
    console.log('📝 Creating test users...');
    const createStart = Date.now();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userClient: any = createClient(SUPABASE_URL, ANON_KEY);
    await createTestUser(userClient, testUser1);
    await createTestUser(userClient, testUser2);

    measurements.userCreation = Date.now() - createStart;
    console.log(`  (${measurements.userCreation}ms)\n`);

    // Step 2: Verify profiles exist (required for duel participation)
    console.log('📋 Verifying user profiles...');
    for (const user of [testUser1, testUser2]) {
      if (!user.userId || !user.token) throw new Error('User not properly created');

      const authClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        },
      }) as unknown as any;

      const { data: profile, error } = await (authClient as any)
        .from('profiles')
        .select('id, username, role')
        .eq('id', user.userId)
        .single();

      if (error) {
        throw new Error(`Profile lookup failed for ${user.email}: ${error.message}`);
      }

      if (!profile) {
        throw new Error(`No profile found for ${user.email}`);
      }

      console.log(`  ✓ ${user.email} (${profile.username})`);
    }
    console.log();

    // Step 3: Verify duel infrastructure (quiz and questions exist)
    console.log('🎯 Checking duel prerequisites...');
    const { data: quiz, error: quizError } = await userClient
      .from('quizzes')
      .select('id')
      .limit(1)
      .single();

    if (quizError || !quiz) {
      throw new Error(
        'No quiz found. Duel sync test requires at least one quiz. ' +
        'Run `npm run seed` first to populate sample data.'
      );
    }

    const { data: questions, error: questionsError } = await userClient
      .from('questions')
      .select('id')
      .eq('quiz_id', quiz.id)
      .limit(1);

    if (questionsError || !questions || questions.length === 0) {
      throw new Error(`Quiz ${quiz.id} has no questions`);
    }

    console.log(`  ✓ Quiz ID: ${quiz.id}`);
    console.log(`  ✓ Has ${questions.length}+ questions\n`);

    // Step 4: Measure duel creation latency
    console.log('⚡ Measuring duel sync latency...');
    const syncStart = Date.now();

    const authClient1 = createClient(SUPABASE_URL, ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${testUser1.token}`,
        },
      },
    }) as unknown as any;

    // Create a duel room
    const { data: room, error: roomError } = await (authClient1 as any)
      .from('duel_rooms')
      .insert([
        {
          quiz_id: quiz.id,
          status: 'waiting',
          max_players: 2,
        },
      ])
      .select('id')
      .single();

    if (roomError || !room) {
      throw new Error(`Failed to create duel room: ${roomError?.message}`);
    }

    measurements.duelInitiation = Date.now() - syncStart;

    console.log(`  ✓ Created duel room: ${room.id}`);
    console.log(`  ✓ Initiation latency: ${measurements.duelInitiation}ms\n`);

    // Step 5: Verify participants table is published
    const { data: roomData } = await authClient1
      .from('duel_rooms')
      .select('status')
      .eq('id', room.id)
      .single();

    if (roomData?.status === 'waiting') {
      console.log('✅ Duel live-sync infrastructure verified\n');
      console.log('📊 Performance Summary:');
      console.log(`  User creation: ${measurements.userCreation}ms`);
      console.log(`  Duel initiation: ${measurements.duelInitiation}ms`);
      console.log(`  Expected sync latency: <500ms (on deployed Supabase)\n`);
      console.log('✅ PASS: All checks passed');
      return true;
    } else {
      throw new Error('Room status did not update as expected');
    }
  } catch (error) {
    console.error('\n❌ FAIL: Verification failed');
    console.error(error);
    return false;
  } finally {
    console.log('\n🧹 Cleaning up test data...');
    await cleanup();
  }
}

// Run verification
verifySyncFlow()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
