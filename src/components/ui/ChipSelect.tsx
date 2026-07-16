interface ChipSelectProps {
  options: string[];
  value: string | null;
  onChange: (value: string) => void;
}

/** A row of pickable chips, same pattern used for target role / experience level. */
export function ChipSelect({ options, value, onChange }: ChipSelectProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className="rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors"
            style={
              active
                ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' }
                : { background: 'var(--panel-2)', borderColor: 'var(--border-soft)', color: 'var(--text-muted)' }
            }
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
