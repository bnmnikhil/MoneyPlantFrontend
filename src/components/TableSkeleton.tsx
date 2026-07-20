import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/** Desktop skeleton rows for a table with `cols` columns. */
export function TableSkeleton({
  headers,
  rows = 6,
}: {
  headers: string[];
  rows?: number;
}) {
  return (
    <>
      {/* desktop */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {headers.map((h, i) => (
                <TableHead key={h} className={i === 0 ? "" : "text-right"}>
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rows }).map((_, r) => (
              <TableRow key={r} className="hover:bg-transparent">
                {headers.map((h, c) => (
                  <TableCell key={h} className={c === 0 ? "" : "text-right"}>
                    <Skeleton
                      className={c === 0 ? "h-4 w-28" : "ml-auto h-4 w-16"}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* mobile */}
      <div className="space-y-3 p-4 md:hidden">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="rounded-lg border border-border p-4">
            <Skeleton className="h-4 w-32" />
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="ml-auto h-3 w-16" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="ml-auto h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
