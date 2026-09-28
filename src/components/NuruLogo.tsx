"use client";

interface NuruLogoProps {
  iconOnly?: boolean;
  size?: number;
  className?: string;
}

export function NuruLogo({ iconOnly = false, size = 40, className = "" }: NuruLogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Robot avatar */}
      <div
        className="relative shrink-0 rounded-2xl overflow-hidden"
        style={{
          width: size,
          height: size,
          background: "linear-gradient(135deg, #7C5CFF 0%, #3E2A9E 100%)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/nuru-bot.png"
          alt="Nuru AI mascot"
          width={size}
          height={size}
          style={{ objectFit: "contain", padding: 2 }}
        />
        {/* Online dot */}
        <span
          className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-400 border-2"
          style={{ borderColor: "rgba(255,255,255,0.12)" }}
        />
      </div>

      {!iconOnly && (
        <div className="flex-1 min-w-0">
          <div className="font-display font-extrabold text-base text-white leading-none tracking-tight">
            NURU
          </div>
          <div className="text-[9px] font-bold tracking-[0.2em] text-white/45 mt-0.5 uppercase">
            Learning Hub
          </div>
        </div>
      )}
    </div>
  );
}

export function NuruLogoSVG({
  width = 160,
  height = 40,
  dark = true,
}: {
  width?: number;
  height?: number;
  dark?: boolean;
}) {
  const textColor = dark ? "#FFFFFF" : "#0D0828";
  const subColor = dark ? "rgba(255,255,255,0.45)" : "rgba(13,8,40,0.45)";
  const avatarSize = height;
  const rx = avatarSize * 0.28;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Nuru AI Academy logo"
    >
      <defs>
        <linearGradient id="nuruGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7C5CFF" />
          <stop offset="100%" stopColor="#3E2A9E" />
        </linearGradient>
      </defs>
      <rect width={avatarSize} height={avatarSize} rx={rx} ry={rx} fill="url(#nuruGrad)" />
      {/* Head */}
      <ellipse cx={avatarSize*0.5} cy={avatarSize*0.38} rx={avatarSize*0.24} ry={avatarSize*0.22} fill="#EDE9FF" />
      {/* Visor */}
      <rect x={avatarSize*0.3} y={avatarSize*0.22} width={avatarSize*0.4} height={avatarSize*0.24} rx={avatarSize*0.06} fill="#0D0828" />
      {/* Eyes */}
      <ellipse cx={avatarSize*0.42} cy={avatarSize*0.32} rx={avatarSize*0.055} ry={avatarSize*0.04} fill="#60CFFF" />
      <ellipse cx={avatarSize*0.58} cy={avatarSize*0.32} rx={avatarSize*0.055} ry={avatarSize*0.04} fill="#60CFFF" />
      {/* Body */}
      <rect x={avatarSize*0.33} y={avatarSize*0.6} width={avatarSize*0.34} height={avatarSize*0.28} rx={avatarSize*0.06} fill="#EDE9FF" />
      <circle cx={avatarSize*0.5} cy={avatarSize*0.72} r={avatarSize*0.065} fill="#60CFFF" />
      {/* Gold ear */}
      <circle cx={avatarSize*0.76} cy={avatarSize*0.36} r={avatarSize*0.08} fill="#F5B942" />
      <circle cx={avatarSize*0.76} cy={avatarSize*0.36} r={avatarSize*0.05} fill="#60CFFF" />
      {/* Online dot */}
      <circle cx={avatarSize-avatarSize*0.08} cy={avatarSize-avatarSize*0.08} r={avatarSize*0.1} fill="#4ADE80" stroke="rgba(255,255,255,0.12)" strokeWidth={avatarSize*0.04} />
      {/* Wordmark */}
      <text x={avatarSize+10} y={height*0.52} fontFamily="system-ui, sans-serif" fontWeight="800" fontSize={height*0.44} fill={textColor} letterSpacing="-0.5">NURU</text>
      <text x={avatarSize+11} y={height*0.88} fontFamily="system-ui, sans-serif" fontWeight="700" fontSize={height*0.22} fill={subColor} letterSpacing="2">LEARNING HUB</text>
    </svg>
  );
}
