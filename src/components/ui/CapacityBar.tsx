/** Segmented capacity bar: one segment per spot, filled for each person going (host included). */
export function CapacityBar({ going, limit }: { going: number; limit: number }) {
  return (
    <div
      role="meter"
      aria-label="Spots filled"
      aria-valuemin={0}
      aria-valuemax={limit}
      aria-valuenow={going}
      aria-valuetext={`${going} of ${limit} going`}
      className="flex gap-1"
    >
      {Array.from({ length: limit }, (_, i) => (
        <span key={i} className={`h-1.5 flex-1 rounded-full ${i < going ? "bg-blue-600" : "bg-border"}`} />
      ))}
    </div>
  );
}
