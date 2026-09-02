# Stevi — site e sistema de design (v2, set/2026)

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

## Conceito: "Manda a foto."

O gesto do produto é mandar uma foto da folha pelo WhatsApp. O site inteiro é
esse gesto: o hero é um cafeicultor virando uma folha com ferrugem pra luz, o
h1 é a instrução, e cada seção mostra o que acontece depois. A honestidade
("quem receita é o agrônomo") não é rodapé jurídico: aparece no hero, na
seção "por quê" e nos números (**0 receitas**).

Ancorado no assunto: as fotos e vídeos são do Sul de Minas — arábica em curva
de nível, Latossolo vermelho, geada de madrugada, armazém de cooperativa. Os
dados exibidos são os que o produto de fato manda (`phraseSpray`, a saudação
de entrada, o formato do veredito Delta T).

## Cor

Duas cores fazem 95% do site. O acento aparece **uma vez por dobra**, no
máximo.

| Token | Hex | Uso |
|---|---|---|
| `--creme` | `#F4F0E4` | Fundo claro. Palha de chapéu, saca de juta. |
| `--creme-2` | `#EAE4D2` | Faixa alternada, fundo de chip. |
| `--tinta` | `#15130F` | Fundo escuro e texto. Café torrado, não preto puro. |
| `--tinta-2` | `#2A2620` | Superfície sobre a tinta (balão de chat). |
| `--cinza` | `#6D675C` | Texto secundário. Cinza com viés quente. |
| `--linha` | `rgba(21,19,15,.14)` | Fios sobre claro. `--linha-escura` sobre escuro. |
| `--cereja` | `#D6321B` | **O acento.** Cereja madura do café. Um uso por dobra. |
| `--folha` | `#2E6E3C` | Semântico "pode" (veredito Delta T). Nunca decorativo. |

Sobre escuro, o texto é `--creme`; sobre claro, `--tinta`. Contraste AA em
todos os pares. `color-scheme: light` — o site não tem tema escuro porque as
seções escuras **são** o desenho.

## Tipografia (Google Fonts, `display=swap`, com fallback `size-adjust`)

- **Display — Big Shoulders Display 800/900.** Condensada, pesada, caixa-alta,
  `line-height: .86`, `letter-spacing: -.01em`. É a voz do site. h1
  `clamp(4rem, 12vw, 11rem)`; h2 `clamp(3rem, 8vw, 7rem)`; h3
  `clamp(2.25rem, 5vw, 4.25rem)`. Nunca em minúsculas, nunca abaixo de 32px.
- **Corpo — Hanken Grotesk 400/500/600.** Lede 22px/1.4 (500); corpo 17px/1.55;
  UI 14–15px/500. Largura de leitura ≤ 62ch.
- **Rótulos** — Hanken 600, 12.5px, caixa-alta, `letter-spacing: .12em`.
- **Dados — IBM Plex Mono 500** nos chips de leitura (`Delta T 6.0 °C`,
  `pH 5.2`). Piso de 14px (`.tag--data`), porque é o conteúdo que mais importa.

## Espaço, forma, componentes

- Container 1320px, gutter 24px (20px no mobile). Grade de 8px.
- Seção: `padding-block: clamp(4rem, 10vw, 8rem)`. Seções pinadas: wrapper de
  `300–400vh` com filho `position: sticky; top: 0; height: 100svh`.
- **Botão-pílula** (`.btn`): 44px de altura mínima, `border-radius: 999px`,
  1px de borda na cor do texto, 15px/500, seta `↗` à direita. Sólido = fundo
  na cor do texto invertida. Variante `.btn--sm` herda o piso de 44px.
- **Cartão de conversa**: fundo `--tinta-2`, balões com radius 18px, texto real
  do produto, timestamp em mono.
- **Máscara de lente**: `clip-path` com duas curvas convexas (ver `.lente`),
  usada na seção escura. É o único ornamento do site.
- Raio: 0 em blocos, 20px em painéis de mídia, 999px em pílulas. Sem sombras
  — profundidade vem de contraste e escala.

## Movimento

- Easing única: `cubic-bezier(.32,.72,0,1)`. Duração `.35s` em hover,
  `.7s` em revelação.
- **Driver de scroll** (`app.js`): para cada `[data-pin]`, calcula o progresso
  0→1 do wrapper na viewport e escreve `--p` no elemento. O CSS deriva tudo de
  `--p` com `calc()` e `clamp()` — escala da imagem, opacidade dos títulos,
  translação dos painéis. Sem biblioteca, sem `requestAnimationFrame` solto:
  um listener passivo de scroll com `ticking`.
- **Revelação** (`.reveal`): opacidade + 24px de subida, via
  `IntersectionObserver`. Títulos display usam máscara de linha
  (`.mask > span` sobe de 100%).
- **Contadores** sobem de 0 quando entram na viewport (só números inteiros).
- **Header** troca de claro/escuro por seção (`data-theme` observado).
- `prefers-reduced-motion: reduce` desliga tudo e revela tudo; `--p` vira 1.

## Regra anti-página-em-branco (tests/landing-sem-js.test.ts)

O inline no `<head>` seta `.js` e, se `app.js` não sinalizar
`window.__steviApp` em 3s, remove `.js` — conteúdo escondido por
`.js .reveal { opacity: 0 }` volta sozinho. 2G rural é o cenário normal.

## Mídia

`web/media/`: `hero-desktop.{mp4,webm}` (1600px, 1,5 MB), `hero-mobile.mp4`
(720px, 0,5 MB), `rows-desktop.mp4`, posters `.jpg`, fotos `.jpg` + `.webp`
(1920px; 720px nas verticais do telefone). **Cada imagem aparece uma vez só
na página** — ferrugem, geada e fileiras na seção "ela vê"; mão com celular,
áudio e drone nos painéis do telefone; noite estrelada na faixa; agrônoma,
retrato e aérea na lente; terreiro nos números; armazém nas cooperativas.
Repetir foto entre seções é regra quebrada (Stefano, 02/09). Vídeos são `autoplay muted loop playsinline` com `poster`; o mobile
recebe a versão 9:16. Gerados no Higgsfield (Kling 3.0 pro / Nano Banana Pro /
Soul v2) em 02/09/2026 e transcodificados com libx264 crf 27 / VP9 crf 34.

## Acessibilidade

Skip-link, um `<h1>`, hierarquia correta, foco visível (anel `--cereja`),
alvos de toque ≥ 44px (tests/landing-alvos-de-toque.test.ts), `<details>` no
FAQ, `alt` em toda imagem, vídeo decorativo `aria-hidden`. Sem overflow
horizontal de 320px a 1440px.
