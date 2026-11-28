// Page init script for demo recordings, registered through AGENT_BROWSER_INIT_SCRIPTS.
// It runs in every page before the app's own scripts and adds:
//   - window.__demoVideo.caption(text) / .clear(): a caption bar at the bottom of the page.
//     The text lives in sessionStorage, so it survives a full navigation;
//   - a ring where the pointer goes down, so a viewer sees each click;
//   - a rule that hides the Next.js dev indicator, which is not part of the product.
(() => {
  if (window.__demoVideo) return;

  const KEY = '__demo_video_caption';
  const CAPTION_ID = '__demo_video_caption';
  const RING_MS = 650;
  const CURSOR_ID = '__demo_video_cursor';
  const GLIDE_MS = 350;
  const CURSOR_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 22 22" width="22" height="22">' +
    '<path d="M3 2l15 8.5-6.6 1.4L8 18.5z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  const CSS = `
    nextjs-portal { display: none !important; }
    #${CAPTION_ID} {
      position: fixed; left: 50%; bottom: 48px; transform: translateX(-50%);
      max-width: min(82vw, 1100px); padding: 12px 24px; border-radius: 12px;
      background: rgba(15, 17, 23, 0.9); color: #fff; z-index: 2147483647;
      font: 500 20px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif;
      text-align: center; box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35); pointer-events: none;
    }
    .__demo_video_ring {
      position: fixed; width: 36px; height: 36px; margin: -18px 0 0 -18px; border-radius: 50%;
      border: 3px solid #f5a524; background: rgba(245, 165, 36, 0.25); pointer-events: none;
      z-index: 2147483646; animation: __demo_video_ring ${RING_MS}ms ease-out forwards;
    }
    #${CURSOR_ID} {
      position: fixed; left: 0; top: 0; width: 22px; height: 22px; pointer-events: none;
      z-index: 2147483647; transition: transform ${GLIDE_MS}ms ease-out;
      filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6));
    }
    @keyframes __demo_video_ring {
      from { transform: scale(0.4); opacity: 1; }
      to { transform: scale(1.9); opacity: 0; }
    }
  `;

  const whenBodyExists = (fn) => {
    if (document.body) fn();
    else document.addEventListener('DOMContentLoaded', fn, { once: true });
  };

  const stored = () => {
    try {
      return sessionStorage.getItem(KEY);
    } catch {
      return null; // storage is unavailable on some pages (about:blank, sandboxed frames)
    }
  };

  const store = (text) => {
    try {
      if (text) sessionStorage.setItem(KEY, text);
      else sessionStorage.removeItem(KEY);
    } catch {
      // Without storage the caption still shows; it only does not survive a navigation.
    }
  };

  const render = (text) => {
    const existing = document.getElementById(CAPTION_ID);
    if (!text) {
      existing?.remove();
      return;
    }
    const bar = existing ?? document.body.appendChild(Object.assign(document.createElement('div'), { id: CAPTION_ID }));
    bar.textContent = text;
  };

  window.__demoVideo = {
    caption(text) {
      store(text);
      whenBodyExists(() => render(text));
      return true;
    },
    clear() {
      store(null);
      whenBodyExists(() => render(null));
      return true;
    },
  };

  whenBodyExists(() => {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    render(stored());
    // A client-side render can replace the body's children; put the caption back.
    new MutationObserver(() => {
      const text = stored();
      if (text && !document.getElementById(CAPTION_ID)) render(text);
    }).observe(document.body, { childList: true });
  });

  // The pointer: agent-browser moves the mouse in one jump, the transition turns it into a glide.
  window.addEventListener(
    'mousemove',
    (event) => {
      if (!document.body) return;
      const cursor =
        document.getElementById(CURSOR_ID) ??
        document.body.appendChild(Object.assign(document.createElement('div'), { id: CURSOR_ID, innerHTML: CURSOR_SVG }));
      cursor.style.transform = `translate(${event.clientX - 3}px, ${event.clientY - 2}px)`;
    },
    true,
  );

  window.addEventListener(
    'pointerdown',
    (event) => {
      if (!document.body) return;
      const ring = document.createElement('div');
      ring.className = '__demo_video_ring';
      ring.style.left = `${event.clientX}px`;
      ring.style.top = `${event.clientY}px`;
      document.body.appendChild(ring);
      setTimeout(() => ring.remove(), RING_MS + 50);
    },
    true,
  );
})();
