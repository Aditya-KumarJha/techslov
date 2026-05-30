type IconProps = {
  className?: string;
};

export function SparkIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none">
      <path
        d="M12 2.5l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.9L12 2.5z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LinkIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none">
      <path
        d="M10 13a5 5 0 0 1 0-7.1l1.2-1.2a5 5 0 0 1 7.1 7.1L17 13"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M14 11a5 5 0 0 1 0 7.1l-1.2 1.2a5 5 0 1 1-7.1-7.1L7 11"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ChatBubbleIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none">
      <path
        d="M5 6.8C5 5.25 6.25 4 7.8 4h8.4C17.75 4 19 5.25 19 6.8v6.4c0 1.55-1.25 2.8-2.8 2.8H10l-3.8 3.2V16H7.8C6.25 16 5 14.75 5 13.2V6.8Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChartIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none">
      <path d="M5 19V5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M5 19h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8 15l3-4 3 2 4-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SendIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none">
      <path d="M4 12l15-7-4 15-2.5-6.5L4 12z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M13.5 13.5L20 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function HashIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none">
      <path d="M9 4l-2 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M17 4l-2 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M4 9h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M3 15h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
