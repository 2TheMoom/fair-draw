/**
 * Fair Draw Logo Component
 *
 * A reticle-bracket mark with a single pulse blip inside it - the exact
 * same corner-bracket and waveform vocabulary used in the page frame and
 * hero, so the mark reads as *of* the system rather than a badge stuck
 * on top. The amber dot marks the pulse peak, echoing the "target round"
 * marker on the hero waveform.
 */

import React from 'react';

export type LogoVariant = 'full' | 'mark' | 'wordmark';
export type LogoSize = 'sm' | 'md' | 'lg';

interface LogoProps {
  variant?: LogoVariant;
  size?: LogoSize;
  className?: string;
}

const sizeMap = {
  sm: 26,
  md: 32,
  lg: 40,
};

function PulseMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-label="Fair Draw" className="shrink-0">
      <path d="M5 9 V5 H9" fill="none" stroke="#6FE8A8" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M27 9 V5 H23" fill="none" stroke="#6FE8A8" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M5 23 V27 H9" fill="none" stroke="#6FE8A8" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M27 23 V27 H23" fill="none" stroke="#6FE8A8" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6 20 H11 L14 9 L17 20 H19 L21 24 L23 20 H26" fill="none" stroke="#9FFFC7" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx="14" cy="9" r="1.7" fill="#F0B75E" />
    </svg>
  );
}

export function Logo({ variant = 'full', size = 'md', className = '' }: LogoProps) {
  const markSize = sizeMap[size];

  const Wordmark = () => (
    <div className="leading-none">
      <span className="font-head font-bold uppercase text-fg" style={{ fontSize: '0.95rem', letterSpacing: '0.01em' }}>
        Fair-Draw
      </span>
      <div className="mt-0.5 font-mono text-[0.58rem] text-fg-dim" style={{ letterSpacing: '0.08em' }}>
        Signal Source: Drand / Quicknet
      </div>
    </div>
  );

  if (variant === 'mark') {
    return <div className={`inline-flex items-center ${className}`}><PulseMark size={markSize} /></div>;
  }
  if (variant === 'wordmark') {
    return <div className={`inline-flex items-center ${className}`}><Wordmark /></div>;
  }
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <PulseMark size={markSize} />
      <Wordmark />
    </div>
  );
}

export function LogoFull(props: Omit<LogoProps, 'variant'>) {
  return <Logo {...props} variant="full" />;
}

export function LogoMark(props: Omit<LogoProps, 'variant'>) {
  return <Logo {...props} variant="mark" />;
}

export function LogoWordmark(props: Omit<LogoProps, 'variant'>) {
  return <Logo {...props} variant="wordmark" />;
}
