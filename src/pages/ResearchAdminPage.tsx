import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MAX_FILINGS, MAX_LIST_BYTES, countOutcomes, dailyStatusLine, daysBetween, defaultPriceRange, normaliseSymbol, previewList, splitRange,
  todayInIndia, type ListPreview,
} from "@/features/research/importTools";
import { ApiError, api } from "@/lib/api";
import type { FilingImportReport, FilingImportResult, PriceLoadReport } from "@/types/api";

/**
 * The owner loads company results and daily prices (ANALYTICS-PLAN.md AN-25), instead of pasting
 * into the browser console. Not in the navigation; reached from /app/admin. The endpoints answer
 * 404 to anyone but the owner, and so does this page, through the status endpoint's same guard.
 */
export function ResearchAdminPage() {
  const owner = useQuery({ queryKey: ["admin", "status"], queryFn: api.adminStatus, retry: false });
  if (owner.isLoading) return <Skeleton className="h-96 w-full" />;
  if (owner.error instanceof ApiError && owner.error.status === 404) {
    return <ErrorState title="Not available" description="This page is not available for your account." />;
  }
  if (owner.error) return <ErrorState onRetry={() => owner.refetch()} />;

  return (
    <div className="page-stack">
      <PageHeader
        title="Research data"
        description="Load a company's quarterly results from NSE's exported lists, and NSE's daily prices."
        actions={<Button asChild variant="outline"><Link to="/app/admin">Status</Link></Button>}
      />
      <ImportResults />
      <LoadPrices />
      <UploadFiling />
    </div>
  );
}

/** The message an endpoint put in its 400 body, or a plain fallback. */
function reason(error: unknown): string {
  if (error instanceof ApiError) {
    const body = error.body as { message?: string } | undefined;
    if (body?.message) return body.message;
    if (error.status === 404) return "Not available for this account.";
    return error.message;
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <Card className="min-w-0">
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

function Counts({ counts }: { counts: Record<string, number> }) {
  return (
    <p className="text-sm tabular-nums">
      {Object.entries(counts).map(([outcome, n]) => `${n} ${outcome.toLowerCase().replace(/_/g, " ")}`).join(" · ")}
    </p>
  );
}

// ---------------------------------------------------------------------------------------- results

function ImportResults() {
  const [symbol, setSymbol] = useState("");
  const [text, setText] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [preview, setPreview] = useState<ListPreview | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<FilingImportReport | null>(null);

  const company = normaliseSymbol(symbol);

  const choose = async (list: FileList | null) => {
    setReport(null);
    setProblem(null);
    if (!list || list.length === 0) return;
    const chosen = Array.from(list);
    const tooBig = chosen.find((file) => file.size > MAX_LIST_BYTES);
    if (tooBig) {
      setProblem(`${tooBig.name} is larger than 1 MB, which an NSE results list never is.`);
      return;
    }
    const combined = (await Promise.all(chosen.map((file) => file.text()))).join("\n");
    setFiles(chosen.map((file) => file.name));
    setText(combined);
    setPreview(previewList(combined));
  };

  const run = async () => {
    if (!company || !preview) return;
    setRunning(true);
    setProblem(null);
    setReport(null);
    try {
      setReport(await api.importFilings(company, text));
    } catch (error) {
      setProblem(reason(error));
    } finally {
      setRunning(false);
    }
  };

  const count = preview?.addresses.length ?? 0;
  const blocked = !company || count === 0 || count > MAX_FILINGS || running;

  return (
    <Section title="Import results"
      description="On NSE, open the company's Financial Results and Integrated Filing - Financials tabs, download each table, and choose both files here.">
      <div className="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)]">
        <Field label="NSE symbol" htmlFor="import-symbol">
          <Input id="import-symbol" value={symbol} placeholder="ITC" autoComplete="off"
            onChange={(event) => setSymbol(event.target.value)} aria-invalid={symbol !== "" && !company} />
        </Field>
        <Field label="NSE's exported lists" htmlFor="import-files">
          <Input id="import-files" type="file" multiple accept=".csv,.txt,text/csv,text/plain"
            onChange={(event) => { void choose(event.target.files); }} />
        </Field>
      </div>
      {symbol !== "" && !company && <p className="text-sm text-loss">Use the NSE symbol, such as ITC, M&amp;M or BAJAJ-AUTO.</p>}
      {preview && (
        <p className="text-sm text-muted-foreground">
          {files.join(", ")}: <span className="text-foreground">{count} filing{count === 1 ? "" : "s"} found</span>
          {preview.withoutFile > 0 && `, ${preview.withoutFile} older row${preview.withoutFile === 1 ? "" : "s"} with no file at NSE`}.
          {count > MAX_FILINGS && ` At most ${MAX_FILINGS} in one import.`}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => { void run(); }} disabled={blocked}>{running ? "Importing…" : "Import"}</Button>
        {running && <span className="text-sm text-muted-foreground">About 2 seconds for each filing not stored before; keep this page open.</span>}
      </div>
      {problem && <p role="alert" className="text-sm text-loss">{problem}</p>}
      {report && <ImportTable report={report} />}
    </Section>
  );
}

function ImportTable({ report }: { report: FilingImportReport }) {
  const failedFirst = [...report.filings].sort((a, b) => Number(b.outcome === "FAILED") - Number(a.outcome === "FAILED"));
  return (
    <div className="space-y-2">
      <Counts counts={countOutcomes(report.filings)} />
      <p className="text-sm">
        <Link to={`/app/stocks/${encodeURIComponent(report.symbol)}`} className="text-primary underline-offset-2 hover:underline">
          Open {report.symbol}'s page →
        </Link>
      </p>
      <div className="relative max-h-80 overflow-auto rounded-md border border-border [scrollbar-color:var(--gb-thumb)_transparent] [scrollbar-width:thin]">
        <table className="w-full min-w-[34rem] border-collapse text-sm">
          <thead className="sticky top-0 bg-card text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-medium">Quarter</th>
              <th scope="col" className="px-3 py-2 text-left font-medium">Basis</th>
              <th scope="col" className="px-3 py-2 text-left font-medium">Outcome</th>
              <th scope="col" className="px-3 py-2 text-left font-medium">Filing</th>
            </tr>
          </thead>
          <tbody>
            {failedFirst.map((filing: FilingImportResult) => (
              <tr key={filing.source} className="border-t border-border">
                <td className="px-3 py-2 tabular-nums">{filing.periodEnd ?? "—"}</td>
                <td className="px-3 py-2">{filing.basis ? filing.basis.toLowerCase() : "—"}</td>
                <td className={`px-3 py-2 ${filing.outcome === "FAILED" ? "text-loss" : ""}`}>
                  {filing.outcome.toLowerCase().replace(/_/g, " ")}{filing.detail ? `: ${filing.detail}` : ""}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{filing.source.split("/").pop()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------------------- prices

interface PriceLoadPart {
  from: string;
  to: string;
  report?: PriceLoadReport;
  error?: string;
}

function LoadPrices() {
  const status = useQuery({ queryKey: ["admin", "prices", "status"], queryFn: api.priceStatus, retry: false });
  const line = status.data ? dailyStatusLine(status.data) : null;
  const today = todayInIndia();
  const initial = defaultPriceRange(today);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [pieces, setPieces] = useState<PriceLoadPart[]>([]);
  const [running, setRunning] = useState(false);

  const days = daysBetween(from, to);
  const invalid = !from || !to || days === 0 ? "Choose a start date on or before the end date."
    : to > today ? "The end date is in the future." : null;

  const run = async () => {
    const plan: PriceLoadPart[] = splitRange(from, to).map(([start, end]) => ({ from: start, to: end }));
    setPieces(plan);
    setRunning(true);
    for (let i = 0; i < plan.length; i++) {
      try {
        const report = await api.loadPrices(plan[i].from, plan[i].to);
        plan[i] = { ...plan[i], report };
      } catch (error) {
        plan[i] = { ...plan[i], error: reason(error) };
      }
      setPieces([...plan]);
      if (plan[i].error) break;
    }
    setRunning(false);
    void status.refetch();
  };

  return (
    <Section title="Load prices"
      description="NSE's daily price file for each date in the range. Days already loaded are skipped; dates with no file (Saturdays, holidays) are reported and left.">
      {line && <p role="status" className={line.warn ? "text-sm text-loss" : "text-sm text-muted-foreground"}>{line.text}</p>}
      <div className="grid gap-4 sm:grid-cols-[12rem_12rem]">
        <Field label="From" htmlFor="prices-from">
          <Input id="prices-from" type="date" value={from} max={today} onChange={(event) => setFrom(event.target.value)} />
        </Field>
        <Field label="To" htmlFor="prices-to">
          <Input id="prices-to" type="date" value={to} max={today} onChange={(event) => setTo(event.target.value)} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => { void run(); }} disabled={running || invalid !== null}>{running ? "Loading…" : "Load prices"}</Button>
        {!invalid && !running && (
          <span className="text-sm text-muted-foreground">
            {days} day{days === 1 ? "" : "s"}{days > 62 ? `, in ${splitRange(from, to).length} parts` : ""}; about 2 seconds per date not loaded before.
          </span>
        )}
      </div>
      {invalid && <p className="text-sm text-loss">{invalid}</p>}
      {pieces.length > 0 && (
        <ol className="space-y-1 text-sm tabular-nums">
          {pieces.map((piece) => (
            <li key={piece.from} className="flex flex-wrap gap-x-3">
              <span className="text-muted-foreground">{piece.from} to {piece.to}</span>
              {piece.report ? <Counts counts={countOutcomes(piece.report.days)} />
                : piece.error ? <span role="alert" className="text-loss">{piece.error}</span>
                : <span className="text-muted-foreground">{running ? "waiting…" : "not run"}</span>}
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}

// ------------------------------------------------------------------------------------ one filing

function UploadFiling() {
  const [symbol, setSymbol] = useState("");
  const [source, setSource] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<FilingImportResult | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const company = normaliseSymbol(symbol);
  const sourceOk = /^https:\/\/nsearchives\.nseindia\.com\/\S+\.(xml|html?)$/i.test(source.trim());

  const run = async () => {
    if (!company || !file) return;
    setRunning(true);
    setProblem(null);
    setResult(null);
    try {
      setResult(await api.uploadFiling(company, source.trim(), file));
    } catch (error) {
      setProblem(reason(error));
    } finally {
      setRunning(false);
    }
  };

  return (
    <Section title="Upload one filing"
      description="Only needed if the server cannot download from NSE: a filing saved on this computer, with the NSE address it came from.">
      <div className="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)]">
        <Field label="NSE symbol" htmlFor="upload-symbol">
          <Input id="upload-symbol" value={symbol} placeholder="ITC" autoComplete="off" onChange={(event) => setSymbol(event.target.value)} />
        </Field>
        <Field label="Its NSE address" htmlFor="upload-source">
          <Input id="upload-source" value={source} placeholder="https://nsearchives.nseindia.com/corporate/…" autoComplete="off"
            onChange={(event) => setSource(event.target.value)} aria-invalid={source !== "" && !sourceOk} />
        </Field>
      </div>
      <Field label="The filing (.xml or .html, at most 2 MB)" htmlFor="upload-file">
        <Input id="upload-file" type="file" accept=".xml,.html,.htm"
          onChange={(event) => { setFile(event.target.files?.[0] ?? null); setResult(null); setProblem(null); }} />
      </Field>
      {source !== "" && !sourceOk && <p className="text-sm text-loss">The address must be an https://nsearchives.nseindia.com filing ending in .xml or .html.</p>}
      <Button onClick={() => { void run(); }}
        disabled={running || !company || !sourceOk || !file || file.size > 2 * 1024 * 1024}>
        {running ? "Uploading…" : "Upload"}
      </Button>
      {problem && <p role="alert" className="text-sm text-loss">{problem}</p>}
      {result && (
        <p className="text-sm">
          {result.outcome.toLowerCase().replace(/_/g, " ")}
          {result.periodEnd ? `: quarter ended ${result.periodEnd}, ${result.basis?.toLowerCase()}` : ""}
          {result.detail ? `: ${result.detail}` : ""}
        </p>
      )}
    </Section>
  );
}
