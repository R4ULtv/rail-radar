const FILLED = "▰";
const EMPTY = "▱";
const CELLS = 5;
const CELL_INDEXES = Array.from({ length: CELLS }, (_, index) => index);

export default function MapLoading() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <span className="relative inline-flex items-center justify-center text-accent font-mono text-3xl leading-none tracking-tighter tabular-nums md:text-2xl">
        <span aria-hidden="true" className="inline-flex">
          {CELL_INDEXES.map((index) => (
            <span key={index} className="map-loading-cell relative inline-block">
              <span>{EMPTY}</span>
              <span
                className="map-loading-cell-fill absolute inset-0"
                style={{ animationDelay: `${(index - 1) * 120}ms` }}
              >
                {FILLED}
              </span>
            </span>
          ))}
        </span>
        <span role="status" aria-live="polite" className="sr-only">
          Loading
        </span>
      </span>
    </div>
  );
}
