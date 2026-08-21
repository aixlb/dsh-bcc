const CSS = `
.bcc-workbench {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr) 260px;
  height: 100%;
  min-height: 0;
  background: var(--dsw-alias-bg, #111);
  color: var(--dsw-alias-text, #eee);
  font-size: 13px;
}
.bcc-col {
  min-width: 0;
  min-height: 0;
  overflow: auto;
  border-right: 1px solid var(--dsw-alias-border, #333);
  padding: 8px;
}
.bcc-col:last-child { border-right: none; }
.bcc-title {
  font-weight: 600;
  margin: 0 0 8px;
  color: var(--dsw-alias-text, #fff);
}
.bcc-item {
  display: block;
  width: 100%;
  text-align: left;
  background: transparent;
  color: inherit;
  border: 0;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
}
.bcc-item[data-active="true"],
.bcc-item:hover {
  background: var(--dsw-alias-fill-hover, rgba(255,255,255,0.08));
}
.bcc-video {
  width: 100%;
  max-height: 46%;
  background: #000;
  border-radius: 8px;
}
.bcc-timeline {
  display: flex;
  gap: 2px;
  margin-top: 8px;
  height: 28px;
}
.bcc-shot {
  flex: 1;
  min-width: 4px;
  background: var(--dsw-alias-fill, #444);
  border: 0;
  padding: 0;
  cursor: pointer;
  border-radius: 2px;
}
.bcc-shot[data-active="true"] { background: var(--dsw-alias-brand, #f5c06a); }
.bcc-process { display: grid; gap: 8px; }
.bcc-thumb { width: 100%; border-radius: 6px; background: #000; }
.bcc-muted { opacity: 0.65; font-size: 12px; }
.bcc-banner {
  grid-column: 1 / -1;
  padding: 8px 12px;
  background: color-mix(in srgb, #c45c26 25%, transparent);
}
.bcc-sidebar-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  color: inherit;
  border: 0;
  cursor: pointer;
  padding: 4px 8px;
}
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
