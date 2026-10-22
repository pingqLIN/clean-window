/** Explicit-target window operations and opt-in content UI. */
export function createController(api) {
  const busy = new Set();
  const cleanKey = id => `clean:${id}`;
  const fullKey = id => `full:${id}`;
  const read = async key => (await api.storage.session.get(key))[key];
  const write = (key, value) => api.storage.session.set({ [key]: value });
  const forget = key => api.storage.session.remove(key);
  const bounds = win => Object.fromEntries(
    ['left', 'top', 'width', 'height']
      .filter(key => Number.isInteger(win[key]))
      .map(key => [key, win[key]])
  );
  const isId = id => Number.isInteger(id) && id >= 0;
  const validLevel = level => Number.isInteger(level) && level >= 1 && level <= 3;
  const levelMode = level => level === 1 ? 'address-dock' : 'address';
  async function assertLocation(tabId, windowId) {
    const current = await api.tabs.get(tabId);
    if (current.windowId !== windowId) throw new Error('目標分頁已移至另一視窗；請重新開啟操作面板。');
  }

  async function toCleanWindow(tab, win, level = 2) {
    if (win.state === 'fullscreen') throw new Error('請先退出全螢幕，再切換精簡視窗。');
    if (tab.groupId >= 0) throw new Error('此分頁屬於群組；為保留群組，請改用「整個視窗全螢幕」。');
    if (tab.splitViewId >= 0) throw new Error('此分頁在分割檢視（Split View）中；請改用「整個視窗全螢幕」。');
    const key = cleanKey(tab.id);
    const record = {
      originWindowId: win.id, originIndex: tab.index, pinned: tab.pinned,
      originState: win.state, incognito: win.incognito,
      phase: 'opening', popupWindowId: null, detachedWindowId: null,
      cleanLevel: level,
      detachedType: 'popup',
      label: typeof tab.title === 'string' ? tab.title.slice(0,160) : ''
    };
    // Journal before moving. A storage failure must not alter any window.
    await write(key, record);
    let created;
    try {
      await assertLocation(tab.id, win.id);
      created = await api.windows.create({
        tabId: tab.id, type: 'popup', state: 'normal', focused: true,
        incognito: !!win.incognito, ...bounds(win)
      });
      if (!isId(created?.id)) throw new Error('Chrome 未回傳新視窗的識別碼。');
      await write(key, { ...record, phase: 'open', detachedWindowId: created.id,
        popupWindowId: created.id });
      return { windowId: created.id, mode: 'clean', level };
    } catch (error) {
      // Keep the pre-move journal if the window was already created.
      if (!created) await forget(key).catch(() => {});
      throw error;
    }
  }

  async function fromPopup(tab, win) {
    const key = cleanKey(tab.id);
    const saved = await read(key);
    // Ignore stale metadata when the user has moved a tab to another popup.
    const record = saved && (saved.popupWindowId === win.id || saved.phase === 'opening') ? saved : null;
    // tabs.move is documented for normal windows. First rehouse the same tab
    // with windows.create(tabId), rather than relying on popup move exceptions.
    await assertLocation(tab.id, win.id);
    const restored = await api.windows.create({
      tabId: tab.id, type: 'normal', state: 'normal', focused: true,
      incognito: !!win.incognito, ...bounds(win)
    });
    if (!isId(restored?.id)) throw new Error('Chrome 未回傳還原視窗的識別碼。');
    let destination = restored.id;
    const warnings = [];
    if (record) {
      let origin;
      try { origin = await api.windows.get(record.originWindowId); } catch { /* Closed origin is normal. */ }
      if (origin?.type === 'normal' && !!origin.incognito === !!win.incognito) {
        try {
          await api.tabs.move(tab.id, { windowId: origin.id, index: record.originIndex });
          destination = origin.id;
        } catch {
          warnings.push('無法合併回原視窗；分頁已安全保留在新的普通視窗。');
        }
      } else if (record.originState === 'maximized') {
        try { await api.windows.update(destination, { state: 'maximized' }); }
        catch { warnings.push('已還原普通視窗，但未能恢復最大化。'); }
      }
      try { await api.tabs.update(tab.id, { pinned: !!record.pinned, active: true }); }
      catch { warnings.push('分頁已還原，但固定分頁狀態未能恢復。'); }
    }
    if (destination !== restored.id) {
      try {
        await api.tabs.update(tab.id, { active: true });
        await api.windows.update(destination, { focused: true });
      } catch { warnings.push('分頁已還原；請手動點選原視窗。'); }
    }
    await forget(key).catch(() => warnings.push('還原資訊未能清除；不影響已還原的分頁。'));
    return { windowId: destination, mode: 'normal', warning: warnings.join(' ') || undefined };
  }

  async function fromDetachedNormal(tab, win, record) {
    await assertLocation(tab.id, win.id);
    const warnings = [];
    let destination = win.id;
    let origin;
    try { origin = await api.windows.get(record.originWindowId); }
    catch { /* Source can close when its last tab is detached. */ }
    if (origin?.type === 'normal' && !!origin.incognito === !!win.incognito) {
      try {
        await api.tabs.move(tab.id, { windowId: origin.id, index: record.originIndex });
        destination = origin.id;
      } catch {
        warnings.push('無法合併回原視窗；分頁保留在目前的普通視窗。');
      }
    } else {
      warnings.push('原視窗已關閉或無法合併；分頁保留在目前的普通視窗。');
    }
    try { await api.tabs.update(tab.id, { pinned: !!record.pinned, active: true }); }
    catch { warnings.push('無法恢復原本的固定分頁狀態。'); }
    if (destination !== win.id) {
      try { await api.windows.update(destination, { focused: true }); }
      catch { warnings.push('分頁已還原；請手動點選原視窗。'); }
    }
    await forget(cleanKey(tab.id)).catch(() => warnings.push('還原資訊未能清除。'));
    return { windowId: destination, mode: 'normal', warning: warnings.join(' ') || undefined };
  }

  async function leaveFullscreen(win) {
    const key = fullKey(win.id);
    const saved = await read(key);
    const state = saved?.state === 'maximized' ? 'maximized' : 'normal';
    await api.windows.update(win.id, { state });
    let warning;
    if (state === 'normal' && saved?.bounds) {
      try { await api.windows.update(win.id, saved.bounds); }
      catch { warning = '已退出全螢幕；螢幕配置可能改變，請手動調整視窗大小。'; }
    }
    await forget(key);
    return { windowId: win.id, mode: state, warning };
  }

  async function toggleFullscreen(win) {
    if (win.state === 'fullscreen') return leaveFullscreen(win);
    const key = fullKey(win.id);
    await write(key, { state: win.state, bounds: bounds(win) });
    try { await api.windows.update(win.id, { state: 'fullscreen' }); }
    catch (error) { await forget(key).catch(() => {}); throw error; }
    return { windowId: win.id, mode: 'fullscreen' };
  }

  async function pageUI(tab, mode) {
    try {
      // The injected script survives moving the tab into a popup, even if
      // the post-move scripting permission is no longer available.
      try {
        const existing = await api.tabs.sendMessage(tab.id, { type: 'clean-window:page-ui', mode });
        if (existing?.ok) return existing;
      } catch { /* First use on this document: install below. */ }
      await api.scripting.executeScript({ target: { tabId: tab.id }, files: ['page-ui.js'] });
      const response = await api.tabs.sendMessage(tab.id, { type: 'clean-window:page-ui', mode });
      if (!response?.ok) throw new Error(response?.error || '頁面控制項無法套用。');
      return response;
    } catch (error) {
      throw new Error('此頁面無法執行自繪介面：' + (error?.message || String(error)));
    }
  }

  async function clearPageUI(tab) {
    try { await api.tabs.sendMessage(tab.id, { type: 'clean-window:page-ui', mode: 'off' }); }
    catch { /* No active content script, restricted URL or page navigation. */ }
  }

  async function edgeUI(tab, level, { prepared = false } = {}) {
    if (level !== 'off' && !prepared) {
      try {
        const existing = await api.tabs.sendMessage(tab.id, { type: 'clean-window:edge-ui', level });
        if (existing?.ok) return existing;
      } catch { /* New document or controller not yet injected. */ }
      await api.scripting.executeScript({ target: { tabId: tab.id }, files: ['edge-ui.js', 'youtube-ui.js', 'page-ui.js'] });
    }
    const response = await api.tabs.sendMessage(tab.id, { type: 'clean-window:edge-ui', level });
    if (!response?.ok) throw new Error(response?.error || '頁面邊緣工具無法更新。');
  }

  async function clearEdgeUI(tab) {
    try { await edgeUI(tab, 'off'); }
    catch { /* Script may already be gone after a page navigation. */ }
  }

  async function titleUI(tab, action, anchor) {
    try {
      if (action !== 'off') {
        // Reuse an already injected controller first. Moving a tab into a
        // popup can make a second executeScript fail even though the script
        // remains alive in the same document.
        try {
          const existing = await api.tabs.sendMessage(tab.id, { type: 'clean-window:title', action,
            ...(action === 'edit' && anchor ? {anchor} : {}) });
          if (existing?.ok) return existing;
        } catch { /* New document: install the script below when permitted. */ }
        await api.scripting.executeScript({ target: { tabId: tab.id }, files: ['title-ui.js'] });
      }
      const response = await api.tabs.sendMessage(tab.id, { type: 'clean-window:title', action,
        ...(action === 'edit' && anchor ? {anchor} : {}) });
      if (!response?.ok) throw new Error(response?.error || '標題控制未回應。');
      return response;
    } catch (error) {
      if (action === 'off') return; // Restricted/newly navigated pages have no active override.
      throw new Error('無法存取此頁面的標題：' + (error?.message || String(error)));
    }
  }

  async function selectedLevel() {
    const prefs = await api.storage.local.get('cleanLevel');
    const level = prefs.cleanLevel;
    return validLevel(level) ? level : 1;
  }

  async function run(action, target, options = {}) {
    if (!['toggle-clean', 'toggle-fullscreen', 'restore', 'edit-title', 'set-level'].includes(action)) throw new Error('不支援的操作。');
    if (!isId(target?.windowId) || !isId(target?.tabId)) throw new Error('找不到有效的目標視窗／分頁。');
    const locks = [`window:${target.windowId}`, `tab:${target.tabId}`];
    if (locks.some(key => busy.has(key))) throw new Error('此視窗正在切換，請勿重複操作。');
    locks.forEach(key => busy.add(key));
    try {
      const tab = await api.tabs.get(target.tabId);
      if (tab.windowId !== target.windowId) throw new Error('目標分頁已移至另一視窗；請重新開啟操作面板。');
      let win = await api.windows.get(target.windowId);
      if (!['normal', 'popup'].includes(win.type)) throw new Error('此類型視窗不支援；未做任何變更。');
      if (action === 'set-level') {
        const requested = options.level;
        if (!validLevel(requested)) throw new Error('簡化等級必須是 1、2 或 3。');
        const key = cleanKey(tab.id);
        const record = await read(key);
        if (win.type !== 'popup' || !record || record.popupWindowId !== win.id ||
            record.phase !== 'open') {
          throw new Error('僅能調整 Clean Window 建立的乾淨 Popup。');
        }
        const previous = validLevel(record.cleanLevel) ? record.cleanLevel : 1;
        if (previous === requested) return {windowId:win.id,mode:'clean',level:requested};
        if (requested === 3) await clearPageUI(tab);
        else await pageUI(tab, levelMode(requested));
        try {
          await write(key, { ...record, cleanLevel: requested });
          await api.storage.local.set({ cleanLevel: requested });
        } catch (error) {
          if (previous === 3) await clearPageUI(tab);
          else await pageUI(tab, levelMode(previous)).catch(() => {});
          await write(key, record).catch(() => {});
          throw error;
        }
        let warning;
        try { await edgeUI(tab, requested); }
        catch { warning = '已切換等級；此頁面的邊緣工具無法更新，可使用快捷鍵還原。'; }
        return {windowId:win.id,mode:'clean',level:requested,warning};
      }
      if (action === 'edit-title') {
        const record = await read(cleanKey(tab.id));
        if (win.type !== 'popup' || !record ||
            (record.popupWindowId !== win.id && record.phase !== 'opening')) {
          throw new Error('請先進入本擴充建立的乾淨 Popup，再編輯頁面標題。');
        }
        await titleUI(tab, 'start');
        await titleUI(tab, 'edit', options.anchor);
        return { windowId: win.id, mode: 'title-editor' };
      }
      if (action === 'toggle-fullscreen') return await toggleFullscreen(win);
      const savedClean = win.type === 'normal' ? await read(cleanKey(tab.id)) : null;
      const detachedNormal = savedClean?.detachedType === 'normal'
        && savedClean.originWindowId !== win.id
        && (savedClean.detachedWindowId === win.id || savedClean.phase === 'opening');
      if (action === 'toggle-clean') {
        if ((win.type === 'popup' || detachedNormal) && win.state === 'fullscreen') {
          await leaveFullscreen(win);
          win = await api.windows.get(win.id);
        }
        if (win.type === 'popup') {
          const result = await fromPopup(tab, win);
          await clearPageUI(tab);
          await clearEdgeUI(tab);
          await titleUI(tab, 'off');
          return result;
        }
        if (detachedNormal) {
          const result = await fromDetachedNormal(tab, win, savedClean);
          await clearPageUI(tab);
          await clearEdgeUI(tab);
          await titleUI(tab, 'off');
          return result;
        }
        if (win.state === 'fullscreen') return await leaveFullscreen(win);
        const level = await selectedLevel();
        await clearPageUI(tab);
        if (level !== 3) {
          await pageUI(tab, levelMode(level));
        }
        try {
          // Title customization is optional in level 3 (restricted pages still open as bare popups).
          try { await titleUI(tab, 'start'); }
          catch (error) { if (level !== 3) throw error; }
          // Install before moving the tab: activeTab permission may not allow
          // fresh scripting in the detached popup. The dormant script draws
          // nothing until the move and recovery journal have succeeded.
          let preparedEdge = false;
          try {
            await api.scripting.executeScript({ target: { tabId: tab.id }, files: ['edge-ui.js', 'youtube-ui.js', 'page-ui.js'] });
            preparedEdge = true;
          } catch { /* Restricted documents still permit bare level-3 popup. */ }
          const opened = await toCleanWindow(tab, win, level);
          try { await edgeUI(tab, level, { prepared: preparedEdge }); }
          catch { opened.warning = '乾淨視窗已開啟；此頁無法顯示邊緣工具，請使用 Alt+Shift+R 還原。'; }
          return opened;
        } catch (error) {
          await clearPageUI(tab);
          await clearEdgeUI(tab);
          await titleUI(tab, 'off');
          throw error;
        }
      }
      let fullResult;
      if (win.state === 'fullscreen') {
        fullResult = await leaveFullscreen(win);
        win = await api.windows.get(win.id);
      } else {
        // F11 may already have left fullscreen; never apply stale bounds.
        await forget(fullKey(win.id));
      }
      if (win.type === 'popup') {
        const result = await fromPopup(tab, win);
        await clearPageUI(tab);
        await clearEdgeUI(tab);
        await titleUI(tab, 'off');
        return result;
      }
      if (detachedNormal) {
        const result = await fromDetachedNormal(tab, win, savedClean);
        await clearPageUI(tab);
        await titleUI(tab, 'off');
        return result;
      }
      await clearPageUI(tab);
      await clearEdgeUI(tab);
      await titleUI(tab, 'off');
      await forget(cleanKey(tab.id));
      return fullResult ?? { windowId: win.id, mode: win.state ?? 'normal' };
    } finally {
      locks.forEach(key => busy.delete(key));
    }
  }
  async function refresh(tabId, windowId) {
    if (busy.has(`tab:${tabId}`)) return false;
    const tab = await api.tabs.get(tabId);
    if (tab.windowId !== windowId) return false;
    const win = await api.windows.get(windowId);
    const record = await read(cleanKey(tabId));
    if (win.type !== 'popup' || record?.popupWindowId !== windowId ||
        record.phase !== 'open') return false;
    const level = validLevel(record.cleanLevel) ? record.cleanLevel : 1;
    if (level !== 3) await pageUI(tab, levelMode(level));
    await edgeUI(tab, level);
    await titleUI(tab, 'start').catch(() => {});
    return true;
  }
  // Session journal is the only source of managed windows, never a browser-wide
  // tab crawl. Ignore stale journal entries and unrelated/foreign popups.
  async function listManaged() {
    const saved = await api.storage.session.get(null);
    const rows = await Promise.all(Object.entries(saved)
      .filter(([key,record]) => /^clean:\d+$/.test(key) &&
        record?.phase === 'open' && isId(record.popupWindowId))
      .map(async ([key,record]) => {
        const tabId = Number(key.slice(6));
        try {
          const [tab,win] = await Promise.all([
            api.tabs.get(tabId), api.windows.get(record.popupWindowId)
          ]);
          if (tab.windowId !== win.id || win.type !== 'popup' ||
              !!tab.incognito !== !!record.incognito && tab.incognito !== undefined ||
              !!win.incognito !== !!record.incognito) return null;
          return {tabId,windowId:win.id,level:validLevel(record.cleanLevel) ? record.cleanLevel : 1,
            title:(record.label?.trim() || tab.title?.trim() || '乾淨視窗').slice(0,160)};
        } catch { return null; }
      }));
    return rows.filter(Boolean).sort((a,b) => a.windowId-b.windowId);
  }
  async function renameManaged(tabId,windowId,title) {
    if (!isId(tabId) || !isId(windowId) || typeof title !== 'string') return false;
    const key = cleanKey(tabId);
    const record = await read(key);
    if (!record || record.phase !== 'open' || record.popupWindowId !== windowId) return false;
    await write(key,{...record,label:title.trim().slice(0,160)});
    return true;
  }
  async function focusManaged(tabId,windowId) {
    const [tab,win,record] = await Promise.all([
      api.tabs.get(tabId),api.windows.get(windowId),read(cleanKey(tabId))
    ]);
    if (tab.windowId !== windowId || win.type !== 'popup' ||
        record?.phase !== 'open' || record.popupWindowId !== windowId) {
      throw new Error('目標已非 Clean Window 管理中的乾淨視窗。');
    }
    await api.windows.update(windowId,{focused:true});
    return {windowId,mode:'focused'};
  }
  return { run, refresh, listManaged, focusManaged, renameManaged };
}
