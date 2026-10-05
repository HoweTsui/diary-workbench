"""Validate authored photo coverage and poster rows; never select or interpret photos."""
from __future__ import annotations


def event_indices(value, count, label):
    if (not isinstance(value, list) or not value or
            any(isinstance(i, bool) or not isinstance(i, int) or not 1 <= i <= count for i in value) or
            len(set(value)) != len(value)):
        raise ValueError(label + ' must contain unique 1-based event indices')
    return value.copy()


def poster_rows(data, count):
    """Old 1-5 event inputs retain one row each; larger inputs require authored groups."""
    rows = data.get('posterRows')
    if rows is None:
        if not 1 <= count <= 5:
            raise ValueError('without posterRows, events must contain 1-5 scenes; group all events into at most 5 rows')
        captions = data.get('captions')
        if captions is None:
            captions = [e.get('caption') for e in data.get('events', [])]
        if not isinstance(captions, list) or len(captions) != count:
            raise ValueError('provide one caption per event or authored posterRows')
        rows = [{'eventIndices': [i + 1], 'caption': c} for i, c in enumerate(captions)]
    if not isinstance(rows, list) or not 1 <= len(rows) <= 5:
        raise ValueError('posterRows must contain 1-5 rows')
    normalized, all_indices = [], []
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError('posterRows entries must be objects')
        indices = event_indices(row.get('eventIndices'), count, 'posterRows.eventIndices')
        caption = row.get('caption')
        if not isinstance(caption, str) or not 4 <= len(caption.strip()) <= 10:
            raise ValueError('row captions require 4-10 characters, never truncate')
        normalized.append({'eventIndices': indices, 'caption': caption.strip()})
        all_indices.extend(indices)
    if all_indices != list(range(1, count + 1)):
        raise ValueError('posterRows must cover every event exactly once, in authored reading order')
    return normalized


def photo_coverage(data, references, events):
    scene_ids = {r['id'] for r in references if r['role'] == 'scene'}
    coverage = data.get('photoCoverage')
    if coverage is None:
        if len(scene_ids) > 5:
            raise ValueError('more than 5 scene photos require photoCoverage for ALL photos, not a selection')
        return []  # Legacy briefs retain explicit referenceIds mapping.
    if not isinstance(coverage, list):
        raise ValueError('photoCoverage must be a list')
    normalized, covered = [], set()
    for item in coverage:
        if not isinstance(item, dict):
            raise ValueError('photoCoverage entries must be objects')
        rid = item.get('referenceId')
        if not isinstance(rid, str) or rid not in scene_ids or rid in covered:
            raise ValueError('photoCoverage.referenceId must uniquely name a declared scene photo')
        facts = item.get('keyContent')
        if (not isinstance(facts, list) or not facts or
                any(not isinstance(f, str) or not f.strip() or len(f) > 160 for f in facts)):
            raise ValueError('photoCoverage.keyContent requires authored main content, not only an ID')
        indices = event_indices(item.get('eventIndices'), len(events), 'photoCoverage.eventIndices')
        actual = [i for i, event in enumerate(events, 1) if rid in event.get('referenceIds', [])]
        if indices != actual:
            raise ValueError('photoCoverage event mapping differs from referenceIds: ' + rid)
        covered.add(rid)
        normalized.append({'referenceId': rid, 'keyContent': facts.copy(), 'eventIndices': indices})
    if covered != scene_ids:
        raise ValueError('photoCoverage must cover ALL scene photos; missing: ' + ', '.join(sorted(scene_ids - covered)))
    return normalized
