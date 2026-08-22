import React, { useEffect, useRef, useState } from 'react'

export function SelectField(props: {
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}): React.ReactElement {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const [menu, setMenu] = useState<{ top: number; left: number; width: number } | null>(null)
  const label = props.options.find((o) => o.value === props.value)?.label ?? '请选择'

  useEffect(() => {
    if (!open) return
    const onDoc = (ev: MouseEvent): void => {
      if (rootRef.current && !rootRef.current.contains(ev.target as Node)) setOpen(false)
    }
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggle = (): void => {
    if (open) {
      setOpen(false)
      return
    }
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) setMenu({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 160) })
    setOpen(true)
  }

  return React.createElement(
    'div',
    { className: 'bcc-select', ref: rootRef },
    React.createElement(
      'button',
      {
        ref: triggerRef,
        type: 'button',
        className: 'bcc-select-trigger',
        'aria-expanded': open,
        onClick: toggle,
      },
      React.createElement('span', { className: 'bcc-select-label' }, label),
      React.createElement('span', { className: 'bcc-select-caret', 'aria-hidden': true }, '▾'),
    ),
    open && menu
      ? React.createElement(
        'div',
        {
          className: 'bcc-select-menu',
          style: { top: menu.top, left: menu.left, width: menu.width },
          role: 'listbox',
        },
        ...props.options.map((opt) => React.createElement(
          'button',
          {
            key: opt.value,
            type: 'button',
            role: 'option',
            className: opt.value === props.value ? 'bcc-select-item is-on' : 'bcc-select-item',
            'aria-selected': opt.value === props.value,
            onClick: () => {
              props.onChange(opt.value)
              setOpen(false)
            },
          },
          opt.label,
        )),
      )
      : null,
  )
}

export function TextInput(props: {
  value: string
  placeholder?: string
  onChange: (value: string) => void
}): React.ReactElement {
  return React.createElement('input', {
    className: 'bcc-input',
    type: 'text',
    value: props.value,
    placeholder: props.placeholder,
    onChange: (ev: React.ChangeEvent<HTMLInputElement>) => props.onChange(ev.target.value),
  })
}

export function TextArea(props: {
  value: string
  rows?: number
  placeholder?: string
  onChange: (value: string) => void
}): React.ReactElement {
  return React.createElement('textarea', {
    className: 'bcc-textarea',
    value: props.value,
    rows: props.rows ?? 8,
    placeholder: props.placeholder,
    spellCheck: false,
    onChange: (ev: React.ChangeEvent<HTMLTextAreaElement>) => props.onChange(ev.target.value),
  })
}

export function NumberInput(props: {
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}): React.ReactElement {
  return React.createElement('input', {
    className: 'bcc-input',
    type: 'number',
    value: props.value,
    min: props.min,
    max: props.max,
    step: props.step,
    onChange: (ev: React.ChangeEvent<HTMLInputElement>) => {
      const n = parseFloat(ev.target.value)
      if (Number.isFinite(n)) props.onChange(n)
    },
  })
}
