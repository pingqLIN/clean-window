const grant=document.querySelector('#grant');
const status=document.querySelector('#status');
async function check(){
  const yes=await chrome.permissions.contains({permissions:['bookmarks']});
  status.textContent=yes?'已授權，可返回原乾淨視窗使用書籤功能。':'尚未授權。';
  grant.disabled=yes;
  grant.textContent=yes?'已啟用':'允許使用 Chrome 書籤';
}
grant.addEventListener('click',async()=>{
  grant.disabled=true;
  try {
    // Must be invoked inside an extension page, from a direct user gesture.
    const yes=await chrome.permissions.request({permissions:['bookmarks']});
    status.textContent=yes?'授權完成，可回到第一級工具列使用。':'未授權；不影響其他乾淨視窗功能。';
  } catch(error) {
    status.textContent='無法完成授權：'+(error?.message||String(error));
  } finally { await check().catch(()=>{grant.disabled=false;}); }
});
void check().catch(error=>{status.textContent=error.message;grant.disabled=false;});
