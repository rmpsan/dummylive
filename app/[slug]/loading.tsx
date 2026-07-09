export default function Loading() {
  return (
    <div className="flex min-h-[var(--app-vh)] flex-col items-center justify-center gap-4">
      <div
        className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--borda)] border-t-[var(--kv-primaria)]"
        role="status"
        aria-label="Carregando"
      />
      <p className="text-sm text-[var(--kv-texto-secundario)]">Carregando…</p>
    </div>
  );
}
