import Link from "next/link";

export default function Home() {
  return (
    <main className="dl-ambient flex min-h-[var(--app-vh)] flex-col items-center justify-center px-6 text-center">
      <div className="dl-anim-up flex max-w-2xl flex-col items-center gap-6">
        <span className="dl-pill">
          <span className="dl-live-dot" /> Dummy Live
        </span>
        <h1 className="text-4xl font-bold sm:text-6xl">
          Transmissões ao vivo,
          <br />
          <span className="bg-gradient-to-r from-[var(--kv-primaria)] to-[var(--kv-destaque)] bg-clip-text text-transparent">
            com a marca do seu cliente.
          </span>
        </h1>
        <p className="max-w-xl text-lg text-[var(--kv-texto-secundario)]">
          Uma plataforma, infinitos clientes. Cada live é 100% personalizada por
          um arquivo de configuração — sem tocar em código.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/demo" className="dl-btn dl-btn-primary">
            Ver live de demonstração →
          </Link>
          <Link href="/demo/staff" className="dl-btn dl-btn-ghost">
            Área da equipe
          </Link>
        </div>
      </div>
    </main>
  );
}
