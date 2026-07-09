/**
 * Rodapé institucional da Dummy Filmes — crédito da agência, presente em
 * TODAS as páginas (fica no root layout, fora do tema white-label do cliente).
 * Estilo próprio e neutro (não usa as variáveis --kv do cliente) para manter
 * a identidade da Dummy consistente em qualquer evento.
 *
 * Mensagem-chave: da captação à plataforma de transmissão, é tudo Dummy Filmes.
 */
export function DummyFooter() {
  return (
    <footer className="dummy-footer">
      <div className="dummy-footer__inner">
        <div className="dummy-footer__brand">
          <span className="dummy-footer__eyebrow">Desenvolvido por</span>
          <a
            href="https://dummyfilmes.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="dummy-footer__logo"
          >
            Dummy&nbsp;Filmes
          </a>
          <p className="dummy-footer__tagline">
            Da captação à plataforma de transmissão ao vivo — produção,
            tecnologia e experiência do início ao fim, tudo com a Dummy Filmes.
          </p>
        </div>

        <div className="dummy-footer__cta">
          <a
            href="https://dummyfilmes.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="dummy-footer__btn"
          >
            Fale com a Dummy Filmes
            <span aria-hidden>→</span>
          </a>
          <a
            href="https://dummyfilmes.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="dummy-footer__link"
          >
            dummyfilmes.com.br
          </a>
        </div>
      </div>
    </footer>
  );
}
