/** A pulsing placeholder block used while data loads. Size it with utilities,
 *  e.g. <Skeleton className="h-8 w-64" />. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}
