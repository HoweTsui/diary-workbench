import { UserCircleIcon } from '@phosphor-icons/react/dist/csr/UserCircle';
import { libraryLinks } from './library.mjs';

export function ProfileAvatar({ catalog }) {
  const profile = catalog?.profile;
  const atlas = profile?.avatarAtlas;
  if (profile?.avatarSrc) {
    const frame = profile.avatarFrame;
    const cropped = frame && [frame.imageWidth, frame.imageHeight, frame.size].every(value => Number.isFinite(value) && value > 0) && [frame.x, frame.y].every(Number.isFinite);
    const style = cropped ? { width: `${frame.imageWidth / frame.size * 100}%`, height: `${frame.imageHeight / frame.size * 100}%`, left: `${-frame.x / frame.size * 100}%`, top: `${-frame.y / frame.size * 100}%` } : undefined;
    return <span className={`profile-avatar${cropped ? ' profile-avatar-cropped' : ''}`}><img src={profile.avatarSrc} style={style} alt={profile.name || '主角头像'} /></span>;
  }
  if (atlas) return <span className="profile-avatar profile-avatar-atlas"><img src={atlas.src} alt={profile.name || '主角头像'} style={{ width: `${atlas.cols * 260}%`, left: `${-80 - atlas.col * 260}%`, top: `${-10 - atlas.row * 280}%` }} /></span>;
  return <span className="profile-avatar"><UserCircleIcon size="100%" aria-hidden="true" focusable="false" /></span>;
}
