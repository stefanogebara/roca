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
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=Fragment+Mono&display=swap" rel="stylesheet">
<style>
  /* Campo Editorial — same tokens as web/styles.css (just-br-derived). */
  :root { --paper:#fdfcfb; --wash:#f7fbeb; --ink:#0c0c0c; --muted:#4f4e4b;
    --olive:#4c5e03; --olive-dark:#303b0c; --chip:#e8f4c3; --line:#e3e0dc; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--paper); color:var(--ink);
    font-family:'DM Sans', system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    line-height:1.55; font-size:17px; -webkit-font-smoothing:antialiased; }
  .wrap { max-width:640px; margin:0 auto; padding:32px 20px 64px; }
  header { text-align:center; padding:16px 0 8px; }
  .badge { display:inline-flex; align-items:center; gap:.5rem;
    font-family:'Fragment Mono', ui-monospace, monospace; font-size:12px;
    letter-spacing:.12em; text-transform:uppercase; color:var(--olive); }
  .badge .dot { width:7px; height:7px; border-radius:50%; background:var(--olive);
    box-shadow:0 0 0 4px var(--chip); }
  h1 { font-size:clamp(30px, 7vw, 40px); font-weight:400; letter-spacing:-.03em;
    line-height:1.12; margin:.4em 0 .25em; color:var(--ink); }
  .lede { color:var(--muted); font-size:17px; margin:0 auto; max-width:36ch; }
  section { background:#fff; border:1px solid var(--line); border-radius:10px;
    padding:20px 22px; margin:16px 0; box-shadow:0 4px 50px rgba(97,74,68,.06); }
  h2 { font-size:19px; font-weight:500; letter-spacing:-.01em; margin:0 0 .4em; color:var(--olive-dark); }
  p { margin:.5em 0; }
  .num { font-family:'Fragment Mono', ui-monospace, monospace; font-weight:400;
    color:var(--olive); white-space:nowrap; background:var(--wash);
    padding:.05em .4em; border-radius:6px; }
  .cta { display:block; text-align:center; background:var(--olive); color:#fff;
    text-decoration:none; font-weight:600; font-size:18px; padding:16px 24px;
    border-radius:999px; margin:24px 0 8px; cursor:pointer;
    transition:background-color .2s ease; }
  .cta:hover { background:var(--olive-dark); }
  .cta:focus-visible, a:focus-visible { outline:3px solid var(--olive); outline-offset:3px; }
  footer { text-align:center; color:var(--muted); font-size:14px; margin-top:28px; }
  a { color:var(--olive); }
  @media (prefers-reduced-motion: reduce) { .cta { transition:none; } }
</style>
</head>
<body>
  <div class="wrap">
    <header>
      <div class="badge"><span class="dot"></span>Verificação</div>
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
