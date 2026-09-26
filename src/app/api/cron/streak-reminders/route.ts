import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendStreakReminder } from '@/lib/email';

/**
 * Vercel Cron API endpoint that sends streak reminder emails.
 *
 * Runs daily (configured in vercel.json) to:
 *  1. Find all users with active study streaks
 *  2. Identify users whose streaks are at risk (haven't studied in 24h)
 *  3. Send personalized reminder emails
 *
 * Security:
 *  - Vercel signs cron requests with a secret token
 *  - Always validate the Authorization header
 *  - Only accessible if CRON_SECRET is configured
 */

// Lazily initialized to avoid crashing at build time when env vars
// are not yet set in the deployment environment.
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY — ' +
      'required for admin operations.'
    );
  }
  return createClient(url, key);
}

interface UserStreakData {
  user_id: string;
  email: string;
  username: string;
  current_streak: number;
  last_study_date: string | null;
  today: string;
}

/**
 * Calculate current streak for a user based on study_log.
 * A streak is consecutive days of study (defined as minutes > 0).
 */
function calculateStreak(studyDates: string[], today: string): number {
  if (studyDates.length === 0) return 0;

  // Sort dates in descending order (most recent first)
  const sorted = [...studyDates].sort().reverse();

  let streak = 0;
  let currentDate = new Date(today);

  for (const dateStr of sorted) {
    const studyDate = new Date(dateStr);
    const expectedDate = new Date(currentDate);
    expectedDate.setDate(expectedDate.getDate() - streak);

    // Check if this date matches the expected consecutive day
    if (
      studyDate.getFullYear() === expectedDate.getFullYear() &&
      studyDate.getMonth() === expectedDate.getMonth() &&
      studyDate.getDate() === expectedDate.getDate()
    ) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Main streak reminder handler.
 */
export async function POST(request: NextRequest) {
  // Validate Vercel cron secret
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('Starting streak reminder cron job...');

    const supabaseAdmin = getSupabaseAdmin();
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Step 1: Find all users with recent study activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    const { data: recentStudyUsers, error: fetchError } = await supabaseAdmin
      .from('study_log')
      .select('user_id, study_date')
      .gte('study_date', thirtyDaysAgoStr)
      .order('study_date', { ascending: false });

    if (fetchError) {
      throw new Error(`Failed to fetch recent study data: ${fetchError.message}`);
    }

    // Group by user and get unique users
    const userMap = new Map<
      string,
      { studyDates: string[]; lastStudyDate: string }
    >();

    if (recentStudyUsers && recentStudyUsers.length > 0) {
      for (const log of recentStudyUsers) {
        if (!userMap.has(log.user_id)) {
          userMap.set(log.user_id, {
            studyDates: [],
            lastStudyDate: log.study_date,
          });
        }
        const entry = userMap.get(log.user_id)!;
        entry.studyDates.push(log.study_date);
      }
    }

    console.log(`Found ${userMap.size} users with recent study activity`);

    // Step 2: For each user, fetch profile and send reminder if streak is at risk
    let remindersSent = 0;
    const errors: Array<{ userId: string; error: string }> = [];

    for (const [userId, { studyDates, lastStudyDate }] of userMap.entries()) {
      try {
        // Fetch user profile
        const { data: profile, error: profileError } = await supabaseAdmin
          .from('profiles')
          .select('email, username')
          .eq('id', userId)
          .single();

        if (profileError || !profile) {
          console.warn(`Could not fetch profile for user ${userId}`);
          continue;
        }

        // Calculate current streak
        const streak = calculateStreak(studyDates, today);

        // Check if user hasn't studied today
        if (lastStudyDate !== today) {
          // Calculate days since last study
          const lastDate = new Date(lastStudyDate);
          const todayDate = new Date(today);
          const daysSinceStudy = Math.floor(
            (todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
          );

          // Send reminder if they have a meaningful streak and haven't studied in 24h+
          if (streak > 0 && daysSinceStudy >= 1) {
            await sendStreakReminder({
              email: profile.email,
              username: profile.username,
              currentStreak: streak,
              lastActivityDaysAgo: daysSinceStudy,
            });

            remindersSent++;
            console.log(
              `Sent reminder to ${profile.username} (streak: ${streak}, inactive: ${daysSinceStudy}d)`
            );
          }
        }
      } catch (error) {
        errors.push({
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        console.error(`Error processing user ${userId}:`, error);
      }
    }

    const result = {
      status: 'completed',
      usersProcessed: userMap.size,
      remindersSent,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    };

    console.log('Streak reminder cron job completed:', result);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Cron job failed:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Allow only POST requests
export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
