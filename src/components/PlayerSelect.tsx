import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
}

export default function PlayerSelect({
  value,
  onChange,
  options,
  placeholder = '— wybierz gracza —',
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const selected = options.find(o => o.value === value);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  return (
    <div className="custom-select" ref={wrapRef}>
      <button
        type="button"
        className="custom-select__trigger input"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className={selected ? undefined : 'custom-select__placeholder'}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          size={14}
          className={`custom-select__chevron${open ? ' custom-select__chevron--open' : ''}`}
        />
      </button>
      {open && (
        <ul className="custom-select__list" role="listbox">
          <li
            role="option"
            aria-selected={value === ''}
            className={`custom-select__option${value === '' ? ' custom-select__option--active' : ''}`}
            onClick={() => { onChange(''); setOpen(false); }}
          >
            {placeholder}
          </li>
          {options.map(o => (
            <li
              key={o.value}
              role="option"
              aria-selected={value === o.value}
              className={`custom-select__option${value === o.value ? ' custom-select__option--active' : ''}`}
              onClick={() => { onChange(o.value); setOpen(false); }}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
