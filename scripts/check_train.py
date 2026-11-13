#!/usr/bin/env python3
"""Diagnostic: check a particular train number in imported CP GTFS days."""
import argparse, json
from pathlib import Path

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--number", default="26450")
    p.add_argument("--dir", default="public/data/cp")
    args = p.parse_args()
    root = Path(args.dir)
    manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    hits = 0
    for day in manifest["days"]:
        doc = json.loads((root / day["file"]).read_text(encoding="utf-8"))
        trains = [t for t in doc["trains"] if str(t.get("number","")).strip() == args.number]
        for t in trains:
            print(f"{day['date']}: {t['type']} {t['number']} | {t['origin']} -> {t['destination']} | {t['departure']} -> {t['arrival']} | trip_id={t['id']}")
        if not trains:
            print(f"{day['date']}: {args.number} AUSENTE do GTFS importado (não prova supressão nem ausência de circulação)")
        hits += len(trains)
    print(f"Resultado: {hits} ocorrências de {args.number} em {len(manifest['days'])} dias")

if __name__=="__main__":
    main()
