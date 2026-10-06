import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { safeFile, sha256 } from './jobs.mjs';
import { replaceData, archiveCharacter, archivedAvatarSrc, writeCharacterAssets, syncArchiveRelationships } from './archive.mjs';
import { jsonText, insideFile } from './workspace.mjs';

const execute = promisify(execFile);
async function optionalBytes(file) { try { return await fs.readFile(file); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } }
async function atomicWrite(file, bytes) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = file + '.workbench-' + randomUUID();
  await fs.writeFile(temporary, bytes); await fs.rename(temporary, file);
}
async function safeDestination(root, relative) {
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep)) throw Error('归档路径不在日记目录内。');
  let ancestor = file;
  while (!(await optionalStat(ancestor))) ancestor = path.dirname(ancestor);
  const real = await fs.realpath(ancestor);
  if (real !== root && !real.startsWith(root + path.sep)) throw Error('归档目录指向日记库之外。');
  return file;
}
async function optionalStat(file) { try { return await fs.lstat(file); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } }
async function filesBelow(root) {
  const files = [];
  async function visit(dir) { for (const item of await fs.readdir(dir, { withFileTypes: true })) { const file = path.join(dir, item.name); if (item.isDirectory()) await visit(file); else if (item.isFile()) files.push(file); } }
  await visit(root); return files;
}

// Only dated content/data is committed. Reader/graph engines, covers, fonts,
// historical attachments and every other date remain byte-for-byte unchanged.
export function createVaultArchive({ root, workspace, skill, python }) {
  let lock = Promise.resolve();
  return (job, folder) => { const run = lock.then(() => archive(job, folder)); lock = run.catch(() => {}); return run; };
  async function archive(job, folder) {
    const target = await workspace.target();
    if (!target || job.workspaceId !== target.id) throw Error('日记库已变化，请重新生成当前日记库的预览。');
    const result = path.join(folder, 'result'), poster = await safeFile(result, job.result.poster);
    const posterBytes = await fs.readFile(poster);
    if (sha256(posterBytes) !== job.approval.posterSha256) throw Error('海报已变化，请重新确认。');
    const input = JSON.parse(await fs.readFile(path.join(folder, 'input.json'), 'utf8'));
    const brief = JSON.parse(await fs.readFile(await safeFile(result, job.result.brief), 'utf8'));
    const photoManifestFile = await safeFile(result, job.result.photoArchive);
    const photoManifest = JSON.parse(await fs.readFile(photoManifestFile, 'utf8'));
    const originalText = input.events.map(e => e.text).join('\n\n');
    if (brief.date !== job.date || brief.sourceText !== originalText || photoManifest.date !== job.date) throw Error('日期或原文与预览不一致。');
    if (photoManifest.photos.length !== input.events.reduce((n, e) => n + e.photos.length, 0)) throw Error('归档照片数量不一致。');
    const noteFile = path.join(target.diaryRoot, job.date + '.md'), previousNote = await optionalBytes(noteFile);
    if (job.noteRevision !== undefined && job.noteRevision !== (previousNote ? sha256(previousNote) : null)) throw Error('这篇日记已在其他地方修改，请返回编辑读取最新记录；未覆盖。');
    const transaction = path.join(root, 'transactions', randomUUID());
    await fs.mkdir(transaction, { recursive: true });
    const documents = path.join(transaction, 'documents'); await fs.mkdir(documents);
    if (previousNote) await fs.writeFile(path.join(documents, job.date + '.md'), previousNote);
    const documentInput = path.join(transaction, 'document-input.json');
    await fs.writeFile(documentInput, jsonText({ date: job.date, sourceText: originalText, body: originalText.trim() || '这一天的图片记录。', title: brief.title, events: brief.events, poster, photoArchive: photoManifestFile }));
    await execute(python, [fileURLToPath(new URL('../scripts/run-skill-document.py', import.meta.url)), path.join(path.dirname(skill), 'scripts/build_diary_document.py'), documentInput, '--output-dir', documents], { timeout: 180000 });
    const attachmentParent = path.join(documents, 'attachments');
    const generatedFolder = (await fs.readdir(attachmentParent))[0];
    const attachmentSource = path.join(attachmentParent, generatedFolder);
    const attachmentRelative = `attachments/${job.date}-workbench-${job.id}`;
    const replacements = new Map(), immutables = new Map();
    const add = async (relative, bytes, immutable = false) => {
      const file = await safeDestination(target.diaryRoot, relative);
      (immutable ? immutables : replacements).set(file, bytes);
    };
    // No scripts, requests, source/review worksheets or duplicate font packages
    // are copied into the user's diary folder.
    for (const file of await filesBelow(attachmentSource)) {
      const relative = path.relative(attachmentSource, file).split(path.sep).join('/');
      if (/\.(png|jpe?g|webp|gif|heic|heif)$/i.test(relative)) await add(attachmentRelative + '/' + relative, await fs.readFile(file), true);
    }
    let note = await fs.readFile(path.join(documents, job.date + '.md'), 'utf8');
    const generatedPrefix = `attachments/${generatedFolder}`;
    note = note.replaceAll(generatedPrefix, attachmentRelative);
    await add(job.date + '.md', Buffer.from(note));
    let photoIndex = 0;
    const savedEvents = [];
    for (const event of input.events) {
      const photos = [];
      for (const photo of event.photos) {
        const index = ++photoIndex, photoRecord = photoManifest.photos[index - 1];
        const originalFile = await safeFile(path.dirname(photoManifestFile), photoRecord.originalPath);
        if (sha256(await fs.readFile(originalFile)) !== sha256(Buffer.from(photo.original.split(',')[1], 'base64'))) throw Error('原照片或顺序发生变化。');
        photos.push({ id: `saved-${job.id}-${index}`, name: photo.name, relative: `${attachmentRelative}/${job.date}-照片-${String(index).padStart(3, '0')}.jpg`, originalRelative: `${attachmentRelative}/original/${String(index).padStart(3, '0')}/${path.basename(originalFile)}` });
      }
      savedEvents.push({ id: event.id, text: event.text, photos });
    }
    await add(attachmentRelative + '/record.json', Buffer.from(jsonText({ schemaVersion: 1, date: job.date, sourceText: originalText, events: savedEvents })), true);

    const book = structuredClone(target.book), graph = structuredClone(target.graph);
    const regularSource = path.join(transaction, 'regular'); await fs.mkdir(regularSource);
    const media = `updates/${job.date}/${job.result.sha256}.png`;
    const stageMedia = path.join(regularSource, media); await fs.mkdir(path.dirname(stageMedia), { recursive: true }); await fs.writeFile(stageMedia, posterBytes);
    await add(path.posix.join(target.relative.regular, media), posterBytes, true);
    const old = book.entries.find(e => e.date === job.date), periodId = old?.periodId || `month-${job.date.slice(0, 7)}`;
    let period = book.periods.find(p => p.id === periodId);
    if (!period) { period = { id: periodId, title: `${job.date.slice(0, 4)}年${Number(job.date.slice(5, 7))}月`, startDate: job.date, endDate: job.date, summary: '', coverSrc: media }; book.periods.push(period); }
    else { if (period.startDate) period.startDate = period.startDate < job.date ? period.startDate : job.date; if (period.endDate) period.endDate = period.endDate > job.date ? period.endDate : job.date; }
    const characters = job.characters || [];
    const entry = { ...old, id: old?.id || job.date, date: job.date, periodId, title: brief.title, posterSrc: media, body: originalText, summary: brief.summary || '', characterIds: characters.map(c => c.id), eventCount: brief.events.length, illustrationCount: brief.events.length, isBlank: false, approval: 'approved' };
    book.entries = [...book.entries.filter(e => e.date !== job.date), entry].sort((a, b) => a.date.localeCompare(b.date));
    let graphChanged = false;
    const assets = new Map();
    for (const character of characters) {
      const node = graph.nodes.find(n => n.id === character.id), known = book.characters.find(c => c.id === character.id);
      const graphRoot = path.posix.dirname(target.relative.graph);
      const asset = await archiveCharacter(character, job.approval, result, [
        { record: node, read: relative => insideFile(target.diaryRoot, path.posix.join(graphRoot, decodeURIComponent(relative))) },
        { record: known, read: relative => safeFile(path.dirname(target.bookFile), decodeURIComponent(relative)) },
        { record: target.reader.characters.find(c => c.id === character.id), read: relative => safeFile(path.join(target.diaryRoot, target.relative.reader, 'data'), decodeURIComponent(relative)) },
      ]);
      assets.set(character.id, asset);
      const updated = await writeCharacterAssets(regularSource, asset, known);
      for (const root of [target.relative.regular, graphRoot]) {
        await add(path.posix.join(root, asset.avatarSrc), asset.avatarBytes, true);
        await add(path.posix.join(root, asset.cardSrc), asset.cardBytes, true);
      }
      const graphNode = { ...node, ...asset.record, avatarSrc: archivedAvatarSrc(asset, node), profile: structuredClone(asset.record.profile), x: node?.x ?? 180 + graph.nodes.length * 120, y: node?.y ?? 280 };
      if (node) Object.assign(node, graphNode); else graph.nodes.push(graphNode);
      if (known) Object.assign(known, updated); else book.characters.push(updated);
      graphChanged = true;
    }
    graphChanged = syncArchiveRelationships(graph, job.approval, job.protagonistId, book) || graphChanged;
    // Already-confirmed book identities may have existing media outside staging;
    // only new identities and this date's media are read by the canonical updater.
    const stageBookHtml = path.join(regularSource, 'index.html');
    await fs.writeFile(stageBookHtml, replaceData(target.bookHtml, 'diary-book-data', book));
    const stageReader = path.join(transaction, 'reader'); await fs.mkdir(path.join(stageReader, 'data'), { recursive: true });
    await fs.copyFile(path.join(target.diaryRoot, target.relative.reader, 'index.html'), path.join(stageReader, 'index.html'));
    await fs.writeFile(path.join(stageReader, 'data/manifest.json'), target.readerJson);
    // The canonical importer requires the media for newly added cast only.
    for (const character of book.characters.filter(c => entry.characterIds.includes(c.id) && !target.reader.characters.some(old => old.id === c.id))) {
      if (character.avatarSrc && !(await optionalStat(path.join(regularSource, decodeURIComponent(character.avatarSrc))))) { const source = await safeFile(path.dirname(target.bookFile), character.avatarSrc); await fs.mkdir(path.dirname(path.join(regularSource, character.avatarSrc)), { recursive: true }); await fs.copyFile(source, path.join(regularSource, character.avatarSrc)); }
    }
    await execute(python, [path.join(path.dirname(skill), 'scripts/build_diary_reader.py'), stageBookHtml, '--output-dir', stageReader, '--update-date', job.date], { timeout: 60000 });
    const reader = JSON.parse(await fs.readFile(path.join(stageReader, 'data/manifest.json'), 'utf8'));
    const readerEntry = reader.entries.find(e => e.date === job.date && !e.isBlank);
    if (!readerEntry || sha256(await fs.readFile(await safeFile(path.join(stageReader, 'data'), decodeURIComponent(readerEntry.posterSrc)))) !== job.result.sha256) throw Error('3D日记本与最终海报不一致。');
    // Do not reintroduce hundreds of cross-year blank pages into the user's book.
    reader.entries = [...target.reader.entries.filter(e => e.date !== job.date), readerEntry].sort((a, b) => a.date.localeCompare(b.date));
    for (const character of characters) {
      const approved = book.characters.find(c => c.id === character.id), existing = reader.characters.find(c => c.id === character.id);
      if (!existing) throw Error('3D 日记本缺少本次已确认角色。');
      const next = await writeCharacterAssets(path.join(stageReader, 'data'), assets.get(character.id), target.reader.characters.find(c => c.id === character.id));
      Object.assign(existing, approved, { avatarSrc: next.avatarSrc, profile: next.profile });
    }
    syncArchiveRelationships(graph, { ...job.approval, relationships: [] }, job.protagonistId, reader);
    for (const file of await filesBelow(path.join(stageReader, 'data'))) if (path.basename(file) !== 'manifest.json') await add(path.posix.join(target.relative.reader, 'data', path.relative(path.join(stageReader, 'data'), file).split(path.sep).join('/')), await fs.readFile(file), true);
    await add(path.posix.join(target.relative.regular, 'index.html'), Buffer.from(replaceData(target.bookHtml, 'diary-book-data', book)));
    await add(path.posix.join(target.relative.regular, 'diary-book-data.json'), Buffer.from(jsonText(book)));
    await add(path.posix.join(target.relative.reader, 'data/manifest.json'), Buffer.from(jsonText(reader)));
    if (graphChanged) {
      await add(target.relative.graph, Buffer.from(replaceData(target.graphHtml, 'graph-data', graph)));
      await add(path.posix.join(path.posix.dirname(target.relative.graph), 'character-graph-data.json'), Buffer.from(jsonText(graph)));
    }
    const previous = new Map();
    for (const file of replacements.keys()) previous.set(file, await optionalBytes(file));
    // Check again after preparation: an Obsidian edit or another writer wins over
    // this older preview instead of being silently lost during a slow build.
    for (const [file, original] of [[target.bookFile, Buffer.from(target.bookHtml)], [target.readerFile, Buffer.from(target.readerJson)], [target.graphFile, Buffer.from(target.graphHtml)], [noteFile, previousNote]]) {
      const now = await optionalBytes(file);
      if ((now ? sha256(now) : null) !== (original ? sha256(original) : null)) throw Error('日记库刚刚在其他地方更新，请重试保存；没有覆盖。');
    }
    const backup = path.join(root, 'backups', `vault-${job.id}-${randomUUID()}`);
    await fs.mkdir(backup, { recursive: true });
    for (const [file, bytes] of previous) if (bytes) { const save = path.join(backup, path.relative(target.diaryRoot, file)); await fs.mkdir(path.dirname(save), { recursive: true }); await fs.writeFile(save, bytes); }
    const written = [];
    let liveEntry;
    try {
      for (const [file, bytes] of immutables) { const oldBytes = await optionalBytes(file); if (oldBytes && !oldBytes.equals(bytes)) throw Error('不可变的附件版本发生冲突。'); if (!oldBytes) await atomicWrite(file, bytes); }
      for (const [file, bytes] of replacements) { await atomicWrite(file, bytes); written.push(file); }
      // Read back committed files while rollback is still available.
      const liveReader = JSON.parse(await fs.readFile(target.readerFile, 'utf8'));
      liveEntry = liveReader.entries.filter(e => e.date === job.date && !e.isBlank);
      if (liveEntry.length !== 1 || sha256(await fs.readFile(await safeFile(path.join(target.diaryRoot, target.relative.reader, 'data'), decodeURIComponent(liveEntry[0].posterSrc)))) !== job.result.sha256 || !(await fs.readFile(noteFile, 'utf8')).includes(attachmentRelative)) throw Error('保存后的回读核对未通过，请保留预览。');
    } catch (error) {
      for (const file of written.reverse()) { const bytes = previous.get(file); if (bytes) await atomicWrite(file, bytes); else await fs.unlink(file); }
      throw error;
    }
    await fs.writeFile(path.join(folder, 'delivery.json'), jsonText({ date: job.date, mode: 'obsidian', note: noteFile, posterSha256: job.result.sha256, bookId: book.book.id, entryId: liveEntry[0].id, originalPhotos: photoIndex, graphChanged, backup }));
    await fs.rm(transaction, { recursive: true, force: true });
    return { mode: 'obsidian', date: job.date, noteUrl: `/api/diary/notes/${job.date}`, notePath: noteFile, bookUrl: `/library/book/index.html#entry=${encodeURIComponent(liveEntry[0].id)}`, regularBookUrl: `/library/regular/index.html#entry=${encodeURIComponent(entry.id)}`, graphUrl: '/library/diary/character-graph.html', posterSha256: job.result.sha256 };
  }
}
