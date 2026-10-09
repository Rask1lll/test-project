import type { BrandProps } from './Brand.types';

export default function Brand({
  compact = false,
  name = "Telegram",
}: BrandProps) {
  return (
    <div className={`brand ${compact ? "compact" : ""}`}>
      <img
        src="/favicon.svg"
        width="44"
        height="44"
        alt={compact ? name : ""}
      />
      {!compact && <span>{name}</span>}
    </div>
  );
}
