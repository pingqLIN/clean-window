import assert from 'node:assert/strict';
import {copyFile, mkdir, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {deflateRawSync, inflateRawSync} from 'node:zlib';

const projectRoot = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const sourceDir = path.join(projectRoot, 'extension');
const distDir = path.join(projectRoot, 'dist');
const runtimeDir = path.join(distDir, 'runtime');
const args = process.argv.slice(2);

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let value = n;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  }
  CRC_TABLE[n] = value >>> 0;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

async function collectFiles(directory, prefix = '') {
  const entries = await readdir(directory, {withFileTypes: true});
  entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  const files = [];

  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolute = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`Runtime source must not contain symlinks: ${relative}`);
    }
    if (entry.isDirectory()) {
      files.push(...await collectFiles(absolute, relative));
    } else if (entry.isFile()) {
      files.push(relative);
    } else {
      throw new Error(`Unsupported runtime source entry: ${relative}`);
    }
  }

  return files;
}

async function validateSource() {
  const pkg = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));
  const manifestPath = path.join(sourceDir, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  assert.match(pkg.version, /^\d+\.\d+\.\d+(?:\.\d+)?$/, 'package.json must contain a Chrome-compatible version');
  assert.equal(manifest.version, pkg.version, 'package.json and extension/manifest.json versions must match');
  assert.equal(manifest.manifest_version, 3, 'Runtime must use Manifest V3');

  const files = await collectFiles(sourceDir);
  const fileSet = new Set(files);
  assert(fileSet.has('manifest.json'), 'extension/manifest.json must be at the Runtime root');

  const required = [
    manifest.background?.service_worker,
    manifest.action?.default_popup,
    ...Object.values(manifest.icons ?? {}),
    ...Object.values(manifest.action?.default_icon ?? {}),
  ].filter(Boolean).map(value => value.replaceAll('\\', '/'));
  for (const relative of required) {
    assert(fileSet.has(relative), `Manifest references a missing Runtime file: ${relative}`);
  }

  const developmentOnlySegments = new Set([
    '.git', '.github', 'node_modules', 'tests', 'docs', 'scripts',
    'evidence', 'local', 'ai-private', 'ai-discussion', 'dist',
  ]);
  for (const relative of files) {
    for (const segment of relative.split('/')) {
      assert(!developmentOnlySegments.has(segment), `Development-only path found in Runtime source: ${relative}`);
    }
    assert(!relative.startsWith('../') && !relative.includes('/../'), `Unsafe Runtime path: ${relative}`);
  }

  return {pkg, manifest, files};
}

function createZipBuffer(entries) {
  assert(entries.length > 0, 'Runtime package must not be empty');
  assert(entries.length < 0xffff, 'Runtime package exceeds classic ZIP entry limits');

  const localParts = [];
  const centralParts = [];
  let localOffset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const data = entry.data;
    assert(name.length > 0 && name.length < 0xffff, `Invalid ZIP entry name: ${entry.name}`);
    assert(data.length < 0xffffffff, `Runtime file exceeds classic ZIP size limit: ${entry.name}`);

    const compressed = deflateRawSync(data, {level: 9});
    const checksum = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 filenames
    local.writeUInt16LE(8, 8); // DEFLATE
    local.writeUInt16LE(0, 10); // Fixed timestamp for reproducible archives
    local.writeUInt16LE(33, 12); // 1980-01-01
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(33, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(localOffset, 42);
    centralParts.push(central, name);

    localOffset += local.length + name.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localOffset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

function verifyZipBuffer(buffer, expectedEntries) {
  let endOffset = -1;
  const earliestEndOffset = Math.max(0, buffer.length - 22 - 0xffff);
  for (let offset = buffer.length - 22; offset >= earliestEndOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      endOffset = offset;
      break;
    }
  }
  assert(endOffset >= 0, 'ZIP end-of-central-directory record is missing');

  const entryCount = buffer.readUInt16LE(endOffset + 10);
  const centralSize = buffer.readUInt32LE(endOffset + 12);
  const centralOffset = buffer.readUInt32LE(endOffset + 16);
  assert.equal(entryCount, expectedEntries.length, 'ZIP entry count does not match Runtime files');
  assert.equal(centralOffset + centralSize, endOffset, 'ZIP central-directory bounds are invalid');

  const actualNames = [];
  let cursor = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    assert.equal(buffer.readUInt32LE(cursor), 0x02014b50, 'Invalid ZIP central-directory entry');
    const method = buffer.readUInt16LE(cursor + 10);
    const checksum = buffer.readUInt32LE(cursor + 16);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
    assert.equal(method, 8, `Unexpected compression method for ${name}`);
    assert(!name.startsWith('extension/'), 'ZIP entries must place manifest.json at the archive root');
    assert(!name.split('/').includes('..'), `Unsafe ZIP entry path: ${name}`);

    assert.equal(buffer.readUInt32LE(localOffset), 0x04034b50, `Invalid local ZIP header: ${name}`);
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const localName = buffer.subarray(localOffset + 30, localOffset + 30 + localNameLength).toString('utf8');
    assert.equal(localName, name, `ZIP local/central filename mismatch: ${name}`);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const compressedData = buffer.subarray(dataOffset, dataOffset + compressedSize);
    const data = inflateRawSync(compressedData);
    assert.equal(data.length, uncompressedSize, `ZIP size mismatch: ${name}`);
    assert.equal(crc32(data), checksum, `ZIP CRC mismatch: ${name}`);

    const expected = expectedEntries.find(entry => entry.name === name);
    assert(expected, `Unexpected file in Runtime ZIP: ${name}`);
    assert.deepEqual(data, expected.data, `Runtime ZIP content differs from source: ${name}`);
    actualNames.push(name);
    cursor += 46 + nameLength + extraLength + commentLength;
  }

  assert.equal(cursor, centralOffset + centralSize, 'ZIP central-directory size mismatch');
  assert.deepEqual(actualNames, expectedEntries.map(entry => entry.name), 'ZIP file list/order differs from Runtime source');
}

async function verifyRuntimeDirectory(directory, sourceFiles) {
  const runtimeFiles = await collectFiles(directory);
  assert.deepEqual(runtimeFiles, sourceFiles, 'Generated Runtime directory does not match extension/ source files');
  for (const relative of sourceFiles) {
    const [source, output] = await Promise.all([
      readFile(path.join(sourceDir, relative)),
      readFile(path.join(directory, relative)),
    ]);
    assert.deepEqual(output, source, `Generated Runtime file differs from source: ${relative}`);
  }
}

if (args.length && !(args.length === 1 && args[0] === '--check')) {
  throw new Error('Usage: node scripts/package-runtime.mjs [--check]');
}

const {pkg, files} = await validateSource();
if (args.includes('--check')) {
  console.log(`PASS: Runtime source is valid; package/manifest version ${pkg.version}; ${files.length} files; no development-only directories.`);
} else {
  await mkdir(distDir, {recursive: true});
  const resolvedDist = path.resolve(distDir);
  assert.equal(path.dirname(path.resolve(runtimeDir)), resolvedDist, 'Runtime output must remain inside dist/');
  await rm(runtimeDir, {recursive: true, force: true});
  await mkdir(runtimeDir, {recursive: true});

  for (const relative of files) {
    const destination = path.join(runtimeDir, relative);
    await mkdir(path.dirname(destination), {recursive: true});
    await copyFile(path.join(sourceDir, relative), destination);
  }

  const zipEntries = await Promise.all(files.map(async name => ({
    name,
    data: await readFile(path.join(runtimeDir, name)),
  })));
  const zipBuffer = createZipBuffer(zipEntries);
  const zipPath = path.join(distDir, `clean-window-v${pkg.version}.zip`);
  await writeFile(zipPath, zipBuffer);

  await verifyRuntimeDirectory(runtimeDir, files);
  verifyZipBuffer(await readFile(zipPath), zipEntries);
  assert(files.includes('manifest.json'), 'Runtime manifest must be at the archive root');
  console.log(`PASS: Runtime build verified; ${files.length} files; dist/runtime/ and dist/clean-window-v${pkg.version}.zip (${zipBuffer.length} bytes).`);
}
