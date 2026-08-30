/**
 * How the map draws itself in each theme: the basemap's own colours, how much of
 * its type it keeps, and the two things drawn over it that are not marks -- the
 * district washes and the cluster bubbles.
 *
 * One place for all of it, because these decisions are not independent. The alpha
 * a district wash needs depends on how dark the ground is; the tone a cluster can
 * carry depends on the same; and type set for a bright ground shouts over a dark
 * one. They were chosen together, by measurement, against the real sheets -- see
 * `basemap.test.ts`, which holds every claim made in the comments here.
 *
 * The basemap is DELIBERATELY quiet in both themes. It is not the content: the
 * marks are, and everything here is tuned so that the loudest thing on screen is
 * a mark, then a district, then -- last -- the map's own type.
 */

import type { ResolvedTheme } from "../../theme";
import type { ClusterTone, ColorSweep } from "../map-colors";
import type { LabelDensity } from "./labels";
import type { MapPalette } from "./palette";

export interface BasemapTheme {
    /** One colour per role; `palette.ts` replays it over the sheet's own zoom ramps. */
    palette: MapPalette;
    /** How much of the basemap's own type survives. */
    labels: LabelDensity;
    /**
     * The district wash. Its sweep is NOT the cluster's: a bubble is a solid disc and
     * wants full colour, while a boundary is a few percent of alpha over the ground,
     * where a saturated hue turns to mud and reads as no colour at all. `strokeMode`
     * decides whether the edge is the interface's ink -- a grid laid over the map --
     * or the wash's own colour, which is quieter and says what the district is doing
     * at the same time.
     */
    boundary: { tone: ColorSweep; strokeMode: "ink" | "self"; strokeOpacity: number; fillScale: number };
    cluster: ClusterTone;
}

/**
 * Light.
 *
 * Its sheet already gets the one thing the dark sheet got wrong -- the road network
 * is lighter than the land it crosses -- so this palette is the sheet's own colours,
 * with three exceptions:
 *
 *  - `labelTextRoad` was #ffffff, painted onto #ffffff road surfaces. Street names
 *    were not quiet on the light theme, they were absent, at a contrast of 1.00.
 *  - `labelText` and `labelTextStrong` came in at 4.4 and 5.3 against the ground,
 *    louder than five of the eight mark statuses they sit among. House numbers
 *    outshouting the marks inverts what the map is for.
 *  - the type that remains is fewer classes: see `labels`.
 */
const LIGHT_PALETTE: MapPalette = {
    adminFill: "#8c8c8c", adminOutline: "#dedede",
    land: "#f4f5f5", landUrban: "#f2f3f3", landIndustrial: "#ecedee",
    green: "#d3d9df", sport: "#cad1d8", water: "#c1c6cb",
    buildingFill: "#dee0e3", buildingOutline: "#c8ccd1", fence: "#d1d4d6",
    roadFill: "#ffffff", roadOutline: "#c8ccd0", roadPattern: "#adb3b8", roadTunnel: "#ecedee",
    roadLimited: "#c8ccd0", roadConstructionFill: "#ffffff", roadConstructionOutline: "#ffffff",
    pathFill: "#c8ccd0", pathOutline: "#f1f2f3",
    transit: "#747d86",
    // 3.68 on the ground: present, and quieter than every mark on top of it
    labelText: "#778088",
    labelTextStrong: "#717a82",
    // 4.19 on the white road surface it is actually painted on, not on the land beside it
    labelTextRoad: "#747d84",
    labelTextWater: "#5e6871",
    labelOutline: "#ffffff", labelIcon: "#9da6af",
};

/**
 * Dark.
 *
 * A neutral graphite ground, chosen over a cool or a warm one because neither the
 * eight status colours nor the accent pink share a hue with it, so nothing on the
 * map can be mistaken for the map. The one fault it exists to fix: the authored
 * sheet paints road surfaces at #0a0a0a over #131416 land, so the network reads as
 * cracks in the ground rather than as the thing you navigate by -- and a marker
 * sitting on a road loses the very edge that places it. Here, as on the light
 * theme, the network is the lighter of the two.
 */
const DARK_PALETTE: MapPalette = {
    adminFill: "#101214", adminOutline: "#2b2f33",
    land: "#15181a", landUrban: "#191d20", landIndustrial: "#1c2023",
    green: "#16211c", sport: "#222a2c", water: "#16242e",
    buildingFill: "#202427", buildingOutline: "#2e3338", fence: "#2a2f33",
    roadFill: "#2f353a", roadOutline: "#3d444a", roadPattern: "#4b5359", roadTunnel: "#23282c",
    roadLimited: "#2a3034", roadConstructionFill: "#343b40", roadConstructionOutline: "#242a2e",
    pathFill: "#394045", pathOutline: "#1a1e21",
    transit: "#4d565c",
    // 3.0 on the ground. Type set at AA on a night map wins the frame it was meant
    // to describe; below ~2.5 it stops being readable at all.
    labelText: "#5d6569", labelTextStrong: "#657279", labelTextRoad: "#72848e",
    labelTextWater: "#4e6572", labelOutline: "#0d0f10", labelIcon: "#41474d",
};

export const BASEMAP: Record<ResolvedTheme, BasemapTheme> = {
    light: {
        palette: LIGHT_PALETTE,
        labels: "reduced",
        // Over paper a tenth of a saturated hue is already a legible tint, so the wash
        // keeps the strength it was drawn at; only the edge changes, from ink to the
        // wash's own colour.
        boundary: { tone: { saturation: 100, value: 80 }, strokeMode: "self", strokeOpacity: 0.55, fillScale: 1 },
        cluster: { saturation: 100, value: 80, neutral: "d3d3d3" },
    },
    dark: {
        palette: DARK_PALETTE,
        labels: "reduced",
        // The same alpha does not read the same on both grounds. Over near-black, a
        // tenth of a saturated hue lands within a couple of 255ths of the ground: the
        // colour is there and carries no information. So the alpha goes UP and the
        // saturation down -- a pale hue at a fifth of alpha reads as colour, where a
        // deep one at a twentieth reads as dirt.
        boundary: { tone: { saturation: 52, value: 100 }, strokeMode: "self", strokeOpacity: 0.34, fillScale: 1.6 },
        // A sweep drawn for paper glows over a night map, and `d3d3d3` -- the "nothing
        // to weigh" grey -- would be brighter there than any real status.
        cluster: { saturation: 92, value: 84, neutral: "9aa0a4" },
    },
};

export { LIGHT_PALETTE, DARK_PALETTE };
