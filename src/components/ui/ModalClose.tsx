/** Small round "×" button pinned to a modal Card's top-right corner. The Card
 *  it sits in must be `position: relative`. Turns accent-purple on hover. */
export function ModalClose({ onClick, className = '' }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close"
      className={`modal-close absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full ${className}`}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
        <path d="M5 5l14 14M19 5L5 19" />
      </svg>
    </button>
  );
}
