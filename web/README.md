# Stevi — site e sistema de design (v2.6, set/2026)

> Refeito do zero em 02/09/2026. Referência estudada a fundo (Playwright +
> espelho local + leitura de CSS/JS): **zipline.com**. O que se trouxe de lá é
> o **ritmo** e a **escala**, não a marca. Nada do site anterior ("Terra e
> Folha") sobreviveu de propósito.
>
> Site estático, sem build de framework: HTML + CSS + um `app.js` pequeno.
> `node scripts/build-web.mjs` copia `web/` para `public/` e injeta o número
> do WhatsApp (`PUBLIC_WA_NUMBER`). Publicar é fazer merge no master.

## O que a leitura do Zipline ensinou (e o que se leva)

Mecânica medida no site deles: Next.js + GSAP ScrollTrigger + Lenis + SplitText;
header fixo transparente de 80px; hero em vídeo full-bleed que "escorre" por
baixo da seção seguinte; uma seção **pinada de 10.800px** onde uma imagem
escala 2→1 enquanto o título por trás cai a 10% de opacidade; três vídeos
verticais que sobem um a um; seção preta com títulos cruzando por opacidade e
imagens em máscara de lente; contadores; rodapé creme. Tipografia brutal
(display condensada 900, caixa-alta, 150px no h1, line-height 85%) sobre
**duas cores só** — creme `#f7f4e8` e preto — com um acento (violeta) usado
seis vezes na página inteira. Easing `cubic-bezier(.32,.72,0,1)`, `.35s`.

**Leva-se:** hero humano (uma pessoa, um gesto — não glamour aéreo) → seção
pinada de casos → prova → como funciona → "por quê" no escuro → números → CTA;
escala tipográfica que não pede desculpa; alternância creme/escuro; movimento
dirigido pelo scroll; um vídeo por seção-chave; acento gasto uma vez.

**Não se leva:** violeta, FK Screamer, copy, fotos, GSAP. Aqui o movimento é
CSS + um driver de scroll de 60 linhas, porque o público abre isto em Android
barato, no meio da lavoura, e cada kilobyte é fricção.

## Conceito: "Manda a foto." — o caderno de campo

O gesto do produto é mandar uma foto da folha pelo WhatsApp, e o que volta é
um documento: um cartão, um alerta, uma resposta, uma conversa. O site é esse
caderno. Papel creme, tinta, duas famílias tipográficas, fios de 1px. Cada
seção abre com o título em largura cheia e desce para uma grade de duas
colunas: **prosa à esquerda, um documento datado à direita**. Nada é "card":
os documentos são cabeça + texto + pé, separados por fios, como impresso.

A honestidade ("quem receita é o agrônomo") não é rodapé jurídico: é a seção
03 (Lei 14.785), a resposta que a Stevi dá quando perguntam "e o que eu passo
nela?", e o fecho ("Triagem, não prescrição."). Os textos dos documentos são
os que o produto de fato manda (`api/_lib/alerts.ts`, `growth.ts`) e o QR do
cartaz vem do endpoint real (`/api/qr`).

## Cor

Duas cores fazem 98% do site. O acento aparece **três vezes** na página
inteira: o ponto do wordmark, a marca da Stevi na cabeça dos documentos e o
ponto final da última linha. Não entra em botão, fio, hover de texto corrido.

| Token | Hex | Uso |
|---|---|---|
| `--creme` | `#F4F0E4` | Fundo. Palha de chapéu, saca de juta. |
| `--papel` | `#FBF8EF` | A folha do cartaz (um tom mais claro que o fundo). |
| `--tinta` | `#15130F` | Texto, barras, a seção escura. Café torrado, não preto puro. |
| `--cinza` | `#5F5A50` | Texto secundário e a fala do produtor. |
| `--cinza-claro` | `#A9A292` | Secundário sobre a tinta. |
| `--linha` | `rgba(21,19,15,.18)` | Fios fracos. `--linha-escura` sobre a tinta. Fios fortes são `--tinta` sólido. |
| `--cereja` | `#D6321B` | **O acento.** Cereja madura do café. Três usos por página. |

Sobre escuro, o texto é `--creme`; sobre claro, `--tinta`. Contraste AA em
todos os pares. `color-scheme: light` — a seção escura **é** o desenho, não
um tema.

## Tipografia (Google Fonts, `display=swap`)

Uma display e a superfamília Plex. Duas vozes de texto, decididas por quem
escreve: **a máquina escreve em mono, a pessoa lê em serifa.**

- **Display — Big Shoulders Display 900.** Condensada, caixa-alta,
  `line-height: .88`, `letter-spacing: -.03em`. h1 `--h1` (`clamp(5rem, 15.5vw,
  13rem)`), só no hero. **Todo h2 tem o mesmo tamanho**, `--h2`
  (`clamp(2.5rem, 7.5vw, 7rem)`), em largura cheia — inclusive "1,2 °C" e o
  fecho. Quebras de linha marcadas à mão por breakpoint (`<br class="d">` só
  no desktop, `<br class="m">` só no celular): condensada não pode quebrar no
  meio da frase. Aparece também na marca dos documentos (1.5rem), nas
  coordenadas do cartão (~2.5rem) e nas perguntas da 05 (~3rem).
- **Serifa — IBM Plex Serif 400/500/600** é a fonte do `body` (17px/1.6): o
  lede, a prosa das seções, as explicações das regras, o texto dentro dos
  documentos e as respostas (`--doc-s`, 18px/1.5). É o que uma pessoa lê.
- **Mono — IBM Plex Mono 400/500/600** para tudo o que a máquina escreve:
  rótulo, legenda-ledger, cabeça e pé de documento, tabela, notas, navegação,
  rodapé, a barra. Dois tamanhos: **rótulo** (`--meta`, 13px, 500, caixa-alta,
  `letter-spacing: .1em`) e **nota** (`--mono-s`, 14px). A lista de seletores
  que recebem mono está num único bloco no topo de `styles.css`.

## Componentes

- **Rótulo** (`.rotulo`): numeral, régua de 28px, texto. Abre toda seção.
- **Ledger** (`.ledger`): a legenda de três células em mono, sem fio. Só sob
  o cartaz ("A4 · O cartaz do balcão · Impressão em preto"). Coordenadas só no
  cartão, onde são evidência.
- **A troca** (`.fio--hero`): o objeto do hero é a conversa real — o
  produtor manda a foto da folha às 08:11, a Stevi responde às 08:12 com a
  triagem (texto do produto). A foto vai **em cor** dentro da fala: ferrugem
  se diagnostica pela cor; preto e branco contradiria a resposta. É a única
  foto da página. A foto é gerada; por isso não leva legenda com coordenada
  (fingiria proveniência) e o `aria-label` diz "ilustração".
- **Documento** (`.doc`, `.cartao`): a "tira" — o que a Stevi manda tem a
  mesma forma: caixa de 1px em `--papel`, cabeça (marca Stevi + tipo + data,
  fio forte embaixo), texto em serifa a 18px, pé em mono 15px com fio fraco.
  Variante `.doc--claro` sobre a tinta. São três na página: o cartão (01), o
  alerta (02) e "Quem responde" no rodapé. Sem sombra: sombra vira mockup.
- **Citação** (`.citacao`): a resposta da Stevi na 03 é uma citação, não uma
  tira — pergunta do produtor em itálico, resposta em serifa, a lei como nota.
- **Carimbos** (`.carimbos`): "Não receita. / Não inventa. / Mostra a fonte."
  em display (~4rem) com a definição ao lado, em linhas com fio.
- **Cartão** (`.cartao`): documento com as coordenadas em display e uma
  `table.tabela` Leitura/Valor/Fonte, tudo alinhado à esquerda, sem quebra de
  linha no desktop; no mobile some a coluna Fonte.
- **Curva** (`.curva`): o instrumento da página. SVG inline da temperatura
  horária prevista (18h→08h) em largura cheia; a linha de 3 °C tracejada em
  cereja; a faixa sombreada cobre exatamente o trecho abaixo de 3 °C; o
  "1,2 °C" em display senta em cima da mínima, com uma linha até o ponto.
  Dois SVGs (desktop 1280×480, celular 400×300) porque texto em SVG não
  escala bem. Dado, não ornamento: o papel milimetrado foi removido por isso.
- **Perguntas** (`.regras--faq`): pergunta em serifa itálica, resposta em
  serifa, em linhas com fio. Sem carimbo de hora: não é uma conversa, é uma
  lista. Três perguntas; a de "receita defensivo?" a 03 já responde.
- **Cartaz** (`.cartaz`): folha A4 (`aspect-ratio: 1/1.4142`) em `--papel`,
  fio de 1px, QR real com `mix-blend-mode: multiply`, canhotos destacáveis em
  `writing-mode` vertical. Na 04 fica ao lado do título e do texto, na mesma
  altura. No celular o QR encolhe e ganha um toque "Abrir no WhatsApp"
  (`.cartaz__toque`): o telefone não lê o próprio QR; os canhotos somem.
- **Barra** (`.barra`): a ação. Faixa com o rótulo em display (`--display-s`),
  a nota em mono e a seta, numa linha só. **A mesma no hero (preta) e no fecho
  (creme sobre tinta)**; hover vai a cereja. É o único lugar em que o acento
  entra como fundo.
- **Link do header** (`.site-header__wa`): texto mono sublinhado, 44px de
  altura mínima. O `.btn` continua no CSS para as páginas internas.
- Container 1360px, gutter 32px (20px no mobile). Raio 0 em tudo salvo o
  botão. Sem sombras, salvo a do cartaz.

## Movimento

- Easing única: `cubic-bezier(.32,.72,0,1)`. Duração `.35s` em hover,
  `.7s` em revelação.
- **Revelação** (`.reveal`): opacidade + 18px de subida, via
  `IntersectionObserver`, com `data-delay` 1–3. Títulos display usam máscara
  de linha (`.mask > span` sobe de 110%); a máscara tem padding no topo para
  não cortar acentos (Ô, Á, Ç).
- **Header** troca de claro/escuro por seção (`data-theme` observado) e fica
  sólido depois de 8px de scroll. Seções têm `scroll-margin-top` do header.
- `app.js` ainda carrega o driver de `[data-pin]`, contadores e vídeo do
  hero — nada na página atual usa; ficam para o painel e para as páginas
  internas.
- `prefers-reduced-motion: reduce` desliga tudo e revela tudo.

## Regra anti-página-em-branco (tests/landing-sem-js.test.ts)

O inline no `<head>` seta `.js` e, se `app.js` não sinalizar
`window.__steviApp` em 3s, remove `.js` — conteúdo escondido por
`.js .reveal { opacity: 0 }` volta sozinho. 2G rural é o cenário normal.

## Mídia

`web/media/`: fotos `.jpg` + `.webp` (1920px). **Na landing entram três, uma
vez cada**: `leaf-rust` (hero), `frost` (seção escura), `coop` (04). Repetir
foto entre seções é regra quebrada (Stefano, 02/09). As demais (aérea, noite,
terreiro, agrônoma, retrato, vídeos do hero) ficam para o painel, o
`/verificar` e os cards. Geradas no Higgsfield (Nano Banana Pro / Soul v2) em
02/09/2026. O QR do cartaz é `/api/qr` (gerado no servidor com o número
público), não um PNG estático.

## Acessibilidade

Skip-link, um `<h1>`, hierarquia correta, foco visível (anel `--cereja`),
alvos de toque ≥ 44px (tests/landing-alvos-de-toque.test.ts), `alt` em toda imagem, vídeo decorativo `aria-hidden`. Sem overflow
horizontal de 320px a 1440px.
