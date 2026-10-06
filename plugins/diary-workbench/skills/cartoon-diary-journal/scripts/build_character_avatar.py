#!/usr/bin/env python3
"""Derive a centered square head-to-shoulder avatar from one full-body card.

Default framing follows the current character proportions; inspect the result and
set --shoulder-y (source-image pixels) if the pose/hair needs a different boundary.
No image generation, repainting, background removal or source mutation occurs.
"""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image


def build_avatar(source, output, *, species='human', shoulder_y=None, size=768, head_box=None):
    source, output = Path(source), Path(output)
    if source.resolve() == output.resolve():
        raise ValueError('avatar must not overwrite the full-body card')
    image = Image.open(source).convert('RGBA')
    if image.width != image.height:
        raise ValueError('standard card must be square (1:1), with one full-body character')
    if size < 256:
        raise ValueError('avatar size must be at least 256')
    alpha = image.getchannel('A')
    bounds = alpha.point(lambda a: 255 if a > 16 else 0).getbbox()
    if not bounds or alpha.getextrema()[0] == 255:
        raise ValueError('card must have transparent exterior and opaque character interiors')
    left, top, right, bottom = bounds
    if head_box is not None:
        if len(head_box) != 4 or not (0 <= head_box[0] < head_box[2] <= image.width and 0 <= head_box[1] < head_box[3] <= image.height):
            raise ValueError('head box must be inside the source card')
        left, top, right, y = head_box
        bottom = image.height
    else:
        y = shoulder_y if shoulder_y is not None else round(top + (bottom-top) * (0.44 if species == 'human' else 0.62))
    if not top < y < bottom:
        raise ValueError('shoulder boundary must lie inside the full-body silhouette')
    # Remove only lower-body pixels. Tighten the remaining alpha bounds, then
    # center that complete head/shoulder silhouette with balanced square padding.
    region = image.crop((left, top, right, y))
    content = region.getchannel('A').point(lambda a: 255 if a > 16 else 0).getbbox()
    if not content:
        raise ValueError('head/shoulder region is empty')
    crop = (left+content[0], top+content[1], left+content[2], top+content[3])
    portrait = image.crop(crop)
    scale = size * 0.80 / max(portrait.size)
    portrait = portrait.resize((max(1, round(portrait.width*scale)), max(1, round(portrait.height*scale))), Image.Resampling.LANCZOS)
    result = Image.new('RGBA', (size, size))
    offset = ((size-portrait.width)//2, (size-portrait.height)//2)
    result.alpha_composite(portrait, offset)
    output.parent.mkdir(parents=True, exist_ok=True)
    result.save(output)
    record = {'schemaVersion': 1, 'method': 'full-body-head-shoulder-crop', 'source': source.name,
              'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'crop': list(crop),
              'sourceSize': list(image.size), 'size': size, 'offset': list(offset),
              'avatarSha256': hashlib.sha256(output.read_bytes()).hexdigest(), 'species': species}
    output.with_suffix('.crop.json').write_text(json.dumps(record, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    return record


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--species', choices=['human', 'cat', 'dog'], default='human')
    parser.add_argument('--shoulder-y', type=int)
    parser.add_argument('--head-box', nargs=4, type=int, metavar=('LEFT', 'TOP', 'RIGHT', 'BOTTOM'), help='Observed head-to-shoulder box; exclude raised pet tails without repainting')
    parser.add_argument('--size', type=int, default=768)
    args = parser.parse_args()
    try:
        record = build_avatar(args.source, args.output, species=args.species, shoulder_y=args.shoulder_y, size=args.size, head_box=args.head_box)
    except (ValueError, OSError) as error:
        parser.error(str(error))
    print(json.dumps(record, ensure_ascii=False))


if __name__ == '__main__':
    main()
