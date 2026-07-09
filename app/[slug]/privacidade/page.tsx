import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveTenant } from "@/lib/config/loader";
import { LiveLogo } from "@/components/live-logo";

const ATUALIZACAO = "julho de 2026";
const OPERADOR = "Dummy Filmes";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const t = await resolveTenant(slug);
  return { title: `Política de Privacidade — ${t?.config.cliente ?? "Dummy Live"}` };
}

export default async function PrivacidadePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await resolveTenant(slug);
  if (!tenant) redirect("/");
  const controlador = tenant.config.cliente;
  const contato = tenant.config.acesso.contato_privacidade;

  return (
    <main className="min-h-[var(--app-vh)] px-5 py-10 safe-top safe-bottom">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <header className="flex flex-col items-center gap-4 text-center">
          <LiveLogo config={tenant.config} className="max-h-12 w-auto" />
          <h1 className="font-[family-name:var(--kv-font-titulo)] text-3xl font-bold">
            Política de Privacidade
          </h1>
          <p className="text-sm text-[var(--kv-texto-secundario)]">
            {controlador} · Última atualização: {ATUALIZACAO}
          </p>
        </header>

        <div className="dl-card space-y-6 p-6 text-sm leading-relaxed text-[var(--kv-texto-secundario)] sm:p-8">
          <p>
            Esta Política de Privacidade descreve como os seus dados pessoais são
            tratados quando você acessa a transmissão ao vivo, em conformidade
            com a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados — LGPD).
          </p>

          <Secao titulo="1. Quem trata os seus dados">
            <p>
              <strong className="text-[var(--kv-texto)]">Controlador:</strong>{" "}
              {controlador}, organizador do evento, que decide sobre o tratamento
              dos seus dados.
            </p>
            <p>
              <strong className="text-[var(--kv-texto)]">Operador:</strong>{" "}
              {OPERADOR}, responsável pela plataforma de transmissão, que trata os
              dados em nome e sob as instruções do Controlador.
            </p>
          </Secao>

          <Secao titulo="2. Dados que coletamos">
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong className="text-[var(--kv-texto)]">Cadastro de acesso:</strong>{" "}
                e-mail, nome completo e, quando exigido pelo evento, CPF.
              </li>
              <li>
                <strong className="text-[var(--kv-texto)]">Dados de participação:</strong>{" "}
                tempo assistido, marcos do vídeo alcançados, entradas e saídas,
                interações (mensagens no chat, reações) e horários.
              </li>
              <li>
                <strong className="text-[var(--kv-texto)]">Dados técnicos:</strong>{" "}
                tipo de dispositivo, sistema operacional, navegador, resolução de
                tela, fuso horário e endereço IP.
              </li>
              <li>
                <strong className="text-[var(--kv-texto)]">Conteúdo do chat:</strong>{" "}
                as mensagens que você envia durante a transmissão.
              </li>
            </ul>
          </Secao>

          <Secao titulo="3. Para que usamos">
            <ul className="list-disc space-y-1 pl-5">
              <li>Autenticar o seu acesso e liberar a transmissão aos inscritos.</li>
              <li>Viabilizar a experiência ao vivo (vídeo, chat e interações).</li>
              <li>Medir audiência e engajamento, inclusive de forma agregada.</li>
              <li>Garantir segurança, moderação e prevenção a abusos.</li>
            </ul>
          </Secao>

          <Secao titulo="4. Base legal">
            <p>
              Tratamos os seus dados com base no seu{" "}
              <strong className="text-[var(--kv-texto)]">consentimento</strong>{" "}
              (fornecido na tela de acesso) e no{" "}
              <strong className="text-[var(--kv-texto)]">legítimo interesse</strong>{" "}
              do Controlador para métricas agregadas de audiência e segurança da
              transmissão, sempre respeitando os seus direitos.
            </p>
          </Secao>

          <Secao titulo="5. Compartilhamento">
            <p>
              Não vendemos os seus dados. Eles podem ser processados por
              prestadores que viabilizam o serviço, como a infraestrutura de
              banco de dados e tempo real (Supabase) e a plataforma de vídeo
              (Vimeo ou YouTube, conforme o evento), que atuam como
              suboperadores. O Controlador pode acessar os relatórios de
              participação do evento.
            </p>
          </Secao>

          <Secao titulo="6. Retenção">
            <p>
              Os dados brutos de participação são mantidos pelo período
              necessário à apuração de resultados do evento (em regra, até 90
              dias), e as métricas agregadas por até 12 meses. Após esses prazos,
              os dados são eliminados ou anonimizados, salvo obrigação legal.
            </p>
          </Secao>

          <Secao titulo="7. Seus direitos (art. 18 da LGPD)">
            <p>
              Você pode, a qualquer momento, solicitar: confirmação e acesso aos
              seus dados; correção de dados incompletos ou desatualizados;
              anonimização, bloqueio ou eliminação; portabilidade; informação
              sobre compartilhamento; e revogação do consentimento.
            </p>
          </Secao>

          <Secao titulo="8. Segurança">
            <p>
              Adotamos medidas técnicas e organizacionais para proteger os seus
              dados, incluindo criptografia em trânsito (TLS) e em repouso,
              controle de acesso por papéis e isolamento entre eventos. Nenhum
              sistema é 100% infalível, mas trabalhamos para reduzir riscos.
            </p>
          </Secao>

          <Secao titulo="9. Cookies">
            <p>
              Utilizamos um cookie estritamente necessário para manter a sua
              sessão de acesso durante a transmissão. Ele não é usado para
              publicidade.
            </p>
          </Secao>

          <Secao titulo="10. Conteúdo e público">
            <p>
              O acesso é pessoal e destinado a maiores de 18 anos. O conteúdo
              pode ter impacto emocional; em caso de sensibilidade, recomenda-se
              cautela.
            </p>
          </Secao>

          <Secao titulo="11. Contato">
            <p>
              Para exercer seus direitos ou tirar dúvidas sobre privacidade, fale
              com {controlador}
              {contato ? (
                <>
                  {" "}pelo canal:{" "}
                  <strong className="text-[var(--kv-texto)]">{contato}</strong>.
                </>
              ) : (
                <> pelo canal de atendimento informado na sua inscrição.</>
              )}
            </p>
          </Secao>

          <Secao titulo="12. Alterações">
            <p>
              Esta Política pode ser atualizada. A data de última atualização
              acima indica a versão vigente.
            </p>
          </Secao>
        </div>

        <div className="text-center">
          <Link
            href={`/${slug}`}
            className="text-xs text-[var(--kv-texto-secundario)] underline-offset-4 hover:underline"
          >
            ← Voltar
          </Link>
        </div>
      </div>
    </main>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-[family-name:var(--kv-font-titulo)] text-base font-semibold text-[var(--kv-texto)]">
        {titulo}
      </h2>
      {children}
    </section>
  );
}
