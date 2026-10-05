// Workbench-only visibility adapter. Geometry, materials and flip timing stay intact.
export function installReaderVisibility(book) {
  if (book.workbenchVisibility) return;
  book.workbenchVisibility = true;
  const original = book.flipPages;
  book.flipPages = function (...args) {
    const result = original.apply(this, args);
    const current = Math.floor(this.progress);
    this.pages.forEach((sheet, index) => {
      // Retain both outer covers and neighboring surfaces, including reverse drags.
      sheet.visible = index === 0 || index === this.pages.length - 1 || Math.abs(index - current) <= 2;
    });
    return result;
  };
}

export function adaptReaderScript(source) {
  if (source.includes('/* workbench-reader-visibility */')) return source;
  const instance = source.match(/\b(?:const|let)\s+([\w$]+)=new [\w$]+\(\{flipDuration:/)?.[1];
  if (!instance) return source;
  return source + '\n/* workbench-reader-visibility */\n;(' + installReaderVisibility.toString() + ')(' + instance + ');\n';
}
