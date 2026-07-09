import type { ClienteConfig } from "@/lib/config/schema";

/**
 * Logo do cliente (RF-05/RF-15). Usa <img> comum porque a URL vem do KV do
 * cliente (CDN externo, RNF-17) — sem allowlist de domínio do next/image.
 * Fallback para o nome do cliente quando não há logo.
 */
export function LiveLogo({
  config,
  className,
}: {
  config: ClienteConfig;
  className?: string;
}) {
  const src = config.kv.logo || config.kv.logo_escuro;
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={config.cliente} className={className} />;
  }
  return (
    <span className="text-lg font-semibold tracking-tight">
      {config.cliente}
    </span>
  );
}
