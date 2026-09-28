import { Resend } from 'resend';

// Lazily initialized — avoids "Missing API key" crash at build time
// when RESEND_API_KEY is not yet set in the deployment environment.
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error(
        'RESEND_API_KEY is not configured. Add it to .env.local to enable email features.'
      );
    }
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

export interface SendPaymentReceiptParams {
  email: string;
  username: string;
  trackName: string;
  amount: number;
  orderReference: string;
  currency?: string;
}

/**
 * Send a payment receipt email to the user after successful purchase.
 * Called from the payment webhook handler (stripe/clickpesa).
 */
export async function sendPaymentReceipt({
  email,
  username,
  trackName,
  amount,
  orderReference,
  currency = 'TZS',
}: SendPaymentReceiptParams) {
  try {
    const response = await getResend().emails.send({
      from: 'noreply@nuruai.academy',
      to: email,
      subject: `Payment Receipt - ${trackName}`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #6366f1;">Thank you for your purchase!</h2>
          
          <p>Hi <strong>${username}</strong>,</p>
          
          <p>Your payment has been received successfully. Here are your receipt details:</p>
          
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Course/Track:</strong> ${trackName}</p>
            <p><strong>Amount:</strong> ${amount.toLocaleString()} ${currency}</p>
            <p><strong>Order Reference:</strong> ${orderReference}</p>
            <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
          </div>
          
          <p>You can now access the content through your Nuru AI Academy dashboard.</p>
          
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            This is an automated email. Please do not reply to this message.
          </p>
        </div>
      `,
    });

    return { success: true, messageId: response.data?.id };
  } catch (error) {
    console.error('Failed to send payment receipt email:', error);
    throw error;
  }
}

export interface SendStreakReminderParams {
  email: string;
  username: string;
  currentStreak: number;
  lastActivityDaysAgo: number;
}

/**
 * Send a streak reminder email to encourage user engagement.
 * Called from the cron endpoint (/api/cron/streak-reminders).
 */
export async function sendStreakReminder({
  email,
  username,
  currentStreak,
  lastActivityDaysAgo,
}: SendStreakReminderParams) {
  try {
    const response = await getResend().emails.send({
      from: 'noreply@nuruai.academy',
      to: email,
      subject: `🔥 Don't break your ${currentStreak}-day streak!`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #f59e0b;">Keep your streak alive! 🔥</h2>
          
          <p>Hi <strong>${username}</strong>,</p>
          
          <p>We noticed you haven't practiced in <strong>${lastActivityDaysAgo} days</strong>. 
          You have an amazing <strong>${currentStreak}-day learning streak</strong> going — don't break it now!</p>
          
          <p style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <strong>Fun fact:</strong> Consistent daily practice is the fastest way to master AI and machine learning concepts.
            Your streak shows your dedication!
          </p>
          
          <p style="text-align: center; margin: 30px 0;">
            <a href="https://nuruai.academy/learn" 
               style="background: #6366f1; color: white; padding: 12px 30px; 
                      border-radius: 8px; text-decoration: none; font-weight: bold;">
              Continue Learning
            </a>
          </p>
          
          <p>Keep up the great work!</p>
          
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            You're receiving this because you're an active learner in Nuru AI Academy.
            This is an automated email. Please do not reply to this message.
          </p>
        </div>
      `,
    });

    return { success: true, messageId: response.data?.id };
  } catch (error) {
    console.error('Failed to send streak reminder email:', error);
    throw error;
  }
}

export interface SendCorporateInviteParams {
  email: string;
  username: string;
  planId: string;
  amount: number;
  orderReference: string;
  inviteUrl: string;
  currency?: string;
}

/**
 * Send a corporate welcome email with the team invite link.
 * Called from the payment webhook handler after confirming a corporate purchase.
 * The buyer receives this email and forwards the invite URL to their team.
 */
export async function sendCorporateInvite({
  email,
  username,
  planId,
  amount,
  orderReference,
  inviteUrl,
  currency = "TZS",
}: SendCorporateInviteParams) {
  const planLabels: Record<string, string> = {
    corp_10:     "Corporate — 10 Seats",
    corp_25:     "Corporate — 25 Seats",
    corp_custom: "Corporate — Custom",
  };
  const planName = planLabels[planId] ?? planId;

  try {
    const response = await getResend().emails.send({
      from: "noreply@nuruai.academy",
      to: email,
      subject: `Your Nuru Academy team access is ready — ${planName}`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #6366f1;">Your team access is live! 🎉</h2>

          <p>Hi <strong>${username}</strong>,</p>

          <p>Payment confirmed. Your <strong>${planName}</strong> subscription is active.</p>

          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Plan:</strong> ${planName}</p>
            <p><strong>Amount paid:</strong> ${amount.toLocaleString()} ${currency}</p>
            <p><strong>Order ref:</strong> ${orderReference}</p>
          </div>

          <p><strong>Share this link with your team members:</strong></p>

          <div style="background: #eef2ff; border: 2px solid #6366f1; padding: 16px; border-radius: 8px; margin: 16px 0; word-break: break-all;">
            <a href="${inviteUrl}" style="color: #4f46e5; font-weight: bold; font-size: 15px;">${inviteUrl}</a>
          </div>

          <p style="font-size: 13px; color: #666;">
            Each team member visits this link and signs in (or creates a free Nuru account)
            to activate their seat. The link can be reused until all seats are filled.
          </p>

          <p style="font-size: 12px; color: #999; margin-top: 30px;">
            This is an automated email. Please do not reply to this message.
          </p>
        </div>
      `,
    });

    return { success: true, messageId: response.data?.id };
  } catch (error) {
    console.error("Failed to send corporate invite email:", error);
    throw error;
  }
}

/**
 * Verify that Resend API key is configured.
 * Call this during app initialization to fail fast if email is misconfigured.
 */
export function verifyEmailConfiguration() {
  if (!process.env.RESEND_API_KEY) {
    console.warn(
      'Warning: RESEND_API_KEY not configured. Email features will not work. ' +
      'Set RESEND_API_KEY in .env.local to enable payment receipts and streak reminders.'
    );
    return false;
  }
  return true;
}
