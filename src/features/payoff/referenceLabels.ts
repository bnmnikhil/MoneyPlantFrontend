export interface ReferenceMarker {
  key: string;
  value: number;
  text: string;
}

export interface ReferenceLabel extends ReferenceMarker {
  /** Horizontal displacement from the actual reference line, in pixels. */
  dx: number;
  row: number;
  fontSize: number;
}

/** Pack annotations into rows, keeping their text inside the plot at either edge. */
export function layoutReferenceLabels(
  markers: ReferenceMarker[], range: [number, number], plotWidth: number,
): ReferenceLabel[] {
  const [low, high] = range;
  if (!(plotWidth > 0) || !Number.isFinite(plotWidth) || !(high > low)) return [];
  const rows: { left: number; right: number }[][] = [];
  return markers.filter((marker) => Number.isFinite(marker.value) && marker.value >= low && marker.value <= high)
    .map((marker) => {
      // Conservative glyph width at 11px; resize only for exceptionally narrow plots.
      const width = Math.min(plotWidth, marker.text.length * 7 + 8);
      const fontSize = Math.min(11, (plotWidth - 8) / Math.max(1, marker.text.length) / 7 * 11);
      const anchor = (marker.value - low) / (high - low) * plotWidth;
      const center = Math.max(width / 2, Math.min(plotWidth - width / 2, anchor));
      const bounds = { left: center - width / 2, right: center + width / 2 };
      let row = rows.findIndex((entries) => entries.every((other) => bounds.left >= other.right + 8 || bounds.right + 8 <= other.left));
      if (row < 0) { row = rows.length; rows.push([]); }
      rows[row].push(bounds);
      return { ...marker, dx: center - anchor, row, fontSize };
    });
}
