import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export default function SessionTakenPage() {
  return (
    <div className="min-h-screen bg-[#09090F] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-2xl grid place-items-center mx-auto mb-6"
          style={{ background: "linear-gradient(135deg, #EF4444, #B91C1C)" }}>
          <ShieldAlert size={28} className="text-white" />
        </div>

        <h1 className="font-display font-extrabold text-2xl text-white mb-3">
          Account signed in elsewhere
        </h1>

        <p className="text-white/50 text-sm leading-relaxed mb-2">
          Your Nuru account was signed in on another device or browser.
          For security, only one active session is allowed at a time.
        </p>

        <p className="text-white/30 text-xs leading-relaxed mb-8">
          If this wasn&apos;t you, your password may be compromised.
          Sign in again and consider changing your password immediately.
        </p>

        <div className="flex flex-col gap-3">
          <Link href="/login"
            className="w-full py-3 rounded-xl font-bold text-white text-sm text-center"
            style={{ background: "linear-gradient(135deg, #6B4EFF, #3E2A9E)" }}>
            Sign in again
          </Link>
          <Link href="/login?reset=1"
            className="w-full py-3 rounded-xl font-semibold text-white/40 text-sm text-center border border-white/10 hover:border-white/25 transition-colors">
            Reset my password
          </Link>
        </div>

        <p className="text-white/20 text-xs mt-8">
          Nuru AI Academy · One account, one device at a time
        </p>
      </div>
    </div>
  );
}
