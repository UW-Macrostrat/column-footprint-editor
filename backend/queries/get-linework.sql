SELECT ST_AsGeoJSON(ST_LineMerge(geometry)) lines, id from map_digitizer.linework;