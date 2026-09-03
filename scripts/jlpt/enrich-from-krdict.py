#!/usr/bin/env python3
"""Build authoritative Korean gloss overrides for selected JLPT words.

Input 1: data/jlpt/production/candidates/n1-source-3000.json
Input 2: an unpacked spellcheck-ko/korean-dict-nikl/krdict directory
Output : data/jlpt/production/candidates/krdict-n1-matches.json

The Korean Learners' Dictionary is distributed by the National Institute of Korean
Language under CC BY-SA 2.0 KR. Its Japanese translation fields let us reverse-map
Japanese headwords to concise Korean dictionary headwords/definitions without using
proprietary dictionary dumps or treating generic machine translation as authority.

The official downloadable XML has changed structure over time and some archived
exports contain isolated malformed tokens. The parser is intentionally
feature-driven and recovery-enabled: it understands both simple trans_* element
names and LMF-style <feat att="..." val="..."> nodes, skips only malformed XML
fragments reported by libxml2, and preserves high-confidence exact surface/reading
matches.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

from lxml import etree as ET


def norm(value: object) -> str:
    return unicodedata.normalize("NFKC", str(value or "")).strip()


def local(tag: str) -> str:
    if not isinstance(tag, str):
        return ""
    return tag.rsplit("}", 1)[-1].lower()


def direct_features(node: ET.Element) -> dict[str, list[str]]:
    values: dict[str, list[str]] = defaultdict(list)
    for child in list(node):
        if local(child.tag) != "feat":
            continue
        att = norm(child.attrib.get("att") or child.attrib.get("name")).lower()
        val = norm(child.attrib.get("val") or child.attrib.get("value") or child.text)
        if att and val:
            values[att].append(val)
    return values


def text_by_name(node: ET.Element, names: set[str]) -> list[str]:
    found: list[str] = []
    for child in node.iter():
        if local(child.tag) in names:
            value = norm(child.text)
            if value:
                found.append(value)
    return found


def all_feature_values(node: ET.Element) -> dict[str, list[str]]:
    values: dict[str, list[str]] = defaultdict(list)
    for child in node.iter():
        if local(child.tag) != "feat":
            continue
        att = norm(child.attrib.get("att") or child.attrib.get("name")).lower()
        val = norm(child.attrib.get("val") or child.attrib.get("value") or child.text)
        if att and val:
            values[att].append(val)
    return values


def first(values: dict[str, list[str]], *keys: str) -> str:
    for key in keys:
        for value in values.get(key.lower(), []):
            if norm(value):
                return norm(value)
    return ""


def korean_headword(entry: ET.Element) -> str:
    simple = text_by_name(entry, {"word", "lemma", "headword"})
    for value in simple:
        if re.search(r"[가-힣]", value):
            return value

    for node in entry.iter():
        if local(node.tag) == "lemma":
            features = all_feature_values(node)
            value = first(features, "writtenform", "lemma", "word", "lexicalunit")
            if re.search(r"[가-힣]", value):
                return value

    features = all_feature_values(entry)
    for key in ("writtenform", "lexicalunit", "lemma", "word"):
        for value in features.get(key, []):
            if re.search(r"[가-힣]", value):
                return norm(value)
    return ""


def korean_definition(sense: ET.Element) -> str:
    simple = text_by_name(sense, {"definition"})
    for value in simple:
        if re.search(r"[가-힣]", value):
            return value
    features = all_feature_values(sense)
    for key in ("definition", "definitiontext", "definition_text"):
        for value in features.get(key, []):
            if re.search(r"[가-힣]", value):
                return norm(value)
    return ""


def is_japanese_language(value: str) -> bool:
    v = norm(value).lower()
    return v in {"일본어", "日本語", "japanese", "ja", "jpn"} or "일본" in v


def translation_nodes(sense: ET.Element):
    for node in sense.iter():
        lname = local(node.tag)
        if lname in {"translation", "equivalent", "equivalentform", "senseexample"}:
            yield node


def extract_japanese_translations(sense: ET.Element) -> list[tuple[str, str]]:
    results: list[tuple[str, str]] = []
    seen: set[tuple[str, str]] = set()

    for node in translation_nodes(sense):
        langs = text_by_name(node, {"trans_lang", "language", "lang"})
        features = all_feature_values(node)
        langs.extend(sum((features.get(k, []) for k in ("language", "lang", "languageidentifier", "language_identifier")), []))
        if langs and not any(is_japanese_language(x) for x in langs):
            continue
        words = text_by_name(node, {"trans_word", "translation", "equivalent", "lemma", "writtenform"})
        defs = text_by_name(node, {"trans_dfn", "translateddefinition", "definition"})
        for key in ("writtenform", "lemma", "translation", "equivalent", "trans_word"):
            words.extend(features.get(key, []))
        for key in ("definition", "translateddefinition", "trans_dfn"):
            defs.extend(features.get(key, []))
        if langs or words:
            for word in words:
                if re.search(r"[ぁ-んァ-ヶ一-龯々〆ヶ]", word):
                    pair = (norm(word), norm(defs[0] if defs else ""))
                    if pair not in seen:
                        seen.add(pair)
                        results.append(pair)

    for node in sense.iter():
        features = direct_features(node)
        lang_values = []
        for key in ("language", "lang", "languageidentifier", "language_identifier"):
            lang_values.extend(features.get(key, []))
        if not lang_values or not any(is_japanese_language(x) for x in lang_values):
            continue
        words: list[str] = []
        defs: list[str] = []
        for key in ("writtenform", "lemma", "translation", "equivalent", "trans_word"):
            words.extend(features.get(key, []))
        for key in ("definition", "translateddefinition", "trans_dfn"):
            defs.extend(features.get(key, []))
        for word in words:
            if re.search(r"[ぁ-んァ-ヶ一-龯々〆ヶ]", word):
                pair = (norm(word), norm(defs[0] if defs else ""))
                if pair not in seen:
                    seen.add(pair)
                    results.append(pair)
    return results


BRACKET_CONTENT = re.compile(r"[〖【\[（(]([^〖〗【】\[\]（）()]+)[〗】\]）)]")
JP_TOKEN = re.compile(r"[一-龯々〆ヶぁ-んァ-ヶー]+")


def japanese_tokens(text: str) -> set[str]:
    value = norm(text)
    tokens = {norm(x) for x in JP_TOKEN.findall(value) if norm(x)}
    for inner in BRACKET_CONTENT.findall(value):
        tokens.update(norm(x) for x in re.split(r"[・･,，/／;；\s]+", inner) if norm(x))
    return tokens


def candidate_match(candidate: dict, translated_word: str) -> tuple[bool, int, list[str]]:
    surface = norm(candidate.get("word"))
    reading = norm(candidate.get("reading"))
    tokens = japanese_tokens(translated_word)
    reasons: list[str] = []
    score = 0
    if surface and surface in tokens:
        score += 3
        reasons.append("surface_exact")
    if reading and reading in tokens:
        score += 2
        reasons.append("reading_exact")
    if surface == reading and surface in tokens:
        score += 1
        reasons.append("kana_identity")
    return score >= 3, score, reasons


def stable_unique(values: list[str]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for value in values:
        value = norm(value)
        if value and value not in seen:
            seen.add(value)
            result.append(value)
    return result


def merge_exact_lexeme_senses(values: list[dict]) -> dict:
    """Merge KRDICT senses only when surface *and* reading evidence are exact.

    Multiple Korean headwords for one exact Japanese surface/reading pair are
    typically legitimate polysemy. Keeping those senses is safer than guessing one
    translation. Surface-only homographs remain ambiguous and are never merged.
    """
    meanings = stable_unique([v.get("meaning_ko", "") for v in values])
    definitions_ko = stable_unique([v.get("definition_ko", "") for v in values])
    definitions_ja = stable_unique([v.get("definition_ja", "") for v in values])
    source_files = stable_unique([v.get("source_file", "") for v in values])
    ja_sources = stable_unique([v.get("meaning_ja_source", "") for v in values])
    first_value = values[0]
    return {
        "score": first_value["score"],
        "reasons": first_value["reasons"],
        "meaning_ko": " | ".join(meanings),
        "definition_ko": " | ".join(definitions_ko),
        "meaning_ja_source": " | ".join(ja_sources),
        "definition_ja": " | ".join(definitions_ja),
        "source_file": source_files[0] if source_files else "",
        "source_files": source_files,
        "merged_sense_count": len(values),
        "match_resolution": "exact_surface_reading_multi_sense",
    }


def iter_lexical_entries(xml_file: Path):
    context = ET.iterparse(str(xml_file), events=("end",), recover=True, huge_tree=True)
    for _, elem in context:
        if local(elem.tag) in {"lexicalentry", "item", "entry"}:
            yield elem
            elem.clear()
    errors = list(context.error_log)
    if errors:
        print(
            f"KRDICT recovery: {xml_file.name}: {len(errors)} malformed XML fragment(s) recovered; "
            f"first={errors[0]}",
            file=sys.stderr,
            flush=True,
        )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--krdict-dir", required=True, type=Path)
    parser.add_argument("--candidates", default="data/jlpt/production/candidates/n1-source-3000.json", type=Path)
    parser.add_argument("--output", default="data/jlpt/production/candidates/krdict-n1-matches.json", type=Path)
    args = parser.parse_args()

    document = json.loads(args.candidates.read_text(encoding="utf-8"))
    candidates = document.get("candidates", [])
    by_surface: dict[str, list[dict]] = defaultdict(list)
    for candidate in candidates:
        by_surface[norm(candidate.get("word"))].append(candidate)

    matches: dict[str, list[dict]] = defaultdict(list)
    files = sorted(args.krdict_dir.glob("*.xml"))
    if not files:
        raise SystemExit(f"No KRDICT XML files found under {args.krdict_dir}")

    entry_count = 0
    jp_translation_count = 0
    for xml_file in files:
        print(f"KRDICT: {xml_file.name}", flush=True)
        for entry in iter_lexical_entries(xml_file):
            entry_count += 1
            ko_word = korean_headword(entry)
            if not ko_word:
                continue
            senses = [node for node in entry.iter() if local(node.tag) == "sense"]
            if not senses:
                senses = [entry]
            for sense in senses:
                ko_definition = korean_definition(sense)
                for ja_word, ja_definition in extract_japanese_translations(sense):
                    jp_translation_count += 1
                    tokens = japanese_tokens(ja_word)
                    candidate_pool: list[dict] = []
                    for token in tokens:
                        candidate_pool.extend(by_surface.get(token, []))
                    if not candidate_pool:
                        continue
                    seen_keys: set[str] = set()
                    for candidate in candidate_pool:
                        key = candidate["key"]
                        if key in seen_keys:
                            continue
                        seen_keys.add(key)
                        ok, score, reasons = candidate_match(candidate, ja_word)
                        if not ok:
                            continue
                        matches[key].append({
                            "score": score,
                            "reasons": reasons,
                            "meaning_ko": ko_word,
                            "definition_ko": ko_definition,
                            "meaning_ja_source": ja_word,
                            "definition_ja": ja_definition,
                            "source_file": xml_file.name,
                        })

    best: dict[str, dict] = {}
    ambiguous: dict[str, list[dict]] = {}
    merged_exact_senses = 0
    for key, values in matches.items():
        values.sort(key=lambda x: (-x["score"], len(x["meaning_ko"]), 0 if x["definition_ja"] else 1, x["meaning_ko"], x["source_file"]))
        top_score = values[0]["score"]
        top = [v for v in values if v["score"] == top_score]
        top_meanings = sorted({v["meaning_ko"] for v in top})
        if len(top_meanings) == 1:
            best[key] = top[0]
        elif top_score >= 5 and all("surface_exact" in v["reasons"] and "reading_exact" in v["reasons"] for v in top):
            best[key] = merge_exact_lexeme_senses(top)
            merged_exact_senses += 1
        else:
            ambiguous[key] = top[:20]

    payload = {
        "schemaVersion": 1,
        "source": "National Institute of Korean Language Korean Learners' Dictionary (CC BY-SA 2.0 KR)",
        "candidateCount": len(candidates),
        "xmlFiles": len(files),
        "lexicalEntriesScanned": entry_count,
        "japaneseTranslationsScanned": jp_translation_count,
        "matchedUnique": len(best),
        "mergedExactSenseEntries": merged_exact_senses,
        "ambiguous": len(ambiguous),
        "unmatched": len(candidates) - len(best),
        "matches": best,
        "ambiguousMatches": ambiguous,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: payload[k] for k in ("candidateCount", "matchedUnique", "mergedExactSenseEntries", "ambiguous", "unmatched")}, ensure_ascii=False))


if __name__ == "__main__":
    main()
