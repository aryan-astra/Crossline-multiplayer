# OpenStreetMap map geometry

The bundled geometry in `src/game/geography/` was downloaded from the official OpenStreetMap API on 2026-10-25 and is derived from OpenStreetMap contributors' database. It contains building ways as closed polygon rings and highway ways as tagged polylines. Coordinates are transformed to a 4400 × 3000 source frame with a local equirectangular projection, north up, uniform scale; each file records its crop bounds, projection center, and meters per game unit. OSM way IDs and tags are retained.

The Paris extract uses `https://api.openstreetmap.org/api/0.6/map?bbox=2.3565,48.8639,2.3705,48.8711`; it contains 1,019 building footprints and 1,822 highway ways. The projection is centered at (48.8675, 2.3635), near Place de la République.

The Delhi extract uses `https://api.openstreetmap.org/api/0.6/map?bbox=77.209,28.621,77.225,28.633`; it contains 470 building footprints and 986 highway ways. The projection is centered at (28.627, 77.217), near Jantar Mantar.

The importer in `scripts/import_osm.py` includes a way when any node falls inside its crop, retaining the full way geometry and tags in source JSON. Runtime map construction clips building rings and selected street lines to the crop bounds, and carries only the OSM way ID, building name, street name/class, and geometry. The rendered map includes `primary`, `secondary`, `tertiary`, `residential`, `living_street`, `pedestrian`, and `unclassified` ways. It uses closed `building=*` ways and does not include multipolygon building relations.

## Attribution and license

This is a geographic layout baseline, not a surveyed or photoreal replica. Street widths, facade height/color, interiors and character scale are gameplay approximations. Parks, barriers, elevation and building multipolygon relations are not imported. Security positions, crowds, objectives and transactions are fictional. Narrow gaps smaller than an agent are impassable; collision recovery searches nearby open ground rather than leaving an entity embedded in a building.

Display this attribution where the maps are shown: **© OpenStreetMap contributors** linking to <https://www.openstreetmap.org/copyright>. The database is made available under the [Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/). These bundled extracts are database contents derived from OSM, so distribute the data under ODbL and include this attribution/license notice with the project. See the official [OSM Legal FAQ](https://wiki.openstreetmap.org/wiki/Legal_FAQ) and [copyright page](https://www.openstreetmap.org/copyright).
