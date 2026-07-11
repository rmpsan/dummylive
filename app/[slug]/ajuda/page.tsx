import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveTenant } from "@/lib/config/loader";
import { LiveLogo } from "@/components/live-logo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const t = await resolveTenant(slug);
  return { title: `Ajuda — ${t?.config.cliente ?? "Dummy Live"}` };
}

interface QA {
  icone: string;
  pergunta: string;
  resposta: React.ReactNode;
}

export default async function AjudaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await resolveTenant(slug);
  if (!tenant) redirect("/");
  const contato = tenant.config.acesso.contato_privacidade;

  const faq: QA[] = [
    {
      icone: "🔊",
      pergunta: "Não estou ouvindo o áudio",
      resposta: (
        <>
          O vídeo começa <strong className="text-[var(--kv-texto)]">sem som</strong>{" "}
          (regra do navegador). Toque no botão{" "}
          <strong className="text-[var(--kv-texto)]">“Ativar som”</strong> que
          aparece sobre o vídeo. Verifique também o volume do seu aparelho.
        </>
      ),
    },
    {
      icone: "🔄",
      pergunta: "A imagem travou ou está lenta",
      resposta: (
        <>
          <strong className="text-[var(--kv-texto)]">Recarregue a página</strong>{" "}
          (tecla <strong className="text-[var(--kv-texto)]">F5</strong> no
          computador, ou puxe a tela para baixo no celular). A transmissão volta
          sozinha para o ponto <strong className="text-[var(--kv-texto)]">ao
          vivo</strong>. Se persistir, tente uma conexão mais estável.
        </>
      ),
    },
    {
      icone: "⏳",
      pergunta: "O vídeo não aparece / ainda não começou",
      resposta: (
        <>
          Se a transmissão ainda não começou, você verá uma imagem de espera com
          a contagem regressiva. Fique nesta página —{" "}
          <strong className="text-[var(--kv-texto)]">ela começa
          automaticamente</strong> na hora marcada, sem precisar atualizar.
        </>
      ),
    },
    {
      icone: "🔑",
      pergunta: "Não consigo entrar",
      resposta: (
        <>
          Confira o <strong className="text-[var(--kv-texto)]">e-mail</strong> e a{" "}
          <strong className="text-[var(--kv-texto)]">senha do evento</strong> (a
          mesma para todos os inscritos, enviada na sua inscrição). Não esqueça de
          preencher o nome e marcar a caixa de autorização.
        </>
      ),
    },
    {
      icone: "⛶",
      pergunta: "Como coloco em tela cheia",
      resposta: (
        <>
          Use o botão de <strong className="text-[var(--kv-texto)]">tela cheia</strong>{" "}
          no canto do vídeo. Para sair da tela cheia, toque novamente ou use a
          tecla <strong className="text-[var(--kv-texto)]">Esc</strong>.
        </>
      ),
    },
    {
      icone: "💬",
      pergunta: "Minha mensagem no chat não envia",
      resposta: (
        <>
          Existe um pequeno intervalo entre mensagens (para evitar spam). Aguarde
          alguns segundos e tente de novo. Verifique também a sua conexão.
        </>
      ),
    },
    {
      icone: "❤️",
      pergunta: "Como faço para reagir",
      resposta: (
        <>
          Toque nos <strong className="text-[var(--kv-texto)]">emojis</strong> na
          barra de reações, logo abaixo do vídeo. Sua reação aparece para todos.
        </>
      ),
    },
    {
      icone: "📶",
      pergunta: "Como ter a melhor experiência",
      resposta: (
        <>
          Use <strong className="text-[var(--kv-texto)]">fones de ouvido</strong>,
          uma conexão estável (Wi-Fi ou 4G/5G) e um navegador atualizado (Chrome,
          Safari ou Edge). Fechar outras abas pesadas também ajuda.
        </>
      ),
    },
    {
      icone: "🚪",
      pergunta: "Como saio da transmissão",
      resposta: (
        <>
          Use o botão <strong className="text-[var(--kv-texto)]">“Sair”</strong> no
          topo da página. Para voltar, é só fazer login novamente com os mesmos
          dados.
        </>
      ),
    },
  ];

  return (
    <main className="min-h-[var(--app-vh)] px-5 py-10 safe-top safe-bottom">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <header className="flex flex-col items-center gap-4 text-center">
          <LiveLogo config={tenant.config} className="max-h-12 w-auto" />
          <span className="dl-pill">Central de ajuda</span>
          <h1 className="font-[family-name:var(--kv-font-titulo)] text-3xl font-bold">
            Dúvidas frequentes
          </h1>
          <p className="max-w-md text-sm text-[var(--kv-texto-secundario)]">
            Respostas rápidas para os probleminhas mais comuns durante a
            transmissão ao vivo.
          </p>
        </header>

        <div className="flex flex-col gap-3">
          {faq.map((q, i) => (
            <section key={i} className="dl-card flex gap-4 p-5">
              <span className="text-2xl leading-none" aria-hidden>
                {q.icone}
              </span>
              <div className="space-y-1.5">
                <h2 className="font-[family-name:var(--kv-font-titulo)] text-base font-semibold text-[var(--kv-texto)]">
                  {q.pergunta}
                </h2>
                <p className="text-sm leading-relaxed text-[var(--kv-texto-secundario)]">
                  {q.resposta}
                </p>
              </div>
            </section>
          ))}
        </div>

        <div className="dl-card p-5 text-center text-sm text-[var(--kv-texto-secundario)]">
          Ainda com problema? Fale com a organização
          {contato ? (
            <>
              {" "}pelo canal:{" "}
              <strong className="text-[var(--kv-texto)]">{contato}</strong>.
            </>
          ) : (
            <> pelo canal de atendimento informado na sua inscrição.</>
          )}
        </div>

        <div className="flex items-center justify-center gap-4">
          <Link
            href={`/${slug}/sala`}
            className="dl-btn dl-btn-primary px-4 py-2 text-sm"
          >
            ← Voltar à transmissão
          </Link>
          <Link
            href={`/${slug}`}
            className="text-xs text-[var(--kv-texto-secundario)] underline-offset-4 hover:underline"
          >
            Ir para o início
          </Link>
        </div>
      </div>
    </main>
  );
}
