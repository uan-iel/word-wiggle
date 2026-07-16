import json
import re
import sys
from pathlib import Path

import pdfplumber

PDF_PATH = Path(sys.argv[1])
OUTPUT_PATH = Path(sys.argv[2])

THEME_RE = re.compile(r"^([一二三四五六七八九十百]+)、([^（(]+)[（(](\d+)")
IPA_CANDIDATE_RE = re.compile(r"(?=(/([^/\n]+?)/))")
IPA_SYMBOL_RE = re.compile(r"[ˈˌːəɪʊɛɒɑɔθðʃʒŋɜæʌɡɚɝ]")
CHINESE_RE = re.compile(r"[\u3400-\u9fff]")
HEADER_RE = re.compile(r"KET备考必备1500词")


def clean(text):
    return re.sub(r"\s+", " ", text).strip()


def infer_pos(word, zh, theme):
    lower = word.lower()
    markers = [
        (r"\(n\s*&\s*v\)|\(n\s*&\s*adj\)", "n./v."),
        (r"\(v\s*&\s*adj\)", "v./adj."),
        (r"\(adj\)", "adj."),
        (r"\(adv\)", "adv."),
        (r"\(prep\)", "prep."),
        (r"\(pron\)", "pron."),
        (r"\(n\)", "n."),
        (r"\(v\)", "v."),
    ]
    for pattern, pos in markers:
        if re.search(pattern, lower):
            return pos
    if "动词" in zh or lower.startswith(("be ", "get ", "go ", "look ", "listen ", "try ")):
        return "v."
    if theme == "颜色":
        return "adj."
    return "KET词汇"


themes = []
current = None
last_entry = None

with pdfplumber.open(PDF_PATH) as pdf:
    for page in pdf.pages:
        bottom = min(830, page.height - 1)
        for box in ((0, 0, 298, bottom), (298, 0, page.width, bottom)):
            text = page.crop(box).extract_text(x_tolerance=2, y_tolerance=2) or ""
            for raw in text.splitlines():
                line = clean(raw)
                if not line or HEADER_RE.search(line):
                    continue
                heading = THEME_RE.match(line)
                if heading:
                    current = {
                        "name": clean(heading.group(2)),
                        "declaredCount": int(heading.group(3)),
                        "words": [],
                    }
                    themes.append(current)
                    last_entry = None
                    continue
                if current is None:
                    continue
                candidates = list(IPA_CANDIDATE_RE.finditer(line))
                ipa_match = None
                for candidate in candidates:
                    content = candidate.group(2).strip()
                    after = line[candidate.start(1) + len(candidate.group(1)) :]
                    if IPA_SYMBOL_RE.search(content) or (CHINESE_RE.search(after) and re.fullmatch(r"[A-Za-z.()' -]+", content)):
                        ipa_match = candidate
                        break
                if ipa_match:
                    full_match = ipa_match.group(1)
                    word = clean(line[: ipa_match.start(1)].strip(" /"))
                    ipa = "/" + clean(ipa_match.group(2)) + "/"
                    zh_start = ipa_match.start(1) + len(full_match)
                    zh = clean(line[zh_start:].strip(" /"))
                    # Some entries put an English alternative before the IPA.
                    word = re.sub(r"\s*/\s*", " / ", word)
                    if not word or not re.search(r"[A-Za-z]", word):
                        continue
                    entry = {
                        "word": word,
                        "zh": zh,
                        "pos": infer_pos(word, zh, current["name"]),
                        "ipa": ipa,
                    }
                    current["words"].append(entry)
                    last_entry = entry
                elif last_entry and not re.match(r"^[A-Za-z].{0,24}$", line):
                    last_entry["zh"] = clean(last_entry["zh"] + line)

for theme in themes:
    for entry in theme["words"]:
        entry["word"] = re.sub(r"\s+\([^)]*(?:n|v|adj|adv|prep|pron)[^)]*\)\s*", " ", entry["word"], flags=re.I).strip()
        entry["letters"] = re.sub(r"[^a-z]", "", entry["word"].lower())
    theme["words"] = [entry for entry in theme["words"] if entry["letters"]]

payload = {
    "sourceTitle": "KET备考必备1500词（带音标版）",
    "declaredTotal": sum(t["declaredCount"] for t in themes),
    "extractedTotal": sum(len(t["words"]) for t in themes),
    "themes": themes,
}

OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
OUTPUT_PATH.write_text(
    "// Generated from the user-provided PDF. Do not edit by hand.\n"
    + "export const VOCABULARY = "
    + json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    + ";\n",
    encoding="utf-8",
)

print(json.dumps({
    "declaredTotal": payload["declaredTotal"],
    "extractedTotal": payload["extractedTotal"],
    "themes": [
        {"name": t["name"], "declared": t["declaredCount"], "extracted": len(t["words"])}
        for t in themes
    ],
}, ensure_ascii=False, indent=2))
