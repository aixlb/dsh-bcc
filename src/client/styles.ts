/**
 * Colors come only from DSH design tokens on `body`.
 * Do not hardcode a palette — light/dark is owned by ui-theme.
 */
const CSS = `
.bcc-dock,
.bcc-cmd {
  color-scheme: light;
  font: inherit;
  color: var(--dsw-alias-label-primary);
}
body[data-ds-dark-theme] .bcc-dock,
body[data-ds-dark-theme] .bcc-cmd {
  color-scheme: dark;
}

.bcc-muted {
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
}
.bcc-chip-err {
  color: var(--dsw-alias-state-error-primary);
  font-size: 12px;
  line-height: 18px;
}

.bcc-btn,
.bcc-pop-go,
.bcc-cmd-reset,
.bcc-dock-icon,
.bcc-header-btn,
.bcc-select-trigger,
.bcc-select-item,
.bcc-seg button {
  font: inherit;
  cursor: pointer;
}
.bcc-btn,
.bcc-pop-go,
.bcc-cmd-reset {
  box-sizing: border-box;
  height: 32px;
  padding: 0 12px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 18px;
}
.bcc-btn:disabled,
.bcc-pop-go:disabled,
.bcc-cmd-reset:disabled {
  opacity: 0.45;
  cursor: wait;
}
.bcc-btn-primary,
.bcc-pop-go {
  border: 0;
  background: var(--dsw-alias-button-info-fill);
  color: var(--dsw-alias-label-primary-foreground);
}
.bcc-btn-primary:hover:not(:disabled),
.bcc-pop-go:hover:not(:disabled) {
  background: var(--dsw-alias-button-info-hover);
}
.bcc-btn-ghost,
.bcc-cmd-reset {
  border: 1px solid var(--dsw-alias-border-l2);
  background: transparent;
  color: var(--dsw-alias-label-primary);
}
.bcc-btn-ghost:hover:not(:disabled),
.bcc-cmd-reset:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
}

.bcc-cmd {
  display: grid;
  gap: 8px;
  padding: 10px 12px;
  max-width: var(--dsh-composer-card-max-width, 640px);
  color: var(--dsw-alias-label-primary);
}
.bcc-cmd-title {
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
}
.bcc-cmd-start { display: grid; gap: 8px; }
.bcc-cmd-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}
.bcc-cmd-actions .bcc-select { flex: 1; min-width: 0; }

.bcc-header-btn {
  min-height: 28px;
  padding: 3px 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
}
.bcc-header-btn:hover,
.bcc-header-btn-on {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}

.bcc-dock {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 1;
  width: min(380px, 92vw);
  display: flex;
  flex-direction: column;
  background: var(--dsw-alias-bg-base);
  border-left: 1px solid var(--dsw-alias-border-l2);
  color: var(--dsw-alias-label-primary);
}
.bcc-dock-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
  height: 100%;
  overflow: auto;
  padding: 0 14px 16px;
}
.bcc-dock-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  position: sticky;
  top: 0;
  z-index: 1;
  margin: 0 -14px;
  padding: 12px 14px 10px;
  background: var(--dsw-alias-bg-base);
  border-bottom: 1px solid var(--dsw-alias-border-l2);
}
.bcc-dock-title {
  color: var(--dsw-alias-label-primary);
  font-size: 14px;
  font-weight: 500;
  line-height: 22px;
}
.bcc-dock-icon {
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font-size: 18px;
  line-height: 1;
}
.bcc-dock-icon:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}

.bcc-dock-section { display: grid; gap: 8px; }
.bcc-dock-section-title {
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.04em;
  line-height: 18px;
  text-transform: uppercase;
}
.bcc-dock-field { display: grid; gap: 4px; font-size: 12px; }
.bcc-dock-field > span {
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
}

.bcc-input,
.bcc-select-trigger {
  box-sizing: border-box;
  width: 100%;
  height: 32px;
  margin: 0;
  padding: 0 10px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: var(--dsw-alias-markdown-code-block);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  outline: none;
}
.bcc-textarea {
  box-sizing: border-box;
  width: 100%;
  min-height: 140px;
  margin: 0;
  padding: 8px 10px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: var(--dsw-alias-markdown-code-block);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12px;
  line-height: 18px;
  resize: vertical;
  outline: none;
}
.bcc-textarea:focus {
  border-color: var(--dsw-alias-button-info-fill);
}
.bcc-input::placeholder,
.bcc-textarea::placeholder {
  color: var(--dsw-alias-label-tertiary);
}
.bcc-input:hover,
.bcc-select-trigger:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}
.bcc-input:focus,
.bcc-select-trigger:focus-visible {
  border-color: var(--dsw-alias-button-info-fill);
}
.bcc-dock input[type="number"]::-webkit-inner-spin-button,
.bcc-dock input[type="number"]::-webkit-outer-spin-button {
  opacity: 0.5;
}

.bcc-select { position: relative; min-width: 0; }
.bcc-select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  text-align: left;
}
.bcc-select-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bcc-select-caret {
  flex: none;
  color: var(--dsw-alias-label-tertiary);
  font-size: 10px;
}
.bcc-select-menu {
  position: fixed;
  z-index: 80;
  box-sizing: border-box;
  max-height: min(280px, 50vh);
  overflow: auto;
  padding: 4px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 12px;
  background: var(--dsw-alias-bg-overlay);
  box-shadow: var(--dsw-shadow-lv3);
  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2);
  --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2);
}
.bcc-select-item {
  display: block;
  width: 100%;
  min-height: 32px;
  padding: 6px 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  line-height: 18px;
  text-align: left;
}
.bcc-select-item:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}
.bcc-select-item.is-on {
  background: var(--dsw-alias-bg-module-platform);
  color: var(--dsw-alias-label-primary);
}

.bcc-dock-num { display: grid; gap: 4px; }
.bcc-dock-video {
  width: 100%;
  max-height: 160px;
  border-radius: 8px;
  background: #000;
  accent-color: var(--dsw-alias-button-info-fill);
}

.bcc-seg {
  display: flex;
  overflow: hidden;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: var(--dsw-alias-bg-base);
}
.bcc-seg button {
  flex: 1;
  height: 32px;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
}
.bcc-seg button + button {
  border-left: 1px solid var(--dsw-alias-border-l2);
}
.bcc-seg button:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.bcc-seg-on {
  background: var(--dsw-alias-bg-module-platform) !important;
  color: var(--dsw-alias-label-primary) !important;
}

.bcc-dock-foot {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: auto;
  padding-top: 8px;
}
.bcc-dock-foot .bcc-btn-primary,
.bcc-dock-foot .bcc-pop-go { flex: 1; }
`

export function injectStyles(): void {
  if (typeof document === 'undefined') return
  let el = document.querySelector('style[data-bcc="1"]') as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.dataset.bcc = '1'
    document.head.appendChild(el)
  }
  el.textContent = CSS
}
