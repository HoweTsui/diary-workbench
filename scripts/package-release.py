"""Package tracked default files only; never include dependencies or local data."""
import hashlib
import json
import subprocess
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
subprocess.run(["node", "scripts/verify-default.mjs"], cwd=root, check=True)
version = json.loads((root / "plugins/diary-workbench/plugin.json").read_text())["version"]
files = subprocess.check_output(["git", "ls-files", "-z"], cwd=root).decode().split("\0")
files = [name for name in files if name]
assert files and "README.md" in files
output = root / "artifacts"
output.mkdir(exist_ok=True)
archives = []
for kind in ("marketplace", "plugin"):
    target = output / f"diary-workbench-{version}-{kind}.zip"
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
        for name in files:
            if kind == "plugin":
                prefix = "plugins/diary-workbench/"
                if not name.startswith(prefix):
                    continue
                entry = name[len(prefix):]
            else:
                entry = "marketplace/" + name
            archive.write(root / name, entry)
    archives.append(target)
(output / "SHA256SUMS.txt").write_text("".join(f"{hashlib.sha256(file.read_bytes()).hexdigest()}  {file.name}\n" for file in archives))
print(json.dumps({"archives": [file.name for file in archives]}))
