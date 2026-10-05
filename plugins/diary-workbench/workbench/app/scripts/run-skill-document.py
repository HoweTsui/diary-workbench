"""Run the canonical document builder with local HEIC decoding enabled."""
import io
import runpy
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, UnidentifiedImageError

try:
    import pillow_heif
    pillow_heif.register_heif_opener()
except ImportError:
    pass

original_open = Image.open


def open_image(fp, *args, **kwargs):
    try:
        return original_open(fp, *args, **kwargs)
    except UnidentifiedImageError:
        if sys.platform != 'darwin' or not isinstance(fp, (str, Path)) or Path(fp).suffix.lower() not in {'.heic', '.heif'}:
            raise
        # Decode a temporary full-resolution PNG. The original bytes remain intact.
        with tempfile.TemporaryDirectory(prefix='diary-document-heic-') as folder:
            output = Path(folder) / 'decoded.png'
            subprocess.run(['/usr/bin/sips', '-s', 'format', 'png', str(fp), '--out', str(output)], check=True, capture_output=True, timeout=45)
            return original_open(io.BytesIO(output.read_bytes()))


if __name__ == '__main__':
    Image.open = open_image
    script = Path(sys.argv[1]).resolve()
    sys.argv = [str(script), *sys.argv[2:]]
    sys.path.insert(0, str(script.parent))
    runpy.run_path(str(script), run_name='__main__')
