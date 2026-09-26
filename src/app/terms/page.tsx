export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <div className="mb-12">
          <h1 className="mb-4 text-4xl font-bold text-slate-900">
            Terms of Service
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
              ⚠️ Legal Notice: This document requires professional legal review
              before use with real payments and user data. These terms are
              provided as a structural template only and do not constitute
              binding legal advice.
            </p>
          </div>

          <section>
            <h2 className="text-2xl font-bold text-slate-900">
              1. Acceptance of Terms
            </h2>
            <p className="text-slate-700">
              By accessing and using Nuru AI Academy (&quot;Service&quot;), you
              accept and agree to be bound by the terms and provision of this
              agreement. If you do not agree to abide by the above, please do
              not use this service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900">
              2. Use License
            </h2>
            <p className="text-slate-700">
              Permission is granted to temporarily download one copy of the
              materials (information or software) on Nuru AI Academy for
              personal, non-commercial transitory viewing only. This is the
              grant of a license, not a transfer of title, and under this
              license you may not:
            </p>
            <ul className="list-inside list-disc space-y-2 text-slate-700">
              <li>Modifying or copying the materials</li>
              <li>Using the materials for any commercial purpose or for any
                public display</li>
              <li>Attempting to decompile or reverse engineer any software
                contained on Nuru AI Academy</li>
              <li>Transferring the materials to another person or
                &quot;mirroring&quot; the materials on any other server</li>
              <li>Removing any copyright or other proprietary notations from
                the materials</li>
              <li>Transferring the materials to another person or
                &quot;mirroring&quot; the materials on any other server</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900">
              3. Disclaimer
            </h2>
            <p className="text-slate-700">
              The materials on Nuru AI Academy are provided on an
              &apos;as is&apos; basis. Nuru AI Academy makes no warranties,
              expressed or implied, and hereby disclaims and negates all other
              warranties including, without limitation, implied warranties or
              conditions of merchantability, fitness for a particular purpose,
              or non-infringement of intellectual property or other violation
              of rights.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900">
              4. Limitations
            </h2>
            <p className="text-slate-700">
              In no event shall Nuru AI Academy or its suppliers be liable for
              any damages (including, without limitation, damages for loss of
              data or profit, or due to business interruption,) arising out of
              the use or inability to use the materials on Nuru AI Academy, even
              if Nuru AI Academy or a Nuru AI Academy authorized representative
              has been notified orally or in writing of the possibility of such
              damage.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900">
              5. Accuracy of Materials
            </h2>
            <p className="text-slate-700">
              The materials appearing on Nuru AI Academy could include technical,
              typographical, or photographic errors. Nuru AI Academy does not
              warrant that any of the materials on its website are accurate,
              complete, or current. Nuru AI Academy may make changes to the
              materials contained on its website at any time without notice.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900">
              6. Links
            </h2>
            <p className="text-slate-700">
              Nuru AI Academy has not reviewed all of the sites linked to its
              website and is not responsible for the contents of any such
              linked site. The inclusion of any link does not imply endorsement
              by Nuru AI Academy of the site. Use of any such linked website is
              at the user&apos;s own risk.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900">
              7. Modifications
            </h2>
            <p className="text-slate-700">
              Nuru AI Academy may revise these terms of service for its website
              at any time without notice. By using this website, you are
              agreeing to be bound by the then current version of these terms of
              service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900">
              8. Governing Law
            </h2>
            <p className="text-slate-700">
              These terms and conditions are governed by and construed in
              accordance with the laws of Tanzania, and you irrevocably submit
              to the exclusive jurisdiction of the courts in Dar es Salaam,
              Tanzania.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900">
              9. Payment Terms
            </h2>
            <p className="text-slate-700">
              Payments for course access are processed through ClickPesa or
              other payment providers. By making a payment, you agree to the
              terms of the payment provider. All sales are final unless a refund
              is explicitly granted by Nuru AI Academy.
            </p>
          </section>

          <div className="rounded-lg border-l-4 border-slate-300 bg-slate-50 p-4">
            <p className="text-sm text-slate-600">
              For questions about these Terms of Service, please contact us
              through the Support section of the application.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
