export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <div className="mb-12">
          <h1 className="mb-4 text-4xl font-bold text-slate-900">
            Privacy Policy
          </h1>
          <p className="text-lg text-slate-600">
            Last updated: {new Date().toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>

        <div className="prose prose-slate max-w-none space-y-8">
          <div className="rounded-lg border-2 border-amber-100 bg-amber-50 p-4">
            <p className="mb-0 text-sm font-semibold text-amber-900">
              ⚠️ Legal Notice: This Privacy Policy requires professional legal
              review before handling real user data. This document describes the
              technical architecture accurately but should be reviewed by legal
              counsel before use in production.
            </p>
          </div>

          <section>
            <h2 className="text-2xl font-bold text-slate-900">
              1. Introduction
            </h2>
            <p className="text-slate-700">
              Nuru AI Academy (&quot;we&quot;, &quot;us&quot;, or
              &quot;Company&quot;) operates the Nuru AI Academy website and
              application. This page informs you of our policies regarding the
              collection, use, and disclosure of personal data when you use our
              Service and the choices you have associated with that data.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900">
              2. Information Collection and Use
            </h2>

            <h3 className="text-xl font-semibold text-slate-800">
              2.1 Account Information
            </h3>
            <p className="text-slate-700">
              When you create an account, we collect:
            </p>
            <ul className="list-inside list-disc space-y-2 text-slate-700">
              <li>Email address</li>
              <li>Username</li>
              <li>Password (hashed and encrypted)</li>
              <li>Preferred language (English or Swahili)</li>
              <li>User role (student or admin)</li>
              <li>Account creation timestamp</li>
            </ul>

            <h3 className="mt-6 text-xl font-semibold text-slate-800">
              2.2 Profile and Learning Data
            </h3>
            <p className="text-slate-700">
              As you use the Service, we collect:
            </p>
            <ul className="list-inside list-disc space-y-2 text-slate-700">
              <li>Display name and avatar selection</li>
              <li>Learning progress (quiz attempts, scores, achievements)</li>
              <li>Study logs (study date and minutes per session)</li>
              <li>AI chat conversations (with your AI tutor)</li>
              <li>Duel participation and match history</li>
              <li>Enrolled tracks and completion status</li>
            </ul>

            <h3 className="mt-6 text-xl font-semibold text-slate-800">
              2.3 Payment Information
            </h3>
            <p className="text-slate-700">
              When you purchase access to tracks:
            </p>
            <ul className="list-inside list-disc space-y-2 text-slate-700">
              <li>Phone number (for mobile money payments via ClickPesa)</li>
              <li>Order reference and transaction status</li>
              <li>Payment amount in Tanzanian Shillings (TZS)</li>
              <li>Payment provider reference (ClickPesa payment ID)</li>
            </ul>
            <p className="text-sm text-slate-600 mt-4">
              We do not store credit card numbers or sensitive payment card data.
              Payment processing is handled by ClickPesa and other payment
              providers according to their respective privacy policies.
            </p>

            <h3 className="mt-6 text-xl font-semibold text-slate-800">
              2.4 Usage Data
            </h3>
            <p className="text-slate-700">
              We may collect automatically:
            </p>
            <ul className="list-inside list-disc space-y-2 text-slate-700">
              <li>IP address</li>
              <li>Browser type and version</li>
              <li>Pages visited and time spent</li>
              <li>Device information</li>
              <li>Timestamps of activities</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900">
              3. Use of Data
            </h2>
            <p className="text-slate-700">Nuru AI Academy uses the collected data for various purposes:</p>
            <ul className="list-inside list-disc space-y-2 text-slate-700">
              <li>To provide and maintain the Service</li>
              <li>To notify you about changes to our Service</li>
              <li>To provide customer support</li>
              <li>To gather analysis or valuable information to improve the Service</li>
              <li>To monitor the usage of our Service</li>
              <li>To detect, prevent and address technical and security issues</li>
              <li>To send you promotional communications (with your consent)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900">
              4. Data Storage and Security
            </h2>
            <p className="text-slate-700">
              Your data is stored securely using Supabase infrastructure with
              encryption at rest. Passwords are hashed using industry-standard
              algorithms. However, no method of transmission over the Internet or
              electronic storage is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900">
              5. Leaderboard and Public Information
            </h2>
            <p className="text-slate-700">
              To enable competitive features like leaderboards and duels, the
              following information is publicly visible:
            </p>
            <ul className="list-inside list-disc space-y-2 text-slate-700">
              <li>Display name</li>
              <li>Avatar</li>
              <li>Experience points (XP)</li>
              <li>Level</li>
              <li>Achievements</li>
            </ul>
            <p className="text-sm text-slate-600 mt-4">
              Your email address and phone number are NEVER visible to other
              users.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900">
              6. Third-Party Services
            </h2>
            <p className="text-slate-700">
              We use third-party services for specific functions:
            </p>
            <ul className="list-inside list-disc space-y-2 text-slate-700">
              <li>
                <strong>Supabase:</strong> Backend database and authentication
              </li>
              <li>
                <strong>ClickPesa:</strong> Payment processing for mobile money
              </li>
              <li>
                <strong>Resend:</strong> Email delivery for receipts and
                notifications
              </li>
              <li>
                <strong>Vercel:</strong> Application hosting and deployment
              </li>
            </ul>
            <p className="text-sm text-slate-600 mt-4">
              These services have their own privacy policies. We encourage you
              to review them.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900">
              7. Your Data Rights
            </h2>
            <p className="text-slate-700">
              Depending on your location, you may have the right to:
            </p>
            <ul className="list-inside list-disc space-y-2 text-slate-700">
              <li>Access your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Opt-out of marketing communications</li>
            </ul>
            <p className="text-slate-700 mt-4">
              To exercise these rights, contact us through the Support section
              of the application.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900">
              8. Retention of Data
            </h2>
            <p className="text-slate-700">
              We retain your personal data for as long as necessary to provide
              the Service and fulfill the purposes outlined in this Privacy
              Policy. You may request deletion of your account and associated
              data at any time.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900">
              9. Changes to This Privacy Policy
            </h2>
            <p className="text-slate-700">
              We may update our Privacy Policy from time to time. We will notify
              you of any changes by posting the new Privacy Policy on this page
              and updating the &quot;Last updated&quot; date at the top of this
              Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900">
              10. Contact Us
            </h2>
            <p className="text-slate-700">
              If you have any questions about this Privacy Policy, please
              contact us through the Support section of the Nuru AI Academy
              application.
            </p>
          </section>

          <div className="rounded-lg border-l-4 border-slate-300 bg-slate-50 p-4">
            <p className="text-sm text-slate-600">
              This Privacy Policy accurately describes the data collected and
              stored by this application based on the Supabase schema. However,
              before using this in production with real user data, have it
              reviewed by a legal professional to ensure compliance with
              applicable data protection regulations.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
