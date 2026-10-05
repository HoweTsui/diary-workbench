#!/usr/bin/env python3
"""Export the bundled reader from a legacy diary-book HTML, without changing it."""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import shutil
import tempfile
from datetime import date
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath
from urllib.parse import quote, unquote, urlsplit

RUNTIME = Path(__file__).resolve().parents[1] / "assets/diary-reader-v3/runtime"
IMAGE_TYPES = {".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif", ".avif"}


def inside(path, root):
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


class EmbeddedData(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.active = False
        self.count = 0
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() == "script" and dict(attrs).get("id") == "diary-book-data":
            self.count += 1
            self.active = True

    def handle_endtag(self, tag):
        if tag.lower() == "script":
            self.active = False

    def handle_data(self, text):
        if self.active:
            self.parts.append(text)


def required_text(value, label):
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{label} must be a nonempty string")
    return value


def read_manifest(index):
    parser = EmbeddedData()
    parser.feed(index.read_text(encoding="utf-8"))
    if parser.count != 1:
        raise ValueError("Expected exactly one script#diary-book-data")
    data = json.loads("".join(parser.parts))
    if not isinstance(data, dict) or data.get("schemaVersion") != 1:
        raise ValueError("Expected diary-book schemaVersion 1")
    book = data.get("book")
    if not isinstance(book, dict):
        raise ValueError("Missing book object")
    for key in ("id", "title"):
        required_text(book.get(key), f"book.{key}")
    required_text(book.get("coverImageSrc") or book.get("coverSrc"), "book cover")
    for name in ("periods", "entries", "characters", "relationships"):
        data.setdefault(name, [])
        if not isinstance(data[name], list):
            raise ValueError(f"{name} must be a list")
    if not data["entries"]:
        raise ValueError("At least one entry is required")
    ids = {}
    for name in ("periods", "entries", "characters"):
        ids[name] = set()
        for item in data[name]:
            if not isinstance(item, dict):
                raise ValueError(f"Invalid {name} item")
            identity = required_text(item.get("id"), f"{name}.id")
            if identity in ids[name]:
                raise ValueError(f"Duplicate {name} id: {identity}")
            ids[name].add(identity)
    entry_dates = set()
    for entry in data["entries"]:
        for key in ("title", "date", "posterSrc"):
            required_text(entry.get(key), f"entry.{key}")
        entry_date = date.fromisoformat(entry["date"])
        if entry_date in entry_dates:
            raise ValueError(f"Only one diary is allowed per date: {entry['date']}")
        entry_dates.add(entry_date)
        if entry.get("periodId") not in ids["periods"]:
            raise ValueError(f"Unknown period for entry {entry['id']}")
        entry.setdefault("characterIds", [])
        if not isinstance(entry["characterIds"], list) or any(
            not isinstance(x, str) or x not in ids["characters"] for x in entry["characterIds"]
        ):
            raise ValueError(f"Unknown character for entry {entry['id']}")
    return data


def insert_blank_dates(data):
    """Return chronological entries with date-only placeholders for missing days."""
    result = copy.deepcopy(data)
    entries_by_date = {date.fromisoformat(entry["date"]): entry for entry in result["entries"]}
    first, last = min(entries_by_date), max(entries_by_date)
    entries = []
    current = first
    while current <= last:
        entry = entries_by_date.get(current)
        if entry is None:
            entry = {
                "id": f"blank-{current.isoformat()}",
                "date": current.isoformat(),
                "title": "留白日",
                "summary": "",
                "periodId": "",
                "posterSrc": "",
                "characterIds": [],
                "isBlank": True,
            }
        entries.append(entry)
        current = date.fromordinal(current.toordinal() + 1)
    result["entries"] = entries
    return result


def local_asset(root, value):
    required_text(value, "asset path")
    decoded = unquote(value)
    parsed = urlsplit(decoded)
    path = PurePosixPath(decoded)
    if (parsed.scheme or parsed.netloc or parsed.query or parsed.fragment
            or path.is_absolute() or ".." in path.parts or "\\" in decoded
            or any(ord(c) < 32 for c in decoded)):
        raise ValueError(f"Unsafe asset path: {value}")
    candidate = (root / path).resolve()
    if not inside(candidate, root):
        raise ValueError(f"Asset escapes source directory: {value}")
    if not candidate.is_file():
        raise ValueError(f"Missing asset: {value}")
    if candidate.suffix.lower() not in IMAGE_TYPES:
        raise ValueError(f"Not an image asset: {value}")
    return candidate, path


def collect_assets(data, root):
    """Rewrite only Src fields, preserving other schema data and original bytes."""
    result = copy.deepcopy(data)
    files = {}

    def walk(value):
        if isinstance(value, dict):
            for key, item in value.items():
                if key.endswith("Src") and item:
                    source, relative = local_asset(root, item)
                    files[relative.as_posix()] = source
                    value[key] = quote(relative.as_posix(), safe="/")
                else:
                    walk(item)
        elif isinstance(value, list):
            for item in value:
                walk(item)
    walk(result)
    return result, files


def export_reader(index, output_dir):
    index = Path(index).resolve(strict=True)
    if not index.is_file():
        raise ValueError("Input must be an existing legacy index.html")
    root = index.parent
    output = Path(output_dir).resolve()
    if "task-output" not in output.parts or output.name == "task-output":
        raise ValueError("Output must be a new directory below task-output/")
    if output.exists():
        raise ValueError("Output already exists; choose a new directory")
    if inside(output, root) or inside(root, output):
        raise ValueError("Output must be separate from the source directory")
    data, assets = collect_assets(insert_blank_dates(read_manifest(index)), root)
    if not (RUNTIME / "index.html").is_file():
        raise ValueError("Bundled runtime missing; rebuild source first")
    if (RUNTIME / "data").exists():
        raise ValueError("Runtime must not contain fixture data")
    output.parent.mkdir(parents=True, exist_ok=True)
    # Stage only after every input reference has passed validation.
    with tempfile.TemporaryDirectory(prefix=".reader-export-", dir=output.parent) as temp:
        stage = Path(temp) / "reader"
        shutil.copytree(RUNTIME, stage)
        for relative, source in assets.items():
            destination = stage / "data" / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, destination)
        (stage / "data").mkdir(exist_ok=True)
        (stage / "data/manifest.json").write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        # Reserve the final directory exclusively; never merge with an existing export.
        output.mkdir(exist_ok=False)
        try:
            for item in stage.iterdir():
                shutil.move(str(item), output / item.name)
        except Exception:
            shutil.rmtree(output)
            raise
    return {
        "output": str(output),
        "entries": len(data["entries"]),
        "blankDays": sum(1 for entry in data["entries"] if entry.get("isBlank")),
        "assets": len(assets),
    }


def update_reader(index, output_dir, diary_date):
    """Merge one date and new cast/media into an existing reader, never its shell.

    Existing book, cast, relationships and other real entries are authoritative.
    Content-addressed new media cannot overwrite a cover/shared older-day image.
    No runtime copy, frontend build or export directory is involved.
    """
    if date.fromisoformat(diary_date).isoformat() != diary_date:
        raise ValueError('Update date must be YYYY-MM-DD')
    output = Path(output_dir).resolve(strict=True)
    manifest = output / 'data/manifest.json'
    if not (output / 'index.html').is_file() or not manifest.is_file():
        raise ValueError('Date update requires an existing reader with data/manifest.json')
    data_root = manifest.parent.resolve()
    if not inside(data_root, output) or manifest.is_symlink():
        raise ValueError('Reader data must stay inside the existing reader')
    existing = json.loads(manifest.read_text(encoding='utf-8'))
    source_index = Path(index).resolve(strict=True)
    incoming = read_manifest(source_index)
    if existing.get('schemaVersion') != 1 or existing.get('book', {}).get('id') != incoming['book']['id']:
        raise ValueError('Date update must keep the existing book.id')
    for key in ('entries', 'characters', 'relationships', 'periods'):
        if not isinstance(existing.get(key), list):
            raise ValueError('Existing reader requires list: ' + key)
    entries = existing['entries']
    if len({entry['date'] for entry in entries}) != len(entries):
        raise ValueError('Existing reader contains duplicate dates')
    matches = [e for e in incoming['entries'] if e['date'] == diary_date]
    if len(matches) != 1 or matches[0].get('isBlank'):
        raise ValueError('Source must contain one nonblank entry for the requested date')
    entry = copy.deepcopy(matches[0])
    old_entry = next((e for e in entries if e['date'] == diary_date), None)
    if old_entry:
        entry['id'] = old_entry['id']
    if any(e['id'] == entry['id'] and e['date'] != diary_date for e in entries):
        raise ValueError('Updated entry id collides with another date')

    result = copy.deepcopy(existing)
    known_ids = {c['id'] for c in result['characters']}
    new_chars = [copy.deepcopy(c) for c in incoming['characters']
                 if c['id'] in entry['characterIds'] and c['id'] not in known_ids]
    all_ids = known_ids | {c['id'] for c in new_chars}
    if set(entry['characterIds']) - all_ids:
        raise ValueError('Requested date contains an unresolved character')
    period = next(p for p in incoming['periods'] if p['id'] == entry['periodId'])
    new_periods = [] if any(p['id'] == period['id'] for p in result['periods']) else [copy.deepcopy(period)]
    patch = {'entries': [entry], 'characters': new_chars, 'periods': new_periods}
    files = {}

    def media(value):
        if isinstance(value, dict):
            for key, item in value.items():
                if key.endswith('Src') and item:
                    source, _ = local_asset(source_index.parent, item)
                    sha = hashlib.sha256(source.read_bytes()).hexdigest()
                    relative = f'updates/{diary_date}/{sha}{source.suffix.lower()}'
                    target = data_root / relative
                    if not inside(target.resolve(), data_root):
                        raise ValueError('Updated media escapes reader data')
                    if target.exists() and target.read_bytes() != source.read_bytes():
                        raise ValueError('Content-addressed update media has changed')
                    files[relative] = source
                    value[key] = quote(relative, safe='/')
                else:
                    media(item)
        elif isinstance(value, list):
            for item in value:
                media(item)

    media(patch)
    result['characters'].extend(new_chars)
    result['periods'].extend(new_periods)
    for current in result['periods']:
        if current['id'] == entry['periodId']:
            # Extend only this entry's period range; preserve its title/cover.
            for key, choose in (('startDate', min), ('endDate', max)):
                if key in current:
                    current[key] = choose(current[key], diary_date)
    new_ids = {c['id'] for c in new_chars}
    for relation in incoming['relationships']:
        if (relation.get('source') in all_ids and relation.get('target') in all_ids
                and {relation['source'], relation['target']} & new_ids
                and relation not in result['relationships']):
            result['relationships'].append(copy.deepcopy(relation))
    result['entries'] = [e for e in result['entries'] if e['date'] != diary_date and not e.get('isBlank')] + [entry]
    result = insert_blank_dates(result)
    # Validate everything before touching output; activate by atomic manifest swap.
    with tempfile.TemporaryDirectory(prefix='.diary-data-update-', dir=output) as temp:
        staged = Path(temp)
        for relative, source in files.items():
            if not (data_root / relative).exists():
                target = staged / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(source, target)
        staged_manifest = staged / 'manifest.json'
        staged_manifest.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        for relative in files:
            src = staged / relative
            if src.exists():
                target = data_root / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                src.replace(target)
        staged_manifest.replace(manifest)
    return {'output': str(output), 'date': diary_date, 'entries': len(result['entries']),
            'assets': len(files), 'dataOnly': True}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("index_html", type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument('--update-date', help='Update only this date/new cast in an existing reader; keep its original shell, cover and flip runtime')
    args = parser.parse_args()
    try:
        report = (update_reader(args.index_html, args.output_dir, args.update_date) if args.update_date
                  else export_reader(args.index_html, args.output_dir))
    except (ValueError, OSError) as exc:
        parser.exit(2, f"Reader export failed: {exc}\n")
    print(json.dumps(report, ensure_ascii=False))
    print("Serve with: python3 -m http.server 8000 --directory " + repr(report["output"]))


if __name__ == "__main__":
    main()
