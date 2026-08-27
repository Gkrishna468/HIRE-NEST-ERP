import React from "react";

interface HireNestLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showSubtitle?: boolean;
  showTagline?: boolean;
  theme?: "light" | "dark" | "auto";
  className?: string;
  iconOnly?: boolean;
}

export const HireNestIcon: React.FC<{ size?: number; className?: string }> = ({
  size = 48,
  className = ""
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="HireNest Workforce Logo"
    >
      <defs>
        {/* Gradients */}
        <linearGradient id="birdWingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="50%" stopColor="#0ea5e9" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
        <linearGradient id="birdBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="60%" stopColor="#4f46e5" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
        <linearGradient id="birdBeakGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
        <linearGradient id="centerBadgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1e40af" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id="arrowGrad" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
        <linearGradient id="nestTraceGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0284c7" />
          <stop offset="50%" stopColor="#0ea5e9" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
        <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Upward Growth Arrow Indicator */}
      <g transform="translate(90, 16)">
        <path
          d="M10 0 L20 10 L14 10 L14 20 L6 20 L6 10 L0 10 Z"
          fill="url(#arrowGrad)"
        />
      </g>

      {/* Left Wing (Feathers spreading in dynamic flight) */}
      <g>
        <path
          d="M100 70 C75 35, 45 42, 32 46 C30 58, 48 76, 70 82 C52 80, 36 90, 38 100 C52 108, 76 100, 95 90 Z"
          fill="url(#birdWingGrad)"
        />
        <path
          d="M48 64 C62 62, 85 70, 96 82"
          stroke="#bae6fd"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.8"
        />
        <path
          d="M42 82 C56 82, 75 88, 88 95"
          stroke="#7dd3fc"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.7"
        />
      </g>

      {/* Bird Head, Eye, and Beak */}
      <g>
        {/* Head and back */}
        <path
          d="M95 72 C98 52, 115 48, 130 52 C142 56, 146 68, 142 80 C136 92, 115 95, 95 86 Z"
          fill="url(#birdBodyGrad)"
        />
        {/* Beak */}
        <path
          d="M138 58 L168 64 L138 68 Z"
          fill="url(#birdBeakGrad)"
        />
        {/* Eye */}
        <circle cx="132" cy="62" r="3.5" fill="#ffffff" />
        <circle cx="133" cy="62" r="1.8" fill="#0f172a" />
      </g>

      {/* Bird Tail / Lower Body */}
      <path
        d="M100 85 C118 95, 125 110, 118 125 C108 128, 92 120, 85 110 Z"
        fill="url(#birdBodyGrad)"
        opacity="0.9"
      />

      {/* Digital Circuit Nest (intertwined nodes and data pathways) */}
      <g stroke="url(#nestTraceGrad)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        {/* Layer 1: Base curve paths */}
        <path d="M40 135 C55 160, 85 175, 120 172 C150 170, 170 150, 175 130" fill="none" />
        <path d="M50 148 C70 172, 110 182, 145 168 C165 160, 172 145, 168 135" fill="none" strokeWidth="2.5" />
        <path d="M30 142 L55 142 L70 160 L130 160 L150 142 L165 142" fill="none" strokeWidth="2.5" />
        
        {/* Branching Traces */}
        <path d="M55 142 L42 125 L32 125" fill="none" strokeWidth="2.5" />
        <path d="M70 160 L60 175 L45 175" fill="none" strokeWidth="2.5" />
        <path d="M130 160 L140 178 L160 178" fill="none" strokeWidth="2.5" />
        <path d="M150 142 L162 122 L172 122" fill="none" strokeWidth="2.5" />
        <path d="M100 172 L100 185" fill="none" strokeWidth="2.5" />
        <path d="M85 166 L78 180" fill="none" strokeWidth="2.5" />
        <path d="M115 166 L122 180" fill="none" strokeWidth="2.5" />
      </g>

      {/* Nest Circuit Nodes / Connection Points */}
      <g>
        {/* Emerald Green Nodes */}
        <circle cx="32" cy="125" r="4" fill="#10b981" />
        <circle cx="45" cy="175" r="4.5" fill="#10b981" />
        <circle cx="100" cy="185" r="4.5" fill="#10b981" />
        <circle cx="160" cy="178" r="4" fill="#10b981" />
        <circle cx="78" cy="180" r="3.5" fill="#10b981" />

        {/* Cyan Nodes */}
        <circle cx="30" cy="142" r="4" fill="#06b6d4" />
        <circle cx="172" cy="122" r="4" fill="#06b6d4" />
        <circle cx="175" cy="130" r="4.5" fill="#0ea5e9" />
        <circle cx="122" cy="180" r="3.5" fill="#06b6d4" />
        <circle cx="40" cy="135" r="3.5" fill="#38bdf8" />
      </g>

      {/* Central "N" Emblem / Core Node */}
      <g transform="translate(100, 115)">
        {/* Badge Background Circle with glowing ring */}
        <circle cx="0" cy="0" r="28" fill="url(#centerBadgeGrad)" stroke="#38bdf8" strokeWidth="3" />
        <circle cx="0" cy="0" r="23" stroke="#1e3a8a" strokeWidth="1.5" fill="none" />
        
        {/* Stylized White Letter "N" */}
        <path
          d="M-10 11 L-10 -11 L-4 -11 L7 6 L7 -11 L11 -11 L11 11 L5 11 L-6 -6 L-6 11 Z"
          fill="#ffffff"
        />
      </g>
    </svg>
  );
};

export const HireNestBrandLogo: React.FC<HireNestLogoProps> = ({
  size = "md",
  showSubtitle = true,
  showTagline = false,
  theme = "auto",
  className = "",
  iconOnly = false
}) => {
  const iconSizes = {
    sm: 32,
    md: 44,
    lg: 64,
    xl: 96
  };

  const titleSizes = {
    sm: "text-sm",
    md: "text-lg",
    lg: "text-2xl",
    xl: "text-3xl"
  };

  const subtitleSizes = {
    sm: "text-[9px]",
    md: "text-[11px]",
    lg: "text-sm",
    xl: "text-base"
  };

  const taglineSizes = {
    sm: "text-[10px]",
    md: "text-xs",
    lg: "text-base",
    xl: "text-lg"
  };

  const isDark = theme === "dark";

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      <div className="relative flex-shrink-0 flex items-center justify-center">
        <HireNestIcon size={iconSizes[size]} />
      </div>

      {!iconOnly && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 leading-tight">
            <span
              className={`font-black tracking-tight ${titleSizes[size]} ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              HIRENEST
            </span>
            <span
              className={`font-black tracking-tight ${titleSizes[size]} text-indigo-600`}
            >
              WORKFORCE
            </span>
          </div>

          {showSubtitle && (
            <span
              className={`font-semibold tracking-wider uppercase ${subtitleSizes[size]} ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              IT Staffing & Vendor Network
            </span>
          )}

          {showTagline && (
            <span
              className={`font-medium tracking-wide mt-1 ${taglineSizes[size]} ${
                isDark ? "text-indigo-400" : "text-indigo-700"
              }`}
            >
              Hire Faster. Scale Smarter.
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default HireNestBrandLogo;
