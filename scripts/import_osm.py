"""Refresh bundled OSM districts; Python standard library only, not a game dependency."""
import argparse
import datetime
import json
import math
from pathlib import Path
import urllib.request
import xml.etree.ElementTree as ET

DISTRICTS = {
    "delhi": ("Jantar Mantar, Delhi", (77.209, 28.621, 77.225, 28.633), (77.217, 28.627), 0.4453),
    "paris": ("Place de la République, Paris", (2.3565, 48.8639, 2.3705, 48.8711), (2.3635, 48.8675), 0.2672),
}


def convert(xml, district):
    location, bounds, center, meters = DISTRICTS[district]
    west, south, east, north = bounds
    lon, lat = center
    root = ET.fromstring(xml)
    nodes = {n.attrib["id"]: (float(n.attrib["lon"]), float(n.attrib["lat"])) for n in root.findall("node")}
    buildings, roads = [], []
    for way in root.findall("way"):
        tags = {t.attrib["k"]: t.attrib["v"] for t in way.findall("tag")}
        refs = [n.attrib["ref"] for n in way.findall("nd")]
        if not refs or any(ref not in nodes for ref in refs):
            continue
        points = [nodes[ref] for ref in refs]
        if not any(west <= x <= east and south <= y <= north for x, y in points):
            continue
        projected = [[round(2200 + (x - lon) * 111320 * math.cos(math.radians(lat)) / meters, 2),
                      round(1500 - (y - lat) * 111320 / meters, 2)] for x, y in points]
        record = {"id": way.attrib["id"], "tags": tags}
        if tags.get("building") and tags["building"] != "no" and len(refs) >= 4 and refs[0] == refs[-1]:
            buildings.append({**record, "ring": projected})
        if tags.get("highway") and len(refs) >= 2:
            roads.append({**record, "line": projected})
    return {
        "source": "OpenStreetMap", "license": "ODbL-1.0", "location": location,
        "retrieved": datetime.date.today().isoformat(),
        "bounds": dict(zip(("west", "south", "east", "north"), bounds)),
        "projection": {"center": {"lon": lon, "lat": lat}, "width": 4400, "height": 3000,
                       "type": "local equirectangular; north-up; uniform scale", "metersPerWorldUnit": meters},
        "buildings": buildings, "roads": roads,
    }


def self_test():
    sample = b'<osm><node id="1" lon="77.217" lat="28.627"/><node id="2" lon="77.218" lat="28.627"/><node id="3" lon="77.218" lat="28.628"/><way id="4"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="1"/><tag k="building" v="yes"/></way></osm>'
    data = convert(sample, "delhi")
    assert len(data["buildings"]) == 1
    assert data["buildings"][0]["ring"][0] == [2200, 1500]
    assert data["buildings"][0]["ring"][-1] == [2200, 1500]
    assert data["projection"]["metersPerWorldUnit"] == 0.4453
    assert not convert(b'<osm><way id="1"><nd ref="missing"/><tag k="building" v="yes"/></way></osm>', "delhi")["buildings"]
    print("OSM importer self-check passed")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("district", nargs="?", choices=tuple(DISTRICTS))
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        self_test()
    elif args.district:
        bounds = DISTRICTS[args.district][1]
        url = "https://api.openstreetmap.org/api/0.6/map?bbox=" + ",".join(map(str, bounds))
        request = urllib.request.Request(url, headers={"User-Agent": "CrosslineMapImporter/0.1 (https://github.com/aryan-astra/Crossline-multiplayer)"})
        with urllib.request.urlopen(request, timeout=60) as response:
            raw = response.read(24 * 1024 * 1024 + 1)
        if len(raw) > 24 * 1024 * 1024:
            raise ValueError("OSM extract exceeds the bounded importer limit")
        result = convert(raw, args.district)
        result["sourceUrl"] = url
        if len(result["buildings"]) < 20 or len(result["roads"]) < 10:
            raise ValueError("Incomplete extract; original file was preserved")
        target = Path(__file__).resolve().parents[1] / "src" / "game" / "geography" / f"{args.district}.json"
        temp = target.with_suffix(".json.tmp")
        temp.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        temp.replace(target)
        print(f"{args.district}: {len(result['buildings'])} buildings, {len(result['roads'])} roads, 4400x3000 world")
    else:
        parser.error("choose a district or --self-test")
