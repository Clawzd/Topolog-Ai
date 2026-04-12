from pathlib import Path

here = Path(__file__).resolve().parent
out = (here / "TopologyCanvas.jsx").resolve()
parts = []
for path in sorted(here.glob("_tc_slice*.txt")):
    parts.append(path.read_text(encoding="utf-8"))
out.write_text("".join(parts), encoding="utf-8", newline="\n")
