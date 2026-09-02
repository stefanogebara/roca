/**
 * Public verification page — the "Stevi é de verdade?" trust anchor a suspicious
 * farmer (or anyone who got a message from the +1 number) can check. Flight-plan
 * S1: número exibido, responsável, CREA do agrônomo, contato LGPD.
 *
 * Identity fields (responsável, agrônomo, CREA, LGPD e-mail) are env-driven and
 * render ONLY when set — the page NEVER fabricates a professional registration
 * or a person's name. The honest disclosure content (what Stevi is, why a +1
 * number, LGPD rights) always shows. Pure; the handler injects env + serves it.
 *
 * Visual: sistema de design v2 do site (web/README.md) — tinta + creme, cereja
 * uma vez, Big Shoulders Display caixa-alta. Tokens copiados de web/styles.css
 * porque esta página é servida por função, não pelo build estático.
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
  // +19705509125 → +1 (970) 550-9125, só para leitura; o teste e o link usam os dígitos.
  const telBonito =
    digits.length === 11 && digits.startsWith('1')
      ? `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
      : tel;

  const responsibleBlock = cfg.responsible
    ? `<section class="bloco"><h2>Quem é responsável</h2><p>Responsável pela Stevi: <strong>${esc(cfg.responsible)}</strong>.</p></section>`
    : '';

  // The key trust anchor — only shown with a REAL CREA. Never fabricated.
  const agronomoBlock =
    cfg.crea && cfg.agronomo
      ? `<section class="bloco"><h2>Responsabilidade agronômica</h2>
      <p>A Stevi trabalha com agrônomo de verdade. Parceiro agronômico:
      <strong>${esc(cfg.agronomo)}</strong> — <span class="dado">${esc(cfg.crea)}</span>.
      É ele, registrado no CREA, que responde pela orientação técnica e pelo
      receituário quando for preciso.</p></section>`
      : '';

  const lgpdContact = cfg.lgpdEmail
    ? ` Dúvida sobre seus dados? Escreve pra <a href="mailto:${esc(cfg.lgpdEmail)}">${esc(cfg.lgpdEmail)}</a>.`
    : '';

  const waHref = `https://wa.me/${digits}?text=${encodeURIComponent('Oi, Stevi! Vi a página de verificação.')}`;

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#15130F">
<title>Verificação — a Stevi é de verdade</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@900&family=Hanken+Grotesk:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap" rel="stylesheet">
<style>
  /* Tokens do sistema de design v2 (web/styles.css). */
  :root { --creme:#F4F0E4; --creme-2:#EAE4D2; --tinta:#15130F; --tinta-2:#2A2620; --cinza:#6D675C;
    --cinza-claro:#A9A292; --linha:rgba(21,19,15,.14); --linha-escura:rgba(244,240,228,.18); --cereja:#D6321B;
    --display:"Big Shoulders Display","Arial Narrow",Impact,sans-serif; --corpo:"Hanken Grotesk","Helvetica Neue",Arial,sans-serif;
    --mono:"IBM Plex Mono",ui-monospace,Menlo,monospace; --ease:cubic-bezier(.32,.72,0,1); }
  * { box-sizing:border-box; }
  html { color-scheme:light; -webkit-text-size-adjust:100%; }
  body { margin:0; background:var(--creme); color:var(--tinta); font-family:var(--corpo); font-size:17px; line-height:1.55;
    -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility; }
  a { color:inherit; }
  :focus-visible { outline:3px solid var(--cereja); outline-offset:3px; }
  .container { width:100%; max-width:860px; margin-inline:auto; padding-inline:24px; }
  @media (max-width:767px) { .container { padding-inline:20px; } }

  /* Topo escuro — mesma voz do hero do site */
  .topo { background:var(--tinta); color:var(--creme); padding:28px 0 56px; }
  .wordmark { font-family:var(--display); font-weight:900; text-transform:uppercase; font-size:1.6rem; letter-spacing:.01em;
    text-decoration:none; display:inline-flex; align-items:baseline; gap:.15em; }
  .wordmark i { width:.38em; height:.38em; border-radius:50%; background:var(--cereja); transform:translateY(.06em); }
  .rotulo { margin:40px 0 14px; font-size:.78rem; font-weight:600; letter-spacing:.12em; text-transform:uppercase; color:var(--cinza-claro); }
  h1 { font-family:var(--display); font-weight:900; text-transform:uppercase; line-height:.86; letter-spacing:-.01em; margin:0;
    font-size:clamp(3.5rem,11vw,7.5rem); text-wrap:balance; }
  .lede { font-size:clamp(1.125rem,1.6vw,1.375rem); line-height:1.4; font-weight:500; max-width:38ch; margin:24px 0 0; color:var(--creme); }
  .numero { margin-top:28px; display:flex; flex-wrap:wrap; gap:10px 18px; align-items:center; }
  .numero .num { font-family:var(--mono); font-weight:500; font-size:1.25rem; letter-spacing:.02em; color:var(--creme); white-space:nowrap; }
  .numero small { color:var(--cinza-claro); font-size:.9375rem; }

  /* Blocos — linhas, não cartões com sombra */
  main { padding:8px 0 48px; }
  .bloco { padding:28px 0; border-bottom:1px solid var(--linha); }
  .bloco:first-child { border-top:0; }
  h2 { font-family:var(--display); font-weight:900; text-transform:uppercase; line-height:.9; letter-spacing:-.01em; margin:0 0 12px;
    font-size:clamp(1.75rem,4vw,2.5rem); }
  p { margin:.6em 0 0; color:var(--cinza); max-width:62ch; }
  p strong { color:var(--tinta); font-weight:600; }
  .dado { font-family:var(--mono); font-weight:500; font-size:max(.875rem,.9em); background:var(--creme-2); color:var(--tinta);
    padding:.15em .5em; border-radius:6px; white-space:nowrap; }
  ul { margin:.6em 0 0; padding:0; list-style:none; display:grid; gap:10px; }
  li { display:grid; grid-template-columns:auto 1fr; gap:14px; color:var(--cinza); }
  li b { font-family:var(--mono); font-weight:500; font-size:.875rem; color:var(--tinta); padding-top:.2em; }

  /* CTA — pílula do site */
  .btn { display:inline-flex; align-items:center; justify-content:center; gap:.5em; min-height:48px; padding:0 22px;
    border:1px solid var(--tinta); border-radius:999px; background:var(--tinta); color:var(--creme); text-decoration:none;
    font:500 1rem/1 var(--corpo); white-space:nowrap; transition:background-color .35s var(--ease), transform .35s var(--ease); }
  .btn::after { content:"↗"; font-weight:600; }
  .btn:hover { background:var(--tinta-2); transform:translateY(-1px); }
  .cta { padding:36px 0 0; display:flex; flex-wrap:wrap; gap:16px 24px; align-items:center; }
  .cta small { color:var(--cinza); font-size:.9375rem; max-width:34ch; }
  footer { border-top:1px solid var(--linha); padding:24px 0 40px; color:var(--cinza); font-size:.875rem; }
  footer .tag { font-family:var(--display); font-weight:900; text-transform:uppercase; font-size:1.5rem; line-height:.9; color:var(--tinta); display:block; margin-bottom:8px; }
  @media (prefers-reduced-motion:reduce) { .btn { transition:none; } }
</style>
</head>
<body>
  <header class="topo">
    <div class="container">
      <a class="wordmark" href="/">Stevi<i aria-hidden="true"></i></a>
      <p class="rotulo">Verificação</p>
      <h1>Sim, a Stevi<br>é de verdade.</h1>
      <p class="lede">Recebeu mensagem e quer confirmar antes de confiar? Desconfiar de número desconhecido é o certo. Aqui está tudo, na transparência.</p>
      <p class="numero"><span class="num">${esc(telBonito)}</span><small>o número que te escreveu — <span class="num" style="font-size:.9375rem">${esc(tel)}</span></small></p>
    </div>
  </header>

  <main class="container">
    <section class="bloco">
      <h2>O que é a Stevi</h2>
      <p>É uma assistente de lavoura no WhatsApp. Você manda foto de praga, pergunta se dá pra pulverizar hoje, tira dúvida de café, soja, milho e pasto — e ela ajuda a entender e a saber o que perguntar.</p>
      <p><strong>A Stevi é um robô</strong> (inteligência artificial), não uma pessoa — e ela avisa isso. E ela <strong>não receita defensivo</strong>: quem define produto e dose é o engenheiro agrônomo, com receituário.</p>
    </section>

    <section class="bloco">
      <h2>Por que o número tem +1</h2>
      <p>Resposta honesta: o número brasileiro ainda está em processo de habilitação (exige CNPJ e trâmite de operadora). Enquanto isso, a Stevi usa um número internacional, dos Estados Unidos. O número é este: <span class="dado">${esc(tel)}</span>. Quando o número BR ficar pronto, a gente avisa.</p>
    </section>

    ${responsibleBlock}
    ${agronomoBlock}

    <section class="bloco">
      <h2>Seus dados (LGPD)</h2>
      <p>A Stevi guarda só o necessário pra te ajudar — sua localização e o histórico da conversa — e te aviso disso na primeira conversa. Você pode pedir <strong>"apaga meus dados"</strong> a qualquer hora, e a gente apaga.${lgpdContact}</p>
      <p><strong>Quem mais participa:</strong> a conversa acontece dentro do WhatsApp (Meta). Pra Stevi funcionar, seus dados passam por provedores de tecnologia:</p>
      <ul>
        <li><b>IA</b><span><strong>inteligência artificial hospedada nos Estados Unidos</strong> — é ela que lê sua foto e entende sua pergunta.</span></li>
        <li><b>infra</b><span>servidor e banco de dados.</span></li>
        <li><b>WhatsApp</b><span>a <strong>Kapso</strong>, plataforma que a gente usa pra gerenciar o WhatsApp — as mensagens da conta passam por ela.</span></li>
      </ul>
      <p>Eles tratam seus dados só pra prestar esse serviço.</p>
    </section>

    <div class="cta">
      <a class="btn" href="${waHref}">Falar com a Stevi no WhatsApp</a>
      <small>O WhatsApp abre com a mensagem já escrita — é só enviar.</small>
    </div>
  </main>

  <footer>
    <div class="container">
      <span class="tag">Triagem, não prescrição.</span>
      Stevi — assistente agronômica no WhatsApp. Esta página existe pra você verificar antes de confiar.
    </div>
  </footer>
</body>
</html>`;
}
