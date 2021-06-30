import "regenerator-runtime/runtime";
import React, { useRef, useEffect, useState, useContext } from "react";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";

import mapboxgl from "mapbox-gl";
import axios from "axios";

import { AppContext } from "../../context";

import {
  SnapLineClosed,
  MultVertDirectSelect,
  MultVertSimpleSelect,
  DrawPolygon,
} from "./modes";

import { MapNavBar } from "../blueprint";
import { PropertyDialog } from "../editor";
import { ImportDialog } from "../importer";

import { SnapModeDrawStyles } from "mapbox-gl-draw-snap-mode";
import { setWindowHash, locationFromHash } from "./utils";
import "./map.css";
import { initializeMap, propertyViewMap, editModeMap } from "./map-pieces";

/**
 *
 * For delete point, feature.removeCoordinate()
 *
 *
 * For the "preview" mode. Add layer, fill will be based on property. Hover would be nice touch. Then popup
 *
 */

const local_url = "http://0.0.0.0:8000/lines/10";
const put_url = "http://0.0.0.0:8000/updates/10";
const columns_url = "http://0.0.0.0:8000/columns/10";

mapboxgl.accessToken =
  "pk.eyJ1IjoidGhlZmFsbGluZ2R1Y2siLCJhIjoiY2tsOHAzeDZ6MWtsaTJ2cXhpMDAxc3k5biJ9.FUMK57K0UP7PSrTUi3DiFQ";

export function Map() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef();

  const {
    state,
    dispatch,
    state_reducer,
    fetchLines,
    fetchColumns,
  } = useContext(AppContext);

  console.log(state.project_id == null);

  const [viewport, setViewport] = useState(
    locationFromHash(window.location.hash)
  );

  const [edit, setEdit] = useState(false);

  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(state.project_id == null);
  const [features, setFeatures] = useState([]);

  useEffect(() => {
    setImportOpen(state.project_id == null);
  }, [state.project_id]);

  const closeOpen = () => {
    setOpen(false);
  };

  const [changeSet, setChangeSet] = useState([]);

  const onSave = async (e) => {
    // can do cleaning on changeSet by the internal id string.
    // Combine like edits so I'm not running a million
    // transactions on the db.
    if (changeSet.length != 0) {
      console.log(changeSet);
      const res = await axios.put(put_url, { change_set: changeSet });
      setChangeSet([]);
    }
    fetchColumns(state.project_id, dispatch);
    fetchLines(state.project_id, dispatch);
  };

  const onCancel = () => {
    setChangeSet([]);
    fetchColumns(state.project_id, dispatch);
    fetchLines(state.project_id, dispatch);
  };

  useEffect(() => {
    if (mapContainerRef.current == null) return;
    initializeMap(
      mapContainerRef.current,
      viewport,
      setChangeSet,
      setViewport
    ).then((mapObj) => {
      mapRef.current = mapObj;
    });
    return () => mapRef.current.remove();
  }, [mapContainerRef, state.project_id]);

  useEffect(() => {
    if (mapRef.current == null) return;
    if (edit) {
      const map = mapRef.current;

      var Draw = new MapboxDraw({
        controls: { point: false },
        modes: Object.assign(
          {
            direct_select: MultVertDirectSelect,
            simple_select: MultVertSimpleSelect,
            draw_polygon: DrawPolygon,
          },
          MapboxDraw.modes,
          { draw_line_string: SnapLineClosed }
        ),
        styles: SnapModeDrawStyles,
        snap: true,
        snapOptions: {
          snapPx: 25,
        },
      });

      map.addControl(Draw, "top-left");

      var featureIds = Draw.add(state.lines);

      map.on("click", async function(e) {
        console.log(Draw.getMode());
      });

      map.on("draw.create", async function(e) {
        console.log(e);
        console.log("created new feature!");
        const { type: action, features } = e;

        features.map((feature) => {
          const obj = { action, feature };
          map.addToChangeSet(obj);
        });
      });

      map.on("draw.delete", async function(e) {
        console.log(e);
        const { type: action, features } = e;

        features.map((feature) => {
          const obj = { action, feature };
          map.addToChangeSet(obj);
        });
      });

      // use the splice to replace coords
      // This needs to account for deleteing nodes. That falls under change_coordinates
      map.on("draw.update", async function(e) {
        Draw.changeMode("simple_select", [e.features[0].id]);
      });
      return () => map.removeControl(Draw);
    }
  }, [state.lines, edit, mapRef]);

  useEffect(() => {
    if (mapRef.current == null) return;
    if (!edit) {
      propertyViewMap(mapRef.current, state, setFeatures, setOpen);
      return () => {
        var mapLayer = mapRef.current.getLayer("column-fill");
        if (typeof mapLayer !== "undefined") {
          mapRef.current.removeLayer("column-fill");
          mapRef.current.removeLayer("outline");
          mapRef.current.removeSource("columns");
        }
      };
    }
  }, [state.columns, edit, mapRef]);

  return (
    <div
      style={{ display: "flex", justifyContent: "center", marginTop: "30px" }}
    >
      <ImportDialog open={importOpen} />
      <div>
        <MapNavBar
          onSave={onSave}
          onCancel={onCancel}
          enterEditMode={() => setEdit(true)}
          enterPropertyMode={() => setEdit(false)}
          editMode={edit}
          columns={state.columns}
        />
      </div>

      <div>
        <div className="map-container" ref={mapContainerRef} />
      </div>
      <PropertyDialog open={open} features={features} closeOpen={closeOpen} />
    </div>
  );
}

export const M = "Mapbobgl";
