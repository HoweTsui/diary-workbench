"""Pack actual references into labelled, lossless boards without omitting sources."""
from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def request_hash(request):
    return hashlib.sha256(json.dumps(request, ensure_ascii=False, sort_keys=True).encode()).hexdigest()


def pack_request(request, references, output_dir, *, max_images=5, tile_edge=1200, scene=None):
    if isinstance(max_images, bool) or not isinstance(max_images, int) or max_images < 2:
        raise ValueError('max_images must be at least 2: master stays separate, other sources may share boards')
    if isinstance(tile_edge, bool) or not isinstance(tile_edge, int) or tile_edge < 1024:
        raise ValueError('reference tile_edge must be at least 1024 for readable guides')
    output = Path(output_dir).resolve()
    source_paths = list(dict.fromkeys(r['path'] for r in references))
    if source_paths != request['referenced_image_paths'] or references[0].get('id') != 'style-lock-master':
        raise ValueError('packing requires the validated request references, with master first')
    if any(output == Path(p).resolve() or output in Path(p).resolve().parents for p in source_paths):
        raise ValueError('reference output must not contain or overwrite source images')
    if output.exists():
        manifest = json.loads((output / 'manifest.json').read_text(encoding='utf-8'))
        if (manifest.get('logicalRequestSha256') != request_hash(request) or
                manifest.get('maxImages') != max_images or manifest.get('tileEdge') != tile_edge):
            raise ValueError('reference output differs; choose a new request/version path')
        verify_pack(manifest['toolRequest'], output / 'manifest.json', references)
        return manifest['toolRequest']
    sources = []
    for i, ref in enumerate(references, 1):
        record = dict(ref, token=f'R{i:02d}', sha256=sha256(ref['path']))
        sources.append(record)
    output.mkdir(parents=True)
    paths, attachments = [], []
    if len(source_paths) <= max_images:
        for path in source_paths:
            paths.append(path)
            attachments.append({'path': path, 'sha256': sha256(path),
                                'sources': [r for r in sources if r['path'] == path]})
    else:
        master = sources[0]
        paths.append(master['path'])
        attachments.append({'path': master['path'], 'sha256': master['sha256'], 'sources': [master]})
        groups = {}
        for source in sources[1:]:
            role = source['role']
            duty = 'identity' if role.startswith('identity-') else role
            groups.setdefault(duty, []).append(source)
        buckets = list(groups.values())
        # Preserve duties where possible; if the actual tool budget is smaller,
        # labels and the manifest keep duties distinct within a shared board.
        while len(buckets) > max_images - 1:
            buckets[-2].extend(buckets.pop())
        while len(buckets) < max_images - 1:
            largest = max(range(len(buckets)), key=lambda i: len(buckets[i]))
            group = buckets[largest]
            if len(group) < 2:
                break
            mid = (len(group) + 1) // 2
            buckets[largest:largest + 1] = [group[:mid], group[mid:]]
        font = ImageFont.truetype(str(ROOT / 'assets/fonts/yozai/Yozai-Regular.ttf'), 30)
        for i, group in enumerate(buckets, 1):
            cols = min(3, math.ceil(math.sqrt(len(group))))
            cell_h, padding = tile_edge + 100, 24
            board = Image.new('RGB', (cols * tile_edge, math.ceil(len(group) / cols) * cell_h), 'white')
            draw = ImageDraw.Draw(board)
            placed = []
            for j, source in enumerate(group):
                x, y = (j % cols) * tile_edge, (j // cols) * cell_h
                with Image.open(source['path']) as original:
                    image = ImageOps.exif_transpose(original).convert('RGBA')
                original_size = list(image.size)
                scale = min((tile_edge - 2 * padding) / image.width, (tile_edge - 2 * padding) / image.height, 1)
                size = tuple(max(1, round(n * scale)) for n in image.size)
                thumb = image.resize(size, Image.Resampling.LANCZOS)
                left, top = x + (tile_edge - size[0]) // 2, y + (tile_edge - size[1]) // 2
                board.paste(thumb, (left, top), thumb)
                draw.text((x + padding, y + tile_edge + 8), source['token'] + ' | ' + source['role'], font=font, fill='black')
                placed.append(dict(source, region=[left, top, *size], originalSize=original_size, scale=scale))
            path = output / f'board-{i:02d}.png'
            board.save(path, optimize=True)
            paths.append(str(path))
            attachments.append({'path': str(path), 'sha256': sha256(path), 'size': list(board.size), 'sources': placed})
    legends = []
    for attachment in attachments:
        for source in attachment['sources']:
            legends.append(f"{source['token']}: id={source.get('id', '(identity)')}; role={source['role']}; "
                           f"characters={source.get('characterIds', 'shared')}; attachment={attachment['path']}; "
                           f"region={source.get('region', 'whole image')}; source={source['path']}")
    packed = {'prompt': request['prompt'].rstrip() + '\n\nACTUAL REFERENCE ATTACHMENTS:\n' + '\n'.join(legends) +
              '\nBoards are reference input only, not output layout. Use every source for its declared duty. '
              'Keep the approved drawing language; preserve identity and main facts, not photographic detail. '
              'Do not render board labels, grids, photographic texture or entire example identities.\n',
              'referenced_image_paths': paths}
    manifest = {'schemaVersion': 1, 'maxImages': max_images, 'scene': scene,
                'tileEdge': tile_edge, 'logicalRequestSha256': request_hash(request), 'toolRequest': packed,
                'sourceCount': len(sources), 'attachments': attachments, 'requestSha256': request_hash(packed)}
    (output / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    verify_pack(packed, output / 'manifest.json', references)
    return packed


def verify_pack(request, manifest_path, expected_references=None):
    manifest = json.loads(Path(manifest_path).read_text(encoding='utf-8'))
    attachments = manifest['attachments']
    paths = [a['path'] for a in attachments]
    if (manifest.get('schemaVersion') != 1 or not paths or len(paths) > manifest['maxImages'] or
            paths != request['referenced_image_paths'] or manifest['requestSha256'] != request_hash(request)):
        raise ValueError('reference pack differs from actual request or exceeds attachment limit')
    covered = []
    for attachment in attachments:
        if sha256(attachment['path']) != attachment['sha256']:
            raise ValueError('reference attachment checksum mismatch')
        for source in attachment['sources']:
            if sha256(source['path']) != source['sha256']:
                raise ValueError('reference source checksum mismatch')
            if 'region' in source:
                x, y, w, h = source['region']
                with Image.open(attachment['path']) as board, Image.open(source['path']) as original:
                    if x < 0 or y < 0 or w <= 0 or h <= 0 or x + w > board.width or y + h > board.height:
                        raise ValueError('reference source region outside board')
                    image = ImageOps.exif_transpose(original).convert('RGBA')
                    if list(image.size) != source['originalSize']:
                        raise ValueError('reference source dimensions differ')
                    image = image.resize((w, h), Image.Resampling.LANCZOS)
                    expected = Image.new('RGB', (w, h), 'white')
                    expected.paste(image, (0, 0), image)
                    if board.crop((x, y, x + w, y + h)).convert('RGB').tobytes() != expected.tobytes():
                        raise ValueError('reference source pixels not fully represented on board')
            covered.append({k: source[k] for k in ('path', 'role', 'origin', 'id', 'characterIds') if k in source})
    master = attachments[0]['sources']
    if len(master) != 1 or master[0].get('id') != 'style-lock-master' or paths[0] != master[0]['path']:
        raise ValueError('approved master must remain the first independent attachment')
    if len(covered) != manifest['sourceCount']:
        raise ValueError('reference source coverage count mismatch')
    if expected_references is not None:
        keys = lambda items: sorted(json.dumps(r, sort_keys=True) for r in items)
        if keys(covered) != keys(expected_references):
            raise ValueError('reference pack omits or changes an expected source/duty/character')
    return manifest
