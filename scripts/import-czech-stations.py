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
# Passenger-capable stations/stops; excludes junctions and boundaries. Track groups (8) cover
# both freight yards and passenger stations such as Praha-Eden; the CIS list tells them apart.
PASSENGER_QUALIFIERS = {"1", "3", "4", "8", "9", "23", "24", "37", "38", "43", "52", "61", "62"}
# SR70 transport nodes: junction stations, used for map importance.
NODE_QUALIFIER = "13"
# Importance 1, shown on the map at continental zoom: Praha, Brno and Ostrava main stations.
TOP_HUBS = {"5457076", "5433295", "5434364"}
# GRAPP operational points. Lowercase "hr." is a boundary; "Hr." abbreviates Hradec/Hradsko.
OPERATIONAL = re.compile(r"^hr\.|st\.hr\.|\bOdb\b|výh\.")


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


def validate(features):
    ids = [feature["properties"]["id"] for feature in features]
    assert len(ids) == len(set(ids)), "Duplicate station IDs"
    # Metro (CZM) and light (CZL) stops are curated separately and kept as they are.
    czech = [feature for feature in features if feature["properties"]["id"].startswith("CZ5")]
    assert 2400 <= len(czech) <= 2900, f"Unexpected Czech station count: {len(czech)}"
    for feature in czech:
        assert re.fullmatch(r"CZ54\d{5}", feature["properties"]["id"]), "Invalid CIS ID"
        lng, lat = feature["geometry"]["coordinates"]
        assert 12 <= lng <= 18.9 and 48.5 <= lat <= 51.1, f"Outside Czech bounds: {feature}"
    pardubice = next(feature for feature in czech if feature["properties"]["id"] == "CZ5453613")
    assert pardubice["properties"]["name"] == "Pardubice hlavní nádraží", "Pardubice identity mismatch"
    names = {feature["properties"]["name"] for feature in czech}
    missing = {"Český Těšín", "Hranice na Moravě", "Praha-Eden", "Kladno město"} - names
    assert not missing, f"Known passenger stations were dropped: {missing}"
    tiers = [sum(feature["properties"]["importance"] == tier for feature in czech) for tier in (1, 2, 3)]
    assert tiers[0] == len(TOP_HUBS) and 20 <= tiers[1] <= 50 and 80 <= tiers[2] <= 250, f"Importance tiers: {tiers}"
    print(f"Validated {len(czech)} Czech stations: unique IDs, CIS codes and coordinate bounds")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sr70-url", default=SR70_URL)
    parser.add_argument("--check", action="store_true", help="Validate committed output without network access")
    args = parser.parse_args()
    stations_path = ROOT / "packages/data/src/stations.geojson"
    stations = json.loads(stations_path.read_text())
    if args.check:
        validate(stations["features"])
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
    # CIS appends Polish names in Těšín Silesia, "Český Těšín (Czeski Cieszyn)", and lists
    # replacement bus stops as "Oparno (Velemín, Oparno) (NAD)"; those are not stations.
    passenger_names = {normalize(re.sub(r"\s*\([^()]*\)$", "", row[0]))
                       for row in csv.reader(io.StringIO(download(CIS_URL).decode("utf-8-sig")))
                       if "(NAD)" not in row[0]} - {""}
    aliases, nodes = {}, set()
    for row in workbook_rows(download(args.sr70_url)):
        if row.get("N") == "1" and row.get("L") == NODE_QUALIFIER:
            nodes.add(normalize(row["B"]))
        if row.get("N") != "1" or row.get("L") not in PASSENGER_QUALIFIERS:
            continue
        # "K" names the governing station, so it is not an alias for the point itself.
        names = [row.get(column, "") for column in ["B", "D", "E", "F", "J"]]
        # A track group borrows its station's names, so only its own name identifies it.
        if not any(normalize(name) in passenger_names for name in (names[:1] if row["L"] == "8" else names)):
            continue
        for name in names:
            if name and name != "-":
                aliases.setdefault(normalize(name), {})[row["A"]] = row

    features, codes, excluded = [], set(), 0
    for point in network["Stations"]:
        name = point["Name"]
        if point["STI"] == "33" or OPERATIONAL.search(name):
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
        codes.add(code)
        features.append({"type": "Feature", "properties": {
            "id": "CZ" + code, "name": row["B"], "type": "rail",
            "importance": 1 if code in TOP_HUBS else 2 if point["STI"] == "11"
            else 3 if normalize(row["B"]) in nodes else 4,
        }, "geometry": {"type": "Point", "coordinates": [lng, lat]}})

    remaining = [feature for feature in stations["features"] if not feature["properties"]["id"].startswith("CZ5")]
    insertion = next((i for i, feature in enumerate(remaining) if feature["properties"]["id"][:3] > "CZ5"), len(remaining))
    stations["features"] = remaining[:insertion] + sorted(features, key=lambda feature: feature["properties"]["id"]) + remaining[insertion:]
    validate(stations["features"])
    stations_path.write_text(json.dumps(stations, ensure_ascii=False, indent=2) + "\n")
    print(f"Imported {len(features)} of {len(network['Stations'])} GRAPP points; excluded {excluded}")


if __name__ == "__main__":
    main()
