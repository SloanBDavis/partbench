export function ViewportCandidateList({
  index,
  rows,
  limited,
  capped,
  announcement,
  choose
}: {
  readonly index: number;
  readonly rows: readonly string[];
  readonly limited: boolean;
  readonly capped: boolean;
  readonly announcement?: string;
  readonly choose: (index: number) => void;
}) {
  if (limited) {
    return (
      <p className="viewport-candidates" role="status">
        Limit: select body.
      </p>
    );
  }
  if (rows.length === 0) return null;
  return (
    <section className="viewport-candidates">
      {announcement ? <p role="status">{announcement}</p> : null}
      {capped ? <p role="status">64 max; filter/move view.</p> : null}
      <select
        aria-label="Candidates"
        aria-keyshortcuts="N"
        size={Math.min(rows.length, 6)}
        value={index}
        onChange={(event) => choose(event.currentTarget.selectedIndex)}
      >
        {rows.map((row, index) => (
          <option key={index} value={index}>
            {row}
          </option>
        ))}
      </select>
    </section>
  );
}
