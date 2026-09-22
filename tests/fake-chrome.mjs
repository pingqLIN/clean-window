export function fakeChrome() {
  const db = {}, calls = [];
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
      async update(id,data){calls.push(['updateTab',id,clone(data)]);return clone(Object.assign(get(tabs,id),data));}
    },
    storage:{session:{
      async get(key){if(key===null)return clone(db);return {[key]:clone(db[key])};},
      async set(values){if(api.failStorage)throw new Error('Storage denied');Object.assign(db,clone(values));},
      async remove(key){for(const item of Array.isArray(key)?key:[key])delete db[item];}
    }}
  };
  return {api,wins,tabs,db,calls};
}
