/* YouTube layout is opt-in and local to the managed document. No player API calls. */
(() => {
  'use strict';
  if (globalThis.__cleanWindowYoutubeUI) return;
  const ATTRIBUTE = 'data-clean-window-youtube';
  const STYLE_ID = 'clean-window-youtube-style';
  let level = 'off', style, observer, resizeObserver, toolbar, frame, listening = false;
  const html = document.documentElement;
  const originalAttribute = html.getAttribute(ATTRIBUTE);
  const scope = value => `html[${ATTRIBUTE}="${value}"]`;
  // The shared focus-view rules apply only to levels 2 and 3. Level 1 only
  // shifts YouTube's app below its permanently visible toolbar.
  const active = `:is(${scope(2)}, ${scope(3)})`;
  const css = `
    ${active} { --cw-youtube-viewport-height:100vh; }
    @supports (height:100dvh) {
      ${active} { --cw-youtube-viewport-height:100dvh; }
    }
    ${active} #masthead-container { display:none!important; }
    ${active} body { margin:0!important; }
    ${active} ytd-page-manager { margin-top:0!important; }
    ${active} ytd-watch-flexy { margin-top:0!important;padding-top:0!important; }
    ${active} ytd-watch-flexy #player-container,
    ${active} ytd-watch-flexy ytd-player,
    ${active} ytd-watch-flexy ytd-player > #container,
    ${active} ytd-watch-flexy #movie_player,
    ${active} ytd-watch-flexy .html5-video-container {
      width:100%!important;height:100%!important;min-height:0!important;max-height:none!important;
    }
    ${active} ytd-watch-flexy video.html5-main-video {
      position:absolute!important;inset:0!important;width:100%!important;height:100%!important;
      max-width:none!important;max-height:none!important;margin:0!important;
      transform:none!important;object-fit:contain!important;
    }
    /* The app is normally absolute at top:0, bypassing the drawn bar's root padding. */
    ${scope(1)} ytd-app,
    ${scope(2)} ytd-app {
      position:relative!important;top:var(--cw-youtube-top-offset)!important;
    }
    /* The outer stage reserves flow space for the content below the player. */
    ${scope(2)} ytd-watch-flexy[theater] #full-bleed-container,
    ${scope(2)} ytd-watch-flexy[theater] #player-full-bleed-container,
    ${scope(2)} ytd-watch-flexy:not([theater]) #player-container-outer {
      height:max(0px,min(calc(var(--cw-youtube-viewport-height) - var(--cw-youtube-toolbar-height)),
        calc(var(--cw-youtube-page-width) / var(--cw-youtube-aspect))))!important;
      min-height:0!important;max-height:none!important;
      min-width:0!important;max-width:none!important;width:100%!important;
    }
    ${scope(2)} ytd-watch-flexy:not([theater]) #columns { display:block!important; }
    ${scope(2)} ytd-watch-flexy:not([theater]) #primary {
      width:100%!important;max-width:none!important;min-width:0!important;margin:0!important;padding:0!important;
    }
    ${scope(2)} ytd-watch-flexy #player-container { position:relative!important;inset:auto!important; }
    ${scope(3)}, ${scope(3)} body { overflow:hidden!important;background:#000!important; }
    /* A tall fixed player can otherwise paint underneath YouTube's sibling stacking contexts. */
    ${scope(3)} body * { visibility:hidden!important; }
    ${scope(3)} #player-container, ${scope(3)} #player-container *,
    ${scope(3)} #clean-window-edge-control { visibility:visible!important; }
    ${scope(3)} #full-bleed-container, ${scope(3)} #player-full-bleed-container {
      overflow:visible!important;
    }
    ${scope(3)} ytd-watch-flexy #player-container {
      position:fixed!important;inset:0!important;width:100%!important;height:var(--cw-youtube-viewport-height)!important;
      min-width:0!important;max-width:none!important;margin:0!important;
      z-index:2147483000!important;background:#000!important;
    }
  `;

  function clearStyle() {
    resizeObserver?.disconnect();
    toolbar = null;
    style?.remove();
    style = null;
    if (originalAttribute === null) html.removeAttribute(ATTRIBUTE);
    else html.setAttribute(ATTRIBUTE, originalAttribute);
  }
  function sync() {
    frame = null;
    const youtube = ['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(location.hostname);
    const watch = youtube && location.pathname === '/watch' &&
      document.querySelector('ytd-watch-flexy:not([hidden]) #movie_player video');
    // Native fullscreen owns its own sizing and controls until the user exits it.
    if (![1, 2, 3].includes(level) || !watch || document.fullscreenElement) {
      clearStyle();
      return;
    }
    if (!style?.isConnected) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      (document.head || html).append(style);
    }
    const bar = document.getElementById('clean-window-address-ui');
    if (bar !== toolbar) {
      resizeObserver?.disconnect();
      toolbar = bar;
      if (toolbar) {
        resizeObserver ||= new ResizeObserver(schedule);
        resizeObserver.observe(toolbar);
      }
    }
    // The level-2 URL bar is a collapsed overlay until hover or keyboard focus.
    // Measure its effective layout contribution, not its transformed box height.
    const hiddenBarCollapsed = toolbar?.dataset.cwHidden === 'true'
      && !toolbar.matches(':hover, :focus-within')
      && toolbar.dataset.cwMenuOpen !== 'true';
    // Both measurements are CSS pixels, so browser zoom and monitor DPI need no conversion.
    const barHeight = toolbar && !hiddenBarCollapsed ? toolbar.getBoundingClientRect().height : 0;
    const rootPadding = parseFloat(getComputedStyle(html).paddingTop) || 0;
    const pageWidth = html.getBoundingClientRect().width;
    const aspect = watch.videoWidth && watch.videoHeight ? watch.videoWidth / watch.videoHeight : 16 / 9;
    const rules = css + `${scope(level)} { --cw-youtube-toolbar-height:${barHeight}px;` +
      `--cw-youtube-top-offset:${barHeight - rootPadding}px;` +
      `--cw-youtube-page-width:${pageWidth}px;--cw-youtube-aspect:${aspect}; }`;
    // Avoid a mutation-observer loop when a layout notification changes no measurements.
    if (style.textContent !== rules) style.textContent = rules;
    if (html.getAttribute(ATTRIBUTE) !== String(level)) html.setAttribute(ATTRIBUTE, String(level));
  }
  function schedule() {
    if (frame === null || frame === undefined) frame = requestAnimationFrame(sync);
  }
  function apply(next) {
    level = next;
    const enabled = [1, 2, 3].includes(level) &&
      ['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(location.hostname);
    if (!enabled) {
      observer?.disconnect();
      observer = null;
      if (frame !== null && frame !== undefined) cancelAnimationFrame(frame);
      frame = null;
      if (listening) {
        for (const name of ['yt-navigate-finish', 'yt-page-data-updated', 'fullscreenchange']) {
          document.removeEventListener(name, schedule);
        }
        for (const name of ['pointerover', 'pointerout', 'focusin', 'focusout']) {
          document.removeEventListener(name, schedule, true);
        }
        window.removeEventListener('popstate', schedule);
        window.removeEventListener('resize', schedule);
        window.visualViewport?.removeEventListener('resize', schedule);
        document.removeEventListener('loadedmetadata', schedule, true);
        document.removeEventListener('resize', schedule, true);
      }
      listening = false;
      clearStyle();
      return;
    }
    if (!listening) {
      for (const name of ['yt-navigate-finish', 'yt-page-data-updated', 'fullscreenchange']) {
        document.addEventListener(name, schedule);
      }
      for (const name of ['pointerover', 'pointerout', 'focusin', 'focusout']) {
        document.addEventListener(name, schedule, true);
      }
      window.addEventListener('popstate', schedule);
      window.addEventListener('resize', schedule);
      window.visualViewport?.addEventListener('resize', schedule);
      document.addEventListener('loadedmetadata', schedule, true);
      document.addEventListener('resize', schedule, true);
      // YouTube can create/replace the player after navigation has completed.
      observer = new MutationObserver(schedule);
      observer.observe(html, { childList:true, subtree:true });
      listening = true;
    }
    sync();
  }
  globalThis.__cleanWindowYoutubeUI = { apply };
})();
