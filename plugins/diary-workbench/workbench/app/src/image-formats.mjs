// MIME metadata is often empty for Finder/clipboard files. Keep the original
// bytes and infer only the type, never pretend a HEIC is a JPEG.
export const imageExtensions = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', jfif: 'image/jpeg',
  webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml', avif: 'image/avif',
  heic: 'image/heic', heif: 'image/heif', heics: 'image/heic-sequence', hif: 'image/heif',
  tif: 'image/tiff', tiff: 'image/tiff', bmp: 'image/bmp', ico: 'image/x-icon',
  psd: 'image/vnd.adobe.photoshop', jp2: 'image/jp2', jxl: 'image/jxl',
  tga: 'image/x-tga', dds: 'image/vnd-ms.dds', exr: 'image/x-exr',
  dng: 'image/x-adobe-dng', raw: 'image/x-raw', cr2: 'image/x-canon-cr2',
  cr3: 'image/x-canon-cr3', nef: 'image/x-nikon-nef', arw: 'image/x-sony-arw',
  raf: 'image/x-fuji-raf', orf: 'image/x-olympus-orf', rw2: 'image/x-panasonic-rw2',
};
export const imageAccept = `image/*,${Object.keys(imageExtensions).map(ext => `.${ext}`).join(',')}`;
export function imageMime(file) {
  const extension = String(file?.name || '').split('.').at(-1).toLowerCase();
  return imageExtensions[extension] || (file?.type?.startsWith('image/') ? file.type : '');
}
export const isImageFile = file => Boolean(imageMime(file));
