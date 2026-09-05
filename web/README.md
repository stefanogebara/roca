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

Duas famílias, três vozes de mono. Não existe terceira família.

- **Display — Big Shoulders Display 900.** Condensada, caixa-alta,
  `line-height: .88`, `letter-spacing: -.03em`. h1 `--h1` (`clamp(5rem, 15.5vw,
  15rem)`), só no hero. **Todo h2 tem o mesmo tamanho**, `--h2`
  (`clamp(3.25rem, 7.5vw, 7rem)`), em largura cheia — inclusive "1,2 °C",
  "Lei 14.785" e o fecho. Aparece também na marca dos documentos (1.5rem), nas
  coordenadas do cartão e nos `dt` das regras (~2.25rem). Nunca em minúsculas.
- **Mono — IBM Plex Mono 400/500/600**, para tudo o mais, em três tamanhos:
  - **Rótulo** (`--meta`, 12px, 500, caixa-alta, `letter-spacing: .1em`): o
    número da seção, a legenda-ledger, a cabeça do documento, quem falou, o
    cabeçalho da tabela. Uma classe de voz, sempre igual.
  - **Corpo** (16px/1.55): prosa das seções, `dd` das regras, tabela (15px).
  - **Documento** (`--doc-s`, 18px/1.5): o texto dentro do cartão, do alerta,
    da resposta e das falas. É o que o produtor recebe; é o maior texto corrido.
  - O lede do hero é `--lede` (20–26px, 500). Notas e rodapé, 13px.

## Componentes

- **Rótulo** (`.rotulo`): numeral, régua de 28px, texto. Abre toda seção.
- **Ledger** (`.ledger`): a legenda de três células — *quem · quando · onde* —
  sob toda foto, sob a curva e sob o cartaz. Mesmo tamanho, mesma posição.
- **Lâmina** (`.lamina` + `.foto`): uma foto com o ledger. **Uma série só**:
  todas em preto e branco, contraste 1.15, grão (SVG `feTurbulence` em
  `multiply`). Três na página: folha (1:1, hero), talhão com geada (4:5, seção
  escura, `.foto--noite` mais fechada), balcão da cooperativa (3:2, 04).
- **Documento** (`.doc`): cabeça (marca Stevi + tipo + data, fio forte
  embaixo), texto a 18px, pé em 13px com fio fraco. Variante `.doc--claro`
  sobre a tinta. A pergunta do produtor entra como `.doc__pergunta`.
- **Cartão** (`.cartao`): documento com as coordenadas em display e uma
  `table.tabela` Leitura/Valor/Fonte, tudo alinhado à esquerda, sem quebra de
  linha no desktop; no mobile some a coluna Fonte.
- **Curva** (`.curva`): SVG inline da temperatura horária prevista (18h→08h),
  eixos em fio fraco, mínima marcada com o único círculo cereja da página.
  Dado, não ornamento: o papel milimetrado foi removido por isso.
- **Regras** (`.regras`): três linhas `dt` display / `dd` corpo, com fios.
- **Fio** (`.fio--chat`): a conversa numa coluna de 640px, Stevi à esquerda,
  produtor à direita (`.fala--eu`, em cinza). Só aparece uma vez (05).
- **Cartaz** (`.cartaz`): folha A4 (`aspect-ratio: 1/1.4142`) em `--papel`,
  marcas de corte nos cantos, sombra curta de objeto impresso, QR real com
  `mix-blend-mode: multiply`, canhotos destacáveis em `writing-mode` vertical.
- **Barra** (`.barra`): a ação. Faixa preta com o texto a 17–22px, a nota em
  rótulo e a seta. **A mesma no hero e no fecho**; hover vai a cereja. É o
  único lugar em que o acento entra como fundo.
- **Botão** (`.btn`): só no header. 44px de altura mínima, raio 2px, 1px de
  borda. `.btn--sm` herda o piso de 44px.
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
