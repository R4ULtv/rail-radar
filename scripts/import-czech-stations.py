#!/usr/bin/env python3
"""Import GRAPP passenger stations using official CIS/SR70 identities (Python 3 stdlib)."""

import argparse
import csv
import http.cookiejar
import io
import json
import math
from pathlib import Path
import re
import unicodedata
import urllib.request
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://grapp.spravazeleznic.cz"
# Effective 15 October–12 December 2026. Select the applicable workbook from:
# https://provoz.spravazeleznic.cz/portal/ViewArticle.aspx?oid=34462
SR70_URL = "https://provoz.spravazeleznic.cz/portal/Show.aspx?oid=2348005"
CIS_URL = "https://portal.cisjr.cz/pub/seznamy/stanice.csv"
NS = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
# Passenger-capable stations/stops; excludes freight groups, junctions and boundaries.
PASSENGER_QUALIFIERS = {"1", "3", "4", "9", "23", "24", "37", "38", "43", "52", "61", "62"}


def normalize(value):
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode().lower()
    for full, short in [("hlavni nadrazi", "hl n"), ("zastavka", "z"),
                        ("mesto", "m"), ("nadrazi", "n"), ("nad ", "n "), ("pod ", "p ")]:
        value = value.replace(full, short)
    return re.sub(r"[^a-z0-9]", "", value)


def coordinate(value):
    return float(re.sub(r"[^0-9,.+-]", "", value).replace(",", "."))


def workbook_rows(data):
    with zipfile.ZipFile(io.BytesIO(data)) as workbook:
        strings = ["".join(node.itertext()) for node in
                   ET.fromstring(workbook.read("xl/sharedStrings.xml")).findall("x:si", NS)]
        sheet = ET.fromstring(workbook.read("xl/worksheets/sheet1.xml"))
        for row in sheet.findall("x:sheetData/x:row", NS)[1:]:
            yield {re.sub(r"\d", "", cell.attrib["r"]):
                   strings[int(cell.findtext("x:v", "0", NS))] if cell.attrib.get("t") == "s"
                   else cell.findtext("x:v", "", NS) for cell in row}


def validate(features, codes):
    ids = [feature["properties"]["id"] for feature in features]
    assert len(ids) == len(set(ids)), "Duplicate station IDs"
    czech = [feature for feature in features if feature["properties"]["id"].startswith("CZ")]
    assert 2400 <= len(czech) <= 2900, f"Unexpected Czech station count: {len(czech)}"
    assert set(codes) == {feature["properties"]["id"][2:] for feature in czech}, "Code map mismatch"
    assert len(set(codes.values())) == len(codes), "Duplicate GRAPP internal IDs"
    for feature in czech:
        assert re.fullmatch(r"CZ54\d{5}", feature["properties"]["id"]), "Invalid CIS ID"
        lng, lat = feature["geometry"]["coordinates"]
        assert 12 <= lng <= 18.9 and 48.5 <= lat <= 51.1, f"Outside Czech bounds: {feature}"
    pardubice = next(feature for feature in czech if feature["properties"]["id"] == "CZ5453613")
    assert pardubice["properties"]["name"] == "Pardubice hlavní nádraží", "Pardubice identity mismatch"
    print(f"Validated {len(czech)} Czech stations: unique IDs, CIS mappings and coordinate bounds")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sr70-url", default=SR70_URL)
    parser.add_argument("--check", action="store_true", help="Validate committed output without network access")
    args = parser.parse_args()
    stations_path = ROOT / "packages/data/src/stations.geojson"
    codes_path = ROOT / "apps/api/src/scrapers/codes/cz-codes.json"
    stations = json.loads(stations_path.read_text())
    if args.check:
        validate(stations["features"], json.loads(codes_path.read_text()))
        return

    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def download(url):
        with opener.open(url, timeout=30) as response:
            return response.read()

    home = download(BASE + "/").decode("utf-8")
    token = re.search(r'id="token"\s+value="([\da-f]+)"', home, re.I)
    if not token:
        raise RuntimeError("GRAPP homepage did not provide a session token")
    network = json.loads(download(f"{BASE}/get/network/all/{token[1]}"))
    passenger_names = {normalize(row[0]) for row in csv.reader(io.StringIO(download(CIS_URL).decode("utf-8-sig")))}
    aliases = {}
    for row in workbook_rows(download(args.sr70_url)):
        if row.get("N") != "1" or row.get("L") not in PASSENGER_QUALIFIERS:
            continue
        names = [row.get(column, "") for column in ["B", "D", "E", "F", "J", "K"]]
        if not any(normalize(name) in passenger_names for name in names):
            continue
        for name in names:
            if name and name != "-":
                aliases.setdefault(normalize(name), {})[row["A"]] = row

    features, codes, excluded = [], {}, 0
    for point in network["Stations"]:
        name = point["Name"]
        if point["STI"] == "33" or re.search(r"\b(?:odb|odbočka|státní hranice|hr\.|hranice|výh\.)", name, re.I):
            excluded += 1
            continue
        candidates = aliases.get(normalize(name)) or aliases.get(normalize(re.sub(r" z$", "", name)), {})
        lat, lng = point["GPS"]  # GRAPP is latitude first; GeoJSON is longitude first.
        nearby = [row for row in candidates.values() if
                  math.hypot((coordinate(row["Z"]) - lat) * 111,
                             (coordinate(row["AA"]) - lng) * 71) < 1]
        if len(nearby) != 1:
            excluded += 1
            continue  # Never invent identities for ambiguous or unmatched points.
        row = nearby[0]
        # SR70 has a 6-digit national number with a final check digit.
        # CIS uses country 54 + the five national digits, without that check digit.
        code = "54" + row["A"].zfill(6)[:-1]
        if code in codes:
            raise RuntimeError(f"Duplicate CIS code {code}: {name}")
        codes[code] = point["Id"]
        features.append({"type": "Feature", "properties": {
            "id": "CZ" + code, "name": row["B"], "type": "rail",
            "importance": 1 if point["STI"] == "11" else 3 if point["STI"][0] == "2" else 4,
        }, "geometry": {"type": "Point", "coordinates": [lng, lat]}})

    remaining = [feature for feature in stations["features"] if not feature["properties"]["id"].startswith("CZ")]
    insertion = next((i for i, feature in enumerate(remaining) if feature["properties"]["id"][:2] > "CZ"), len(remaining))
    stations["features"] = remaining[:insertion] + sorted(features, key=lambda feature: feature["properties"]["id"]) + remaining[insertion:]
    validate(stations["features"], codes)
    stations_path.write_text(json.dumps(stations, ensure_ascii=False, indent=2) + "\n")
    codes_path.write_text(json.dumps(dict(sorted(codes.items())), indent=2) + "\n")
    print(f"Imported {len(features)} of {len(network['Stations'])} GRAPP points; excluded {excluded}")


if __name__ == "__main__":
    main()
