// Adapt only the workbench's served/packaged copies. Original carriers and engines stay untouched.
const backLink = `<a class="workbench-back" href="/" aria-label="返回工作台" title="返回工作台"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14 5-7 7 7 7"/></svg><span>返回工作台</span></a>`;
const sharedStyles = `
.workbench-back { display:inline-flex; align-items:center; justify-content:center; gap:5px; min-width:44px; min-height:44px; padding:0 8px; flex-shrink:0; color:inherit; text-decoration:none; white-space:nowrap; border-radius:8px; font:14px system-ui,sans-serif; pointer-events:auto; }
.workbench-back:hover { background:#f1f1f1; }
.workbench-back:focus-visible { outline:2px solid currentColor; outline-offset:2px; }
@media(max-width:620px) { .workbench-back span { display:none; } }
`;
const readerStyles = `
.workbench-reader-brand { display:flex; align-items:center; gap:14px; min-width:0; flex:1; }
.workbench-reader-brand .brand { flex:1; max-width:none; }
#entry-characters { gap:7px; flex-wrap:wrap; }
#entry-characters a.workbench-cast { position:relative; padding:0; width:34px; min-height:44px; justify-content:center; flex-shrink:0; }
.workbench-cast-frame { display:block; position:relative; width:34px; height:34px; overflow:hidden; border:1px solid #ccc; border-radius:50%; background:white; }
.workbench-cast-frame img { display:block; width:100%; height:100%; object-fit:contain; }
.workbench-cast::after { content:attr(aria-label); position:absolute; bottom:calc(100% + 5px); left:50%; transform:translateX(-50%); padding:5px 9px; border:1px solid #ddd; border-radius:6px; background:white; color:#171717; font:14px system-ui,sans-serif; white-space:nowrap; box-shadow:0 2px 8px #0001; opacity:0; pointer-events:none; z-index:10; }
.workbench-cast:hover::after,.workbench-cast:focus-visible::after { opacity:1; }
@media(max-width:620px) { .workbench-reader-brand { gap:8px; } }
`;
const readerAdapter = `<script data-workbench-integration>
(() => {
  const host = document.getElementById('entry-characters');
  if (!host) return;
  fetch('./data/manifest.json').then(response => response.json()).then(data => {
    const cast = new Map((data.characters || []).map(character => [character.id, character]));
    function update() {
      for (const link of host.querySelectorAll('a:not(.workbench-cast)')) {
        const character = cast.get(decodeURIComponent(link.hash.slice('#character='.length)));
        if (!character) continue;
        link.classList.add('workbench-cast');
        link.setAttribute('aria-label', character.name);
        const frame = document.createElement('span');
        frame.className = 'workbench-cast-frame';
        const image = document.createElement('img');
        image.alt = ''; image.decoding = 'async';
        if (character.avatarSrc) {
          const url = new URL(character.avatarSrc, new URL('./data/', location.href));
          if (url.origin === location.origin) image.src = url.href;
        }
        const crop = character.avatarFrame;
        if (crop && [crop.imageWidth,crop.imageHeight,crop.size].every(value => Number.isFinite(value) && value > 0) && [crop.x,crop.y].every(Number.isFinite)) {
          Object.assign(image.style, { position:'absolute', maxWidth:'none', width:(crop.imageWidth/crop.size*100)+'%', height:(crop.imageHeight/crop.size*100)+'%', left:(-crop.x/crop.size*100)+'%', top:(-crop.y/crop.size*100)+'%' });
        }
        image.onerror = () => { image.remove(); frame.textContent = '♙'; frame.style.cssText += ';text-align:center;font-size:26px;line-height:32px'; };
        frame.append(image); link.replaceChildren(frame);
      }
    }
    new MutationObserver(update).observe(host, { childList:true });
    update();
  }).catch(() => {});
})();
</script>`;
const graphStyles = `
body[data-workbench-library="graph"] { display:flex; flex-direction:column; height:100dvh; }
body[data-workbench-library="graph"] > .topbar { position:relative; inset:auto; display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; flex-shrink:0; gap:10px 12px; padding:12px 20px; background:var(--paper); border-bottom:1.5px solid var(--ink); pointer-events:auto; }
body[data-workbench-library="graph"] .brand { min-width:0; }
body[data-workbench-library="graph"] .brand h1 { font-size:clamp(24px,3vw,38px); line-height:1.2; }
body[data-workbench-library="graph"] .workbench-graph-filters { display:flex; align-items:center; justify-content:flex-end; gap:8px; min-width:0; }
body[data-workbench-library="graph"] .workbench-graph-filters .search { width:200px; max-width:100%; }
body[data-workbench-library="graph"] .toolbar { position:absolute; z-index:4; inset:12px 16px auto; display:flex; flex-wrap:wrap; justify-content:flex-start; gap:8px; max-width:none; margin:0; min-width:0; }
body[data-workbench-library="graph"] > .app { position:relative; isolation:isolate; flex:1; height:auto; min-height:0; --graph-tools-height:80px; }
body[data-workbench-library="graph"] .inspector { min-height:0; overscroll-behavior:contain; }
body[data-workbench-library="graph"] > .app:not(.inspector-open) { grid-template-columns:minmax(0,1fr); }
body[data-workbench-library="graph"] > .app:not(.inspector-open) .inspector { display:none; }
body[data-workbench-library="graph"] .toolbar .mobile-inspector { display:none; }
body[data-workbench-library="graph"] > .app:not(.inspector-open) .toolbar .mobile-inspector { display:inline-flex; }
body[data-workbench-library="graph"] > .app > .close-inspector { position:absolute; z-index:7; top:24px; left:calc(100% - clamp(330px,27vw,408px) - 30px); display:grid; place-items:center; width:30px; height:40px; padding:0; border:1.5px solid var(--ink); border-right:0; border-radius:8px 0 0 8px; background:var(--paper); box-shadow:-3px 3px 0 rgba(23,23,21,.12); cursor:pointer; font-size:22px; line-height:1; }
body[data-workbench-library="graph"] > .app:not(.inspector-open) > .close-inspector { display:none; }
@media(max-width:900px) {
  body[data-workbench-library="graph"] > .app { display:grid; grid-template-columns:minmax(0,1fr) minmax(320px,min(42vw,408px)); }
  body[data-workbench-library="graph"] > .app.inspector-open > .close-inspector { left:calc(100% - max(320px,min(42vw,408px)) - 30px); }
  body[data-workbench-library="graph"] .graph-pane { width:auto; height:auto; min-height:0; }
  body[data-workbench-library="graph"] .inspector { display:none; position:relative; inset:auto; width:auto; height:auto; transform:none; transition:none; border-left:2px solid var(--ink); box-shadow:none; }
  body[data-workbench-library="graph"] .inspector.open { display:block; }
}
@media(max-width:800px) {
  body[data-workbench-library="graph"] > .topbar { grid-template-columns:auto minmax(0,1fr); }
  body[data-workbench-library="graph"] .workbench-graph-filters { grid-column:1 / -1; justify-self:end; width:min(100%,360px); }
  body[data-workbench-library="graph"] .workbench-graph-filters .search { flex:1; min-width:0; width:auto; }
}
@media(max-width:620px) {
  body[data-workbench-library="graph"] > .topbar { padding:10px 12px; gap:8px; }
  body[data-workbench-library="graph"] .toolbar { right:12px; left:12px; gap:7px; }
  body[data-workbench-library="graph"] .toolbar .mobile-inspector { min-width:40px; width:40px; padding:0; gap:0; font-size:0; }
  body[data-workbench-library="graph"] > .app { grid-template-columns:minmax(0,1fr); grid-template-rows:minmax(0,1fr); }
  body[data-workbench-library="graph"] > .app.inspector-open { grid-template-rows:minmax(240px,42dvh) minmax(0,1fr); }
  body[data-workbench-library="graph"] > .app.inspector-open > .close-inspector { top:calc(42dvh - 20px); left:10px; border-right:1.5px solid var(--ink); border-radius:8px; }
  body[data-workbench-library="graph"] .graph-pane { min-height:240px; border-right:0; }
  body[data-workbench-library="graph"] .inspector { min-height:0; padding:18px 18px 24px; border:0; border-top:2px solid var(--ink); }
}
`;
const graphAdapter = `<script data-workbench-integration>
(() => {
  const pane = document.getElementById('graph-pane');
  const inspector = document.getElementById('inspector');
  const toggle = document.getElementById('show-inspector');
  const toolbar = pane.querySelector('.toolbar');
  const narrow = window.matchMedia('(max-width:900px)');
  toggle.setAttribute('aria-controls', 'inspector');
  toggle.setAttribute('aria-label', '人物卡');
  if (!narrow.matches) inspector.classList.add('open');
  toggle.addEventListener('click', event => {
    inspector.classList.toggle('open');
    event.stopImmediatePropagation();
  }, true);
  function syncInspector() {
    const open = inspector.classList.contains('open');
    const wasOpen = pane.parentElement.classList.contains('inspector-open');
    inspector.inert = !open;
    pane.parentElement.classList.toggle('inspector-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    if (wasOpen && !open) toggle.focus();
  }
  new MutationObserver(syncInspector).observe(inspector, { attributes:true, attributeFilter:['class'] });
  narrow.addEventListener('change', syncInspector);
  syncInspector();
  // Keep the mobile card below the canvas actions, including when edit-mode tools wrap.
  const updateToolHeight = () => pane.parentElement.style.setProperty('--graph-tools-height', (toolbar.offsetTop + toolbar.offsetHeight + 12) + 'px');
  new ResizeObserver(updateToolHeight).observe(toolbar);
  updateToolHeight();
  // The original canvas listens for window resize; also refresh when the toolbar wraps.
  let lastSize = '';
  new ResizeObserver(() => {
    const rect = pane.getBoundingClientRect();
    const size = rect.width + ':' + rect.height;
    if (size !== lastSize) { lastSize = size; window.dispatchEvent(new Event('resize')); }
  }).observe(pane);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && narrow.matches && inspector.classList.contains('open') && !event.target.matches('input,textarea,select')) {
      inspector.classList.remove('open'); toggle.focus();
    }
  });
})();
</script>`;

// Older graph carriers have atlas-only nodes. Extend the served copy so newly
// confirmed individual cards can appear without rebuilding that legacy atlas.
function individualAvatars(html) {
  if (html.includes('function directAvatarSource(')) return html;
  if (!html.includes('function renderProfileAvatar(node)') || !html.includes('if (hasAtlasCell && atlas.complete && atlas.naturalWidth)')) throw Error('原人物图谱版本不支持角色图片适配。');
  const helpers = `var workbenchAvatars = new Map();
      function workbenchAvatar(node) {
        if (typeof node.avatarSrc !== 'string' || !node.avatarSrc || /^[A-Za-z][A-Za-z0-9+.-]*:|^\\//.test(node.avatarSrc) || decodeURIComponent(node.avatarSrc).split('/').includes('..')) return null;
        var record = workbenchAvatars.get(node.avatarSrc);
        if (record) return record;
        var image = new Image(); record = { image: image, ready: false };
        workbenchAvatars.set(node.avatarSrc, record);
        image.onload = function () { record.ready = true; draw(); if (selectedId && nodeById.has(selectedId)) renderProfileAvatar(nodeById.get(selectedId)); };
        image.src = node.avatarSrc; return record;
      }
      `;
  return html.replace('function renderProfileAvatar(node)', helpers + 'function renderProfileAvatar(node)')
    .replace('if (!hasAtlasCell(node)) {', `var direct = workbenchAvatar(node);
        if (direct && direct.ready) { avatar.style.backgroundImage = 'url("' + direct.image.src + '")'; avatar.style.backgroundSize = 'contain'; avatar.style.backgroundRepeat = 'no-repeat'; return; }
        if (!hasAtlasCell(node)) {`)
    .replace('if (hasAtlasCell && atlas.complete && atlas.naturalWidth) {', `var direct = workbenchAvatar(node);
        if (direct && direct.ready) {
          var scale = Math.min(radius * 1.8 / direct.image.naturalWidth, radius * 1.8 / direct.image.naturalHeight);
          var width = direct.image.naturalWidth * scale, height = direct.image.naturalHeight * scale;
          ctx.drawImage(direct.image, node.x - width / 2, node.y - height / 2, width, height);
        } else if (hasAtlasCell && atlas.complete && atlas.naturalWidth) {`);
}

function fitGraphOnResize(html) {
  const before = `        resetView(false);\n        draw();\n      }\n\n      function resetPositions()`;
  const after = `        fitViewToPositions(new Map(nodes.map(function (node) { return [node.id, { x: node.x, y: node.y }]; })));\n        draw();\n      }\n\n      function resetPositions()`;
  if (!html.includes(before)) throw new Error('人物图谱缩放入口未找到，不能适配面板宽度');
  return html.replace(before, after);
}

function makeInspectorCollapsible(html) {
  const before = '<button id="close-inspector" class="close-inspector" type="button" aria-label="关闭人物卡">×</button>';
  const inspector = '<aside class="inspector" id="inspector" aria-label="人物卡">';
  const handle = '<button id="close-inspector" class="close-inspector" type="button" aria-label="收起人物卡" title="收起人物卡">×</button>\n';
  if (!html.includes(before) || !html.includes(inspector)) throw new Error('人物卡收起按钮未找到，不能应用工作台适配');
  return html.replace(before, '').replace(inspector, handle + inspector);
}

export function adaptLibraryPage(html, kind) {
  if (!['book', 'graph'].includes(kind) || html.includes('data-workbench-library=')) return html;
  let adapted = html.replace('<body>', `<body data-workbench-library="${kind}">`);
  if (kind === 'book') {
    adapted = adapted.replace('</body>', readerAdapter + '\n</body>');
    adapted = adapted.replace('<header><a class="brand"', `<header><div class="workbench-reader-brand">${backLink}<a class="brand"`)
      .replace('</a><div class="header-actions">', '</a></div><div class="header-actions">')
      .replace('<span>把日常，慢慢翻开。</span>', '');
    if (!adapted.includes('class="workbench-back"')) adapted = adapted.replace('<header class="book-toolbar">', `<header class="book-toolbar">${backLink}`);
  } else {
    adapted = fitGraphOnResize(individualAvatars(makeInspectorCollapsible(adapted)));
    const topbar = adapted.match(/<header class="topbar">[\s\S]*?<\/header>/)?.[0];
    if (!topbar) throw new Error('人物图谱操作栏未找到，不能应用工作台适配');
    const toolbar = topbar.match(/<div class="toolbar"[^>]*>[\s\S]*?<\/div>/)?.[0];
    const search = toolbar?.match(/<label class="search control">[\s\S]*?<\/label>/)?.[0];
    const filter = toolbar?.match(/<select id="relation-filter"[\s\S]*?<\/select>/)?.[0];
    if (!toolbar || !search || !filter) throw new Error('人物图谱搜索与操作控件未找到');
    const filters = `<div class="workbench-graph-filters" aria-label="查找人物与筛选关系">${search}${filter}</div>`;
    const canvasTools = toolbar.replace(search, '').replace(filter, '');
    const pageHeader = topbar.replace(toolbar, filters).replace('<header class="topbar">', `<header class="topbar">${backLink}`);
    adapted = adapted.replace(topbar, '').replace('<main class="app">', `${pageHeader}\n<main class="app">`)
      .replace(/(<section class="graph-pane"[^>]*>)/, `$1\n${canvasTools}`)
      .replace('</body>', `${graphAdapter}\n</body>`);
  }
  return adapted.replace('</head>', `<style data-workbench-integration>${sharedStyles}${kind === 'book' ? readerStyles : graphStyles}</style>\n</head>`);
}
