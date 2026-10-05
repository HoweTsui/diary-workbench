export const libraryLinks = {
  book: '/library/book/index.html',
  graph: '/library/diary/character-graph.html',
  manifest: '/api/diary/catalog',
  asset: path => path?.startsWith('/') && !path.startsWith('//') ? path : `/library/diary/${path}`,
};
export async function loadCatalog(signal) {
  let response = await fetch(libraryLinks.manifest, { cache: 'no-store', signal });
  // Static public exports are read-only demos, never a hidden production store.
  if (response.status === 404) response = await fetch('/library/book/data/manifest.json', { cache: 'no-store', signal });
  if (!response.ok) throw Error('日记清单读取失败');
  return response.json();
}
