import Link from "next/link";

export default function NotFound() {
  return (
    <main className="dl-ambient flex min-h-[var(--app-vh)] flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="dl-anim-up flex flex-col items-center gap-5">
        <span className="dl-pill">Transmissão não encontrada</span>
        <h1 className="text-5xl font-bold sm:text-7xl">404</h1>
        <p className="max-w-sm text-[var(--kv-texto-secundario)]">
          Esta live não existe ou o endereço está incorreto. Verifique o link
          que você recebeu.
        </p>
        <Link href="/" className="dl-btn dl-btn-ghost">
          ← Início
        </Link>
      </div>
    </main>
  );
}
