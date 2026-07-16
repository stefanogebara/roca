/**
 * Public verification page — the "Stevi é de verdade?" trust anchor a suspicious
 * farmer (or anyone who got a message from the +1 number) can check. Flight-plan
 * S1: número exibido, responsável, CREA do agrônomo, contato LGPD.
 *
 * Identity fields (responsável, agrônomo, CREA, LGPD e-mail) are env-driven and
 * render ONLY when set — the page NEVER fabricates a professional registration
 * or a person's name. The honest disclosure content (what Stevi is, why a +1
 * number, LGPD rights) always shows. Pure; the handler injects env + serves it.
 */

/** Minimal HTML-entity escape for interpolated (env-sourced) values. */
function esc(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface VerifierConfig {
  /** WhatsApp number, any format (normalized to digits for the wa.me link). */
  waNumber: string;
  /** Who stands behind Stevi (VERIFIER_RESPONSIBLE). */
  responsible: string | null;
  /** Partner agronomist's name (VERIFIER_AGRONOMO). */
  agronomo: string | null;
  /** Agronomist's CREA registration, e.g. "CREA-MG 123456" (VERIFIER_CREA).
   *  MUST be real — the block is omitted entirely when this is absent. */
  crea: string | null;
  /** LGPD contact e-mail (VERIFIER_LGPD_EMAIL). */
  lgpdEmail: string | null;
}

export function verifierHtml(cfg: VerifierConfig): string {
  const digits = cfg.waNumber.replace(/\D/g, '');
  const tel = `+${digits}`;

  const responsibleBlock = cfg.responsible
    ? `<section><h2>Quem é responsável</h2><p>Responsável pela Stevi: <strong>${esc(cfg.responsible)}</strong>.</p></section>`
    : '';

  // The key trust anchor — only shown with a REAL CREA. Never fabricated.
  const agronomoBlock =
    cfg.crea && cfg.agronomo
      ? `<section><h2>Responsabilidade agronômica</h2>
      <p>A Stevi trabalha com agrônomo de verdade. Parceiro agronômico:
      <strong>${esc(cfg.agronomo)}</strong> — <strong>${esc(cfg.crea)}</strong>.
      É ele, registrado no CREA, que responde pela orientação técnica e pelo
      receituário quando for preciso.</p></section>`
      : '';

  const lgpdContact = cfg.lgpdEmail
    ? ` Dúvida sobre seus dados? Escreve pra <a href="mailto:${esc(cfg.lgpdEmail)}">${esc(cfg.lgpdEmail)}</a>.`
    : '';

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Verificação — Stevi, sua ajudante de lavoura</title>
<style>
  :root { --green:#14432f; --leaf:#2e7d4f; --cream:#f4efe4; --ink:#1c2b22; --muted:#5b6b60; --line:#e0d8c6; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--cream); color:var(--ink);
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    line-height:1.55; font-size:18px; }
  .wrap { max-width:640px; margin:0 auto; padding:28px 20px 56px; }
  header { text-align:center; padding:12px 0 8px; }
  .badge { font-size:15px; color:var(--leaf); font-weight:700; letter-spacing:.02em; }
  h1 { font-size:30px; line-height:1.2; margin:.3em 0 .2em; color:var(--green); }
  .lede { color:var(--muted); font-size:17px; margin:0 auto; max-width:34ch; }
  section { background:#fff; border:1px solid var(--line); border-radius:16px;
    padding:18px 20px; margin:16px 0; }
  h2 { font-size:19px; margin:0 0 .4em; color:var(--green); }
  p { margin:.5em 0; }
  .num { font-weight:700; color:var(--green); white-space:nowrap; }
  .cta { display:block; text-align:center; background:var(--green); color:#fff;
    text-decoration:none; font-weight:700; font-size:19px; padding:16px;
    border-radius:14px; margin:22px 0 8px; }
  footer { text-align:center; color:var(--muted); font-size:14px; margin-top:24px; }
  a { color:var(--leaf); }
</style>
</head>
<body>
  <div class="wrap">
    <header>
      <div class="badge">✅ VERIFICAÇÃO</div>
      <h1>Sim, a Stevi é de verdade.</h1>
      <p class="lede">Recebeu mensagem e quer confirmar antes de confiar? Desconfiar de número desconhecido é o certo. Aqui está tudo, na transparência.</p>
    </header>

    <section>
      <h2>O que é a Stevi</h2>
      <p>É uma assistente de lavoura no WhatsApp. Você manda foto de praga, pergunta se dá pra pulverizar hoje, tira dúvida de café, soja, milho e pasto — e ela ajuda a entender e a saber o que perguntar.</p>
      <p><strong>A Stevi é um robô</strong> (inteligência artificial), não uma pessoa — e ela avisa isso. E ela <strong>não receita defensivo</strong>: quem define produto e dose é o engenheiro agrônomo, com receituário.</p>
    </section>

    <section>
      <h2>Por que o número tem +1 (Estados Unidos)</h2>
      <p>Resposta honesta: o número brasileiro ainda está em processo de habilitação (exige CNPJ e trâmite de operadora). Enquanto isso, a Stevi usa um número internacional. O número é este: <span class="num">${esc(tel)}</span>. Quando o número BR ficar pronto, a gente avisa.</p>
    </section>

    ${responsibleBlock}
    ${agronomoBlock}

    <section>
      <h2>Seus dados (LGPD)</h2>
      <p>A Stevi guarda só o necessário pra te ajudar — sua localização e o histórico da conversa — com seu consentimento na primeira mensagem. Você pode pedir <strong>"apaga meus dados"</strong> a qualquer hora, e a gente apaga.${lgpdContact}</p>
    </section>

    <a class="cta" href="https://wa.me/${digits}">Falar com a Stevi no WhatsApp</a>
    <footer>Stevi — assistente do cafeicultor. Esta página existe pra você verificar antes de confiar.</footer>
  </div>
</body>
</html>`;
}
