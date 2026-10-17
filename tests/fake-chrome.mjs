export function fakeChrome() {
  const db = {}, preferences = {}, calls = [];
  const pageModes = new Map();
  const titleModes = new Map();
  const edgeModes = new Map();
  const wins = new Map([
    [1,{id:1,type:'normal',state:'normal',left:20,top:30,width:900,height:650,incognito:false}],
    [2,{id:2,type:'normal',state:'normal',left:950,top:70,width:600,height:500,incognito:false}]
  ]);
  const tabs = new Map([
    [11,{id:11,windowId:1,index:0,active:true,pinned:false,groupId:-1}],
    [12,{id:12,windowId:1,index:1,active:false,pinned:false,groupId:-1}],
    [21,{id:21,windowId:2,index:0,active:true,pinned:false,groupId:-1}]
  ]);
  let nextWindow=3;
  const clone=x=>structuredClone(x);
  const get=(map,id)=> { if(!map.has(id))throw new Error('Not found '+id); return map.get(id); };
  const retab=windowId=>[...tabs.values()].filter(t=>t.windowId===windowId).sort((a,b)=>a.index-b.index);
  const transfer=(tabId,windowId,index=0)=>{
    const tab=get(tabs,tabId), old=tab.windowId;
    tab.windowId=windowId; tab.index=index;
    retab(old).forEach((t,i)=>t.index=i);
    if(!retab(old).length)wins.delete(old);
    return clone(tab);
  };
  const api={
    windows:{
      async get(id){ return clone(get(wins,id)); },
      async create(data){
        calls.push(['create',clone(data)]);
        if(api.failCreate)throw new Error('Create denied');
        get(tabs,data.tabId);
        const id=nextWindow++;
        const win={id,type:data.type??'normal',state:data.state??'normal',left:0,top:0,width:800,height:600,incognito:false,...data};
        delete win.tabId; wins.set(id,win); transfer(data.tabId,id);
        return clone(win);
      },
      async update(id,data){
        calls.push(['updateWindow',id,clone(data)]);
        if(api.failUpdate)throw new Error('Update denied');
        return clone(Object.assign(get(wins,id),data));
      }
    },
    tabs:{
      async get(id){ return clone(get(tabs,id)); },
      async query(q){ return clone(retab(q.windowId).filter(t=>!q.active||t.active)); },
      async move(id,data){
        calls.push(['moveTab',id,clone(data)]);
        if(api.failMove)throw new Error('Move denied');
        if(get(wins,get(tabs,id).windowId).type!=='normal'||get(wins,data.windowId).type!=='normal')throw new Error('Normal windows only');
        return transfer(id,data.windowId,data.index);
      },
      async update(id,data){calls.push(['updateTab',id,clone(data)]);return clone(Object.assign(get(tabs,id),data));},
      async sendMessage(id, message) {
        if (message.type === 'clean-window:edge-ui') {
          if (!edgeModes.has(id)) throw new Error('No edge UI script available');
          edgeModes.set(id, message.level);
          return {ok:true,active:message.level!=='off'};
        }
        if (message.type === 'clean-window:title') {
          if (!titleModes.has(id)) throw new Error('No title script available');
          if (message.action === 'start') { titleModes.set(id,'active'); return {ok:true,active:true}; }
          if (message.action === 'edit') {
            if (titleModes.get(id)!=='active') return {ok:false,error:'Title not active'};
            titleModes.set(id,'editing'); return {ok:true,active:true};
          }
          if (message.action === 'off') { titleModes.set(id,'off'); return {ok:true,active:false}; }
          return {ok:false,error:'Unknown title action'};
        }
        if (!pageModes.has(id)) throw new Error('No content script available');
        if (message.mode === 'off') { pageModes.set(id,'off');return {ok:true,active:false}; }
        if (message.mode === 'address') { pageModes.set(id,'address');return {ok:true,active:true}; }
        if (message.mode === 'address-dock') {pageModes.set(id,'address-dock');return {ok:true,active:true};}
        if (message.mode === 'focus-toggle') {
          if (api.noMain) return {ok:false,error:'找不到主內容'};
          const active=pageModes.get(id)!=='focus';
          pageModes.set(id,active?'focus':'off');
          return {ok:true,active};
        }
        return {ok:false,error:'Unsupported mode'};
      }
    },
    scripting: { async executeScript({target,files}) {
      if (api.failInject) throw new Error('Injection blocked');
      if (api.failInjectInPopup && get(wins,get(tabs,target.tabId).windowId).type==='popup') {
        throw new Error('Injection blocked after moving tab');
      }
      get(tabs,target.tabId);
      if (files[0]==='edge-ui.js') {
        if (!edgeModes.has(target.tabId)) edgeModes.set(target.tabId,'off');
        return [{result:undefined}];
      }
      if (files[0]==='title-ui.js') {
        if (!titleModes.has(target.tabId)) titleModes.set(target.tabId,'off');
        return [{result:undefined}];
      }
      if (files[0]!=='page-ui.js') throw new Error('Unexpected content script');
      if (!pageModes.has(target.tabId)) pageModes.set(target.tabId,'off');
      return [{result:undefined}];
    }},
    storage:{local:{
      async get(key){return Object.fromEntries((Array.isArray(key)?key:[key]).map(k=>[k,clone(preferences[k])]));},
      async set(values){Object.assign(preferences,clone(values));}
    },session:{
      async get(key){if(key===null)return clone(db);return {[key]:clone(db[key])};},
      async set(values){if(api.failStorage)throw new Error('Storage denied');Object.assign(db,clone(values));},
      async remove(key){for(const item of Array.isArray(key)?key:[key])delete db[item];}
    }}
  };
  return {api,wins,tabs,db,preferences,pageModes,titleModes,edgeModes,calls};
}
