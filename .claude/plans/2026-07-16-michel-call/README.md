# Ligação Michel — one-pager (20 min, voz)

**Michel Silva (Gaia Tech) · Espera Feliz, Caparaó-MG · café · raio 60 km.**
**Objetivo da ligação:** destravar os 4 leads parados, fechar o acordo
parceiro-fundador, e sair com 1 visita marcada até sexta. Ele é o parceiro nº 1
— o molde de todos os próximos.

## Abertura (1 min — tom: parceiro, zero cobrança)

> "Michel, tô montando a rede de agrônomos da Stevi e você é o primeiro — quero
> acertar o modelo COM você antes de escalar. Tenho 4 produtores da sua região
> esperando contato e queria entender como fazer isso funcionar pro seu dia."

## Parte 1 — Diagnóstico dos 4 leads parados (5 min, sem culpa)

- Pergunta aberta: **"o que travou?"** (hipóteses: não viu o template / número
  desconhecido / formato ruim / semana cheia). A resposta dele redesenha o fluxo.
- **Ação NA HORA:** ele responde a mensagem da Stevi no WhatsApp durante a
  ligação → isso abre a janela de 24h → os dossiês pendentes chegam sozinhos.
- Avisar: a Stevi **re-consenta os 4 produtores** antes de qualquer entrega
  (pode ter esfriado — LGPD e respeito).

## Parte 2 — O acordo (8 min): grátis até agosto, em troca de 5 coisas

Leads do Caparaó **de graça até agosto**. Em troca:

1. **SLA de contato: 48h** por lead aceito (a Stevi já me avisa lead parado >24h).
2. **QA agronômico: 15 min/semana** validando as respostas-padrão da Stevi (o
   "golden set" — 36 casos; hoje 0 verificados). Nome dele como responsável técnico.
3. **Depoimento** depois do 1º fechamento (1 áudio de 30s serve).
4. **2 intros:** 1 cooperativa + 1 revenda da região (com quem ele já tem porta).
5. **Convidar a carteira dele** pra Stevi (link com token `vim pelo Michel`) —
   densidade de produtores = os leads futuros são DELE.

O que ele ganha: leads qualificados e consentidos na área dele, dossiê pronto
(cultura, região, histórico, fotos), a Stevi como assistente da carteira dele, e
o nome dele na página de verificação como responsável técnico.

## Parte 3 — Capturar na ligação (2 min)

- [ ] **CREA dele** (número + UF) → vai pra página pública de verificação
      (`/verificar`) como âncora de confiança. Pedir permissão explícita.
- [ ] Melhor **dia/horário fixo** pros 15 min de QA semanal.
- [ ] **1 visita a produtor marcada até sexta** (o objetivo-meta da ligação).
- [ ] Como ele prefere avaliar cada lead: "atendido / fechado / fraco" (a Stevi
      já registra `outcome` e `lead_grade` — vira o histórico que justifica preço).

## Preço — SÓ depois do 1º fechamento (não nesta ligação, salvo ele puxar)

> "A partir do próximo: **R$50 por produtor aceito** — continua fazendo sentido?"

Se ele puxar preço antes: "primeiro quero te ver fechar um — aí conversamos com
número real na mesa."

## Não fazer

- Não culpar pelos leads parados (o silêncio é diagnóstico, não falha).
- Não prometer feature nova na ligação (anotar e trazer depois).
- Não falar de preço antes do 1º fechamento (regra pré-registrada do plano).
- Não publicar o número cru da Stevi — sempre o cartão .vcf / link tokenizado.

## Depois da ligação (mesmo dia)

- Registrar `VERIFIER_CREA` / `VERIFIER_AGRONOMO` na Vercel (página completa).
- Mandar pra ele: o cartão de contato (`/api/vcard`) + link tokenizado da
  carteira + o resumo do acordo em 5 linhas por WhatsApp.
- Stevi re-consenta os 4 produtores → dossiês fluem no reply dele.

---

## Plano B — por mensagem (escolhido 16/jul: fundador prefere não ligar)

Trade-off assumido: mensagem perde um pouco de taxa de fechamento vs. voz, mas
custa 60 segundos. **As mensagens saem do WhatsApp PESSOAL do fundador** (Michel
conhece o Stefano — o acordo não pode vir do robô). A máquina resolve o resto
sozinha: qualquer reply dele pra Stevi abre a janela de 24h → os 4 dossiês
entregam automaticamente → fundador é alertado (🤝).

### Sequência (copiar-colar, 4 mensagens)

**1 — abre:**
> Michel! Aqui é o Stefano, da Stevi. Não vou te tomar tempo com ligação — dá
> pra resolver tudo por aqui mesmo. 👊
> Tenho **4 produtores de café da tua região** que pediram agrônomo pela Stevi
> e autorizaram passar o contato. Tão te esperando.

**2 — a ação (anexar o .vcf de `roca-black.vercel.app/api/vcard`):**
> Pra eles chegarem até você é só responder qualquer coisa ("oi" serve) pra
> Stevi nesse contato aqui 👇
> Na hora ela te manda o resumo de cada produtor — cultura, região, o que ele
> precisa. Sem app, sem cadastro, só WhatsApp.

**3 — o acordo:**
> O acordo que te proponho, bem simples: **leads do Caparaó de graça até
> agosto.** Em troca: você tenta contato em até 48h, me dá 15 min por semana
> validando as respostas técnicas da Stevi (teu nome como responsável técnico
> dela), e depois do teu primeiro fechamento a gente conversa sobre seguir. Se
> fizer sentido pra você, me apresenta 1 cooperativa e 1 revenda da região
> também.

**4 — o CREA:**
> Última coisa: tô publicando a página de verificação da Stevi (produtor
> desconfiado confere lá quem responde por ela). Quero colocar teu nome como
> agrônomo responsável — **me passa teu CREA (número e UF)?** Publico só com
> tua autorização. 🙏

### O que acontece depois do envio (tudo automático)

- Michel responde à Stevi → dossiês fluem → fundador recebe o alerta 🤝.
- Silêncio ≥24h num lead aceito → SLA pinga o fundador.
- CREA chegar → colar pro Claude → `VERIFIER_*` na Vercel → página completa.
- **Silêncio total por ~2 dias = diagnóstico** → a ligação de 20 min vira o
  fallback (roteiro acima), não o default.

### Guard-rails (inalterados)

- **Preço não entra** nas mensagens — regra pré-registrada: só depois do 1º
  fechamento dele.
- Lead >1 semana parado no momento do reply dele → avisar o Claude ANTES do
  dossiê sair (re-consentimento do produtor).
