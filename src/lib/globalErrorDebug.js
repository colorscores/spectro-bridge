// Global error debug overlay - only loaded when imported from main.jsx in debug mode
(function initGlobalDebugOverlay() {
  if (typeof window === 'undefined') return;
  if (window.__DEBUG_OVERLAY_INIT) return;
  window.__DEBUG_OVERLAY_INIT = true;

  const createOverlay = () => {
    const overlay = document.createElement('div');
    overlay.id = '__debug-overlay';
    overlay.style.position = 'fixed';
    overlay.style.zIndex = '99999';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(0,0,0,0.6)';
    overlay.style.color = '#fff';
    overlay.style.display = 'none';
    overlay.style.fontFamily = 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji';

    const panel = document.createElement('div');
    panel.style.position = 'absolute';
    panel.style.right = '16px';
    panel.style.bottom = '16px';
    panel.style.left = '16px';
    panel.style.maxHeight = '40%';
    panel.style.overflow = 'auto';
    panel.style.background = '#111827';
    panel.style.border = '1px solid rgba(255,255,255,0.2)';
    panel.style.borderRadius = '12px';
    panel.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
    panel.style.padding = '16px';

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = '8px';

    const title = document.createElement('div');
    title.textContent = 'Debug Overlay';
    title.style.fontWeight = '700';
    title.style.letterSpacing = '0.01em';

    const controls = document.createElement('div');

    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear';
    clearBtn.style.marginRight = '8px';
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';

    [clearBtn, closeBtn].forEach(btn => {
      btn.style.background = 'transparent';
      btn.style.border = '1px solid rgba(255,255,255,0.3)';
      btn.style.color = '#fff';
      btn.style.padding = '6px 10px';
      btn.style.borderRadius = '8px';
      btn.style.cursor = 'pointer';
    });

    controls.appendChild(clearBtn);
    controls.appendChild(closeBtn);

    const log = document.createElement('pre');
    log.style.whiteSpace = 'pre-wrap';
    log.style.fontSize = '12px';
    log.style.lineHeight = '1.4';
    log.style.margin = '0';

    header.appendChild(title);
    header.appendChild(controls);
    panel.appendChild(header);
    panel.appendChild(log);
    overlay.appendChild(panel);

    document.body.appendChild(overlay);

    const show = (text) => {
      log.textContent = text;
      overlay.style.display = 'block';
    };
    const hide = () => {
      overlay.style.display = 'none';
    };

    clearBtn.addEventListener('click', () => {
      log.textContent = '';
    });
    closeBtn.addEventListener('click', hide);

    return { show, hide, logEl: log, el: overlay };
  };

  const overlay = createOverlay();
  const format = (msg, stack) => {
    const ts = new Date().toISOString();
    return `[${ts}] ${msg || 'Unknown error'}\n\n${stack || ''}`;
  };

  window.addEventListener('error', (event) => {
    try {
      const msg = event?.message || String(event?.error || 'Error');
      const stack = event?.error?.stack || '';
      overlay.show(format(msg, stack));
    } catch {}
  });

  window.addEventListener('unhandledrejection', (event) => {
    try {
      const reason = event?.reason;
      const msg = typeof reason === 'string' ? reason : (reason?.message || 'Unhandled rejection');
      const stack = reason?.stack || '';
      overlay.show(format(msg, stack));
    } catch {}
  });
})();
