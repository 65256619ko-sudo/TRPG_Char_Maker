#!/usr/bin/env python3
"""src/ を1枚の index.html にまとめる。
  python3 build.py          … index.html を作り直す
  python3 build.py --check  … index.html が src/ と一致しているか確かめる（違えば終了コード1）
  python3 build.py --index  … src/INDEX.md（各ファイルの目次）を作り直す
src/index.html の <!--@css--> と <!--@js--> の間にある link / script を、
<style> と <script> に展開するだけ。ファイルを足したら、その行を src/index.html に追加する。"""
import os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "src")


def read(p):
    with open(p, encoding="utf-8", newline="") as f:
        return f.read()


def block(tpl, kind):
    m = re.search(r"<!--@%s-->\n(.*?)<!--@/%s-->" % (kind, kind), tpl, re.S)
    if not m:
        sys.exit("src/index.html に <!--@%s--> がありません" % kind)
    return m


def files(m, attr):
    return re.findall(r'%s="([^"]+)"' % attr, m.group(1))


def build():
    tpl = read(os.path.join(SRC, "index.html"))
    mc, mj = block(tpl, "css"), block(tpl, "js")
    css = "".join(read(os.path.join(SRC, p)) for p in files(mc, "href"))
    js = "".join(read(os.path.join(SRC, p)) for p in files(mj, "src"))
    # 後ろの塊から先に置き換える（位置がずれないように）
    out = tpl[: mj.start()] + "<script>" + js + "</script>" + tpl[mj.end():]
    out = out[: mc.start()] + "<style>" + css + "</style>" + out[mc.end():]
    return out


def index():
    tpl = read(os.path.join(SRC, "index.html"))
    rows = ["# src の目次（python3 build.py --index で作り直し）", ""]
    for kind, attr, folder in (("css", "href", "CSS"), ("js", "src", "JS")):
        rows += ["## " + folder, ""]
        for p in files(block(tpl, kind), attr):
            t = read(os.path.join(SRC, p))
            names = []
            for l in t.split("\n"):
                m = re.match(r"^(?:async )?function (\w+)", l)
                if m:
                    names.append(m.group(1))
                elif l.startswith("// =====") or (kind == "css" and l.startswith("/* =====")):
                    names.append("【" + re.sub(r"[=\s/*]+", " ", l).strip()[:24] + "】")
            rows.append("- `%s`（%d行）: %s" % (p, t.count("\n"), " ".join(names[:8])))
        rows.append("")
    with open(os.path.join(SRC, "INDEX.md"), "w", encoding="utf-8", newline="") as f:
        f.write("\n".join(rows))


if __name__ == "__main__":
    if "--index" in sys.argv:
        index()
        print("src/INDEX.md を更新しました")
    elif "--check" in sys.argv:
        ok = read(os.path.join(ROOT, "index.html")) == build()
        print("一致" if ok else "index.html が src/ とずれています（python3 build.py を実行）")
        sys.exit(0 if ok else 1)
    else:
        with open(os.path.join(ROOT, "index.html"), "w", encoding="utf-8", newline="") as f:
            f.write(build())
        print("index.html を作りました")
