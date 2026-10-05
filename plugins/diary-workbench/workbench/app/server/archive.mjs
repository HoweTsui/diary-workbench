import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { safeFile, sha256 } from './jobs.mjs';

const execute = promisify(execFile);
export function replaceData(html, id, data) {
  const pattern = new RegExp(`(<script\\b[^>]*\\bid=["']${id}["'][^>]*>)([\\s\\S]*?)(<\\/script\\s*>)`, 'gi');
  if ([...html.matchAll(pattern)].length !== 1) throw Error(`载体中的 ${id} 数据块不唯一，未替换外壳。`);
  return html.replace(pattern, (_, start, old, end) => start + JSON.stringify(data).replaceAll('<', '\\u003c') + end);
}

// Archive only into the independent test library. A production target is a later explicit configuration.
export function createArchive({ root, demoRoot, readerRoot, skill, python }) {
  let lock = Promise.resolve();
  return (job, jobFolder) => {
    const run = lock.then(() => archive(job, jobFolder)); lock = run.catch(() => {}); return run;
  };
  async function archive(job, jobFolder) {
    const source = path.join(jobFolder, 'result');
    const poster = await safeFile(source, job.result.poster);
    if (sha256(await fs.readFile(poster)) !== job.approval.posterSha256) throw Error('预览图片已经改变，请重新检查。');
    const briefPath = await safeFile(source, job.result.brief), brief = JSON.parse(await fs.readFile(briefPath, 'utf8'));
    const photos = await safeFile(source, job.result.photoArchive);
    const token = randomUUID(), staged = path.join(root, 'staging', token), live = path.join(root, 'library'), backup = path.join(root, 'backups', token);
    await fs.mkdir(staged, { recursive: true });
    let hadLibrary = false;
    try { await fs.access(path.join(live, 'diary/diary-book-data.json')); hadLibrary = true; } catch {}
    if (hadLibrary) await fs.cp(live, staged, { recursive: true });
    else {
      await fs.cp(demoRoot, path.join(staged, 'diary'), { recursive: true });
      await fs.cp(readerRoot, path.join(staged, 'reader'), { recursive: true });
      await fs.cp(demoRoot, path.join(staged, 'reader/data'), { recursive: true });
      await fs.copyFile(path.join(demoRoot, 'diary-book-data.json'), path.join(staged, 'reader/data/manifest.json'));
    }
    const diary = path.join(staged, 'diary'), manifestFile = path.join(diary, 'diary-book-data.json');
    const data = JSON.parse(await fs.readFile(manifestFile, 'utf8'));
    if (!Array.isArray(data.entries) || new Set(data.entries.map(e => e.date)).size !== data.entries.length) throw Error('原书清单存在重复日期，不能归档。');
    const media = `entries/${job.date}-${job.result.sha256}.png`; await fs.mkdir(path.join(diary, 'entries'), { recursive: true }); await fs.copyFile(poster, path.join(diary, media));
    const old = data.entries.find(e => e.date === job.date), castIds = job.characters.map(c => c.id);
    const periodId = old?.periodId || 'workbench-diary';
    if (!data.periods.some(p => p.id === periodId)) data.periods.push({ id: periodId, title: '日常记录', startDate: job.date, endDate: job.date, summary: '', coverSrc: media });
    const period = data.periods.find(p => p.id === periodId);
    period.startDate = period.startDate < job.date ? period.startDate : job.date;
    period.endDate = period.endDate > job.date ? period.endDate : job.date;
    const entry = { ...old, id: old?.id || job.date, date: job.date, periodId, title: brief.title, posterSrc: media, summary: brief.summary || '', characterIds: castIds, eventCount: brief.events.length, illustrationCount: brief.events.length, isBlank: false };
    data.entries = [...data.entries.filter(e => e.date !== job.date), entry].sort((a, b) => a.date.localeCompare(b.date));
    const graphFile = path.join(diary, 'character-graph.html'), graphHtml = await fs.readFile(graphFile, 'utf8');
    const graphMatch = graphHtml.match(/<script\b[^>]*\bid=["']graph-data["'][^>]*>([\s\S]*?)<\/script\s*>/i);
    if (!graphMatch) throw Error('原图谱缺少数据块。');
    const graph = JSON.parse(graphMatch[1]);
    let graphChanged = false;
    for (const character of job.characters) {
      const known = data.characters.find(c => c.id === character.id), node = graph.nodes.find(c => c.id === character.id);
      const card = await safeFile(source, character.card), cardSrc = `avatars/${character.id}-${sha256(await fs.readFile(card))}${path.extname(card)}`;
      const approvedProfile = { ...(known?.profile || {}), approval: 'approved', identity: { status: 'confirmed', version: character.version, approvedVersion: character.version, approvedBy: 'user', styleVersion: 'style-lock-v2', approvedAt: job.approval.at } };
      // Do not replace an existing portrait: only the explicitly approved new identity version changes it.
      if (!known || known.profile?.identity?.status !== 'confirmed' || known.profile?.identity?.approvedBy !== 'user' || known.profile?.identity?.version !== character.version) {
        await fs.mkdir(path.join(diary, 'avatars'), { recursive: true }); await fs.copyFile(card, path.join(diary, cardSrc));
        const next = { ...known, id: character.id, name: character.name, species: character.species, anchors: character.anchors, avatarSrc: cardSrc, profile: approvedProfile };
        if (known) Object.assign(known, next); else data.characters.push(next);
        if (node) Object.assign(node, next); else graph.nodes.push({ x: 0, y: 0, ...next });
        graphChanged = true;
      }
    }
    // No relationship is inferred from sharing a poster; established graph edges remain intact.
    await fs.writeFile(manifestFile, JSON.stringify(data, null, 2));
    const bookFile = path.join(diary, 'index.html'); await fs.writeFile(bookFile, replaceData(await fs.readFile(bookFile, 'utf8'), 'diary-book-data', data));
    if (graphChanged) await fs.writeFile(graphFile, replaceData(graphHtml, 'graph-data', graph));
    const input = JSON.parse(await fs.readFile(path.join(jobFolder, 'input.json'), 'utf8'));
    const documentInput = path.join(staged, 'document-input.json');
    await fs.writeFile(documentInput, JSON.stringify({ date: job.date, sourceText: brief.sourceText, body: input.events.map(e => e.text).filter(text => text.trim()).join('\n\n') || '这一天的图片记录。', title: brief.title, events: brief.events, poster, photoArchive: photos }));
    await execute(python, [fileURLToPath(new URL('../scripts/run-skill-document.py', import.meta.url)), path.join(path.dirname(skill), 'scripts/build_diary_document.py'), documentInput, '--output-dir', path.join(staged, 'notes')], { timeout: 180000 });
    await execute(python, [path.join(path.dirname(skill), 'scripts/build_diary_reader.py'), bookFile, '--output-dir', path.join(staged, 'reader'), '--update-date', job.date], { timeout: 60000 });
    // Verify the reader actually references this exact final PNG before activating the staged library.
    const readerData = JSON.parse(await fs.readFile(path.join(staged, 'reader/data/manifest.json'), 'utf8'));
    // The canonical date updater deliberately leaves existing identities untouched.
    // Mirror only the versions explicitly confirmed above, without modifying the reader shell.
    for (const character of job.characters) {
      const approved = data.characters.find(c => c.id === character.id), readerCharacter = readerData.characters.find(c => c.id === character.id);
      if (!readerCharacter) throw Error('3D 日记本缺少本次已确认角色。');
      const identity = readerCharacter.profile?.identity;
      if (identity?.status === 'confirmed' && identity.approvedBy === 'user' && identity.version === approved.profile.identity.version) continue;
      const card = await safeFile(diary, approved.avatarSrc), relative = `updates/${job.date}/${sha256(await fs.readFile(card))}${path.extname(card)}`;
      await fs.mkdir(path.dirname(path.join(staged, 'reader/data', relative)), { recursive: true });
      await fs.copyFile(card, path.join(staged, 'reader/data', relative));
      Object.assign(readerCharacter, approved, { avatarSrc: relative });
    }
    await fs.writeFile(path.join(staged, 'reader/data/manifest.json'), JSON.stringify(readerData, null, 2));
    const readerEntry = readerData.entries.filter(e => e.date === job.date && !e.isBlank);
    if (readerEntry.length !== 1) throw Error('3D 日记本未得到唯一的对应日期。');
    const readerPoster = await safeFile(path.join(staged, 'reader/data'), decodeURIComponent(readerEntry[0].posterSrc));
    if (sha256(await fs.readFile(readerPoster)) !== job.result.sha256) throw Error('3D 日记本与预览海报不一致。');
    await fs.unlink(documentInput);
    await fs.mkdir(path.dirname(backup), { recursive: true });
    if (hadLibrary) await fs.rename(live, backup);
    try { await fs.rename(staged, live); } catch (error) { if (hadLibrary) await fs.rename(backup, live); throw error; }
    return { mode: 'local-test', noteUrl: `/api/diary/library/notes/${job.date}.html`, bookUrl: `/library/book/index.html#entry=${encodeURIComponent(entry.id)}`, graphUrl: '/library/diary/character-graph.html', date: job.date, posterSha256: job.result.sha256 };
  }
}
