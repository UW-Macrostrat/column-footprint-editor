SELECT ST_AsGeoJSON(ST_LineMerge(geometry)) lines from map_digitizer.linework;