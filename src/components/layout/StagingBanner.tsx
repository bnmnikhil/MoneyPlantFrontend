import { STAGING_BANNER_TEXT } from "@/lib/environment";

/** A full-width notice at the top of every page of a staging build. */
export function StagingBanner() {
  return (
    <div
      role="status"
      className="w-full bg-amber-600 px-4 py-1 text-center text-sm font-semibold text-white"
    >
      {STAGING_BANNER_TEXT}
    </div>
  );
}
