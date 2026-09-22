import {readFile, readdir, access} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const manifest=JSON.parse(await readFile(new URL('../extension/manifest.json',import.meta.url)));
const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url)));
assert.equal(manifest.version,pkg.version);
assert.equal(manifest.manifest_version,3);
assert.deepEqual([...manifest.permissions].sort(),['contextMenus','storage']);
for(const key of ['host_permissions','content_scripts','externally_connectable','web_accessible_resources']) assert.equal(manifest[key],undefined,`${key} not needed`);
for(const file of await readdir(new URL('../extension/',import.meta.url))){
 if(file.endsWith('.js'))execFileSync(process.execPath,['--check',fileURLToPath(new URL(`../extension/${file}`,import.meta.url))],{stdio:'inherit'});
}
for(const path of Object.values(manifest.icons))await access(new URL(`../extension/${path}`,import.meta.url));
const html=await readFile(new URL('../extension/popup.html',import.meta.url),'utf8');
assert.equal(/\son\w+\s*=/i.test(html),false);
console.log('PASS: JavaScript syntax, MV3 manifest, version consistency, minimal permissions, icons, no inline handlers.');
