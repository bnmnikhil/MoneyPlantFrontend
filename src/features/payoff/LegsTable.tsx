import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PayoffLeg } from "@/types/api";
import { formatINR, formatNumber } from "@/lib/format";

function DirTag({ qty }: { qty: number }) {
  const short = qty < 0;
  return (
    <Badge variant={short ? "destructive" : "success"} className="font-normal">
      {short ? "Short" : "Long"} {formatNumber(Math.abs(qty))}
    </Badge>
  );
}

export function LegsTable({ legs }: { legs: PayoffLeg[] }) {
  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Symbol</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Strike</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Avg price</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {legs.map((leg) => (
              <TableRow key={leg.symbol}>
                <TableCell className="font-medium">{leg.symbol}</TableCell>
                <TableCell>
                  <Badge
                    variant={leg.type === "CE" ? "success" : "destructive"}
                    className="font-normal"
                  >
                    {leg.type}
                  </Badge>
                </TableCell>
                <TableCell className="tnum text-right">
                  {formatINR(leg.strike)}
                </TableCell>
                <TableCell className="text-right">
                  <DirTag qty={leg.qty} />
                </TableCell>
                <TableCell className="tnum text-right">
                  {formatINR(leg.avgPrice)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile */}
      <div className="divide-y divide-border md:hidden">
        {legs.map((leg) => (
          <div key={leg.symbol} className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Badge
                  variant={leg.type === "CE" ? "success" : "destructive"}
                  className="font-normal"
                >
                  {leg.type}
                </Badge>
                <span className="font-medium">{leg.symbol}</span>
              </div>
              <DirTag qty={leg.qty} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <span className="text-muted-foreground">Strike</span>
              <span className="tnum text-right">{formatINR(leg.strike)}</span>
              <span className="text-muted-foreground">Avg price</span>
              <span className="tnum text-right">{formatINR(leg.avgPrice)}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export { DirTag };
