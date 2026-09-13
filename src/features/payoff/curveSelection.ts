import type { CurveRef } from "@/types/api";

export const curveKey = (curve: CurveRef) => `${curve.connectionId}:${curve.underlying}`;

/** Keep the same account/underlying, but refresh its display metadata. A now
 * empty list must clear the selection so the previous account is not displayed. */
export function resolveSelectedCurve(curves: CurveRef[], previous?: CurveRef) {
  return curves.find((curve) => previous && curveKey(curve) === curveKey(previous)) ?? curves[0];
}
