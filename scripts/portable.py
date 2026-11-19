"""Bundle the existing root-path production build into the downloadable edition."""
from base64 import b64encode
from hashlib import sha256
from pathlib import Path
import re
from zipfile import ZIP_DEFLATED, ZipFile


def data64(data):
    return b64encode(data).decode("ascii")


def package(dist, output):
    html = (dist / "index.html").read_text(encoding="utf-8")
    script = re.search(r'<script [^>]*src="(/assets/[^"]+)"[^>]*></script>', html)
    style = re.search(r'<link rel="stylesheet"[^>]*href="(/assets/[^"]+)"[^>]*>', html)
    if not script or not style:
        raise ValueError("Run npm run build with the default root base path first")
    js = (dist / script[1][1:]).read_text(encoding="utf-8")
    js = re.sub(r"</script", lambda _: r"<\/script", js, flags=re.I)
    digest = data64(sha256(js.encode("utf-8")).digest())
    css = (dist / style[1][1:]).read_text(encoding="utf-8")
    icon = data64((dist / "atelier.svg").read_bytes())
    html = html.replace("script-src &#39;self&#39;", f"script-src &#39;sha256-{digest}&#39;")
    html = html.replace('href="/atelier.svg"', f'href="data:image/svg+xml;base64,{icon}"')
    html = html.replace(style[0], f"<style>{css}</style>")
    html = html.replace(script[0], f'<meta name="atelier-portable"><script type="module">{js}</script>')
    output.mkdir(exist_ok=True)
    portable = output / "Atelier.html"
    # Keep LF line endings so the CSP hash matches on every platform.
    portable.write_bytes(html.encode("utf-8"))
    with ZipFile(output / "Atelier.zip", "w", ZIP_DEFLATED, compresslevel=9) as archive:
        archive.write(portable, portable.name)
        for asset in sorted(dist.rglob("*")):
            if asset.is_file():
                archive.write(asset, Path("dist") / asset.relative_to(dist))


if __name__ == "__main__":
    package(Path("dist"), Path("导出"))
