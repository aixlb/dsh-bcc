const CSS = `
.bcc-muted { opacity: 0.65; font-size: 12px; }
.bcc-chip-err {
  color: #f0a070;
  font-size: 12px;
  font-weight: 700;
}
.bcc-pop-row {
  display: grid;
  grid-template-columns: 92px 1fr;
  gap: 8px;
  align-items: center;
  font-size: 12px;
}
.bcc-pop-row select,
.bcc-pop-row input {
  width: 100%;
  height: 28px;
  border-radius: 6px;
  border: 1px solid var(--dsw-alias-border, #444);
  background: var(--dsw-alias-fill, #111);
  color: inherit;
  padding: 0 8px;
}
.bcc-pop-go,
.bcc-cmd-reset {
  height: 32px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
}
.bcc-pop-go {
  border: 0;
  background: var(--dsw-alias-brand, #f5c06a);
  color: #111;
  font-weight: 600;
}
.bcc-pop-go:disabled { opacity: 0.6; cursor: wait; }
.bcc-cmd-reset {
  background: transparent;
  color: inherit;
  border: 1px solid var(--dsw-alias-border, #444);
}
.bcc-cmd {
  display: grid;
  gap: 8px;
  padding: 10px 12px;
  max-width: var(--dsh-composer-card-max-width, 640px);
}
.bcc-cmd-title {
  font-weight: 600;
  font-size: 13px;
}
.bcc-cmd-start { display: grid; gap: 8px; }
.bcc-cmd-actions { display: flex; gap: 8px; flex-wrap: wrap; }
`

let injected = false
export function injectStyles(): void {
  if (injected || typeof document === 'undefined') return
  injected = true
  const el = document.createElement('style')
  el.dataset.bcc = '1'
  el.textContent = CSS
  document.head.appendChild(el)
}
