# OpenStreetMap map geometry

The bundled geometry in `src/game/geography/` was downloaded from the official OpenStreetMap API on 2026-10-23 and is derived from OpenStreetMap contributors' database. It contains building ways as closed polygon rings and highway ways as tagged polylines. Coordinates are transformed to the existing 2200 × 1500 game frame with a local equirectangular projection, north up, uniform scale; each file records its crop bounds, projection center, and meters per game unit. OSM way IDs and tags are retained.

The Paris extract was downloaded with `https://api.openstreetmap.org/api/0.6/map?bbox=2.359,48.865,2.368,48.870`; the bundled crop is `west=2.360, south=48.8657, east=2.367, north=48.8693` (198 building footprints, 490 highway ways). The crop is centered on Place de la République (48.8675, 2.3638).

The Delhi extract was downloaded with `https://api.openstreetmap.org/api/0.6/map?bbox=77.213,28.624,77.221,28.630`; the bundled crop uses those same bounds (102 building footprints, 212 highway ways), centered on Jantar Mantar (28.6271, 77.2166).

Buildings and roads are included when the arithmetic mean of their OSM way nodes falls inside the crop. The source JSON keeps their full way geometry and tags; the runtime map clips building rings and selected street lines to the crop bounds, and carries only the OSM way ID, building name, street name/class, and geometry. The rendered map includes `primary`, `secondary`, `tertiary`, `residential`, `living_street`, `pedestrian`, and `unclassified` ways. It uses closed `building=*` ways and does not include multipolygon building relations.

## Attribution and license

This is a geographic layout baseline, not a surveyed or photoreal replica. Street widths, facade height/color, interiors and character scale are gameplay approximations. Parks, barriers, elevation and building multipolygon relations are not imported. Security positions, crowds, objectives and transactions are fictional. Narrow gaps smaller than an agent are impassable; collision recovery searches nearby open ground rather than leaving an entity embedded in a building.

Display this attribution where the maps are shown: **© OpenStreetMap contributors** linking to <https://www.openstreetmap.org/copyright>. The database is made available under the [Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/). These bundled extracts are database contents derived from OSM, so distribute the data under ODbL and include this attribution/license notice with the project. See the official [OSM Legal FAQ](https://wiki.openstreetmap.org/wiki/Legal_FAQ) and [copyright page](https://www.openstreetmap.org/copyright).
