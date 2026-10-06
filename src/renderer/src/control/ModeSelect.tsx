import { useEffect, useRef, useState } from 'react'

export type PanelView = 'record' | 'translation'

const VIEW_OPTIONS: { value: PanelView; label: string }[] = [
  { value: 'record', label: '記録' },
  { value: 'translation', label: '翻訳' }
]

function ModeSelect({
  value,
  onChange
}: {
  value: PanelView
  onChange: (view: PanelView) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (e: PointerEvent): void => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  const current = VIEW_OPTIONS.find((option) => option.value === value)

  return (
    <div className="mode-select" ref={rootRef}>
      <button
        type="button"
        className="mode-select__button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        {current?.label ?? ''}
        <span className="mode-select__caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <ul className="mode-select__menu" role="listbox">
          {VIEW_OPTIONS.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                className={option.value === value ? 'is-active' : undefined}
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default ModeSelect
