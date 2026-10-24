import { forwardRef } from 'react';
import type { LucideIcon, LucideProps } from 'lucide-react';

export * from 'lucide-react';

/** Lucide'da olmayan hakem düdüğü ikonu (Lucide ile aynı çizgi stilinde). */
export const Whistle = forwardRef<SVGSVGElement, LucideProps>(function Whistle(
  { size = 24, strokeWidth = 2, className, ...rest },
  ref,
) {
  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
      {...rest}
    >
      <circle cx="8.5" cy="14.5" r="5" />
      <path d="M12.5 11.5 21 9V5.5l-11 3.2" />
      <path d="M8.5 14.5h.01" />
      <path d="M4 5l1.5 2M8 3.5V6M12 4.5 11 6.5" />
    </svg>
  );
}) as unknown as LucideIcon;
