import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useUnderlyingSearch } from "./hooks";
import type { UnderlyingSearchItem } from "@/types/api";

export function UnderlyingSearch({ selected, onSelect }: {
  selected: UnderlyingSearchItem | null;
  onSelect: (item: UnderlyingSearchItem) => void;
}) {
  const [query, setQuery] = useState(selected?.symbol ?? "");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const search = useUnderlyingSearch(query);
  const items = search.data?.items ?? [];

  useEffect(() => {
    setQuery(selected?.symbol ?? "");
  }, [selected?.code, selected?.exchange]);

  const choose = (item: UnderlyingSearchItem) => {
    onSelect(item);
    setQuery(item.symbol);
    setOpen(false);
  };

  return (
    <div className="builder-underlying relative" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
      <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="underlying-search">
        Underlying
      </label>
      <div className="flex items-center rounded-md border border-border bg-background px-3">
        <Search className="size-4 text-muted-foreground" />
        <input
          id="underlying-search"
          role="combobox"
          aria-expanded={open}
          aria-controls="underlying-results"
          aria-autocomplete="list"
          value={query}
          placeholder="Symbol or company name"
          className="w-full bg-transparent px-2 py-2 text-sm outline-none"
          onFocus={() => setOpen(query.trim().length > 0)}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); setActiveIndex(0); }}
          onKeyDown={(event) => {
            if (!open) return;
            if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((value) => Math.min(items.length - 1, value + 1)); }
            if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((value) => Math.max(0, value - 1)); }
            if (event.key === "Enter" && items[activeIndex]) { event.preventDefault(); choose(items[activeIndex]); }
            if (event.key === "Escape") setOpen(false);
          }}
        />
      </div>

      {open && query.trim() && (
        <div id="underlying-results" role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-md border border-border bg-popover p-1 shadow-xl">
          {search.isLoading && <p className="p-3 text-sm text-muted-foreground">Searching catalogue…</p>}
          {search.isError && <p className="p-3 text-sm text-loss">Catalogue unavailable. Retry your search.</p>}
          {!search.isLoading && !search.isError && items.length === 0 && (
            <p className="p-3 text-sm text-muted-foreground">No matching NSE stock or index.</p>
          )}
          {items.map((item, index) => (
            <button key={`${item.exchange}:${item.code}`} type="button" role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(item)}
              className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm ${index === activeIndex ? "bg-accent" : "hover:bg-accent"}`}>
              <span><strong>{item.symbol}</strong><span className="ml-2 text-muted-foreground">{item.name}</span></span>
              <span className="ml-3 whitespace-nowrap text-xs text-muted-foreground">
                {item.isIndex ? "Index" : item.exchange} · {item.hasOptions === true ? "Options" : item.hasOptions === false ? "No listed options" : "Options unknown"}
              </span>
            </button>
          ))}
          {search.data?.warnings.map((warning) => <p key={warning} className="p-2 text-xs text-amber-600">{warning}</p>)}
        </div>
      )}
    </div>
  );
}
