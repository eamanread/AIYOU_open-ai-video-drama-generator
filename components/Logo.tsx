/**
 * 蜂巢映画 漫剧生成平台 - Logo 组件
 *
 * @developer 光波 (a@ggbo.com)
 * @copyright Copyright (c) 2025 光波. All rights reserved.
 */

import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showSubtitle?: boolean;
}

/**
 * 蜂巢映画 Logo
 * sm  = 画布左上角水印 (h≈48px)
 * md  = 侧边栏/导航 (h≈64px)
 * lg  = 欢迎屏大 Logo (h≈160px)
 */
export const Logo: React.FC<LogoProps> = React.memo(({ size = 'md', className = '', showSubtitle }) => {
  const cfg = {
    sm:  { hex: 28, text: 'text-lg',   sub: 'text-[8px]',  gap: 'gap-2',   tracking: 'tracking-[0.15em]' },
    md:  { hex: 36, text: 'text-2xl',  sub: 'text-[9px]',  gap: 'gap-2.5', tracking: 'tracking-[0.18em]' },
    lg:  { hex: 64, text: 'text-5xl',  sub: 'text-xs',     gap: 'gap-4',   tracking: 'tracking-[0.25em]' },
  }[size];

  return (
    <div className={`flex items-center ${cfg.gap} select-none ${className}`}>
      {/* 蜂巢六边形图标 */}
      <HexIcon size={cfg.hex} />

      {/* 文字区 */}
      <div className="flex flex-col">
        <span
          className={`${cfg.text} font-black ${cfg.tracking} bg-gradient-to-r from-cyan-300 via-white to-cyan-300 bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(34,211,238,0.4)]`}
          style={{ fontFamily: "'Noto Serif SC', 'Source Han Serif CN', 'STSong', serif" }}
        >
          蜂巢映画
        </span>
        {showSubtitle && (
          <span className={`${cfg.sub} font-medium tracking-[0.35em] text-cyan-400/60 mt-0.5 ml-0.5`}>
            FCYH STUDIO
          </span>
        )}
      </div>
    </div>
  );
});

/** 蜂巢六边形 SVG 图标 */
const HexIcon: React.FC<{ size: number }> = React.memo(({ size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="shrink-0 drop-shadow-[0_0_10px_rgba(34,211,238,0.35)]"
  >
    <defs>
      <linearGradient id="hex-grad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#22d3ee" />
        <stop offset="50%" stopColor="#a5f3fc" />
        <stop offset="100%" stopColor="#06b6d4" />
      </linearGradient>
      <linearGradient id="hex-fill" x1="16" y1="16" x2="48" y2="48" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.15" />
        <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.05" />
      </linearGradient>
    </defs>

    {/* 外层大六边形 */}
    <path
      d="M32 4 L56 18 L56 46 L32 60 L8 46 L8 18 Z"
      stroke="url(#hex-grad)"
      strokeWidth="2"
      fill="url(#hex-fill)"
    />

    {/* 内层蜂巢网格 — 三个小六边形 */}
    <path
      d="M32 16 L40 20.5 L40 29.5 L32 34 L24 29.5 L24 20.5 Z"
      stroke="url(#hex-grad)"
      strokeWidth="1.2"
      fill="none"
      opacity="0.7"
    />
    <path
      d="M22 29 L30 33.5 L30 42.5 L22 47 L14 42.5 L14 33.5 Z"
      stroke="url(#hex-grad)"
      strokeWidth="1.2"
      fill="none"
      opacity="0.5"
    />
    <path
      d="M42 29 L50 33.5 L50 42.5 L42 47 L34 42.5 L34 33.5 Z"
      stroke="url(#hex-grad)"
      strokeWidth="1.2"
      fill="none"
      opacity="0.5"
    />

    {/* 中心光点 */}
    <circle cx="32" cy="25" r="2.5" fill="#22d3ee" opacity="0.9" />
  </svg>
));
