import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { XIcon } from '@phosphor-icons/react/dist/csr/X';

export function PosterPreview({ src, alt, className = 'poster-preview', label = '放大查看海报', children }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current.showModal();
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  useEffect(() => { setOpen(false); }, [src]);
  return <><button type="button" draggable={false} className={`${className} poster-trigger`} aria-label={label} onClick={() => setOpen(true)}>{children || <img draggable={false} src={src} alt={alt} />}</button>
    {open ? createPortal(<dialog ref={dialog} className="poster-lightbox" aria-label="图片放大查看" onCancel={() => setOpen(false)} onClose={() => setOpen(false)} onClick={event => { if (event.target === event.currentTarget) setOpen(false); }}><button autoFocus className="poster-close" aria-label="关闭图片" onClick={() => setOpen(false)}><XIcon size={24} /></button><img src={src} alt={alt} /></dialog>, document.body) : null}
  </>;
}
