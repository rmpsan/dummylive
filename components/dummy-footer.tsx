/**
 * Crédito discreto da Dummy Filmes — uma única linha sutil, presente em todas
 * as páginas (root layout). Identidade neutra, sem competir com o cliente.
 */
export function DummyFooter() {
  return (
    <footer className="dummy-footer">
      <span>Desenvolvido por</span>
      <a
        href="https://dummyfilmes.com.br"
        target="_blank"
        rel="noopener noreferrer"
      >
        Dummy Filmes
      </a>
    </footer>
  );
}
