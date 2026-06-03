import { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export const Icon = {
  ghost: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 11a7 7 0 0 1 14 0v9.2l-2.2-1.5-2.2 1.5-2.3-1.5-2.3 1.5-2.2-1.5L5 20.2z"/>
      <circle cx="9.5" cy="11" r="0.9" fill="currentColor" stroke="none"/>
      <circle cx="14.5" cy="11" r="0.9" fill="currentColor" stroke="none"/>
      <path d="M9.5 14.5c.8.7 1.6 1 2.5 1s1.7-.3 2.5-1"/>
    </svg>
  ),
  eye: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" {...props}>
      <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/>
      <circle cx="12" cy="12" r="3"/>
      <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none"/>
    </svg>
  ),
  moon: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" {...props}>
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>
    </svg>
  ),
  star: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 3l1.6 5.2 5.4.2-4.3 3.3 1.5 5.3L12 14l-4.2 3 1.5-5.3L5 8.4l5.4-.2z"/>
    </svg>
  ),
  flame: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 21c-3.5 0-6-2.4-6-5.5C6 12 9 11 9 7c3 1 6 4 6 8.5 0 1-.3 1.8-.8 2.5C16 17 18 14.5 18 12c2 2 2 4 2 5.5C20 19.6 16.5 21 12 21z"/>
    </svg>
  ),
  arrow: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 12h14M13 6l6 6-6 6"/>
    </svg>
  ),
  check: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 12.5l4 4 10-10"/>
    </svg>
  ),
  cross: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...props}>
      <path d="M6 6l12 12M18 6L6 18"/>
    </svg>
  ),
  link: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 1 0-5.7-5.7L11 7"/>
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 1 0 5.7 5.7L13 17"/>
    </svg>
  ),
  dots: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <circle cx="5" cy="12" r="1.6"/>
      <circle cx="12" cy="12" r="1.6"/>
      <circle cx="19" cy="12" r="1.6"/>
    </svg>
  ),
  sigil: (props: IconProps) => (
    <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.2" {...props}>
      <circle cx="16" cy="16" r="13" />
      <circle cx="16" cy="16" r="7.5" />
      <path d="M16 1v6M16 25v6M1 16h6M25 16h6M5.5 5.5l4.3 4.3M22.2 22.2l4.3 4.3M26.5 5.5l-4.3 4.3M9.8 22.2l-4.3 4.3"/>
      <circle cx="16" cy="16" r="1.6" fill="currentColor" stroke="none"/>
    </svg>
  ),
  somnia: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" {...props}>
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/>
      <path d="M12 7v10M8 9v6M16 9v6"/>
    </svg>
  ),
  chevron_left: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M15 18l-6-6 6-6"/>
    </svg>
  ),
  chevron_right: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9 18l6-6-6-6"/>
    </svg>
  ),
  external: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <path d="M15 3h6v6M10 14L21 3"/>
    </svg>
  ),
};
