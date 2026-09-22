/** Explicit-target window operations. No URL access, navigation, or page injection. */
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
  async function assertLocation(tabId, windowId) {
    const current = await api.tabs.get(tabId);
    if (current.windowId !== windowId) throw new Error('目標分頁已移至另一視窗；請重新開啟操作面板。');
  }

  async function toPopup(tab, win) {
    if (win.state === 'fullscreen') throw new Error('請先退出全螢幕，再切換精簡視窗。');
    if (tab.groupId >= 0) throw new Error('此分頁屬於群組；為保留群組，請改用「整個視窗全螢幕」。');
    if (tab.splitViewId >= 0) throw new Error('此分頁在分割檢視（Split View）中；請改用「整個視窗全螢幕」。');
    const key = cleanKey(tab.id);
    const record = {
      originWindowId: win.id, originIndex: tab.index, pinned: tab.pinned,
      originState: win.state, incognito: win.incognito,
      phase: 'opening', popupWindowId: null
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
      await write(key, { ...record, phase: 'open', popupWindowId: created.id });
      return { windowId: created.id, mode: 'clean' };
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

  async function run(action, target) {
    if (!['toggle-clean', 'toggle-fullscreen', 'restore'].includes(action)) throw new Error('不支援的操作。');
    if (!isId(target?.windowId) || !isId(target?.tabId)) throw new Error('找不到有效的目標視窗／分頁。');
    const locks = [`window:${target.windowId}`, `tab:${target.tabId}`];
    if (locks.some(key => busy.has(key))) throw new Error('此視窗正在切換，請勿重複操作。');
    locks.forEach(key => busy.add(key));
    try {
      const tab = await api.tabs.get(target.tabId);
      if (tab.windowId !== target.windowId) throw new Error('目標分頁已移至另一視窗；請重新開啟操作面板。');
      let win = await api.windows.get(target.windowId);
      if (!['normal', 'popup'].includes(win.type)) throw new Error('此類型視窗不支援；未做任何變更。');
      if (action === 'toggle-fullscreen') return await toggleFullscreen(win);
      if (action === 'toggle-clean') {
        if (win.type === 'popup' && win.state === 'fullscreen') {
          await leaveFullscreen(win);
          win = await api.windows.get(win.id);
        }
        return await (win.type === 'popup' ? fromPopup(tab, win) : toPopup(tab, win));
      }
      let fullResult;
      if (win.state === 'fullscreen') {
        fullResult = await leaveFullscreen(win);
        win = await api.windows.get(win.id);
      } else {
        // F11 may already have left fullscreen; never apply stale bounds.
        await forget(fullKey(win.id));
      }
      if (win.type === 'popup') return await fromPopup(tab, win);
      await forget(cleanKey(tab.id));
      return fullResult ?? { windowId: win.id, mode: win.state ?? 'normal' };
    } finally {
      locks.forEach(key => busy.delete(key));
    }
  }
  return { run };
}
