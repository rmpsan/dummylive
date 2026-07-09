"use client";

/**
 * Gráficos SVG leves e dependency-free, temáticos via CSS variables do KV.
 * Usados no dashboard (curva de audiência, retenção, trechos).
 */

export function LineChart({
  data,
  height = 160,
}: {
  data: { t: string; online: number }[];
  height?: number;
}) {
  if (data.length < 2) {
    return <Vazio texto="Dados insuficientes para a curva." altura={height} />;
  }
  const W = 100;
  const H = 100;
  const max = Math.max(1, ...data.map((d) => d.online));
  const step = W / (data.length - 1);
  const pts = data.map((d, i) => [i * step, H - (d.online / max) * H] as const);
  const linha = pts.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ");
  const area = `0,${H} ${linha} ${W},${H}`;

  return (
    <div className="w-full" style={{ height }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full overflow-visible">
        <defs>
          <linearGradient id="dl-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--kv-primaria)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--kv-primaria)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#dl-area)" />
        <polyline
          points={linha}
          fill="none"
          stroke="var(--kv-primaria)"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-[var(--kv-texto-secundario)]">
        <span>{hora(data[0].t)}</span>
        <span>pico {max}</span>
        <span>{hora(data[data.length - 1].t)}</span>
      </div>
    </div>
  );
}

export function BarChart({
  bars,
  formatValue,
  height = 160,
}: {
  bars: { label: string; value: number; sub?: string }[];
  formatValue?: (v: number) => string;
  height?: number;
}) {
  if (!bars.length) return <Vazio texto="Sem dados." altura={height} />;
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {bars.map((b, i) => (
        <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <span className="text-[10px] font-medium text-[var(--kv-texto-secundario)]">
            {formatValue ? formatValue(b.value) : b.value}
          </span>
          <div className="flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t-[var(--r-xs)] bg-[var(--kv-primaria)] transition-all"
              style={{ height: `${(b.value / max) * 100}%`, minHeight: b.value > 0 ? 3 : 0 }}
              title={`${b.label}: ${b.value}`}
            />
          </div>
          <span className="truncate text-[10px] text-[var(--kv-texto-secundario)]">
            {b.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Faixa horizontal de "trechos assistidos" (heatmap simples). */
export function SegmentStrip({
  trechos,
}: {
  trechos: { seg: number; hits: number }[];
}) {
  if (!trechos.length) return <Vazio texto="Sem dados de trechos." altura={56} />;
  const max = Math.max(1, ...trechos.map((t) => t.hits));
  const fim = trechos[trechos.length - 1]?.seg ?? 0;
  return (
    <div>
      <div className="flex h-14 w-full items-stretch gap-px overflow-hidden rounded-[var(--r-sm)]">
        {trechos.map((t, i) => {
          const intensidade = t.hits / max;
          return (
            <div
              key={i}
              className="flex-1"
              title={`${mmss(t.seg)} — ${t.hits} amostras`}
              style={{
                background: `color-mix(in srgb, var(--kv-primaria) ${Math.round(
                  8 + intensidade * 92
                )}%, transparent)`,
              }}
            />
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-[var(--kv-texto-secundario)]">
        <span>início</span>
        <span>{mmss(fim)}</span>
      </div>
    </div>
  );
}

function Vazio({ texto, altura }: { texto: string; altura: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-[var(--r-sm)] border border-dashed border-[var(--borda)] text-xs text-[var(--kv-texto-secundario)]"
      style={{ height: altura }}
    >
      {texto}
    </div>
  );
}

function hora(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function mmss(seg: number) {
  const m = Math.floor(seg / 60);
  const s = Math.floor(seg % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
