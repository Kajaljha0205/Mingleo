export function Wordmark({
  tone = "dark",
  className = "",
}: {
  tone?: "dark" | "light";
  className?: string;
}) {
  return (
    <span
      className={`font-display text-[28px] leading-none font-extrabold tracking-[-0.02em] ${
        tone === "light" ? "text-white" : "text-charcoal"
      } ${className}`}
    >
      mingleo<span className="text-mingle-blue">.</span>
    </span>
  );
}
