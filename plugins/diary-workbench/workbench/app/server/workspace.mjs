import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { historyEvents } from './history-events.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
export const validDate = date => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(new Date(date).getTime()) && new Date(date).toISOString().slice(0, 10) === date;
export const jsonText = data => JSON.stringify(data, null, 2).replaceAll('<', '\\u003c') + '\n';
export const fileUrl = relative => '/api/diary/vault/' + relative.split('/').map(encodeURIComponent).join('/');
export function embeddedData(html, id) {
  const matches = [...html.matchAll(new RegExp(`<script\\b[^>]*\\bid=["']${id}["'][^>]*>([\\s\\S]*?)<\\/script\\s*>`, 'gi'))];
  if (matches.length !== 1) throw Error(`日记载体中的 ${id} 数据不唯一。`);
  return JSON.parse(matches[0][1]);
}
export async function insideFile(root, relative) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) || relative.includes('\\') || relative.includes('\0')) throw Error('日记文件路径无效。');
  const file = await fs.realpath(path.resolve(root, relative));
  if (!file.startsWith(root + path.sep) || !(await fs.stat(file)).isFile()) throw Error('文件不在已连接的日记目录内。');
  return file;
}
const imagePattern = /!\[([^\]]*)\]\((?:<([^>]+)>|([^\s)]+))(?:\s+"[^"]*")?\)|!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;
function bodyText(markdown, date) {
  const start = `<!-- diary:${date}:start -->`, end = `<!-- diary:${date}:end -->`;
  let text = markdown.includes(start) ? markdown.split(start)[1].split(end)[0] : markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
  text = text.trimStart();
  const heading = /^##\s*(?:日记内容|正文|今日记录|今天的记录|今日日记)\s*\r?$/m.exec(text);
  if (heading) text = text.slice(heading.index + heading[0].length);
  else text = text.replace(/^#\s+[^\n]*\n/, '');
  text = text.split(/^##\s*(?:日记海报|海报|原照片|原图参考|原图|照片|当天照片|当日照片|原始照片)/m)[0];
  return text.trim();
}

// A private local configuration binds the UI to an existing diary directory. It
// never treats the job staging root or a demo as a user's production notebook.
export class DiaryWorkspace {
  constructor({ root, configFile = path.join(root, 'workspace.json') }) { this.root = root; this.configFile = configFile; }
  async target() {
    let config;
    try { config = JSON.parse(await fs.readFile(this.configFile, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return null; throw Error('日记库配置无法读取，未切换到演示库。'); }
    if (config.schemaVersion !== 1 || !path.isAbsolute(config.diaryRoot)) throw Error('日记库配置无效。');
    const diaryRoot = await fs.realpath(config.diaryRoot);
    const relative = { regular: config.regularBook || '日记本/普通日记本', reader: config.reader || '日记本/3D日记本', graph: config.graph || '人物关系图谱/character-graph.html' };
    for (const value of Object.values(relative)) if (path.isAbsolute(value) || value.split(/[\\/]/).includes('..')) throw Error('日记载体必须位于已连接的目录内。');
    const [bookFile, readerFile, graphFile] = await Promise.all([
      insideFile(diaryRoot, relative.regular + '/index.html'),
      insideFile(diaryRoot, relative.reader + '/data/manifest.json'),
      insideFile(diaryRoot, relative.graph),
    ]);
    await insideFile(diaryRoot, relative.reader + '/index.html');
    const [bookHtml, readerJson, graphHtml] = await Promise.all([fs.readFile(bookFile, 'utf8'), fs.readFile(readerFile, 'utf8'), fs.readFile(graphFile, 'utf8')]);
    const book = embeddedData(bookHtml, 'diary-book-data'), reader = JSON.parse(readerJson), graph = embeddedData(graphHtml, 'graph-data');
    if (!book.book?.id || book.book.id !== reader.book?.id) throw Error('普通日记本与3D日记本不是同一本书，未写入。');
    for (const data of [book, reader]) if (!Array.isArray(data.entries) || new Set(data.entries.map(e => e.date)).size !== data.entries.length) throw Error('日记本存在重复日期，未写入。');
    if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) throw Error('原人物图谱数据无效。');
    return { ...config, id: hash(diaryRoot + '\0' + book.book.id), diaryRoot, relative, bookFile, readerFile, graphFile, bookHtml, graphHtml, readerJson, book, reader, graph };
  }
  async summary() {
    const target = await this.target();
    return target ? { id: target.id, mode: 'obsidian', label: target.label || path.basename(path.dirname(path.dirname(target.diaryRoot))), diaryRoot: target.diaryRoot, title: target.displayTitle || target.book.book.title } : { id: 'local-test', mode: 'local-test', label: '独立测试库' };
  }
  async file(relative) { const target = await this.target(); if (!target) throw Error('尚未连接个人日记库。'); return insideFile(target.diaryRoot, relative); }
  async catalog() {
    const target = await this.target(); if (!target) return null;
    const noteDates = (await fs.readdir(target.diaryRoot)).filter(name => /^\d{4}-\d{2}-\d{2}\.md$/.test(name)).map(name => name.slice(0, 10));
    let statistics = {};
    try { statistics = JSON.parse(await fs.readFile(path.join(this.root, 'poster-events.json'), 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const entries = target.book.entries.filter(e => !e.isBlank).map(entry => ({
      ...entry, summary: '', body: undefined,
      eventCount: Number.isInteger(entry.eventCount) ? entry.eventCount : statistics.workspaceId === target.id && statistics.entries?.[entry.date]?.posterSrc === entry.posterSrc ? statistics.entries[entry.date].eventCount : undefined,
      posterSrc: entry.posterSrc ? fileUrl(path.posix.join(target.relative.regular, decodeURIComponent(entry.posterSrc))) : '',
      noteUrl: `/api/diary/notes/${entry.date}`, bookHref: `/library/book/index.html#entry=${encodeURIComponent(entry.id)}`,
    }));
    for (const date of noteDates) if (!entries.some(e => e.date === date)) entries.push({ id: date, date, title: date + ' 日记', posterSrc: '', illustrationCount: 0, noteUrl: `/api/diary/notes/${date}` });
    const narrator = target.graph.nodes.find(n => n.role === '日记主角');
    const avatarAtlas = !narrator?.avatarSrc && target.graph.atlas?.src && narrator ? { ...target.graph.atlas, src: fileUrl(path.posix.join(path.posix.dirname(target.relative.graph), decodeURIComponent(target.graph.atlas.src))), col: narrator.col || 0, row: narrator.row || 0 } : null;
    const customAvatar = target.profile?.avatarSrc;
    if (customAvatar) await insideFile(target.diaryRoot, customAvatar);
    return { schemaVersion: 1, book: { ...target.book.book, title: target.displayTitle || target.book.book.title }, entries: entries.sort((a, b) => a.date.localeCompare(b.date)), characters: target.graph.nodes, workspace: await this.summary(), profile: { name: narrator?.name || target.book.book.title, avatarAtlas: customAvatar ? null : avatarAtlas, avatarFrame: customAvatar ? target.profile.avatarFrame : null, avatarSrc: customAvatar ? fileUrl(customAvatar) : narrator?.avatarSrc ? fileUrl(path.posix.join(path.posix.dirname(target.relative.graph), decodeURIComponent(narrator.avatarSrc))) : '' } };
  }
  async record(date) {
    if (!validDate(date)) throw Error('日期无效。');
    const target = await this.target(); if (!target) return null;
    let markdown = '';
    try { markdown = await fs.readFile(await insideFile(target.diaryRoot, date + '.md'), 'utf8'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const entry = target.book.entries.find(e => e.date === date && !e.isBlank);
    if (!markdown && !entry) return { date, exists: false, events: [], photos: [] };
    const body = markdown ? bodyText(markdown, date) : (entry.body || entry.summary || '');
    const allImages = [...markdown.matchAll(imagePattern)].map(m => ({ label: m[1] || '', relative: decodeURIComponent(m[2] || m[3] || m[4]).replace(/\\$/, '').replace(/^生活\/日记\//, '') }));
    const posterImage = allImages.find(m => /海报|poster/i.test(m.label + m.relative));
    // A folder named gallery contains individual originals, not a contact sheet.
    let photoImages = allImages.filter(m => !/海报|poster|宫格|gallery|角色|图谱/i.test(m.label + path.posix.basename(m.relative)));
    // The document exporter retains original uploads beside its compressed gallery.
    // Prefer those bytes when reopening a diary for editing, not the gallery image.
    if (posterImage) {
      const folder = path.posix.dirname(posterImage.relative);
      try {
        const saved = JSON.parse(await fs.readFile(await insideFile(target.diaryRoot, path.posix.join(folder, 'record.json')), 'utf8'));
        if (saved.date === date && Array.isArray(saved.events)) {
          for (const event of saved.events) for (const photo of event.photos) {
            await insideFile(target.diaryRoot, photo.relative);
            await insideFile(target.diaryRoot, photo.originalRelative || photo.relative);
          }
          const events = saved.events.map(e => ({ ...e, photos: e.photos.map(p => ({ ...p, source: fileUrl(p.relative), originalSource: fileUrl(p.originalRelative || p.relative) })) }));
          return { date, exists: true, body, events, photos: events.flatMap(e => e.photos), approval: entry?.approval, posterUrl: posterImage ? fileUrl(posterImage.relative) : '', noteUrl: `/api/diary/notes/${date}` };
        }
      } catch (error) { if (error.code !== 'ENOENT') throw Error('当天的图片归档信息无法读取，原记录仍保留。'); }
      try {
        const originalRoot = path.join(folder, 'original'), groups = (await fs.readdir(path.join(target.diaryRoot, originalRoot))).sort();
        const originals = [];
        for (const group of groups) {
          const item = path.posix.join(originalRoot, group);
          const stat = await fs.stat(path.join(target.diaryRoot, item));
          if (stat.isDirectory()) for (const name of (await fs.readdir(path.join(target.diaryRoot, item))).sort()) originals.push({ label: name, relative: path.posix.join(item, name) });
          else if (/\.(png|jpe?g|webp|gif|heic|heif)$/i.test(group)) originals.push({ label: group, relative: item });
        }
        if (originals.length) {
          photoImages = [];
          for (const [index, original] of originals.entries()) {
            const compressed = path.posix.join(folder, `${date}-照片-${String(index + 1).padStart(3, '0')}.jpg`);
            try { await insideFile(target.diaryRoot, compressed); photoImages.push({ ...original, relative: compressed, originalRelative: original.relative }); }
            catch (error) { if (error.code !== 'ENOENT') throw error; photoImages.push(original); }
          }
        }
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    const photos = [];
    for (const [i, image] of photoImages.entries()) {
      let relative = image.relative.replace(/^生活\/日记\//, '');
      if (/^(https?:|data:|\/)/i.test(relative)) continue;
      await insideFile(target.diaryRoot, relative);
      // Legacy reference galleries can point to compressed copies; find the
      // matching archive manifest to restore the actual original where available.
      let originalRelative = image.originalRelative || relative;
      await insideFile(target.diaryRoot, originalRelative);
      if (relative.includes('/reference/')) {
        const archiveRoot = relative.split('/reference/')[0];
        try { const manifest = JSON.parse(await fs.readFile(path.join(target.diaryRoot, archiveRoot, 'archive-manifest.json'), 'utf8')); const match = manifest.photos.find(p => decodeURIComponent(p.compressedPath) === path.posix.relative(archiveRoot, relative)); if (match) { originalRelative = path.posix.join(archiveRoot, match.originalPath); await insideFile(target.diaryRoot, originalRelative); } }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
      }
      photos.push({ id: `history-${date}-${i}`, name: path.basename(originalRelative), source: fileUrl(relative), originalSource: fileUrl(originalRelative) });
    }
    let associations = {};
    try { associations = JSON.parse(await fs.readFile(path.join(this.root, 'history-associations.json'), 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const association = associations.workspaceId === target.id ? associations.entries?.[date] : null;
    const events = historyEvents(date, body, photos, association);
    return { date, exists: true, body, events, photos, approval: entry?.approval, posterUrl: posterImage ? fileUrl(posterImage.relative) : entry?.posterSrc ? fileUrl(path.posix.join(target.relative.regular, decodeURIComponent(entry.posterSrc))) : '', noteUrl: `/api/diary/notes/${date}`, legacyPhotoGrouping: photos.length > 0 };
  }
  async identities() {
    const target = await this.target(); if (!target) return null;
    const graphRoot = path.posix.dirname(target.relative.graph);
    return target.graph.nodes.map(node => ({ ...node,
      species: ['cat', '猫'].includes(node.species) ? 'cat' : node.kind === 'pet' || node.species === 'dog' ? 'dog' : 'human',
      sourceRoot: target.diaryRoot,
      sourcePath: node.avatarSrc ? path.posix.join(graphRoot, decodeURIComponent(node.avatarSrc)) : target.graph.atlas?.src ? path.posix.join(graphRoot, decodeURIComponent(target.graph.atlas.src)) : null,
      sourceDescription: node.avatarSrc ? '' : `既有人物图谱合图，${target.graph.atlas?.cols}列、${target.graph.atlas?.rows}行；本角色位于第${(node.row || 0) + 1}行、第${(node.col || 0) + 1}列。其他格子不是本角色。此图是旧身份来源，不代表已通过当前画风。`,
    }));
  }
}
