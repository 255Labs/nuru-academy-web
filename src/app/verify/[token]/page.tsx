import { createClient } from "@supabase/supabase-js";
import { CheckCircle, XCircle, Award } from "lucide-react";

const TRACK_LABELS: Record<string, string> = {
  beginner:     "AI for Everyone",
  intermediate: "LLMs Under the Hood",
  expert:       "The Model Landscape",
};

export default async function VerifyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );

  const { data } = await supabase.rpc("verify_certificate", { p_token: token });
  const cert = Array.isArray(data) ? data[0] : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f0720] to-[#1a1035] flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl max-w-md w-full p-8 text-center shadow-2xl">
        {cert ? (
          <>
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-green-600" />
            </div>
            <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-6">Nuru AI Academy</div>
            <Award size={40} className="text-nuru-purple mx-auto mb-2" style={{ color: "#6B4EFF" }} />
            <h1 className="text-2xl font-black text-gray-900 mb-1">Certificate Verified</h1>
            <p className="text-green-600 font-semibold text-sm mb-6">This certificate is authentic and valid.</p>

            <div className="bg-gray-50 rounded-2xl p-5 text-left space-y-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Awarded to</div>
                <div className="font-bold text-gray-900 text-lg">{cert.display_name}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Course completed</div>
                <div className="font-semibold text-gray-700">{TRACK_LABELS[cert.track_id] ?? cert.track_id}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Date issued</div>
                <div className="font-semibold text-gray-700">
                  {new Date(cert.issued_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-400 mt-6">
              Issued by Nuru AI Academy · nuruai.academy
            </p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <XCircle size={32} className="text-red-500" />
            </div>
            <h1 className="text-2xl font-black text-gray-900 mb-2">Certificate Not Found</h1>
            <p className="text-gray-500 text-sm">
              This verification link is invalid or the certificate does not exist.
              If you believe this is an error, contact Nuru AI Academy.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
