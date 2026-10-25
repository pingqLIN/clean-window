import {readFile, readdir, access} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const manifest=JSON.parse(await readFile(new URL('../extension/manifest.json',import.meta.url)));
const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url)));
assert.equal(manifest.version,pkg.version);
assert.equal(manifest.manifest_version,3);
assert.deepEqual([...manifest.permissions].sort(),['activeTab','contextMenus','scripting','storage']);
assert.deepEqual([...manifest.optional_host_permissions].sort(),['http://*/*','https://*/*']);
const expectedShortcuts={'toggle-clean':'Alt+Shift+Y','toggle-fullscreen':'Alt+Shift+F','restore':'Alt+Shift+U','edit-title':'Alt+Shift+J'};
for(const [name,shortcut] of Object.entries(expectedShortcuts)) assert.equal(manifest.commands?.[name]?.suggested_key?.default,shortcut,`Default shortcut for ${name} must remain ${shortcut}`);
const shortcutDefaults=Object.values(manifest.commands??{}).map(command=>command.suggested_key?.default).filter(Boolean);
assert.equal(new Set(shortcutDefaults).size,shortcutDefaults.length,'Default command shortcuts must be unique');
for(const key of Object.keys(expectedShortcuts)) assert.ok(manifest.commands[key],`Missing keyboard command: ${key}`);
for(const key of ['host_permissions','content_scripts','externally_connectable','web_accessible_resources']) assert.equal(manifest[key],undefined,`${key} not needed`);
for(const file of await readdir(new URL('../extension/',import.meta.url))){
 if(file.endsWith('.js'))execFileSync(process.execPath,['--check',fileURLToPath(new URL(`../extension/${file}`,import.meta.url))],{stdio:'inherit'});
}
for(const path of Object.values(manifest.icons))await access(new URL(`../extension/${path}`,import.meta.url));
const html=await readFile(new URL('../extension/popup.html',import.meta.url),'utf8');
const siteAccessHtml=await readFile(new URL('../extension/site-access.html',import.meta.url),'utf8');
assert.equal(/\son\w+\s*=/i.test(html),false);
assert.equal(/\son\w+\s*=/i.test(siteAccessHtml),false);
for(const id of ['target-host','scope-note','allow','continue','cancel','status']) assert.match(siteAccessHtml,new RegExp('id="'+id+'"'));
console.log('PASS: JavaScript syntax, MV3 manifest, version consistency, required/optional permission boundary, unique default shortcuts, icons, site-access controls and no inline handlers.');
