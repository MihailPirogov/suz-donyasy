#!/bin/bash
# Download the open sources into src/ (licences: SOURCES.md)
set -e
cd "$(dirname "$0")/../src"
B="https://kaikki.org/ruwiktionary/%D0%A2%D0%B0%D1%82%D0%B0%D1%80%D1%81%D0%BA%D0%B8%D0%B9"
curl -fsS -o ru_tt.jsonl "$B/kaikki.org-dictionary-%D0%A2%D0%B0%D1%82%D0%B0%D1%80%D1%81%D0%BA%D0%B8%D0%B9.jsonl"
curl -fsS -o en_tt.jsonl "https://kaikki.org/dictionary/Tatar/kaikki.org-dictionary-Tatar.jsonl"
curl -fsS -o ttwiki.xml.bz2 "https://dumps.wikimedia.org/ttwiki/latest/ttwiki-latest-pages-articles.xml.bz2"
python3 ../tools/ttwiki_freq.py
