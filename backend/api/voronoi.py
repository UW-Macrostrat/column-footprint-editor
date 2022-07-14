from starlette.endpoints import HTTPEndpoint
from starlette.responses import JSONResponse
from database import Database
from project import Project
from pathlib import Path
import json

from collections import defaultdict

here = Path(__file__).parent / ".."
procedures = here / "database" /"procedures"
queries= here / "database" / "queries"

class VoronoiTesselator(HTTPEndpoint):
    """ 
    Allow for multiple bounding geometry options. Group by bounding geom from
    project. Check if a point has a bounding geom. If it doesn't! Make it red 
    by adding some property to be read by frontend.

    To start I can group points by bounding geometry ID in a dictionary.
    And then get the polygons for all the entries in the dictionary

    """

    tesselate_sql = procedures / "tesselate.sql"
    get_bounding_id = procedures / "get-bounding-id.sql"
    point_buffer = procedures / "point-buffer.sql"

    def group_points(self, db, points):
        """ 
        :points a list of geojson Point type

        returns: A dictionary where each key corresponds to a map_face containing point OR 0 if not
        contained within a geometry
        """

        grouped = defaultdict(list)
        sql = open(self.get_bounding_id).read()
        
        for point in points:
            b_id = db.exec_sql(sql, params={'point': json.dumps(point['geometry'])}, count=1)
            if b_id:
                grouped[b_id].append(point['geometry'])
            else:
                grouped[0].append(point['geometry'])
        
        return grouped

    def tesselate(self, db: Database, points):
        """
            ensure that points are within a bounding geometry, 
            polygonize all by grouped bounding geom
            return those.
        """
        grouped = self.group_points(db, points)
        unbounded_points = grouped[0]
        del grouped[0]

        sql = open(self.tesselate_sql).read()
        p_buffer_sql = open(self.point_buffer).read()

        polygons = []
        for points in grouped.values():
            params = {"points": json.dumps({"type": "GeometryCollection", "geometries": points})}
            res = db.exec_sql(sql, params=params)
            polygons = polygons + [json.loads(dict(row)['voronoi']) for row in res]
        for point in unbounded_points:
            params = {"point": json.dumps(point)}
            res = db.exec_sql(p_buffer_sql, params=params)
            polygons = polygons + [json.loads(dict(row)['buffered']) for row in res]

        return polygons


    async def put(self, request):
        project_id = request.path_params['project_id']
        project = Project(project_id)
        db = Database(project)

        data = await request.json()
        points = data["points"]

        polygons = self.tesselate(db, points)

        return JSONResponse({"Status":"Success", "polygons": polygons})
    
    async def post(self, request):
        project_id = request.path_params['project_id']
        project = Project(project_id)
        db = Database(project)

        return JSONResponse({"Status": "Not implemented yet"})