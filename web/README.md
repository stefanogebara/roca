# Stevi — landing page & sistema de design

> Documentação do site estático em `web/` e do seu sistema de design.
> (Pedido originalmente como `DESIGN.md`; nomeado `README.md` porque o hook do
> repositório bloqueia `.md` novos que não sejam README.)

Site estático, sem build: só HTML + CSS + um JS pequeno de progressive
enhancement. Português (pt-BR). Publicar a pasta `web/` como estático (root =
`web/`) — sem toolchain.

## Conceito: "Terra e Folha"

Stevi é uma assistente agronômica que vive no WhatsApp e cuja marca é a
**honestidade** ("triagem, não prescrição"). O visual precisava ser **enraizado,
caloroso e confiável — mas moderno e limpo**, longe tanto do SaaS corporativo
frio quanto do clichê de agro (trator de desenho, verde-limão).

A metáfora é a própria terra brasileira: o **Latossolo** vermelho-terracota e a
**folha** verde-profunda sobre a luz de um campo (bege quente). O motivo gráfico
recorrente é uma **curva de nível topográfica** (contorno de relevo) em marca
d'água — sugere "conhecer o terreno" sem nenhuma ilustração literal.

A prova viva do produto são **mockups reais de conversa no WhatsApp**: todo o
texto da Stevi nos balões é o texto que o produto realmente envia (extraído de
`api/_lib/*`: `phraseSpray`, `buildFarmCard`, o portão de conformidade, a
janela Delta T e o vazio sanitário da Portaria SDA/MAPA nº 1.579/2026). Nada de
copy de vitrine.

## Paleta

Escolhida para contraste WCAG AA sobre o bege quente e nos balões de chat.

### Neutros (quentes)
| Token | Hex | Uso |
|---|---|---|
| `--bone` | `#FBF7EF` | Fundo da página |
| `--bone-2` | `#F4EDDE` | Faixa alternada (FAQ) |
| `--bone-3` | `#EDE4D2` | — |
| `--card` | `#FFFFFF` | Cards |
| `--ink` | `#211C14` | Texto principal (~15:1 no bege) |
| `--ink-2` | `#574E3F` | Texto secundário (~7:1) |
| `--ink-3` | `#857A66` | Legendas/apoio |
| `--line` | `#E7DECB` | Fios/bordas |

### Folha (verde) — cor primária
| Token | Hex | Uso |
|---|---|---|
| `--green-050` | `#E8F1EA` | Tints, chips de dado |
| `--green-100` | `#CFE4D5` | Bordas em hover |
| `--green` | `#1C6B43` | Botões, links, ação (branco AA, ~5.9:1) |
| `--green-deep` | `#103E28` | Cabeçalho do chat, texto sobre claro |
| `--green-900` | `#0C2E1E` | Fundo das seções escuras, rodapé |

### Terra (terracota / Latossolo) — acento
| Token | Hex | Uso |
|---|---|---|
| `--terra-050` | `#F8E8DF` | Tints |
| `--terra` | `#B8482A` | Acento: eyebrow, faixa CTA, detalhes (branco ~4.7:1) |
| `--terra-deep` | `#8F3A22` | Gradiente da faixa CTA |

### Sol/trigo (decorativo, uso mínimo)
`--wheat #D9A54B` — acentos sobre fundo escuro (tagline do rodapé, ícones da
seção de honestidade). Não usar como texto sobre claro.

### Semânticos (veredito Delta T / vazio)
| | Cor | Fundo | Texto |
|---|---|---|---|
| Go | `--go #1E7A3E` | `--go-bg #E4F1E7` | `--go-ink #14622F` |
| Atenção | `--caution #B4620E` | `--caution-bg #FAEEDB` | `--caution-ink #8C4C0A` |
| Não | `--nogo #B3261E` | `--nogo-bg #FBE7E5` | `--nogo-ink #8C1E17` |

### Chat
`--chat-bg #ECE4D3` (com micro-pontilhado), balão da Stevi `#FFFFFF`, balão do
produtor `#D9EAD0` (verde suave, "WhatsApp-ish" mas da nossa marca), timestamp
`#8A9384`.

## Tipografia

Via Google Fonts (`<link>`), com `display=swap`. Deliberadamente **sem
Inter/Roboto** (genéricos de IA).

> Tipografia alinhada à do seatable.one (mesma família da hero): **Instrument
> Serif + DM Sans + JetBrains Mono**.

- **Display — Instrument Serif** (serifada leve, só peso 400 + itálico): H1/H2/H3
  de seção, wordmark, pull-quote. `font-synthesis: none` para nunca "engrossar"
  artificialmente — a serifada leve em tamanho grande É o visual. Itálico como
  acento (a palavra "entender", "não", a tagline).
- **Corpo/UI — DM Sans**: legível em tela barata de Android. Todo o texto
  corrido, botões, nav, cards.
- **Dados — JetBrains Mono**: leituras de instrumento — `Delta T 6.5 °C`,
  `pH ~5.2`, `Vento 16 km/h`, chips de fonte. Reforça a precisão técnica.

**Escala** fluida com `clamp()` (mobile-first):
`H1 clamp(2.35→4.25rem)`, `H2 clamp(1.8→2.85rem)`, `H3 1.2rem`,
corpo `1.0625rem` (17px) / lede `1.3rem`, eyebrow `.8125rem` caixa-alta.
Corpo com `line-height 1.6` para leitura confortável.

## Ritmo, forma e profundidade

- **Espaçamento**: grade de 8px (`--s1..--s9`, `.25rem`→`6rem`). Seções com
  padding vertical `clamp(3.5rem, 8vw, 6.5rem)`.
- **Raio**: `--r-sm .5` · `--r .9` · `--r-lg 1.25` · `--r-xl 1.75rem` · pill.
- **Sombra**: quente (tinta/verde em baixa opacidade, nunca preto puro).
  Escala `--sh-sm → --sh-lg`; `--sh-phone` para os aparelhos.
- **Motivo**: `--contour`, um SVG de curvas de nível em data-URI, usado como
  marca d'água discreta (hero, seções escuras, faixa CTA).

## Movimento

- **Scroll-reveal** (fade + subida) via `IntersectionObserver` em `app.js`,
  com **stagger** nos balões do chat (cascata que dá vida à conversa).
- **Micro-interações**: hover sobe botões/cards 2–4px; nav com sublinhado
  animado; sombra do cabeçalho fixo reforça no scroll.
- **Progressive enhancement**: sem JS, tudo aparece normalmente (o estado
  oculto só se aplica quando `.js` está presente).
- **`prefers-reduced-motion: reduce`**: desliga transições e revela tudo.
- Easing: `cubic-bezier(.16,1,.3,1)`.

## Acessibilidade

- HTML semântico (`header/main/section/nav/footer/figure/details`), 1 só `<h1>`,
  hierarquia de headings correta.
- Skip-link "Pular para o conteúdo"; foco visível (anel terracota).
- Contraste AA conferido para texto sobre bege, verde e terracota.
- Toda imagem é SVG inline com `role`/`aria-label` (ex.: a foto da folha, o
  card de localização) ou `aria-hidden` quando decorativa. Zero `<img>` sem alt.
- FAQ com `<details>`/`<summary>` nativos (teclado de graça).
- Alvos de toque grandes; testado sem overflow horizontal de 320px a 1440px.

## Favicon e imagem social (OG)

- **`favicon.svg`** — mark "app-tile": quadrado arredondado verde com um broto
  (caule + duas folhas) em creme e uma semente terracota. Casa o "assistente no
  celular" com a agronomia; legível a 16px. O mesmo mark aparece inline no
  cabeçalho, no avatar do chat e no rodapé (variantes de cor).
- **`og-image.png`** (1200×630) — gerada renderizando `og-template.html` num
  navegador headless (Playwright) e capturando a viewport. Traz o wordmark, a
  promessa, o chip "Triagem, não prescrição.", a linha de fundamentação e um
  card de veredito Delta T. Preferi PNG a SVG porque Facebook/WhatsApp/X não
  renderizam OG em SVG de forma confiável. Para regenerar: sirva `web/` e
  capture `og-template.html` a 1200×630 (ver "Preview"). ~208 KB.

## Arquivos (`web/`)

| Arquivo | O que é |
|---|---|
| `index.html` | A página inteira (todas as seções, pt-BR, semântica). |
| `styles.css` | Sistema de design + componentes (tokens, chat, gauge, responsivo). |
| `app.js` | Scroll-reveal + sombra do header. Sem dependências. |
| `favicon.svg` | Ícone da marca. |
| `og-image.png` | Imagem social 1200×630 (gerada). |
| `og-template.html` | Fonte da OG (renderizada headless; **não** é página do site). |
| `README.md` | Este documento (o "DESIGN.md"). |

## Como pré-visualizar localmente

Site estático — qualquer servidor HTTP serve. Da pasta `web/`:

```bash
python -m http.server 8848
# abra http://localhost:8848/
```

`file://` também abre, mas um servidor evita qualquer surpresa com caminhos.
As fontes carregam do Google Fonts (precisa de internet); tudo mais é local.

## Decisões e ressalvas

- **Números com ponto** (`11.2 °C`) e não vírgula: é exatamente o que o produto
  emite hoje (`toFixed` em `deltaT.ts`). Fidelidade ao artefato real > convenção
  de locale — foi decisão consciente.
- **Farm card**: usei um exemplo do MT em julho/2026 (vazio sanitário ativo até
  06/09), coerente com `calendar.ts` na data de hoje.
- **Contato**: o WhatsApp (beta) é o canal real; `oi@stevi.agr.br` é placeholder,
  marcado "(em breve)" e **não** é link, pra não haver link quebrado.
- **Número do WhatsApp**: sandbox Twilio (`join indeed-region`), sinalizado como
  beta em toda CTA. Trocar quando migrar pro WhatsApp Cloud API.
- **Deixei de fora de propósito**: framework/toolchain (robustez e deploy zero-
  risco), fotos raster (todo o "arte" é SVG leve), e qualquer alegação de que o
  Stevi prescreve — o oposto é o argumento central da página.
