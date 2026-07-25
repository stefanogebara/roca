# Audit digest — 13 result lines


---
## UI/UX Web — landing, painel ops e páginas públicas

**Área:** UI/UX Web — landing, painel ops e páginas públicas  |  **Nota:** 6

**Veredito:** O artesanato visual é genuinamente bom — design system coeso ("Campo Editorial"), a11y básica correta, página leve e sem framework — mas a landing é uma máquina de conversão apontada para o alvo errado: converte só fazendeiro curioso, tem ZERO prova social, zero caminho para o parceiro (coop/agrônomo) que é o modelo de negócio, e o único CTA leva a um número +1 com copy contraditória sobre "código de sandbox". O painel ops é operacional de verdade (não vitrine), mas tem um ponto cego grave pós-outage: nenhuma visibilidade de saúde do sistema, e o copy hardcoded "Disparo automático ativo" mente enquanto PROSPECT_DAILY_CAP=0 pausa tudo. Detalhe revelador do nível de cuidado: a landing chama a Stevi de "ele" em 5 lugares.

**Forças:**
- Design system disciplinado e consistente entre landing, painel e /verificar (tokens 'Campo Editorial', mesma paleta olive/paper em todas as superfícies)
- A11y acima da média para landing de startup: skip-link, :focus-visible, prefers-reduced-motion, aria-labels nos mockups de chat, HTML semântico, funciona 100% sem JS (public/app.js é progressive enhancement puro)
- Painel serve a operação real de 2 founders: strip 'O que fazer hoje' com fila de trabalho, funis clicáveis, dry-run de disparo, toggle assumir/religar agente da Vitória — não é dashboard de vaidade
- /verificar é uma ideia rara e bem executada: página de confiança que NUNCA fabrica CREA (blocos env-driven que somem se não configurados, valores escapados — api/_lib/verifierPage.ts:44-52)
- Página leve (~70KB HTML+CSS+JS, sem framework, sem tracker) — coerente com a promessa de 'conexão de campo'

**Findings:**
- [HIGH][M] **Landing não tem caminho nem prova social para o parceiro (coop/agrônomo) — o lado B do modelo de negócio**
  - Evidência: public/index.html inteiro: nenhuma seção 'sou agrônomo/cooperativa', nenhum CTA B2B, zero depoimento, zero número de uso, zero logo. Grep por 'Michel|CREA|verificar' em index.html: nenhum match — o trust anchor CREA-ES existe só em /verificar, que a landing nunca linka. Um prospect que recebe o template da Vitória e googla a Stevi cai numa página 100% farmer, em vercel.app, com número de teste +1.
  - Arquivos: C:\Users\stefa\roca\public\index.html, C:\Users\stefa\roca\api\_lib\verifierPage.ts
  - Recomendação: Adicionar seção 'Para agrônomos e cooperativas' com Michel (CREA-ES) como âncora de responsabilidade técnica, CTA próprio de parceria, e linkar /verificar no footer e na nota do hero. É a página que valida o funil outbound inteiro.
- [HIGH][M] **Painel não tem NENHUMA visão de saúde do sistema — e o copy hardcoded mente durante a parada de emergência**
  - Evidência: painel.html:516 exibe estático 'Disparo automático ativo: seg–sex às 10h, 13h e 16h (BRT) · lote de 8 · máx. 20/dia' — mas dispatch.ts:204 mostra que PROSPECT_DAILY_CAP=0 (o kill-switch usado no outage recente) pausa tudo. Grep por 'health|canary|monitor' em api/ops/*: zero matches — a máquina de saúde graduada (api/_lib/prospect/health.ts, latch, capGrade) não é exposta em endpoint ops nenhum. O founder olha o painel hoje e vê 'ativo' enquanto nada dispara.
  - Arquivos: C:\Users\stefa\roca\public\painel.html, C:\Users\stefa\roca\api\_lib\prospect\dispatch.ts, C:\Users\stefa\roca\api\_lib\prospect\health.ts
  - Recomendação: Expor cap efetivo, grade, latch e falhas de entrega num endpoint ops e substituir o copy estático por esse dado. Pós-outage (template #132000, credenciais re-sincronizadas), operar às cegas pelo painel é inaceitável.
- [HIGH][S] **O único CTA da landing tem copy contraditória sobre o fluxo de entrada**
  - Evidência: index.html:106 'o WhatsApp abre com o código de acesso já preenchido' e index.html:524 'Número de teste (beta) do WhatsApp sandbox. É só enviar o código que já vem preenchido' — mas o texto prefilled real é 'Oi, Stevi! Quero testar.' (não é código de sandbox nenhum). Ou o copy é stale da era Twilio sandbox (o stack migrou pra Cloud API) ou o fluxo confunde no exato ponto de conversão. O número 19705509125 está hardcoded 4x na landing enquanto qr.ts:19 já usa PUBLIC_WA_NUMBER env — quando o número BR chegar, a landing exige edição manual (drift garantido).
  - Arquivos: C:\Users\stefa\roca\public\index.html, C:\Users\stefa\roca\api\qr.ts, C:\Users\stefa\roca\scripts\build-web.mjs
  - Recomendação: Unificar o copy com o fluxo real ('abre com a mensagem pronta — é só enviar'), remover a menção a sandbox, e considerar injetar o número via build (build-web.mjs) da mesma env var do qr.ts.
- [HIGH][M] **Founder não consegue agir sobre conversa de produtor pelo painel — só ler**
  - Evidência: openThread (painel.html:316-331) é read-only; o botão 'Assumir conversa' existe apenas para prospects da Vitória (painel.html:706-716). Se a Stevi responde errado a um produtor quente ou trava, não há ação possível no painel. Pior: no loop diário central (encaminhar lead ao parceiro), leadRow (painel.html:386-437) não oferece nem copiar telefone nem link wa.me — o founder sai do painel e digita o número na mão.
  - Arquivos: C:\Users\stefa\roca\public\painel.html
  - Recomendação: Mínimo viável: botão wa.me/copiar-telefone no lead e na conversa (abre o WhatsApp do founder direto no contato). Fase 2: envio de mensagem manual pelo painel via a mesma transport layer.
- [MEDIUM][S] **Copy da landing quebra o gênero da marca: 'a Stevi' vira 'ele' em 5 lugares**
  - Evidência: index.html:214 'do jeito que ele responde', :414 'ele diz que não sabe', :465 'ele pede sua permissão', :500 'E se ele não souber?', :504 'Como ele sabe do meu clima' — resíduo óbvio de um rename de persona masculina. Para um produto cuja tese é honestidade e cuidado, texto descuidado na homepage corrói exatamente o que está à venda.
  - Arquivos: C:\Users\stefa\roca\public\index.html
  - Recomendação: Corrigir os 5 para 'ela/a Stevi' em web/index.html e rodar build-web. 15 minutos.
- [MEDIUM][M] **painel.html público vaza o playbook operacional inteiro — inclusive que a 'Vitória' é bot**
  - Evidência: painel.html é estático em public/, servido sem auth (só os dados exigem login). O fonte contém: nome do template (stevi_parceria_v2, :516), agenda e caps de disparo, estágios do funil, e 'A Vitória 🤖 cuida; entre só se ela escalar' (:240) + 'Personagens simulados… conversam com o cérebro REAL da Vitória… nunca fala preço, escala pro Stefano' (:786-788). Um prospect desconfiado que abra /painel.html descobre a automação antes de qualquer disclosure.
  - Arquivos: C:\Users\stefa\roca\public\painel.html, C:\Users\stefa\roca\api\_lib\opsAuth.ts
  - Recomendação: Servir o painel atrás do auth (function que exige a sessão antes de entregar o HTML) ou, no mínimo, tirar do HTML estático todo copy que descreve a operação da Vitória e do disparo.
- [MEDIUM][S] **Toda a cadeia de confiança mora em roca-black.vercel.app — nome de outro projeto**
  - Evidência: index.html:10 canonical e :19-29 OG apontam para https://roca-black.vercel.app/; footer index.html:563 'oi@stevi.agr.br (em breve)'. A página /verificar pede ao fazendeiro que confie, mas a URL que ele verifica é um subdomínio Vercel com nome que não é nem 'stevi'. O trust anchor CREA em /verificar depende de 4 env vars que somem silenciosamente se unset (verificar.ts:15-18 — não verificável no repo se estão configuradas em produção).
  - Arquivos: C:\Users\stefa\roca\public\index.html, C:\Users\stefa\roca\api\verificar.ts
  - Recomendação: Registrar e apontar stevi.agr.br antes de escalar outbound; confirmar em produção que VERIFIER_AGRONOMO/VERIFIER_CREA estão setados (senão a página de verificação não mostra o agrônomo — o único diferencial dela).
- [MEDIUM][S] **Posicionamento inconsistente entre páginas: cafeicultor ou 5 culturas?**
  - Evidência: verifierPage.ts:132 footer '. Stevi — assistente do cafeicultor'; verifierPage.ts:114 'café, soja, milho e pasto' (sem citros); landing index.html:111 'Soja, milho, pastagem, café e citros'. Três respostas diferentes para 'o que é a Stevi' em duas páginas públicas.
  - Arquivos: C:\Users\stefa\roca\api\_lib\verifierPage.ts, C:\Users\stefa\roca\public\index.html
  - Recomendação: Escolher um posicionamento e alinhar as três ocorrências. Se a cunha é café (Michel CREA-ES, região), diga café em todo lugar e liste o resto como 'também'.
- [MEDIUM][M] **Navegação some no mobile sem menu substituto — para um público mobile-first**
  - Evidência: styles.css:188 '.site-nav { display: none; …}' só volta em @media (min-width: 860px) (styles.css:515). Não existe hamburger nem menu alternativo: no celular (o dispositivo do fazendeiro), 'Como funciona', 'Honestidade' e 'Perguntas' só se alcançam rolando a página inteira.
  - Arquivos: C:\Users\stefa\roca\public\styles.css
  - Recomendação: Ou aceitar conscientemente (landing curta de scroll único) e remover a nav também no desktop por consistência, ou adicionar um menu mobile mínimo. O estado atual é o pior dos dois: informação de navegação que existe só para quem menos precisa.
- [LOW][S] **Painel sem auto-refresh nem paginação — o 'O que fazer hoje' congela no load**
  - Evidência: painel.html: nenhum setInterval/polling; todayStrip (:227-255) e todas as abas só atualizam em clique de aba ou reload manual. loadConversas (:292-314) e prospects carregam listas inteiras sem paginação ou busca nas conversas.
  - Arquivos: C:\Users\stefa\roca\public\painel.html
  - Recomendação: Polling leve (60-120s) no todayStrip + timestamp 'atualizado às HH:MM'. Paginação pode esperar escala real; o refresh não — lead quente esfria em minutos.
- [LOW][S] **Claim 'Nada aqui é inventado pra vitrine' colado em caption 'Conversa de exemplo' — contradição no mesmo bloco**
  - Evidência: index.html:215 'Nada aqui é inventado pra vitrine: é o texto que a Stevi manda no WhatsApp' vs index.html:168 caption 'Conversa de exemplo — resposta real da Stevi'. Os mockups são SVGs hardcoded com dados fictícios (Delta T 11.2, Portaria SDA/MAPA nº 1.579/2026). Se um agrônomo cético confere a portaria e ela não existe, o claim de honestidade vira contra a marca.
  - Arquivos: C:\Users\stefa\roca\public\index.html
  - Recomendação: Manter os mockups mas ajustar o claim: 'formato real das respostas da Stevi' — ou usar screenshot de conversa real anonimizada, que também resolve a ausência de prova social.
- [LOW][S] **Google Fonts externo numa página que promete funcionar em 'conexão de campo'**
  - Evidência: index.html:34 carrega DM Sans (5 variações) + Fragment Mono de fonts.googleapis.com — stylesheet render-blocking + origem extra, na mesma página que diz 'Funciona bem em conexão de campo' (index.html:497). O resto da página é exemplarmente leve.
  - Arquivos: C:\Users\stefa\roca\public\index.html, C:\Users\stefa\roca\public\styles.css
  - Recomendação: Self-host das 2 famílias em woff2 subset latin (ou cair para system stack no mobile). Ganho: 1 origem a menos e first paint mais estável em 3G rural.

**Quick wins:**
- Corrigir os 5 'ele'→'ela' em web/index.html e rebuildar (15 min, protege a tese de marca)
- Remover a menção a 'sandbox/código de acesso' do hero e do CTA band — alinhar com o texto prefilled real
- Linkar /verificar no footer e na nota do hero da landing (o trust anchor CREA já existe, está só escondido)
- Botão 'copiar telefone / abrir no WhatsApp' no leadRow do painel — destrava o loop diário de encaminhar lead
- Alinhar o posicionamento (cafeicultor vs 5 culturas) entre verifierPage.ts e index.html

**Movimentos estratégicos:**
- Seção B2B na landing ('Para agrônomos e cooperativas') com Michel CREA-ES como âncora e CTA de parceria — a página precisa validar o funil outbound da Vitória, não só captar fazendeiro
- Aba 'Saúde' no painel expondo cap efetivo/grade/latch/falhas de entrega da máquina que já existe em prospect/health.ts — e matar o copy operacional hardcoded que mente durante emergência
- Domínio próprio (stevi.agr.br) antes de escalar prospecção: toda a cadeia de confiança (landing, /verificar, QR) hoje aponta para roca-black.vercel.app
- Capacidade de intervenção humana em conversa de produtor (hoje só existe para prospects da Vitória) — é o backstop da tese 'triagem, não prescrição'

---
## Estratégia, GTM & Posicionamento

**Área:** Estratégia, GTM & Posicionamento  |  **Nota:** 4.5

**Veredito:** O paper trail de estratégia é acima da média (scorecard pré-registrado com critério de kill, posicionamento que admite que a IA é commodity, pesquisa competitiva real) — mas a execução contradiz o próprio plano em quase todos os pontos de contato com a realidade. Existem DUAS teses de receita concorrentes não reconciliadas (lead-gen de agrônomo a R$50 vs caderno/PRONAF como wedge de compliance), o único canal automatizado de prospecção é proibido por design de falar preço, o outbound está em parada de emergência (PROSPECT_DAILY_CAP=0) no meio da janela de 60 dias, e a demanda real observada (5 referrals, todas soja/milho em SP/MT) foi descartada porque a oferta (1 agrônomo de café em MG, relação iniciada com uma promessa falsa que exigiu retratação) foi construída onde havia relacionamento, não onde apareceu demanda. O tripwire do próprio flight-plan ("commits > conversas = campanha fora dos trilhos") está sendo violado pelo git log: migração de design system, gym de personas e refactors durante a janela de validação. Hoje isto é um plano excelente orbitando um campo que ninguém está pisando.

**Forças:**
- Scorecard pré-registrado (13/jul) com bar de venture/negócio/matar e regras de leitura de n mínimo — disciplina de decisão rara em pré-seed (flight-plan README)
- Posicionamento intelectualmente honesto: admite que o Q&A é commodity e que o moat (distribuição+contexto+cercamento+proatividade) é uma APOSTA que o D7 vouchado testa, não um fato
- Pesquisa competitiva de verdade (On Agri R$147/mês, RAImundo grátis do governo, Plantix) que matou features 'Japan artifacts' e repriorizou o backlog — não é wishful thinking
- 'Triagem, não prescrição' engenheirado como gate determinístico (compliance.ts), não prompt — é exatamente o cercamento que permite o vouch de coop/agrônomo que a distribuição exige
- Burn quase zero (~4 crons/dia, prompt caching, sem SDK) — o relógio da empresa é tempo de fundador, não caixa

**Findings:**
- [CRITICAL][S] **Duas teses de receita concorrentes sem decisão — lead-gen de agrônomo vs caderno/PRONAF**
  - Evidência: README.md:116-117 trava 'lead-gen, nunca comissão'; o flight-plan (R$50/lead, sondar R$100-150) aposta no agrônomo como pagador; mas .claude/plans/2026-07-16-brazil-fit-backlog/README.md:6 declara o caderno de aplicações 'the most defensible wedge in the set' com pricing abaixo dos R$147/mês do On Agri — uma tese de assinatura/B2B2C. O platform-audit (Open Question 1) registra o conflito e ninguém decidiu. O código instrumenta as duas (partners.ts + report/financing.ts) e não precifica nenhuma.
  - Arquivos: C:\Users\stefa\roca\README.md, C:\Users\stefa\roca\.claude\plans\2026-07-16-brazil-fit-backlog\README.md, C:\Users\stefa\roca\.claude\plans\2026-07-13-flight-plan\README.md
  - Recomendação: Memo de 1 página esta semana escolhendo a tese primária e o pagador (agrônomo por lead vs produtor/coop pelo caderno-crédito). O lead-gen tem teto estrutural e mismatch geográfico já observado; o caderno tem obrigação legal (INC 02/2018 hortifruti) e valor de crédito no café. Travar a escolha no scorecard — duas teses semi-testadas em 60 dias = zero teses validadas.
- [CRITICAL][M] **O único sinal de monetização do scorecard está atrás do gargalo humano mais evitado**
  - Evidência: api/_lib/prospect/agent.ts:41-55,83 — a Vitória é HARD-GATED de citar preço ('NUNCA cite preço ou valor (nem exemplos)'); toda pergunta de preço escala pro Stefano. Regra 7 do flight-plan: TODO prospect novo entra só via Vitória. E o michel-call README (linha 71+) registra que o fundador 'prefere não ligar' (Plano B por mensagem). Resultado: a pergunta 'R$50 por lead, continua?' — o critério central do scorecard — não tem NENHUM canal que a execute de forma confiável.
  - Arquivos: C:\Users\stefa\roca\api\_lib\prospect\agent.ts, C:\Users\stefa\roca\.claude\plans\2026-07-16-michel-call\README.md
  - Recomendação: Ou (a) libere a Vitória para UMA pergunta de preço scriptada e pré-aprovada no momento certo do funil (mantendo o gate para negociação), ou (b) crie um sinal de preço que não dependa de call do founder: framing pago já na entrada do parceiro nº2+ ('primeiros 10 grátis, depois R$50') dentro do template/fluxo automatizado. O plano já previa isso — implemente.
- [CRITICAL][L] **A empresa inteira é um número WhatsApp +1 que a Meta já sinaliza — e o +55 é 'milestone posterior'**
  - Evidência: .claude/plans/2026-07-09-stevi-prospecting/README.md (Display-name decision): Meta recusou 'Stevi' 3× — estrutural, número US com marca BR. Git: 81de090 (outage #132000, 0% delivery), 6605977 (credenciais re-sincronizadas), 18f2170/4ad9de5 (PROSPECT_DAILY_CAP=0 ativo AGORA). Flight-plan: '+55 bloqueado por meses (o +1 é ativo único e insubstituível)', gated em CNPJ/Anatel. A armadura (canário, latch, shape-guard) é boa engenharia sobre uma fundação que a Meta pode remover unilateralmente.
  - Arquivos: C:\Users\stefa\roca\.claude\plans\2026-07-09-stevi-prospecting\README.md, C:\Users\stefa\roca\api\_lib\prospect\health.ts
  - Recomendação: Tratar CNPJ + número +55 como pré-requisito existencial, não milestone: iniciar a abertura do CNPJ AGORA (leva semanas, custa pouco, destrava display name, verificação de negócio, confiança do produtor e o registro stevi.agr.br/com.br). Enquanto isso, cada semana de outbound pausado no +1 é semana perdida da janela de 60 dias.
- [HIGH][M] **Demanda real observada foi descartada: 100% das referrals são soja/milho SP/MT, 100% da oferta e do pitch são café-MG**
  - Evidência: tasks/lessons.md (2026-07-17): 'a verdade: 5 referral_requests, ALL in SP/MT (soja/milho), partner_id null — zero ever matched'. Enquanto isso api/_lib/prospect/template.ts:39-64 — TODOS os templates dizem 'produtores de café'/'cafeicultores', e o único parceiro (Michel) atende raio 60km no Caparaó-MG. O marketplace está construindo oferta onde o founder tem relacionamento e ignorando onde a demanda apareceu sozinha.
  - Arquivos: C:\Users\stefa\roca\tasks\lessons.md, C:\Users\stefa\roca\api\_lib\prospect\template.ts, C:\Users\stefa\roca\api\_lib\partners.ts
  - Recomendação: Duas opções honestas: (a) recrutar 1 agrônomo de soja/milho em SP/MT para atender as 5 referrals reais (validação de handoff com demanda orgânica, sem Michel), ou (b) declarar explicitamente que SP/MT está fora do beachhead e medir só café — mas aí o funil de referral precisa dizer isso ao produtor em vez de prometer 'assim que a rede estiver pronta'.
- [HIGH][M] **Ponto único de falha: Michel — QA agronômico, CREA público, intros e molde do modelo em UMA pessoa que ainda não fechou o acordo**
  - Evidência: michel-call README: o acordo (SLA 48h, 15min/sem de QA do golden set — '36 casos; hoje 0 verificados', depoimento, 2 intros) ainda era proposta; a relação abriu com uma promessa falsa ('4 produtores te esperando') que exigiu walk-back público (lessons.md 2026-07-17). Commit a47450b já publicou 'Michel, CREA-ES' em /verificar — o nome dele ancora a confiança pública do produto antes do acordo estar de pé.
  - Arquivos: C:\Users\stefa\roca\.claude\plans\2026-07-16-michel-call\README.md, C:\Users\stefa\roca\api\_lib\verifierPage.ts, C:\Users\stefa\roca\tasks\lessons.md
  - Recomendação: Parceiros nº2 e nº3 são urgência de GTM, não S2-4: um marketplace com lado da oferta n=1 não é testável e o churn de UMA pessoa mata a página de verificação, o QA e a tese. Formalizar o acordo com Michel por escrito (5 linhas no WhatsApp servem) antes de qualquer escala.
- [HIGH][S] **O tripwire do próprio plano está disparado: commits > conversas, com outbound PAUSADO no meio da janela**
  - Evidência: Flight-plan: 'Tripwire semanal: commits > conversas-com-produtores = campanha fora dos trilhos; o conserto nunca é mais código.' Git log da janela de validação: migração completa de design system 'Campo Editorial' (7326ea8, 6541bb5, 60da2a3, bf40063, d59d10a, 42a5b67), refactor do pipeline em 6 commits, gym de personas — enquanto PROSPECT_DAILY_CAP=0 (4ad9de5) congela a aquisição. Hoje é dia ~12 de 60; o gate S4 exige coorte D7 n≥15 que ninguém está enchendo.
  - Arquivos: C:\Users\stefa\roca\.claude\plans\2026-07-13-flight-plan\README.md
  - Recomendação: Congelar todo trabalho de polish (design system, gym, refactors) até o gate S4. A única fila de engenharia legítima agora: diagnosticar e religar o dispatch (a causa do cap=0), e o que destravar conversas de produtor. Se a semana fechar de novo com mais commits que conversas, o plano manda tratar como campanha fora dos trilhos — trate.
- [HIGH][S] **Beachhead indeciso enquanto o produto se espalha por 5 culturas — e a cultura do wedge legal (hortifruti) não está no produto**
  - Evidência: backlog P0 item 4: 'Pick the beachhead: hortifruti OR coffee' — status 'decision', aberto desde 16/jul. O backlog aponta que o caderno só é obrigação LEGAL em hortifruti (INC 02/2018, multa + apreensão de carga); mas README.md:30 — o Agrofit grounding cobre soja, milho, pastagem, café e citros: zero hortifruti. O flight-plan assume café-Caparaó. Três documentos, três respostas.
  - Arquivos: C:\Users\stefa\roca\.claude\plans\2026-07-16-brazil-fit-backlog\README.md, C:\Users\stefa\roca\README.md
  - Recomendação: Decidir e cortar: se café é o beachhead (defensável — Michel, geada, florada, crédito), tirar citros/pastagem do discurso e do roadmap e reposicionar o caderno como ferramenta de CRÉDITO (PRONAF) em vez de compliance; se hortifruti, o Agrofit slice precisa das culturas antes de qualquer GTM. Não decidir é escolher os dois e validar nenhum.
- [MEDIUM][S] **Lead-gen a R$50 tem teto estrutural que não paga uma venture — e o plano não nomeia o modelo de escala**
  - Evidência: Frequência observada de demanda: 5 pedidos de agrônomo em toda a base em ~2 semanas (lessons.md). O próprio cenário VENTURE do scorecard (≥3 parceiros com PIX real) implica receita < R$1k/mês. O backlog pergunta ('Moat durability… what compounds our lead?') mas nenhum documento diz o que vem DEPOIS do lead-gen: assinatura do produtor? SaaS por coop? per-seat de técnico?
  - Arquivos: C:\Users\stefa\roca\.claude\plans\2026-07-13-flight-plan\README.md, C:\Users\stefa\roca\api\_lib\prospect\template.ts
  - Recomendação: Aceitar explicitamente que R$50/lead é instrumento de VALIDAÇÃO (prova que agrônomo paga por demanda qualificada) e escrever a hipótese do modelo de escala agora — o candidato óbvio nos próprios docs é B2B2C: coop/revenda paga pelo filtro + caderno dos associados (o template coop já vende exatamente isso). Isso muda quem a Vitória prospecta primeiro.
- [MEDIUM][M] **Contra RAImundo (grátis, chancela Embrapa/governo) a promessa entregue hoje é menor que a prometida**
  - Evidência: backlog:9 — 'RAImundo (Embrapa/MAPA, free, smallholder-targeted) já live… WhatsApp-first is table stakes'. A resposta de referral em produção ainda é a promessa vazia: pipeline.ts:171-174 'Assim que a nossa rede de agrônomos parceiros estiver pronta, eu te conecto direto por aqui' — para todo produtor fora do raio de 60km do Michel (hoje: todos os que pediram). O diferencial declarado (handoff que termina num humano com CREA) não existe para 100% da demanda real até agora.
  - Arquivos: C:\Users\stefa\roca\api\_lib\pipeline.ts, C:\Users\stefa\roca\.claude\plans\2026-07-16-brazil-fit-backlog\README.md
  - Recomendação: Não competir em 'assistente grátis de WhatsApp' (guerra perdida contra o governo). Toda a copy e o funil devem vender o que RAImundo estruturalmente não faz: o caderno/histórico que vira documento de crédito e o handoff real para agrônomo da região. E enquanto a rede não cobre a região do produtor, a resposta honesta deve oferecer o que JÁ entrega (o dossiê pronto pra levar ao agrônomo dele) como produto, não como consolação.
- [MEDIUM][M] **O plano inteiro assume um founder de campo que o comportamento registrado contradiz — sem plano B**
  - Evidência: Flight-plan 'Divisão de trabalho — Só o fundador: Michel e todo parceiro (voz), manhãs de armazém, 10 conversas de produtor/sem, pedidos de preço, leitura das primeiras sessões'. Registro real: a ligação de 20min com o parceiro nº1 virou 'Plano B por mensagem (escolhido 16/jul: fundador prefere não ligar)' (michel-call README:71), e a semana produziu design system e refactors. Nenhum documento define o que acontece se a parte humana do plano não for executada.
  - Arquivos: C:\Users\stefa\roca\.claude\plans\2026-07-13-flight-plan\README.md, C:\Users\stefa\roca\.claude\plans\2026-07-16-michel-call\README.md
  - Recomendação: Ou redesenhar o GTM para o founder que existe (assíncrono, por mensagem, automação máxima — o Plano B do Michel é um bom molde: sequências copy-paste + máquina resolve o resto), ou trazer a Vitoria (co-founder humana) formalmente para o papel de campo com metas próprias no scorecard. O que não pode é o plano exigir um comportamento e a operação entregar outro silenciosamente.

**Quick wins:**
- Memo de 1 página decidindo a tese de receita primária (lead-gen agrônomo vs caderno/crédito) e o beachhead (café vs hortifruti) — as duas decisões estão abertas desde 16/jul e bloqueiam todo o resto
- Formalizar o acordo com Michel por escrito (5 linhas de WhatsApp) e recrutar parceiro nº2 fora do Caparaó — de preferência 1 agrônomo soja/milho SP/MT para atender as 5 referrals reais paradas
- Iniciar abertura do CNPJ esta semana (destrava +55, display name, verificação Meta e domínio .br — o caminho crítico de tudo leva semanas)
- Trocar a promessa vazia do REFERRAL_REPLY ('quando a rede estiver pronta') por entrega imediata do dossiê/caderno pronto pra levar ao agrônomo do produtor
- Congelar polish (design system, gym, refactors) até o gate S4 e diagnosticar/religar o dispatch pausado — o tripwire do próprio plano já disparou

**Movimentos estratégicos:**
- Re-sequenciar: CNPJ + número +55 como pré-requisito de escala (não 'milestone posterior') — nenhum resultado do flight-plan sobrevive a um ban do +1
- Adotar B2B2C coop/revenda como hipótese de modelo de escala (coop paga pelo filtro + caderno dos associados; o template coop já vende isso) e usar R$50/lead apenas como instrumento de validação de disposição a pagar
- Se café fica como beachhead: afiar o produto no ciclo do café (florada >30°C, geada, ferrugem, caderno→crédito PRONAF) e cortar citros/pastagem do discurso — profundidade num segmento bate largura em cinco
- Redesenhar o GTM para operação assíncrona-por-mensagem (o molde do Plano B do Michel) com metas humanas explícitas no scorecard para a co-founder — o plano atual exige um founder de campo que a evidência mostra que não existe

---
## Dados & Modelagem (Supabase: 28 migrations, db.ts, memory.ts, caderno.ts, opsData.ts)

**Área:** Dados & Modelagem (Supabase: 28 migrations, db.ts, memory.ts, caderno.ts, opsData.ts)  |  **Nota:** 6.5

**Veredito:** O schema é disciplinado para o estágio — idempotência de webhook bem resolvida (índice único parcial + claim 23505), RLS ligado em tudo com zero policies (postura service-role-only coerente), purga de retenção existe (raro em pré-seed) e cada migration documenta intenção. Mas a tese de negócio ("dado proprietário vira moat") NÃO está refletida no schema: os sinais mais valiosos — veredito de triagem de praga, série temporal de NDVI, veredito de janela de pulverização — são descartados ou sobrescritos, sobrevivendo só como prosa em messages.raw. Há ainda uma coluna de "consentimento" LGPD que na verdade grava notificação, dados de terceiros prospectados sem política de retenção, e leituras do ops console que silenciosamente truncam em 1000 linhas. É um schema de app de mensagens bem feito; ainda não é um schema de empresa de dados agronômicos.

**Forças:**
- Idempotência de mensagem correta: índice único parcial em provider_message_id (migration 0006) + claim por erro 23505 com fail-open deliberado e comentado (db.ts:270-286)
- RLS habilitado em TODAS as tabelas com zero policies — anon key não lê nada; gap dos prospects foi detectado e corrigido (migration 0021)
- Retenção/purga existe e roda no cron (purgeExpiredRows, db.ts:700-722) — messages 365d, farmer_alerts 90d, ops_login_attempts 30d — mais do que a maioria pré-seed tem
- Snapshot de uf/crop/topic + consent_version copiados para referral_requests no momento do opt-in (migration 0004/0005) — trilha de auditoria LGPD correta para o fluxo de referral
- farmer_alerts com unique(user_id, dedup_key) como claim de idempotência de alerta (migration 0014) e dispatch de prospect com claim condicional otimista (prospect/db.ts:102-110) — padrões de concorrência serverless corretos

**Findings:**
- [HIGH][M] **O dado de moat nº 1 (veredito de triagem de praga) é jogado fora — nunca persiste estruturado**
  - Evidência: pipeline.ts:255-263: o resultado da visão (pest, confidence, crop, evidence, grupos de produto) é serializado só na URL do card e no texto da resposta. A tabela messages guarda apenas intent='pest_triage' (migration 0001:49). Não existe tabela de eventos de triagem. O mapa regional de pressão de praga (cultura × praga × geo × data) — o dataset que nenhum concorrente tem — hoje só é recuperável minerando prosa de messages.raw, que ainda por cima é purgada em 365d (db.ts:703).
  - Arquivos: C:\Users\stefa\roca\api\_lib\pipeline.ts, C:\Users\stefa\roca\supabase\migrations\20260707000001_init.sql
  - Recomendação: Criar triage_events append-only: user_id, farm_id, crop, pest, confidence, evidence, lat/lon arredondado (município), created_at. Escrever no mesmo ponto do pipeline que monta o card. Mesmo tratamento para o veredito de spray_window (condição → sim/não). Custo marginal ~zero, é o começo do moat.
- [HIGH][S] **Série temporal de NDVI é sobrescrita a cada leitura — farm_derived é 1 linha por fazenda**
  - Evidência: db.ts:190-204: setCachedNdvi faz upsert em farm_derived (PK = farm_id, migration 0001:33-39), destruindo a leitura anterior. Migrations 0007/0009 só adicionaram colunas à mesma linha única. A evolução de vigor por fazenda ao longo da safra — o insumo de 'sua lavoura caiu 15% vs mês passado' e de qualquer produto de histórico — não existe.
  - Arquivos: C:\Users\stefa\roca\api\_lib\db.ts, C:\Users\stefa\roca\supabase\migrations\20260707000007_ndvi_cache.sql
  - Recomendação: Tabela ndvi_readings append-only (farm_id, ndvi, std, samples, scene_date, fetched_at) escrita junto do cache; manter farm_derived como cache de leitura. Migration + 3 linhas no setCachedNdvi.
- [HIGH][S] **consent_lgpd_at registra NOTIFICAÇÃO, não consentimento — base legal mal modelada na coluna errada**
  - Evidência: db.ts:326-338: markConsentNotified seta consent_lgpd_at quando a nota LGPD foi ENTREGUE; o próprio comentário admite 'continued use after being informed is the working basis' (legítimo interesse, não consentimento). Diferente do fluxo de referral, que grava consent_version (migration 0005), a nota geral não versiona o texto exibido. Numa fiscalização ANPD, uma coluna chamada 'consent' que prova só entrega de aviso é pior que não ter nada — sugere consentimento que não existe.
  - Arquivos: C:\Users\stefa\roca\api\_lib\db.ts, C:\Users\stefa\roca\supabase\migrations\20260707000005_referral_consent_version.sql
  - Recomendação: Renomear semanticamente (lgpd_notified_at) ou adicionar lgpd_notice_version text; documentar a base legal por tabela (legítimo interesse vs consentimento) num comentário de migration. Não requer mudança de comportamento.
- [MEDIUM][S] **Dados pessoais de terceiros (prospects raspados) sem NENHUMA política de retenção**
  - Evidência: purgeExpiredRows (db.ts:700-722) cobre só messages, farmer_alerts, ops_login_attempts e monitor_runs. prospects (nomes + telefones raspados, migration 0015), prospect_messages (threads de conversa, migration 0016), prospect_gym_runs e gym_runs (transcripts jsonb) crescem para sempre. Prospects com status 'discarded'/'invalid' — pessoas que nunca responderam ou pediram para sair — ficam retidos indefinidamente. Para dados coletados sem relação com o titular, é o ponto mais frágil da postura LGPD do repo (a migration 0021 admite: 'the most sensitive third-party data in the schema').
  - Arquivos: C:\Users\stefa\roca\api\_lib\db.ts, C:\Users\stefa\roca\supabase\migrations\20260709000015_prospects.sql
  - Recomendação: Adicionar à purga: prospects discarded/invalid > 180d (mantendo prospect_optouts para sempre — é a prova legal do opt-out), prospect_messages > 365d, gym_runs/prospect_gym_runs > 90d. São 4 entradas no array targets existente.
- [MEDIUM][S] **opsConversations busca messages sem limit — PostgREST trunca em 1000 linhas e os números do painel ficam silenciosamente errados**
  - Evidência: opsData.ts:115-118: db.from('messages').select('user_id, created_at').in('user_id', ids) sem .limit() nem .order(). O próprio repo sabe do clamp de 1000 linhas do PostgREST — digest.ts:160-161 detecta e sinaliza truncamento — mas opsConversations não: passadas 1000 mensagens no conjunto, count e lastAt por fazendeiro viram amostra arbitrária sem aviso. Com inbound 7d já em milhares isso quebra cedo.
  - Arquivos: C:\Users\stefa\roca\api\_lib\opsData.ts, C:\Users\stefa\roca\api\_lib\digest.ts
  - Recomendação: Trocar por agregação no servidor (RPC com group by user_id, ou uma view), ou no mínimo .order('created_at', descending) + limit explícito + flag de truncamento como o digest faz.
- [MEDIUM][S] **Migration editada DEPOIS de aplicada em prod — histórico de schema não é mais imutável**
  - Evidência: migration 0020 (partners.sql:27-30) confessa: 'This file originally seeded the first partner; the seed was removed after being applied'. O motivo (PII de pessoa real no git) é legítimo, mas o método quebra a invariante de migrations: o arquivo no git não é mais o que rodou em prod, checksums divergem, e ambientes novos nascem diferentes do prod por construção. Sem down scripts em nenhuma das 28 migrations (forward-only é defensável em Supabase, mas não há procedimento de rollback documentado em lugar nenhum).
  - Arquivos: C:\Users\stefa\roca\supabase\migrations\20260710000020_partners.sql
  - Recomendação: Nunca editar migration aplicada — corrigir com migration nova. Para o caso PII: seeds operacionais fora de migrations (já é a regra declarada agora). Documentar a política de rollback (restore de backup + migration corretiva) num README de supabase/.
- [MEDIUM][S] **Estado conversacional (users.awaiting) sem timestamp — resposta atrasada semanas é interpretada como resposta ao prompt antigo**
  - Evidência: migration 0003 é uma coluna text solta, sem awaiting_set_at. pipeline.ts:437-466 roteia por user.awaiting ('crop', 'referral_consent', 'farm_confirm') antes de qualquer classificação: um fazendeiro que recebeu 'o que você planta?' e volta 3 semanas depois com 'sim' ou outra frase cai no handler do estado obsoleto. O pipeline limpa awaiting em muitos caminhos (linhas 550-694), mas não há expiração por tempo — impossível sem o timestamp no schema.
  - Arquivos: C:\Users\stefa\roca\supabase\migrations\20260707000003_conversation_state.sql, C:\Users\stefa\roca\api\_lib\pipeline.ts
  - Recomendação: Adicionar awaiting_set_at timestamptz na mesma escrita de setAwaiting; no pipeline, ignorar awaiting mais velho que ~48h. Migration de 1 linha + 2 linhas de código.
- [LOW][S] **Índices ausentes para queries que o código realmente faz (wamid, created_at global, referral user_id)**
  - Evidência: (1) prospect/health.ts:70 aplica CADA callback de status da Meta com update WHERE wamid=X — prospects não tem índice em wamid (migration 0015 indexa status/wa_status/sent_at/phone). (2) purgeExpiredRows (db.ts:714) e opsOverview (opsData.ts:59-62) filtram messages por created_at sem user_id — único índice é (user_id, created_at), logo seq scan na maior tabela do banco. (3) referral_requests.user_id sem índice, usado por hasRecentReferral a cada opt-in (db.ts:685). Tudo barato hoje pela escala; vira dor exatamente quando as coisas começam a dar certo.
  - Arquivos: C:\Users\stefa\roca\api\_lib\prospect\health.ts, C:\Users\stefa\roca\supabase\migrations\20260709000015_prospects.sql, C:\Users\stefa\roca\api\_lib\db.ts
  - Recomendação: Uma migration: create index prospects_wamid_idx on prospects(wamid) where wamid is not null; messages(created_at); referral_requests(user_id). 10 minutos.
- [LOW][L] **Modelagem mono-fazenda/sem talhão limita o teto do caderno como produto de rastreabilidade**
  - Evidência: farms tem unique(user_id) (migration 0001:28) — um pin por produtor, sem entidade talhão. applications (migration 0028) tem area_ha mas nenhum vínculo espacial além de farm_id nullable com on delete set null. O relatório de aplicação que banco/certificadora/receituário valorizam é POR TALHÃO. O comentário do init já previa 'polygon later' — 'later' não tem nenhum caminho no schema. Aceitável para v1; só não confundir o caderno atual com rastreabilidade vendável.
  - Arquivos: C:\Users\stefa\roca\supabase\migrations\20260707000001_init.sql, C:\Users\stefa\roca\supabase\migrations\20260715000028_applications.sql
  - Recomendação: Não corrigir agora. Quando o caderno mostrar tração (>N produtores registrando), introduzir fields/talhoes (farm_id, nome, área, geo opcional) e apontar applications.field_id — o desenho atual migra limpo porque applications já referencia farm_id.
- [LOW][S] **Métricas de negócio derivadas de regex sobre texto de resposta — frágil por construção**
  - Evidência: opsData.ts:20-22: 'failures7d' vem de FAILURE_RE aplicado em messages.raw outbound ('não consegui|me pegou|...'), espelhado no digest. Qualquer mudança de style pack (que é hot-swappable por design, migration 0010) silenciosamente muda a métrica de falha. O mesmo padrão de 'dado estruturado guardado como prosa' do finding nº 1, agora contaminando o funil de decisão dos founders.
  - Arquivos: C:\Users\stefa\roca\api\_lib\opsData.ts, C:\Users\stefa\roca\api\_lib\digest.ts
  - Recomendação: Gravar um campo estruturado no momento da falha (ex.: intent='fallback' ou coluna meta jsonb em messages com {failure: true, reason}) em vez de reconhecer a falha depois por regex.

**Quick wins:**
- Migration ndvi_readings append-only + 3 linhas em setCachedNdvi — para de destruir a série temporal hoje (db.ts:190-204)
- Migration de índices: prospects(wamid), messages(created_at), referral_requests(user_id) — 10 minutos, paga-se no primeiro pico de callbacks da Meta
- Adicionar prospects descartados (>180d), prospect_messages e gym_runs ao array de purgeExpiredRows (db.ts:702-707) — fecha o buraco LGPD de dados de terceiros
- awaiting_set_at timestamptz + expiração de 48h no pipeline — mata a classe de bug 'respondeu 3 semanas depois'
- Corrigir opsConversations com agregação server-side ou limit+flag de truncamento (padrão já existe em digest.ts:160)

**Movimentos estratégicos:**
- Schema de eventos agronômicos estruturados (triage_events + spray_verdicts + outcome follow-up 'resolveu?') — transforma o exhaust de conversa no mapa regional de pressão de praga, o único dataset que compõe com escala e que nem cooperativa nem Climate FieldView têm no WhatsApp
- Elevar o caderno de log-de-intents (caderno.ts lê rótulos de intent) para registro por talhão com outcome — é a diferença entre 'histórico fofo' e documento de rastreabilidade que banco/certificadora paga
- Catálogo de dados LGPD executável: base legal + retenção declaradas por tabela (comentário padronizado em migration) e purga derivada disso — vira argumento de venda para cooperativas (compliance como feature), não só defesa
- Transformar outcome/lead_grade (migration 0026) em dataset de qualidade de lead por parceiro/região — é a evidência de pricing do lado agrônomo do marketplace; hoje são duas colunas text livres sem enum nem timestamp de quando o parceiro respondeu

---
## Loops de aprendizado & sistema self-improving

**Área:** Loops de aprendizado & sistema self-improving  |  **Nota:** 5.5

**Veredito:** A infraestrutura de AVALIAÇÃO é acima da média para pré-receita (gym pareado com juiz cross-family, veto de segurança, mitigação de position bias, tudo persistido e auditável) — mas quase nada é self-improving de verdade. Dos 6 loops, 4 param num humano na etapa "mudança aplicada", o único 100% automático (playbook da Vitória → prompt de produção) é justamente o menos vigiado e é um canal de injeção de texto adversarial de prospect no system prompt, e ZERO outcome de fazendeiro real realimenta qualquer coisa — todo treino é sintético. A âncora de verdade agronômica não existe: 0 dos 36 casos golden foram assinados pelo Michel, então a "accuracy" é opinião de LLM julgando LLM da mesma família. É um bom sistema de medição com um sistema de aprendizado embrionário e sem cadência (último experimento de gym: 09/jul, 16 dias atrás).

**Forças:**
- Stevi Gym metodologicamente sério: comparação pareada champion/challenger, juiz deliberadamente de outra família (gemini) p/ quebrar blind spots correlacionados, randomização de posição, veto duro de segurança (judge.ts:174-256)
- Simulação usa o cérebro REAL de produção com zero side effects por construção (userId:null, packOverride) — o que é testado é o que roda (sim.ts:79-82, stylepack.ts:66-69)
- Toda run persiste em tabela auditável append-only (gym_runs, golden_runs, prospect_gym_runs, canary_runs, prospect_playbook) e aparece no /painel → Treino
- Golden eval fail-closed nos DOIS sentidos com critérios indexados m1..n1 — corrigiu um fail-open real no lado must_not (goldeneval.ts:151-184)
- Canário aprendeu com o incidente real: o outage #132000 de 13/jul virou check de shape de template, com alerta só em transição (canary.ts:183-190)

**Findings:**
- [HIGH][L] **Nenhum outcome de fazendeiro real realimenta nenhum loop — todo treino é sintético**
  - Evidência: O único minerador de conversas REAIS é prospect-side (api/_lib/prospect/learn.ts:102-153). Não existe equivalente para as conversas de produtores: pipeline.ts não captura nenhum sinal de feedback (sem 'resolveu?', sem reação, sem outcome de lead), cohort.ts é métrica de digest que nenhum prompt consome, e as personas do gym estão congeladas em código (api/_lib/gym/personas.ts) sem caminho de transcript real → nova persona/caso golden.
  - Arquivos: api/_lib/prospect/learn.ts, api/_lib/pipeline.ts, api/_lib/gym/personas.ts, api/_lib/cohort.ts
  - Recomendação: Fechar o loop com o usuário final: (1) sinal barato de outcome por conversa (retorno em 24h, silêncio pós-triagem, lead aceito pelo parceiro); (2) clonar o padrão do learn.ts para minerar conversas de produtores semanalmente; (3) botão no painel Treino que promove uma conversa real ruim a caso golden / persona.
- [HIGH][S] **Golden set com 0/36 casos verificados por agrônomo — a métrica de accuracy não tem âncora de verdade**
  - Evidência: Todos os 36 casos de knowledge/goldenset/goldenset.jsonl têm verified_by:null (grep confirmou 36/36). O próprio harness admite: golden-run.ts:61 imprime '⚠️ (peça pro Michel assinar os casos)'. A tese do produto é 'triagem com responsável técnico', mas o responsável técnico nunca validou o gabarito.
  - Arquivos: knowledge/goldenset/goldenset.jsonl, scripts/golden-run.ts
  - Recomendação: Sessão de trabalho com o Michel para assinar os 36 casos (verified_by='michel-crea-es'), e regra: caso novo só entra no set com assinatura ou marcado como não-verificado no relatório. É a ação de maior alavancagem/custo de toda esta dimensão.
- [HIGH][M] **O único loop verdadeiramente automático (playbook → prompt de produção) roda sem revisão humana, sem UI de auditoria, e é canal de injeção**
  - Evidência: learn.ts:102-153 minera texto bruto de prospects e insere o resultado direto no system prompt da Vitória em produção (agent.ts:139-145), toda segunda via cron (monitor.ts:139-153). Nenhuma tela do painel exibe o playbook (grep por 'playbook|aprendizado' em web/ retorna vazio). Um prospect malicioso pode plantar texto que o minerador transforma em 'learning' injetado no prompt; as mitigações (110 chars/linha, 'REGRAS DURAS prevalecem') são só prompt-level — o gate de saída cobre apenas preço via regex (agent.ts:41-42).
  - Arquivos: api/_lib/prospect/learn.ts, api/_lib/prospect/agent.ts, api/cron/monitor.ts
  - Recomendação: Mínimo: exibir o playbook vigente no painel com timestamp e stats. Melhor: learnings entram como 'pending' e só ativam com um clique do founder; adicionar sanity-check do minerador (rejeitar learnings com imperativo dirigido ao agente, ex. 'ignore', 'sempre diga').
- [HIGH][S] **Juiz da MESMA família do gerador no golden eval e no Vitória gym — contradiz a doutrina escrita do próprio repo**
  - Evidência: goldeneval.ts:206 e prospect/gym.ts:224 usam MODELS.reasoning() (anthropic/claude-sonnet-5, env.ts:18) para julgar respostas geradas pelo próprio sonnet-5. O repo documenta exatamente esse risco em judge.ts:5-9 ('a judge from the same family tends to bless its own style') e só o aplica no gym da Stevi (ROCA_JUDGE_MODEL || gemini-2.5-flash). Os números de accuracy do golden e as médias da Vitória carregam viés de auto-avaliação.
  - Arquivos: api/_lib/gym/goldeneval.ts, api/_lib/prospect/gym.ts, api/_lib/gym/judge.ts
  - Recomendação: Trocar os dois juízes para o mesmo ROCA_JUDGE_MODEL cross-family já usado pelo gym da Stevi — mudança de 2 linhas.
- [MEDIUM][M] **Promoção de style pack não tem gate — qualquer versão ativa sem gym win nem golden pass**
  - Evidência: opsActivatePack (opsData.ts:209-215) e stylepack-push.mjs:77-83 ativam qualquer versão incondicionalmente. O 'recommended' do resolveRun (judge.ts:264-298) é puramente advisory; nada liga gym_runs/golden_runs à ativação, e não existe tabela de lineage de campeões (o comentário da migration promete 'champion lineage' mas style_packs só tem um boolean active).
  - Arquivos: api/_lib/opsData.ts, scripts/stylepack-push.mjs, supabase/migrations/20260708000010_style_packs.sql
  - Recomendação: Gate soft primeiro: o painel mostra o último gym e golden do pack ao ativar, com aviso se ausente/perdedor. Depois hard: ativação exige golden run do pack com rate ≥ campeão registrada em golden_runs.
- [MEDIUM][M] **Evals sem cadência nem gate de CI — regressão de qualidade só seria pega por reclamação**
  - Evidência: CI roda só typecheck+vitest (.github/workflows/ci.yml). Golden e gym são CLI ad-hoc ('never on a cron', goldeneval.ts:3-4 — decisão de custo consciente, mas sem substituto). Últimos experimentos de gym: 09/jul (commits d11d5ad, d039c33); hoje é 25/jul. O canário pega modelo MORTO (fallback rate), não modelo PIOR.
  - Arquivos: .github/workflows/ci.yml, api/_lib/gym/goldeneval.ts, api/cron/monitor.ts
  - Recomendação: Golden parcial semanal barato (--limit 12, ~24 chamadas LLM) encadeado no monitor de segunda, com alerta ao founder se a taxa cair >10pp vs média das últimas 4 runs — trend sem custo de CI.
- [MEDIUM][M] **Vitória Gym mede mas não experimenta: sem champion/challenger, prompt hardcoded, coaching invisível**
  - Evidência: prospect/gym.ts dá notas absolutas 1-5 (sem pareamento, sem veto estrutural) e o prompt da Vitória é string hardcoded em agent.ts:61-99 sem versionamento. O 'coach Vitória from gym round 1 findings' (commit 4e12ac0) foi edição manual de código — impossível saber se melhorou, pois notas absolutas de juiz não-calibrado não detectam delta real.
  - Arquivos: api/_lib/prospect/gym.ts, api/_lib/prospect/agent.ts, api/_lib/gym/judge.ts
  - Recomendação: Reusar a infra style_packs para versionar o prompt da Vitória e portar o judgePair pareado do gym da Stevi — a arquitetura já existe no repo, é replicação, não invenção.
- [MEDIUM][S] **Mineração do playbook tem defeitos de amostragem: threads interleaved sem separação e janela que descarta as mensagens mais recentes**
  - Evidência: learn.ts:107-112 busca prospect_messages com order ascending + limit(400): com >400 msgs em 14 dias, mantém as 400 mais ANTIGAS e o slice(-8000) corta chars, não conversas. learn.ts:121-126 concatena todas as threads misturadas por timestamp — prospect_id é selecionado e ignorado — então 'o que moveu a conversa' é atribuição sobre diálogos embaralhados.
  - Arquivos: api/_lib/prospect/learn.ts
  - Recomendação: Agrupar por prospect_id, amostrar N threads completas (priorizando as com reply/conversão), ordenar descending com limit. Pequeno, melhora diretamente a qualidade do único loop automático.
- [MEDIUM][M] **Aprendizado de prospecção termina num bloco de 700 chars — não realimenta targeting, cadência nem copy**
  - Evidência: O playbook só vira playbookBlock (learn.ts:71-78) no prompt conversacional. Learnings sobre 'quem responde' não tocam a seleção/priorização de alvos (prospect/source.ts), a cadência D+3 (dispatch), nem geram propostas de novo template (templates Meta são estáticos por natureza, mas nada acumula candidatos a v3 do template). replyRateByKind é computado e ninguém decide nada com ele automaticamente.
  - Arquivos: api/_lib/prospect/learn.ts, api/_lib/prospect/source.ts, api/_lib/prospect/dispatch.ts
  - Recomendação: Passo 1 barato: o run semanal já emite stats por kind — usar p/ reordenar a fila de dispatch por kind com melhor reply rate. Passo 2: acumular 'candidatos a template' minerados p/ revisão humana mensal.
- [LOW][S] **Incidente→check é artesanal: o padrão #132000 não virou processo**
  - Evidência: O outage de 13/jul virou o template shape check (canary.ts:183-190) porque um humano escreveu o código — excelente reação pontual, mas não há ritual que garanta que TODO incidente (ex.: o atual das credenciais Cloud re-sincronizadas e do PROSPECT_DAILY_CAP=0, commits 6605977/18f2170) termine com um novo check de canário + teste antes do post-mortem fechar.
  - Arquivos: api/_lib/canary.ts, tasks/lessons.md
  - Recomendação: Checklist de encerramento de incidente em tasks/lessons.md ou no plano: 'que check de canário teria pego isso? que teste pina a correção?' — duas perguntas obrigatórias, custo zero.
- [LOW][M] **gym_runs acumula transcripts e verdicts que nunca voltam ao sistema**
  - Evidência: gym_runs e prospect_gym_runs guardam transcripts completos (migrations 20260709000012, 20260710000019) e o painel os exibe read-only (api/ops/gym.ts). Não existe caminho transcript ruim → novo caso golden, nova persona, ou nova regra de pack — o corpus de avaliação não cresce com o que as runs revelam.
  - Arquivos: api/ops/gym.ts, supabase/migrations/20260709000012_gym.sql
  - Recomendação: Ação 'promover a caso golden' no painel Treino: seleciona um turn ruim, preenche must/must_not, appenda no goldenset.jsonl via PR — o corpus passa a compor.

**Quick wins:**
- Michel assina os 36 casos do golden set (verified_by) — transforma a métrica central de opinião de LLM em verdade de especialista
- Trocar o juiz do golden eval e do Vitória gym para ROCA_JUDGE_MODEL cross-family (2 linhas: goldeneval.ts:206, prospect/gym.ts:224)
- Exibir o playbook vigente da Vitória no /painel (learnings + stats + data) — hoje o que está injetado no prompt de produção é invisível
- Corrigir a amostragem do learn.ts: agrupar por prospect_id, ordenar descending (hoje limit(400) ascending descarta a semana mais recente)
- Golden parcial semanal (--limit 12) encadeado no monitor de segunda com alerta em queda >10pp

**Movimentos estratégicos:**
- Fechar o loop com o fazendeiro real: sinal de outcome por conversa (retorno/silêncio/lead aceito) → mineração semanal de conversas reais de produtores → candidatos a golden case e persona, com aprovação humana no painel
- Promoção por evidência: ativação de style pack exige gym win + golden ≥ campeão registrados; criar lineage auditável de campeões (a migration promete, o schema não entrega)
- Versionar o prompt da Vitória na infra de packs existente e portar o julgamento pareado — todo agente da empresa passa a evoluir pelo mesmo trilho champion/challenger
- Institucionalizar incidente→check: todo outage fecha com um novo canary check + teste que o teria pego (padrão #132000 como processo, não como heroísmo)

---
## APIs externas & resiliência

**Área:** APIs externas & resiliência  |  **Nota:** 5.5

**Veredito:** A disciplina de fail-soft é real — quase toda ferramenta degrada para null com fallback honesto em PT-BR, e o canary com alerta só em transição é um padrão acima da média para o estágio. Mas a fundação é frágil de um jeito que o time subestima: as três fontes que sustentam os momentos de maior valor (titiler.xyz demo para NDVI/onboarding, Yahoo Finance não-oficial para preços, Open-Meteo keyless fora dos termos de uso comercial) não têm contrato, SLA nem plano B, e o cálculo de NDVI provavelmente carrega um viés sistemático para baixo (offset BOA de +1000 do Sentinel-2 ignorado) que descalibra todas as faixas de vigor mostradas ao produtor. Pior: a chamada mais quente do sistema (OpenRouter) é a única sem deadline, e os alertas proativos — o loop de retenção — morrem em silêncio absoluto quando o INPE ou o forecast falham, sem nenhuma checagem no canary. O sistema é honesto quando sabe que falhou; o problema são as falhas que ele não sabe detectar e as informações erradas que entrega com confiança.

**Forças:**
- Fail-soft consistente e deliberado: soil/ndvi/geo degradam para null com timeout explícito, e as respostas ao produtor admitem a falha em linguagem honesta (reason.ts:108, reason.ts:204, prices.ts:149) em vez de inventar dado
- Canary diário com alerta só em transições (quebrou/voltou), persistência em canary_runs e checagem de SHAPE de template — lição do outage #132000 de Jul/13 institucionalizada em código (canary.ts:177-218)
- Copy com hedge e fonte citada: portaria MAPA nomeada no vazio, margem de ~1km do INPE declarada, "previsão de ponto tem incerteza" na geada, idade da imagem NDVI exposta quando >21 dias (reason.ts:133-138)
- Lógica pura separada de I/O (deltaT.ts, calendar.ts, parseFireCsv, pickBrazilHit) — testável e testada; thresholds exportados para não divergirem do prompt
- Auto-vigilância de dados estáticos: agrofit.json carimbado com generated_at, check de 120 dias no canary, e heurística de staleness do calendário de vazio (agrofit.ts:50-78, calendar.ts:123-131)

**Findings:**
- [CRITICAL][M] **NDVI provavelmente com viés sistemático para baixo: offset BOA (+1000) do Sentinel-2 ignorado**
  - Evidência: ndvi.ts:5-7 afirma "Because it's a ratio, raw digital numbers work — no reflectance scaling needed" e pointNdvi (ndvi.ts:337-345) calcula (nir-rv)/(nir+rv) sobre DN cru do titiler. Isso é verdade para fator de ESCALA, mas falso para offset ADITIVO: desde o processing baseline 04.00 (jan/2022) todo L2A da ESA carrega DN = refletância×10000 + 1000. Com o offset, um talhão vigoroso (NDVI real ~0,80: red 400, nir 3600) computa ~0,53 — cai de "lavoura vigorosa" para "desenvolvimento moderado". As faixas de classifyVigor (0,15/0,3/0,5/0,7) e o gate no_vegetation<0,15 do onboarding (ndvi.ts:85-100) assumem NDVI verdadeiro. NÃO consegui verificar ao vivo se o Earth Search v1 já subtrai o offset nos COGs — precisa de um teste empírico contra um campo sabidamente verde antes de confiar em qualquer leitura.
  - Arquivos: api/_lib/tools/ndvi.ts
  - Recomendação: Verificar empiricamente hoje (ler B04/B08 de um talhão irrigado conhecido e comparar com o NDVI do Copernicus Browser). Se confirmado, subtrair o offset declarado em raster:bands do STAC item (ou migrar para a collection sentinel-2-c1-l2a harmonizada) e adicionar um teste de golden-field que trave a calibração.
- [HIGH][M] **Sem máscara de nuvem por pixel: nuvem sobre o talhão vira "vegetação rala / possível estresse"**
  - Evidência: findLatestScene (ndvi.ts:258-295) filtra só por eo:cloud_cover da CENA inteira (~100×100 km, teto 40%, preferência ≤25%). Uma cena 20% nublada pode ter a nuvem exatamente sobre o pin; nuvem/sombra lê NDVI ~0-0,2 e o produtor recebe "🟡 vegetação rala — possível estresse. Vale olhar de perto" (ndvi.ts:134-139) ou o onboarding trava no falso "não achei vegetação" (farmcard.ts:150-152). A banda SCL (scene classification) do L2A existe exatamente para isso e não é lida em lugar nenhum.
  - Arquivos: api/_lib/tools/ndvi.ts, api/_lib/farmcard.ts
  - Recomendação: Ler a SCL nos mesmos 9 pontos do grid e descartar pixels classificados como nuvem/sombra/cirrus antes de agregar; se sobrarem <5 amostras, cair para a cena anterior. É o tipo de erro que queima confiança de forma irrecuperável ("o satélite disse que minha lavoura tá ruim e ela tá linda").
- [HIGH][M] **titiler.xyz (instância demo pública) é load-bearing no onboarding de produção**
  - Evidência: ndvi.ts:27-28 aponta para https://titiler.xyz e o próprio código admite o problema duas vezes (ndvi.ts:18-19, 301-303: "⚠️ Production should self-host"). Cada pin dispara ~18 point-reads (9 pixels × 2 bandas) + thumbnail no serviço demo do developmentseed — sem SLA, sem rate-limit contratado. E o canary mascara a falha: probe('titiler', '/healthz', okWhen: s<500) (canary.ts:117,127) — um 429 (o modo de falha típico de demo público) ou 404 conta como saudável, enquanto os point-reads reais falham.
  - Arquivos: api/_lib/tools/ndvi.ts, api/_lib/canary.ts
  - Recomendação: Self-hostear titiler (Lambda/Fly, é um container pronto) ou migrar para GEE via programa de startups ANTES de escalar onboarding; trocar o probe do canary por um point-read real num COG conhecido, com okWhen estrito.
- [HIGH][S] **OpenRouter — a dependência mais quente — é a única sem timeout; farmer pode receber silêncio total**
  - Evidência: chatOnce (llm.ts:117-152) faz fetch sem AbortSignal; o próprio canary confessa: "chat() has no deadline of its own" (canary.ts:229-231) e se protege com Promise.race — mas só no canary. No caminho do produtor, um socket pendurado consome os 60s de maxDuration do webhook (vercel.json:5-7); a Vercel mata a função e o catch que enviaria FALLBACK_REPLY (pipeline.ts:947) nunca roda → o produtor não recebe NADA, nem o fallback.
  - Arquivos: api/_lib/llm.ts, api/_lib/pipeline.ts
  - Recomendação: AbortSignal.timeout(~25s) no chatOnce (visão/reasoning) e ~10s no tier barato — deixa margem para o retry e garante que o pipeline sempre alcança o fallback antes do teto de 60s. Mudança de 3 linhas.
- [HIGH][L] **Yahoo Finance não-oficial como fonte de preços + redistribuição em card compartilhável**
  - Evidência: prices.ts:13 usa query1.finance.yahoo.com/v8/finance/chart — API não documentada, sem contrato, historicamente instável (enforcement de crumb/cookie, 401/429 por UA, já quebrou múltiplas vezes para terceiros). O comentário (prices.ts:8-10) mostra que o time evitou o CEPEA por copyright — mas cotações atrasadas de ICE/CME redistribuídas num card de imagem com marca própria, projetado para viralizar ("prices are the most-forwarded content", pipeline.ts:680-682), têm exatamente o mesmo problema de licenciamento de dados de bolsa. Bônus: KC=F é contrato contínuo — no rollover, weekChangePct reporta o gap entre contratos como "variação na semana".
  - Arquivos: api/_lib/tools/prices.ts, api/_lib/pipeline.ts
  - Recomendação: Curto prazo: aceitar o risco conscientemente, adicionar retry + segunda fonte de fallback (ex.: stooq) e tratar rollover no weekChangePct. Antes do card de preços virar loop de crescimento: fonte licenciada (B3 delayed / acordo CEPEA) — o custo jurídico de um cease-and-desist no meio da tração é maior que a licença.
- [HIGH][S] **Alertas proativos morrem em silêncio absoluto: INPE e forecast fora do canary, falha vira só log**
  - Evidência: fetchDailyFires lança erro → monitor.ts:94-96 captura com log.error e segue; findings só registra contagens quando sent/failed>0 (monitor.ts:91-93), então um outage do INPE = zero alertas de fogo por semanas sem NENHUM sinal em findings, canary ou founder alert. externalProbes (canary.ts:115-139) não proba INPE Queimadas nem BigDataCloud. Falha de forecast de geada por fazenda também é só log (alerts.ts:228-231). O loop de retenção inteiro pode estar morto e o sistema reporta verde.
  - Arquivos: api/_lib/canary.ts, api/cron/monitor.ts, api/_lib/alerts.ts
  - Recomendação: Adicionar probes de INPE (HEAD no CSV do dia) e BigDataCloud ao canary; quando fetchDailyFires/forecast falhar, empurrar uma linha para findings ("alertas de fogo NÃO rodaram: INPE indisponível") — o monitor já tem o canal, só não usa.
- [MEDIUM][S] **Escalada de geada suprimida pelo dedup: 'risco' (3°C) na terça silencia o 'geada' (0°C) na quarta**
  - Evidência: frostDedupKey = `frost:${day.date}` (alerts.ts:58-60) e a unicidade é user_id+dedup_key (db.ts:647-665; kind é armazenado mas não diferencia). Se o run de terça classifica a mínima de quinta como 'risco' e alerta, e o forecast de quarta piora para 'geada' (≤1°C — a diferença entre acompanhar e agir), o claim já existe e o upgrade NUNCA é enviado. É precisamente o cenário 'geada que veio mais forte do que o aviso' — o pior erro possível para a confiança no produto. Agravante menor: o cron roda 11:00 UTC = 8h BRT (vercel.json:27), depois da madrugada — a mínima de HOJE já aconteceu e pode ser 'alertada' como previsão.
  - Arquivos: api/_lib/alerts.ts, api/_lib/db.ts
  - Recomendação: Incluir o nível no dedup key (frost:{date}:{risk}) ou permitir re-claim quando o risk piora; excluir o dia corrente do forecast (a geada de hoje já passou às 8h).
- [MEDIUM][M] **Monitor: um único cron de 60s empilha alertas sequenciais + canary + purge — estágios finais morrem primeiro ao escalar**
  - Evidência: monitor.ts roda em série: vazio → geada (fetch Open-Meteo por célula + send por produtor, loop sequencial em alerts.ts:222-252) → fogo (CSV de vários MB) → canary → higiene → purge, tudo dentro de maxDuration 60s (vercel.json:9-11). Com ~50+ fazendas em células distintas e riscos ativos, o estágio de geada sozinho consome o budget (fetch de até 8s + send de ~0,5-1s cada); a Vercel mata a função e canary + purge + monitor_runs insert simplesmente não rodam — sem nenhum registro de execução parcial.
  - Arquivos: api/cron/monitor.ts, api/_lib/alerts.ts, vercel.json
  - Recomendação: Paralelizar fetches de forecast por célula (Promise.all com pool), mover o canary para ANTES dos estágios de envio (é a checagem mais barata e mais crítica), e registrar no monitor_runs quais estágios completaram.
- [MEDIUM][S] **Open-Meteo keyless (termos não-comerciais) e BigDataCloud endpoint 'client' usados server-side em produto comercial**
  - Evidência: weather.ts:2 ("free, no API key"), frost.ts, geo.ts:16 — Open-Meteo grátis é explicitamente para uso NÃO-comercial (limite ~10k calls/dia); Stevi é um negócio. bigdatacloud.net/data/reverse-geocode-client (geo.ts:15) é o endpoint gratuito para uso client-side em browser; chamá-lo de serverless viola os termos. Open-Meteo alimenta o verdito de pulverização, geada e farm card — é a fonte mais load-bearing do produto inteiro, sem chave, sem SLA e fora dos termos. Um bloqueio por IP/UA da Vercel apagaria as três features de uma vez.
  - Arquivos: api/_lib/tools/weather.ts, api/_lib/tools/frost.ts, api/_lib/tools/geo.ts
  - Recomendação: Assinar o Open-Meteo API commercial (~€29/mês, mesma API com chave e SLA) — barato demais para não fazer; trocar BigDataCloud por reverse-geocode do próprio Open-Meteo ou Nominatim self-host.
- [MEDIUM][S] **parseFireCsv confia em ordem fixa de colunas do INPE sem validar o header**
  - Evidência: fires.ts:39-51 assume cols[1]=lat, cols[2]=lon, cols[5]=municipio com split(',') ingênuo e nem lê a linha de cabeçalho. O INPE já mudou schema de produtos públicos antes (o próprio arquivo comenta que a API JSON foi descontinuada, fires.ts:5-6). Se as colunas mudarem e outro campo numérico cair nas posições 1/2, o geofence passa a comparar coordenadas erradas — podendo alertar produtor de queimada inexistente 'a ~2 km' ou silenciar fogo real, sem nenhum erro visível.
  - Arquivos: api/_lib/tools/fires.ts
  - Recomendação: Validar o header (nomes lat/lon/municipio) e resolver índices por nome; abortar com erro alto e claro se o header mudar — melhor zero alertas com alarme do que geofence errado.
- [MEDIUM][S] **NDVI amostra a 'porteira', não o talhão — e a copy instrui exatamente isso**
  - Evidência: reason.ts:96 pede "Manda o pin da porteira" e o grid é 3×3 a 30 m (~60×60 m) centrado no pin (ndvi.ts:44-45), descrito ao produtor como "média de 9 pontos num raio de ~40 m ao redor do pin" (reason.ts:115-117). A porteira fica tipicamente na estrada/sede — o grid pode estar medindo quintal, telhado e beira de estrada e reportar isso como vigor da lavoura. Em talhão pequeno de café (1-5 ha) o erro é proporcionalmente maior; o gate de vegetação do onboarding também sofre (pin válido na porteira → 'não achei vegetação').
  - Arquivos: api/_lib/reason.ts, api/_lib/tools/ndvi.ts
  - Recomendação: Mudar a copy para "pin no meio do talhão" e, no onboarding, quando o NDVI da porteira der baixo, oferecer explicitamente "manda um pin de dentro da lavoura" antes do hold. Custo zero, ganho direto de precisão.
- [LOW][S] **retry.ts promete 'tool fetches' mas nenhuma ferramenta usa; e a governança de dados estáticos é manual**
  - Evidência: retry.ts:2-3 cita "tool fetches" como motivação, mas grep confirma que withRetry só envolve LLM, sends, probes do canary e sourcing de prospect — weather.ts:51, frost.ts:58, prices.ts:53, soil.ts:50, geo.ts:29 são todos single-shot; um 503 transiente custa o verdito de pulverização do produtor. No lado estático: agrofit.json (gerado 2026-07-07) tem nag de 120d mas rebuild manual, e a fatia cobre 5 culturas enquanto crops.ts aceita 10 — produtor de algodão/cana/feijão/trigo/arroz recebe resposta de praga SEM grounding e sem aviso de que não há cobertura.
  - Arquivos: api/_lib/retry.ts, api/_lib/tools/weather.ts, api/_lib/tools/prices.ts, api/_lib/tools/agrofit.ts, api/_lib/tools/crops.ts
  - Recomendação: Envolver os fetches de weather/frost/prices em withRetry (attempts:2 cabe no budget); no reply de praga fora das 5 culturas, dizer explicitamente que o registro não foi consultado para aquela cultura.

**Quick wins:**
- AbortSignal.timeout no chatOnce do OpenRouter (25s reasoning / 10s router) — 3 linhas que eliminam o cenário 'produtor recebe silêncio total'
- Probes de INPE Queimadas e BigDataCloud no canary + trocar o probe do titiler por um point-read real com okWhen estrito (hoje 429/404 contam como saudável)
- Dedup de geada por nível (frost:{date}:{risk}) para não silenciar a escalada risco→geada, e excluir o dia corrente do forecast no run das 8h BRT
- Mudar a copy de 'pin da porteira' para 'pin no meio do talhão' — custo zero, corrige a maior fonte de erro do NDVI em talhão pequeno
- Validar header do CSV do INPE e resolver colunas por nome antes do geofence

**Movimentos estratégicos:**
- Calibração NDVI como projeto com receita de verificação: testar empiricamente o offset BOA (+1000) contra talhões conhecidos, adicionar máscara SCL por pixel, e travar com golden-field tests — hoje toda leitura de vigor mostrada ao produtor é suspeita
- Tirar o titiler.xyz do caminho crítico antes de escalar onboarding: self-host (container pronto) ou GEE via programa de startups — o momento-mágico do produto não pode depender de um demo público sem SLA
- Formalizar o contrato das dependências: Open-Meteo commercial (~€29/mês), decisão consciente sobre licenciamento de preços (B3 delayed/CEPEA) antes do card de cotações virar o loop viral, e uma tabela fonte→SLA→fallback→canary como artefato vivo
- Separar alertas proativos do monitor/canary em crons distintos (ou re-ordenar canary primeiro) com registro de estágios completados — o loop de retenção e o sistema imunológico não podem competir pelos mesmos 60 segundos

---
## Testes & infraestrutura de qualidade

**Área:** Testes & infraestrutura de qualidade  |  **Nota:** 6

**Veredito:** A base é melhor que a média de pré-seed: 547 testes verdes em ~25s, sem rede, com disciplina real de regressão pós-outage (o #132000 virou teste nomeado) e o gate de compliance é a peça mais bem testada do repo. Mas a infraestrutura de qualidade tem três buracos materiais: nada impede um deploy quebrado (CI corre em paralelo ao deploy da Vercel, com push direto em master), o caminho de envio WhatsApp — exatamente onde as duas últimas quebras de produção aconteceram — tem zero testes, e a métrica de "acurácia" do golden set é teatro parcial: o juiz é o mesmo modelo do cérebro (Sonnet dando nota para Sonnet) e 36 de 36 casos nunca foram assinados pelo agrônomo que dá lastro à tese. Gym e goldeneval são bem desenhados no papel, porém 100% manuais e sem nenhum vínculo obrigatório com ativação de pack ou release.

**Forças:**
- Suite rápida, determinística e verde: 58 arquivos / 547 testes em ~25s local, todo I/O mockado (CI sem secrets) — rodou limpa na auditoria (npm test)
- Disciplina de regressão pós-outage exemplar: tests/prospect-dispatch.test.ts pina o outage #132000 ('aborts on an approved-but-reshaped template — the Jul/13 outage'), claim-before-send, cap 0 como parada de emergência e o latch de saúde
- O gate de segurança (compliance.ts) é a peça mais bem testada do repo: 17+ casos de dose/marca/verbo incluindo os gaps de verbo e dose por pé/planta (tests/compliance.test.ts)
- webhook.test.ts cobre o único entrypoint de produção com o invariante que importa (sempre ack, mesmo com pipeline/verify explodindo — anti retry-storm)
- Canário de produção com alerta só em transição (api/_lib/canary.ts) + checagem de shape de template vs registry — o tipo de vigilância que quase nenhuma pré-receita tem

**Findings:**
- [HIGH][S] **Nenhum gate de deploy: CI é paralelo ao deploy da Vercel, não bloqueia nada**
  - Evidência: .github/workflows/ci.yml:6-9 roda em push para master; a integração Git da Vercel faz deploy no MESMO push, em paralelo. vercel.json não tem ignoreCommand/gating, e o git log mostra pushes diretos em master (4ad9de5, 18f2170, 6605977 — todos 'chore(deploy)'). Um commit que quebra typecheck ou testes chega em produção antes do CI terminar de rodar.
  - Arquivos: .github/workflows/ci.yml, vercel.json
  - Recomendação: Gate real: branch protection em master + PR obrigatório com o check 'verify' required, OU ignoreCommand/Deployment Protection na Vercel condicionado ao CI. Parar de dar push direto em master para mudanças de código (env-only pode ter atalho documentado).
- [HIGH][M] **O caminho de envio (transport.send) tem zero testes — exatamente onde as duas últimas quebras de produção aconteceram**
  - Evidência: CloudApiAdapter.send (api/_lib/transport/cloud.ts:228+) e TwilioAdapter.send (twilio.ts:128+) têm lógica real: fallback mídia→texto recursivo, degradação de botões para texto plano, cache de Content SID, document vs image. tests/cloud.test.ts cobre só verifySignature/parseInbound; twilio-signature.test.ts só assinatura; grep por sendText/sendDocument/sendButtons em tests/ retorna vazio. O contrato 'every rich message carries its plain-text twin' (transport/types.ts:31-52) não é pinado por teste nenhum — e o outage de credenciais Cloud + #132000 foram send-path.
  - Arquivos: api/_lib/transport/cloud.ts, api/_lib/transport/twilio.ts, tests/cloud.test.ts
  - Recomendação: Testes de contrato dos dois adapters com fetch mockado: botões degradam para texto, mídia quebrada não derruba a resposta, document leva filename, payload Cloud correto por tipo. É o mesmo padrão do webhook.test.ts, aplicado à outra ponta do fio.
- [HIGH][S] **O juiz do goldeneval é o mesmo modelo do cérebro — auto-avaliação com blind spots correlacionados**
  - Evidência: goldeneval.ts:207 usa MODELS.reasoning() como juiz = anthropic/claude-sonnet-5 (env.ts:18), o MESMO slug que reason() usa para gerar a resposta julgada. O próprio judge.ts do gym documenta por que isso é errado (judge.ts:5-9: juiz da mesma família 'tends to bless its own style') e usa Gemini de propósito. O prospect gym repete o padrão (api/_lib/prospect/gym.ts:224). A acurácia do golden — inclusive o bloco red-team de compliance — é Sonnet dando nota para Sonnet.
  - Arquivos: api/_lib/gym/goldeneval.ts, api/_lib/prospect/gym.ts, api/_lib/env.ts
  - Recomendação: Trocar o juiz do goldeneval (e do prospect gym) para ROCA_JUDGE_MODEL / família diferente, como o gym já faz. Mudança de ~1 linha por arquivo; re-rodar o golden para rebasear a série histórica em golden_runs.
- [HIGH][M] **Golden set: 36 casos, ZERO verificados por agrônomo — a métrica de acurácia não tem lastro técnico**
  - Evidência: knowledge/goldenset/goldenset.jsonl: 36 linhas, 36 com verified_by null (grep confirmou 36/36). Existe até teste pinando o estado ('nothing is agronomist-verified yet', goldeneval.test.ts:44-47) e o CLI implora ('peça pro Michel assinar os casos', scripts/golden-run.ts:61). Para uma tese cuja credibilidade é 'triagem com respaldo de CREA', o ground truth agronômico foi escrito pelos founders e nunca passou pelo Michel.
  - Arquivos: knowledge/goldenset/goldenset.jsonl, scripts/golden-run.ts
  - Recomendação: Sessão de trabalho com o Michel: revisar e assinar os 36 casos (verified_by='michel-crea-es'), corrigir critérios errados, e adicionar 10-15 casos que ELE considera as perguntas perigosas. Só depois disso o número do golden vira argumento de venda/segurança.
- [MEDIUM][S] **A lógica mais traiçoeira do juiz do gym (mapeamento anti-viés de posição) é intestável e não testada**
  - Evidência: judgePair embute Math.random() inline (judge.ts:174) e parseJudgeReply/extractJsonBlock não são exportados; gym.test.ts cobre apenas resolveRun e PERSONAS (grep por judgePair|parseJudgeReply em tests/ vem vazio). Um bug na dupla inversão 'isSlot1 === aIsSlot1' (judge.ts:183) inverteria silenciosamente TODOS os vereditos champion/challenger — e nenhum teste pegaria. toSlotAnswer (judge.ts:125-130) degrada qualquer lixo para 'empate' sem log.
  - Arquivos: api/_lib/gym/judge.ts, tests/gym.test.ts
  - Recomendação: Injetar o RNG (parâmetro com default Math.random), exportar parseJudgeReply, e pinar com testes: mapeamento de slots nos dois sortes, flags de violação mapeadas ao lado certo, parse degradando para tie. ~5 testes, meio dia.
- [MEDIUM][M] **Gym e goldeneval são 100% manuais e nada obriga um challenger a passar no golden antes de ativar um style pack**
  - Evidência: Ativação = flip do campo active em style_packs lido por stylepack.ts:30-38; api/ops/gym.ts é somente leitura de histórico; runGoldenEval aceita packOverride para avaliar 'BEFORE activation' (goldeneval.ts:269) mas isso é convenção de CLI, não gate. Nenhuma tabela vincula o pack ativo a um golden_run/gym_run aprovado; nada roda em CI (por custo, corretamente) nem em pre-activation (incorretamente).
  - Arquivos: api/_lib/stylepack.ts, api/_lib/gym/goldeneval.ts, api/ops/gym.ts
  - Recomendação: Fazer da ativação um fluxo com gate: endpoint/script de ativação que exige golden_run verde recente (e gym run sem veto) para a versão do pack, gravando o vínculo pack↔run. O custo de LLM é o mesmo que hoje — só muda a ordem obrigatória.
- [MEDIUM][M] **Handlers de cron e ops sem nenhum teste de wiring — incluindo o acoplamento endpoint→auth**
  - Evidência: Nenhum teste importa api/cron/* ou api/ops/* (grep em tests/ vazio). api/cron/dispatch.ts:16-20 nega sem CRON_SECRET — não testado; api/cron/monitor.ts (que orquestra canário+frost+fire) idem. ops.test.ts testa as primitivas de opsAuth (token, throttle) mas não que cada um dos 8 endpoints ops de fato as chama — e o histórico do próprio usuário registra 'unauthenticated endpoints slipped through twice'.
  - Arquivos: api/cron/dispatch.ts, api/cron/monitor.ts, api/ops/overview.ts, tests/ops.test.ts
  - Recomendação: Replicar o padrão webhook.test.ts: para cada handler cron/ops, um teste de 401 sem credencial + um happy path com dependências mockadas. É mecânico e barato; o de dispatch importa mais (dinheiro e reputação do número saem por ali).
- [MEDIUM][S] **resolveRouteIntent é um espelho manual do pipeline com drift admitido em comentário e sem teste de equivalência — e 14/36 casos do golden dependem dele**
  - Evidência: goldeneval.ts:87-102: 'if pipeline.ts reorders its cascade, this mirror does NOT catch it automatically — keep the two in sync by hand'. 14 dos 36 casos do golden são mode:route (grep no jsonl), então ~40% da métrica pode medir o espelho, não a produção. goldeneval.test.ts:59-73 testa o espelho contra ele mesmo; pipeline-routes.test.ts testa o pipeline; nada cruza os dois.
  - Arquivos: api/_lib/gym/goldeneval.ts, api/_lib/pipeline.ts
  - Recomendação: O refactor de route-table do handleInbound já foi feito (git log) — extrair a cascata ordenada para uma função compartilhada e deletar o espelho, ou no mínimo um teste que compara a ordem dos dois lado a lado.
- [MEDIUM][M] **Zero E2E real e nenhum smoke test pós-deploy — a janela de detecção de um deploy quebrado é de até 24h**
  - Evidência: Nenhum teste toca Twilio sandbox ou Cloud API de verdade (CI declara e o código confirma: tudo mockado). A única verificação de produção é o canário, que roda 1×/dia (vercel.json:27, cron 0 11) e cujo probe de webhook aceita qualquer não-5xx (canary.ts:137) — não prova que uma mensagem entra e uma resposta sai. Entre um deploy ruim às 12h e o canário do dia seguinte, quem detecta é um fazendeiro sem resposta.
  - Arquivos: api/_lib/canary.ts, vercel.json
  - Recomendação: Smoke sintético pós-deploy: um POST assinado ao webhook de produção com um usuário de teste dedicado (asserta 200 + pipeline invocado via marker em messages), disparado por GitHub Action no evento deployment_status. Encurta 24h para ~2 minutos.
- [LOW][M] **Confiabilidade do juiz LLM nunca foi medida — o veto de segurança do gym é uma única chamada de Gemini Flash sem calibração**
  - Evidência: judge.ts usa 1 chamada por par (temperature 0) e o veto de promoção depende dela; não existe conjunto de calibração (transcrições com violação conhecida que o juiz DEVE flagrar) nem medição de concordância entre replicações/famílias. O design (família separada, randomização, fail-to-tie) é bom, mas é fé, não medida.
  - Arquivos: api/_lib/gym/judge.ts, api/_lib/gym/personas.ts
  - Recomendação: Criar 8-10 transcrições sintéticas com violações plantadas (dose+produto, agronomia inventada) e rodar o juiz nelas como teste de calibração periódico (CLI, não CI); medir taxa de detecção antes de confiar promoções ao veto.
- [LOW][S] **Cobertura nunca é medida — sem config de coverage nem threshold**
  - Evidência: vitest.config.ts não configura coverage e package.json não tem script para isso; 96 arquivos .ts em api/ vs 58 suítes. A distribuição observada é boa nas peças críticas, mas o número real é desconhecido e regressões de cobertura são invisíveis.
  - Arquivos: vitest.config.ts, package.json
  - Recomendação: Adicionar @vitest/coverage-v8 com um relatório informativo no CI (sem threshold rígido no início) — só para tornar o buraco visível, ex.: transport/*.ts hoje apareceria vermelho.

**Quick wins:**
- Trocar o juiz do goldeneval (e do prospect gym) para família diferente do cérebro (usar ROCA_JUDGE_MODEL como o gym já faz) — ~1 linha por arquivo
- Ativar branch protection em master + check 'verify' obrigatório (ou Deployment Protection na Vercel) — encerra o deploy-sem-gate hoje
- Injetar RNG em judgePair, exportar parseJudgeReply e pinar o mapeamento de slots com ~5 testes
- Testes 401/happy-path para api/cron/dispatch.ts e api/cron/monitor.ts no padrão webhook.test.ts
- Agendar a sessão com Michel para assinar (verified_by) os 36 casos do golden set

**Movimentos estratégicos:**
- Transformar o golden em gate de release: ativação de style pack / troca de modelo só via fluxo que exige golden_run verde (juiz de outra família, casos assinados) e grava o vínculo pack↔run
- Smoke E2E sintético pós-deploy contra o webhook de produção (usuário de teste, assinatura válida) via GitHub Action em deployment_status — janela de detecção de 24h vira minutos
- Cobrir a camada transport.send com testes de contrato dos fallbacks (botões→texto, mídia quebrada→texto) — é a camada que já quebrou duas vezes em produção
- Calibrar o juiz LLM com transcrições de violação plantada e medir concordância entre replicações antes de confiar promoções ao veto de segurança

---
## Segurança & LGPD

**Área:** Segurança & LGPD  |  **Nota:** 7

**Veredito:** A engenharia de segurança é notavelmente acima da média para dois founders pré-receita: HMAC verificado sobre raw body nos dois provedores, RLS em todas as tabelas, throttle de login fail-closed, URLs assinadas com TTL para o histórico químico, logger que mascara telefones e um fluxo de exclusão LGPD que realmente apaga. O problema não é invasão — é compliance: a base legal declarada ("consentimento") não é a implementada (aviso pós-fato), o agente de prospecção usa o nome da cofundadora real e só admite ser IA se perguntado (violação da política de automação do WhatsApp, no mesmo número que acabou de sair de um outage), nenhum aviso cita OpenRouter/Anthropic/Google como operadores nem transferência internacional, e coordenadas exatas da fazenda viajam em URLs públicas cacheáveis que o próprio schema chama de sensíveis. São gaps de papel e de política de plataforma — baratos de fechar agora, caros de fechar depois de uma denúncia ou de um ban do número.

**Forças:**
- Webhook verifica assinatura dos dois provedores sobre o raw body com timingSafeEqual antes de qualquer trabalho (api/webhook.ts:92, transport/twilio.ts:75-88, transport/cloud.ts:116-125); statuses Cloud só processados após verificação
- RLS habilitado em 100% das tabelas com zero policies (anon key não lê nada); o gap de prospects foi detectado e corrigido (20260712000021_prospects_rls.sql)
- Login do painel: throttle por IP + global persistido em DB que FALHA FECHADO se a contagem falhar, compare constant-time resistente a length-leak (opsAuth.ts:50-75, ops/login.ts:26-35)
- Histórico químico atrás de URL assinada HMAC com TTL e Cache-Control private/no-store, nunca em query aberta (reportToken.ts, card.ts:209-224, report.ts:25-33); direito de exclusão LGPD funciona de verdade e roda antes de tudo (pipeline.ts:1158, db.ts:756-775), com purge de retenção e scrub de digests
- Opt-out de prospect honrado imediatamente e permanentemente via blocklist checada antes de todo envio (prospect/inbound.ts:53-62, prospects.sql:33-38)

**Findings:**
- [HIGH][S] **Agente 'Vitória' não se declara IA proativamente — risco de ban do número (política Meta) e de transparência LGPD**
  - Evidência: api/_lib/prospect/agent.ts:24-27 nomeia o agente com o nome da cofundadora real ("prospects talk 'with Vitória'") e o prompt só manda revelar ser IA "se perguntarem" (agent.ts:91-93). A política de mensagens do WhatsApp Business exige disclosure de experiência automatizada; o número Cloud é o MESMO que serve fazendeiros e acabou de sair de um outage (template #132000, PROSPECT_DAILY_CAP=0 como parada de emergência). Uma denúncia de prospect ("pessoa falsa") pode derrubar o canal inteiro do negócio.
  - Arquivos: api/_lib/prospect/agent.ts
  - Recomendação: Incluir disclosure na primeira resposta do agente (ex.: assinatura "Vitória · assistente digital da Stevi") e no template de primeiro toque. Custa uma linha; o próprio prompt já admite o risco ("uma pessoa falsa desmascarada gera denúncia").
- [HIGH][M] **Base legal declarada ≠ implementada: página pública promete 'consentimento', código registra apenas aviso pós-processamento**
  - Evidência: api/_lib/verifierPage.ts:128 afirma "com seu consentimento na primeira mensagem"; mas db.ts:326-338 documenta a base real ("continued use after being informed is the working basis") e o campo consent_lgpd_at marca só a ENTREGA da nota. A nota (CONSENT_NOTE, pipeline.ts:98-99) é anexada à primeira RESPOSTA (pipeline.ts:1089) — ou seja, localização e mensagem já foram processadas e enviadas a LLM antes de qualquer aviso. Não é consentimento LGPD (art. 5º, XII: manifestação livre, informada e inequívoca).
  - Arquivos: api/_lib/verifierPage.ts, api/_lib/db.ts, api/_lib/pipeline.ts
  - Recomendação: Assumir a base legal verdadeira (legítimo interesse/execução de contrato) com LIA documentada, corrigir o texto do /verificar, e renomear semanticamente o campo (notice_delivered_at). Alternativa: pedir opt-in explícito antes de persistir localização. A mentira pública é o pior dos dois mundos em fiscalização ANPD.
- [MEDIUM][S] **Nenhum aviso cita operadores (OpenRouter/Anthropic/Google/Meta) nem transferência internacional de dados**
  - Evidência: Texto, fotos, voz e coordenadas do produtor vão para OpenRouter nos EUA (llm.ts:10, 122-136) e daí para Anthropic/Google; prospecção usa Google Places (prospect/source.ts). CONSENT_NOTE (pipeline.ts:98-99) e /verificar (verifierPage.ts:128) falam só em "guardo sua localização e o histórico" — zero menção a terceiros ou transferência internacional (LGPD arts. 9º e 33). Não verifiquei existência de DPAs assinados — se existirem, o gap é só de transparência.
  - Arquivos: api/_lib/pipeline.ts, api/_lib/verifierPage.ts, api/_lib/llm.ts
  - Recomendação: Uma frase no /verificar e na CONSENT_NOTE ("usamos provedores de IA nos EUA sob contrato"), + inventário simples de operadores com cláusulas contratuais padrão (OpenRouter, Supabase, Vercel, Meta, Twilio, Google).
- [MEDIUM][S] **Coordenadas exatas da fazenda em URLs públicas cacheáveis — contradiz a própria política do schema**
  - Evidência: pipeline.ts:204 e 209 montam /api/card?type=farm|spray&lat=<exato>&lon=<exato> sem assinatura nem arredondamento; card.ts:232-235 serve com Cache-Control public. A URL vaza em forward da mensagem, logs de CDN/proxy e no provedor. O init.sql:2-3 declara "Precise coordinates are sensitive; keep access to the service role only" — e depois o pipeline as publica em query string. Violam também a regra da casa ("never place personal data in URL parameters").
  - Arquivos: api/_lib/pipeline.ts, api/card.ts
  - Recomendação: Truncar lat/lon a 3 casas decimais (~110 m — irrelevante para clima/solo em grade de ~1-11 km) nos cards spray/farm, ou usar o mesmo modelo assinado do applications. Truncar é 1 linha e mata o problema.
- [MEDIUM][M] **Painel ops: senha única compartilhada, single-factor, protegendo PII integral e o botão de disparo em massa**
  - Evidência: opsAuth.ts:1-9 — uma senha compartilhada (OPS_PASSWORD) dá acesso a threads completas com telefone integral (opsData.ts opsThread) E a ações de efeito real: ops/prospects.ts:137-142 aceita action=dispatch com dryRun:false (envio outbound real) via POST autenticado só pelo cookie. Sem 2FA, sem identidade por founder (auditoria não distingue quem fez o quê). CSRF mitigado apenas por SameSite=Lax.
  - Arquivos: api/_lib/opsAuth.ts, api/ops/prospects.ts
  - Recomendação: Para o estágio: senha longa aleatória obrigatória + TOTP (biblioteca de 20 linhas) ou passkey; exigir header custom (X-Stevi-Ops: 1) nos POSTs como anti-CSRF de cinto-e-suspensório; logar qual sessão executou dispatch/promote.
- [MEDIUM][M] **Prospecção outbound sem LIA/RoPA e com import manual sem procedência registrada**
  - Evidência: source.ts:8-9 afirma em comentário que números do Google Places são "the LGPD-safe class", mas não há Legitimate Interest Assessment nem registro de operações documentado no repo. Pior: ops/prospects.ts:29-38 aceita import por texto livre colado no painel (source: 'manual') — a procedência desses números fica irrastreável, e o agente promete ao prospect "contato comercial público (site ou diretório da própria empresa)" (agent.ts:94-96), o que pode ser falso para imports manuais.
  - Arquivos: api/ops/prospects.ts, api/_lib/prospect/source.ts, api/_lib/prospect/agent.ts
  - Recomendação: Exigir campo de procedência no import manual (URL/origem) e gravá-lo em prospects.source; escrever LIA de 1 página + RoPA simples antes de escalar o outbound (cap hoje é 0 — momento perfeito).
- [LOW][S] **Rate limit público é in-memory por instância — escala horizontal e cold start o diluem**
  - Evidência: httpRateLimit.ts:8-13 admite o trade-off ("NOT a globally-consistent guarantee"): cada instância Fluid tem contadores próprios, então N instâncias = N×120 req/min por IP, e card.ts dispara fetches externos (weather/soil/geo/NDVI) + rasterização por request com variação de lat/lon furando o CDN.
  - Arquivos: api/_lib/httpRateLimit.ts, api/card.ts
  - Recomendação: Aceitável documentado para pré-receita. Quando houver custo real: regra de rate limit no Vercel WAF (config, não código) ou Upstash. Não vale infra nova hoje.
- [LOW][S] **CRON_SECRET comparado com === (não constant-time) em 3 endpoints**
  - Evidência: api/cron/dispatch.ts:19, api/cron/digest.ts:20, api/cron/monitor.ts:34 — `req.headers['authorization'] === \`Bearer ${secret}\``. Timing attack por rede em Vercel é impraticável, mas o repo já tem safeEqual pronto em opsAuth.ts:50 — a inconsistência é grátis de eliminar.
  - Arquivos: api/cron/dispatch.ts, api/cron/digest.ts, api/cron/monitor.ts
  - Recomendação: Trocar por safeEqual(auth, `Bearer ${secret}`) nos três handlers.
- [LOW][S] **OPS_SESSION_SECRET cai para CRON_SECRET — acoplamento de segredos com blast radius cruzado**
  - Evidência: opsAuth.ts:23-36: sem OPS_SESSION_SECRET, sessões do painel são assinadas com CRON_SECRET — o mesmo segredo que viaja como bearer em toda invocação de cron. Vazou o cron secret (log de proxy, misconfiguração), forja-se sessão de painel com acesso a toda PII. O código já loga warning, mas fallback silencioso em produção é convite a nunca configurar.
  - Arquivos: api/_lib/opsAuth.ts
  - Recomendação: Tornar OPS_SESSION_SECRET obrigatório (throw, não warn) — é uma env var de 1 minuto.
- [LOW][S] **Retenção de mensagens (365d) excede o uso real (180d) sem justificativa registrada**
  - Evidência: db.ts:700-707 purga messages a 365d, mas o próprio comentário diz que o consumidor mais longo (caderno) lê 180d. Transcritos de voz idem. Minimização LGPD (art. 6º, III) pede alinhar retenção ao uso ou documentar por que 365.
  - Arquivos: api/_lib/db.ts
  - Recomendação: Reduzir para 180d ou anotar a justificativa (ex.: histórico anual de safra) no comentário da purge e no aviso de privacidade.

**Quick wins:**
- Adicionar disclosure de IA na primeira mensagem do agente de prospecção e no template aprovado (1 linha, mata o maior risco de plataforma)
- Corrigir o texto do /verificar: trocar a alegação de 'consentimento' pela base legal real + citar operadores de IA nos EUA (verifierPage.ts:128 e CONSENT_NOTE)
- Truncar lat/lon a 3 casas decimais nas URLs de card spray/farm (pipeline.ts:204,209)
- Trocar === por safeEqual no bearer dos 3 crons e tornar OPS_SESSION_SECRET obrigatório
- Exigir procedência no import manual de prospects (campo origem gravado em prospects.source)

**Movimentos estratégicos:**
- Escrever a LIA + RoPA (1-2 páginas cada) cobrindo produto e prospecção ANTES de religar o outbound (cap está em 0 — é a janela ideal); isso vira ativo de due diligence para investidores
- Adicionar 2FA (TOTP/passkey) e identidade por founder no painel — o console é hoje o único ponto onde toda a PII aparece por extenso e onde envios em massa são disparáveis
- Formalizar o inventário de operadores + DPAs (OpenRouter, Supabase, Vercel, Meta, Twilio, Google) e o mecanismo de transferência internacional (cláusulas-padrão ANPD)
- Separar o número/WABA de prospecção do número que atende fazendeiros — hoje um ban por denúncia de cold outreach derruba o produto inteiro

---
## Produto & CX conversacional (Stevi via WhatsApp)

**Área:** Produto & CX conversacional (Stevi via WhatsApp)  |  **Nota:** 6

**Veredito:** A conversa núcleo é bem acima da média de agtech: honestidade operacional real (NDVI velho declarado, pin sem vegetação não vira "sua lavoura", veredito de pulverização assumido como previsão), voz PT-BR trabalhada com A/B via Gym, e degradação honesta em toda falha de fonte. Mas o produto tem três rachaduras estruturais: (1) o "loop de retenção" (alertas de geada/fogo/vazio) está quebrado por construção — cron manda via TwilioAdapter hard-coded e free-form, então produtor do canal Cloud e qualquer produtor dormente >24h simplesmente não recebe; (2) metade das features (cotações, caderno, histórico, resumo, relatório PRONAF) só existe atrás de regex — errou a frase, cai num LLM que não sabe que essas features existem e cujo style pack declara o tema fora de escopo; (3) zero feedback de velocidade percebida em caminhos de 2-3 chamadas LLM sequenciais. O fazendeiro que acerta o caminho feliz é bem servido; o que erra a frase ou some por dois dias encontra um produto mudo ou incoerente.

**Forças:**
- Honestidade quando a fonte falha é disciplina, não acidente: NDVI velho vem com idade e ressalva (reason.ts:122-137), pin sem vegetação segura a resposta em vez de analisar telhado (farmcard.ts:44-60,149-153), cotações com disclaimer de praça (prices.ts:163-166)
- Style pack v4 com estrutura condicional (resposta-primeiro para veredito, calor-primeiro para relação) evoluída por A/B real no Gym — engenharia de voz rara em produto desse estágio
- Fail-soft em todas as camadas: toda falha de ferramenta tem uma resposta honesta pro produtor (áudio ilegível, foto ilegível, clima fora, cotação fora) — nenhum dead-end técnico cru
- Quick replies são queries reais que reentram no pipeline — zero estado extra, degrade limpo pra texto puro nos dois adapters
- Onboarding payback bem desenhado: farm card deriva solo+clima+vazio+NDVI em paralelo com cap de 7s (farmcard.ts:34,111-145) — o momento "ele conhece minha terra" chega rápido

**Findings:**
- [HIGH][M] **Alertas proativos (o loop de retenção declarado) não chegam a quem deveriam re-engajar**
  - Evidência: api/cron/monitor.ts:70,77,89 instancia `new TwilioAdapter()` hard-coded para vazio/geada/fogo, enquanto api/webhook.ts:39 seleciona adapter por request (Cloud OU Twilio) — produtor adquirido via Cloud recebe alerta de OUTRO número (quebra de identidade) ou nada. Pior: nem cloud.ts nem twilio.ts têm caminho de template na send(); free-form fora da janela de 24h é rejeitado pelos dois provedores — exatamente o produtor dormente que o alerta existe pra trazer de volta. alerts.ts:141 solta o claim e re-tenta amanhã, falhando de novo, para sempre.
  - Arquivos: api/cron/monitor.ts, api/_lib/alerts.ts, api/_lib/transport/cloud.ts, api/_lib/transport/twilio.ts
  - Recomendação: Persistir o provider/canal por usuário e rotear o alerta pelo canal de origem; criar templates aprovados para geada/fogo/vazio e usar template-first com fallback free-form quando dentro da janela. Medir entregas de alerta no digest (hoje failed aparece mas ninguém liga o porquê).
- [HIGH][M] **Features inteiras só existem atrás de regex; o fallback LLM não sabe que elas existem — e o style pack nega o escopo**
  - Evidência: Cotações, histórico, resumo, caderno de aplicações e relatório PRONAF só disparam por regex (pipeline.ts:134-161). O router LLM não tem esses intents (router.ts:23 LLM_INTENTS) e o SYSTEM_PROMPT (prompts/system.ts) não menciona nenhuma dessas capacidades — uma frase fora do padrão ("como anda o mercado do café?", "quanto que tá o café") cai em 'general', onde o modelo pode negar a capacidade ou inventar preço de memória (a prime directive só proíbe inventar AGRONOMIA, não cotação). O pack v4 ainda declara "crédito" fora de escopo (prompts/style-packs/v4/README.md:75) enquanto o produto tem financing_report. O commit 011eb7e (branch) consertando 'quanto tá a saca do café' mostra o whack-a-mole em curso.
  - Arquivos: api/_lib/router.ts, api/_lib/prompts/system.ts, api/_lib/pipeline.ts, prompts/style-packs/v4/README.md
  - Recomendação: Adicionar prices/history/brief ao taxonomy do router LLM como classes; incluir um parágrafo de capacidades no SYSTEM_PROMPT (o que a Stevi sabe fazer e o gatilho de cada coisa) e proibir explicitamente citar preço de memória; alinhar a seção fora-do-escopo do pack com as features reais.
- [HIGH][S] **Zero feedback de velocidade percebida: sem mark-as-read/typing, com caminhos de 2-3 chamadas LLM sequenciais**
  - Evidência: cloud.ts não tem nenhuma chamada de mark-as-read/typing indicator (grep confirma: só parsing de status callbacks, linha 54-84). Foto de praga = identifyFromPhoto + compose, duas chamadas reasoning-tier sequenciais (reason.ts:276,318); áudio = transcrição + router + reason (3 chamadas em série). O produtor em 3G manda a foto do problema mais urgente da lavoura e encara um chat mudo, nem 'lida' marca, por 15-30s.
  - Arquivos: api/_lib/transport/cloud.ts, api/webhook.ts, api/_lib/reason.ts
  - Recomendação: Cloud API suporta mark-as-read com typing indicator num único POST — disparar ao receber o webhook, antes de qualquer trabalho. Avaliar fundir identificação+composição da triagem de foto numa chamada só com saída estruturada+texto.
- [MEDIUM][M] **Os cartões visuais matam os quick replies exatamente nos momentos de vitória**
  - Evidência: Nos dois adapters, mensagem com mídia não carrega botões: twilio.ts:144 ("media wins here") e cloud.ts (payload de mídia sem botões). O próprio código justifica os botões citando Farmer.Chat (~45% das interações vindas de follow-ups sugeridos, pipeline.ts:285-288) — mas veredito de spray com card, NDVI com card, triagem com pest card e cotação com card (os picos de valor) shipam SEM os próximos passos.
  - Arquivos: api/_lib/transport/cloud.ts, api/_lib/transport/twilio.ts, api/_lib/pipeline.ts
  - Recomendação: No Cloud API, usar interactive message com image header (suporta botões + imagem juntos); no Twilio, mandar os botões como segunda mensagem curta após o card.
- [MEDIUM][M] **"Meu histórico" devolve contagens, não conteúdo — e as aplicações registradas nem aparecem**
  - Evidência: caderno.ts:19-25: EVENT_LABELS só mapeia 5 intents para rótulos genéricos ("📷 triagem de praga/doença") — sem qual praga, qual veredito, qual talhão. application_log não está no mapa, então o único registro estruturado que o produtor ativamente declarou ("apliquei X ontem") fica FORA do histórico dele. O "retention moat" hoje é uma lista de contadores.
  - Arquivos: api/_lib/caderno.ts, api/_lib/pipeline.ts
  - Recomendação: Incluir application_log no EVENT_LABELS e enriquecer os últimos registros com o conteúdo (praga identificada, veredito de spray, produto aplicado) — os dados já estão no message log e na tabela applications.
- [MEDIUM][S] **Pedido explícito de agrônomo sem parceiro casado vira promessa vaga de futuro, apesar do concierge real existir**
  - Evidência: pipeline.ts:171-174: REFERRAL_REPLY fecha com "Assim que a nossa rede de agrônomos parceiros estiver pronta, eu te conecto" — mas o código pinga os founders imediatamente por email+WhatsApp (pipeline.ts:736-746) justamente pra follow-up humano. O produtor no momento de maior intenção de conversão ouve "algum dia" quando a operação real é "alguém te procura".
  - Arquivos: api/_lib/pipeline.ts
  - Recomendação: Trocar a copy para prometer o follow-up que já acontece ("anotei — nossa equipe te chama por aqui pra te conectar"), mantendo honestidade sobre prazo.
- [MEDIUM][M] **Gate de compliance substitui a resposta INTEIRA por texto de praga/receituário — falso positivo de adubação vira non-sequitur**
  - Evidência: compliance.ts:36-57: dose (kg/g/L por ha/m²/planta) + verbo de aplicação dispara o gate sem distinguir defensivo de corretivo — "aplique 2 kg de calcário por m²" ou dose de adubo tripa o padrão. compliance.ts:167: o SAFE_REPLACEMENT fala de "praga/doença" e receituário; um produtor que perguntou de calagem recebe uma resposta sobre outro assunto. O gate também descarta todo o conteúdo legítimo da resposta em vez de só a parte problemática.
  - Arquivos: api/_lib/compliance.ts
  - Recomendação: Excluir corretivos/fertilizantes comuns (calcário, gesso, ureia, NPK) do gatilho quando não há defensivo/marca/ativo junto; e neutralizar o SAFE_REPLACEMENT para não presumir contexto de praga.
- [MEDIUM][S] **Transcrição de áudio truncada silenciosamente em 500 tokens — a resposta sai baseada numa pergunta cortada**
  - Evidência: transcribe.ts:29-31: maxTokens:500 (~2 min de fala). O público-alvo de letramento baixo manda exatamente os áudios longos de desabafo que o pack v4 celebra acolher; um áudio de 3 min corta no meio sem nenhum aviso ao produtor nem flag no pipeline, e a Stevi responde ao fragmento com confiança.
  - Arquivos: api/_lib/transcribe.ts, api/_lib/pipeline.ts
  - Recomendação: Subir o teto e detectar truncamento (duração do áudio vs tamanho do transcript, ou finish_reason) — quando cortar, admitir: "peguei a primeira parte do seu áudio até X; manda o resto ou resume em texto".
- [LOW][S] **O farm card — momento wow do onboarding — pergunta "Soja, milho, pasto?" sem café, o carro-chefe do GTM**
  - Evidência: farmcard.ts:170 vs pipeline.ts:521 (que inclui café). O goldenset é dominado por casos de café e o parceiro técnico é CREA-ES (região cafeeira); o cafeicultor no momento de maior encantamento recebe uma pergunta que sugere que a Stevi não é pra ele. parseCrops aceita café/citros (tools/crops.ts:18-19), só o convite que esconde.
  - Arquivos: api/_lib/farmcard.ts
  - Recomendação: Alinhar a pergunta: "Soja, milho, café, pasto?" no farm card (e considerar citros quando UF=SP).
- [LOW][M] **Goldenset (36 casos) não cobre voz, conteúdo de cotações/histórico/brief, nem o fluxo do pin**
  - Evidência: knowledge/goldenset/goldenset.jsonl: 36 linhas; prices/history/brief aparecem só em mode:'route' (roteamento, sem asserção de conteúdo); zero casos de áudio (o caminho de maior risco de UX pro público-alvo), zero casos do onboarding por pin/no-vegetation, zero casos de alerta proativo. As "interações esperadas" auditam bem o núcleo pest/spray e quase nada do resto do produto.
  - Arquivos: knowledge/goldenset/goldenset.jsonl
  - Recomendação: Adicionar casos reply-mode para cotações (deve citar ressalva de praça), histórico (deve trazer conteúdo, não contagem), brief (campos), e um lote de transcrições de áudio reais com ruído/regionalismo.

**Quick wins:**
- Incluir café na pergunta de cultura do farm card (farmcard.ts:170) — uma linha, corrige o momento wow pro público-alvo principal
- Trocar a copy do REFERRAL_REPLY para prometer o follow-up humano que já existe, em vez de "quando a rede estiver pronta"
- Disparar mark-as-read + typing indicator no Cloud adapter assim que o webhook chega — um POST, transforma a velocidade percebida
- Adicionar application_log ao EVENT_LABELS do caderno.ts para o histórico incluir o que o produtor declarou ter aplicado
- Acrescentar um parágrafo de capacidades (cotações, histórico, resumo, caderno) ao SYSTEM_PROMPT + mencionar cotações na intro canned de smalltalk (reason.ts:393)

**Movimentos estratégicos:**
- Consertar o canal de alertas de ponta a ponta: provider persistido por usuário, templates aprovados para geada/fogo/vazio, template-first fora da janela de 24h — sem isso o loop de retenção é ficção e a tese de re-engajamento não é testável
- Acabar com o whack-a-mole de regex: promover prices/history/brief a classes do router LLM e dar ao modelo consciência das próprias features — a taxa de "feature existe mas o produtor não achou" hoje é invisível nas métricas
- Resposta em áudio (TTS) opcional para quem manda áudio: o produto hoje é assimétrico — aceita a voz do produtor de letramento baixo mas responde com 10 linhas de texto com markdown
- Transformar o caderno passivo em registro com substância (praga diagnosticada, veredito, aplicação) — é a única feature com potencial de moat real e hoje entrega contadores

---
## Performance & Custo (Vercel + LLM + latência WhatsApp)

**Área:** Performance & Custo (Vercel + LLM + latência WhatsApp)  |  **Nota:** 6.5

**Veredito:** A engenharia de custo fora do caminho crítico é acima da média para um pré-receita: 3 crons totais (1x/dia, 1x/dia, 3x/dia úteis), tiering de modelo correto (Haiku router / Sonnet reasoning / Gemini Flash ASR), guards baratos antes de qualquer LLM e retries bounded — o custo de LLM por conversa hoje é irrisório (~US$0,01-0,02 por turno de texto, ~US$0,03-0,06 por foto; conversa típica de 5 turnos < US$0,10). Dinheiro não é o problema; latência no caminho WhatsApp é. O webhook segura o ack do provedor até o pipeline inteiro terminar (foto: 12-25s vs ~15s de timeout do Twilio), a entrega do texto fica refém de um card que leva 5-11s para rasterizar no fetch do WhatsApp, e a única chamada externa sem deadline é justamente a mais lenta (OpenRouter). Há trabalho duplicado no NDVI (mesma cena STAC buscada 2x) sobre infra demo pública que o próprio código marca como imprópria para produção, e zero observabilidade de custo real — o campo usage da API é descartado em llm.ts. Nota 6.5: fundamentos sólidos, mas os três primeiros findings são exatamente o que transforma o "wow" do produto em "essa moça demora pra responder".

**Forças:**
- Disciplina de cron exemplar: monitor consolida ~8 jobs (alertas, canário, retenção LGPD, higiene de prospects) em 1 invocação/dia (C:\Users\stefa\roca\api\cron\monitor.ts); dispatch roda só 3x/dia úteis — segue à risca a regra de custo Vercel do próprio CLAUDE.md
- Tiering de modelos correto e centralizado: Haiku 4.5 para router/extrações JSON, Sonnet 5 para raciocínio, Gemini 2.5 Flash para transcrição (C:\Users\stefa\roca\api\_lib\env.ts:16-20), com maxTokens apertado por chamada (12 no router, 60-250 em extrações)
- Guards baratos ANTES de qualquer trabalho caro: dedup por provider-id, rate limit 15/min por usuário, cap de mídia 11MB, fail-closed sem user row (C:\Users\stefa\roca\api\_lib\pipeline.ts:959-1027) — os vetores óbvios de custo-abuso via LLM estão fechados
- Retries curtos e conscientes do budget do webhook (attempts:2 no LLM, backoff com jitter — C:\Users\stefa\roca\api\_lib\retry.ts) e fail-soft generalizado: ferramenta caída degrada a resposta, nunca trava
- O card de preços NÃO re-busca Yahoo: as cotações vão empacotadas na query string do card (C:\Users\stefa\roca\api\_lib\pipeline.ts:239-253) — o padrão certo, que os cards de spray/farm/ndvi deveriam copiar

**Findings:**
- [HIGH][M] **Webhook segura o ack do provedor até o pipeline inteiro terminar — foto/voz estouram o timeout do Twilio e pagam invocação dupla**
  - Evidência: C:\Users\stefa\roca\api\webhook.ts:115-116 — `await handleInbound(adapter, msg); ack();`. O caminho de foto roda 2 chamadas Sonnet com vision (C:\Users\stefa\roca\api\_lib\reason.ts:216-331) + fetch de mídia + send ≈ 12-25s; voz ≈ 10-20s. Twilio espera ~15s pelo ack e redeliver; o duplicado é dropado pelo claimInbound (pipeline.ts:959-970), mas cada redelivery é invocação nova (assinatura + 4-5 queries de guard) e o webhook aparece como erro 11200 no console Twilio. Pior caso: withRetry (2 tentativas x 2 chamadas + backoff) encosta no maxDuration=60 (vercel.json:6) e a função morre DEPOIS de gastar os tokens e ANTES do send.
  - Arquivos: C:\Users\stefa\roca\api\webhook.ts, C:\Users\stefa\roca\api\_lib\pipeline.ts, C:\Users\stefa\roca\vercel.json
  - Recomendação: Ack imediato após verificação de assinatura e processar async (waitUntil / background function / fila leve tipo QStash). No mínimo: logar duração p95 do handler e taxa de redelivery por provedor para dimensionar o problema com dados.
- [HIGH][M] **Entrega da resposta refém da rasterização do card: texto + imagem num único envio, e o card renderiza on-demand (5-11s observado)**
  - Evidência: C:\Users\stefa\roca\api\_lib\pipeline.ts:1117-1123 envia text+mediaUrl numa mensagem só; Twilio/Meta só entregam depois de baixar GET /api/card, que renderiza na hora: type=farm dispara soil+weather+geocode em paralelo (C:\Users\stefa\roca\api\card.ts:162-166) e depois svgToPng (card.ts:230); nos testes um PNG leva 5-11s (+ cold start da função). type=ndvi ainda refaz a busca de cena STAC via fetchSceneThumb (card.ts:139-143). Card lento ou falho atrasa/derruba a mensagem inteira — justamente no payback moment do pin e no diagnóstico de praga. CDN cache (max-age 900) quase não pega: URL varia por lat/lon/params de cada fazendeiro.
  - Arquivos: C:\Users\stefa\roca\api\_lib\pipeline.ts, C:\Users\stefa\roca\api\card.ts, C:\Users\stefa\roca\api\_lib\cards\render.ts
  - Recomendação: Enviar o texto primeiro e o card como segunda mensagem (mudança pequena em finalizeAndSend). Estratégico: pré-renderizar o card async no momento da resposta, salvar em storage (Supabase Storage) e enviar URL de arquivo estático — o fetch do WhatsApp vira ~100ms e o endpoint de compute público desaparece.
- [HIGH][S] **chatOnce (OpenRouter) é a única chamada externa sem timeout — e é a mais lenta e mais frequente do sistema**
  - Evidência: C:\Users\stefa\roca\api\_lib\llm.ts:122-136 — fetch sem AbortController/deadline. Todos os outros fetches do repo têm hard deadline (weather.ts TIMEOUT_MS=6000, ndvi.ts 9000, soil/geo, template.ts com o comentário explícito 'a hung fetch is billable idle CPU'). Um socket pendurado no OpenRouter consome os 60s de maxDuration do webhook inteiros, o retry do withRetry nem chega a rodar, e o fazendeiro recebe silêncio.
  - Arquivos: C:\Users\stefa\roca\api\_lib\llm.ts, C:\Users\stefa\roca\api\_lib\retry.ts
  - Recomendação: AbortSignal.timeout por tentativa em chatOnce — deadlines por tier: ~10s router/extrações, ~30s reasoning/vision. 30 minutos de trabalho, elimina o pior caso inteiro.
- [MEDIUM][S] **Zero observabilidade de custo LLM: o campo usage da resposta é descartado — todo custo por conversa é chute**
  - Evidência: C:\Users\stefa\roca\api\_lib\llm.ts:143-151 — o parse da resposta lê só choices[].message.content; usage (input/output/cache_read tokens) que a OpenRouter retorna é jogado fora. Consequência dupla: (1) impossível saber custo real por conversa/por intent/por lead; (2) impossível verificar se o cacheSystem (llm.ts:103-111) está de fato gerando hits — com TTL de 5 min e tráfego esparso de pré-receita, é provável que cada request pague a ESCRITA de cache a 1,25x sem nunca ler, e via OpenRouter o hit ainda depende de cair no mesmo provider (não pinado no código). Nota de calendário: o preço introdutório do Sonnet 5 ($2/$10 por MTok) vence em 31/08/2026 e vira $3/$15 — +50% no custo por mensagem sem nenhuma mudança de código.
  - Arquivos: C:\Users\stefa\roca\api\_lib\llm.ts, C:\Users\stefa\roca\api\_lib\reason.ts
  - Recomendação: Logar usage por chamada (tabela llm_usage: model, intent, input/output/cache_read tokens, latência). Com dados: decidir se cacheSystem fica (pinando provider anthropic nas prefs do OpenRouter e movendo o breakpoint para depois do bloco estável base+pack, antes do sufixo por intent) ou sai; e planejar quais intents descem para Haiku quando o preço introdutório vencer.
- [MEDIUM][M] **Foto de praga: imagem de até 8MB vai inteira (2x) para o modelo flagship sem downscale — teto de tokens de imagem e payload gigante**
  - Evidência: C:\Users\stefa\roca\api\_lib\pipeline.ts:996-1010 aceita até 11.000.000 chars base64 (~8MB binário; o erro real 'media over cap 11000001 b64 chars' mostra fotos chegando NO limite). A imagem segue sem redimensionar para identifyFromPhoto e, no fallback, de novo para a resposta direta (C:\Users\stefa\roca\api\_lib\reason.ts:216-240, 278-289). Sonnet 5 tem vision hi-res: imagem grande cobra até ~4.8k tokens vs ~1.6k a 1568px, e o upload de MBs por chamada adiciona 1-3s+ de latência. É o item de maior custo unitário do produto (~US$0,03-0,06/foto) e do pior caminho de latência (12-25s).
  - Arquivos: C:\Users\stefa\roca\api\_lib\pipeline.ts, C:\Users\stefa\roca\api\_lib\reason.ts
  - Recomendação: Downscale servidor (sharp) para ~1568px de lado maior antes do base64: corta tokens de imagem até ~3x, payload 10-50x, e derruba segundos do caminho de foto. O cap de 11MB continua como guarda de abuso.
- [MEDIUM][M] **NDVI: a mesma cena Sentinel-2 é buscada 2x por leitura e toda a feature depende de instância demo pública (titiler.xyz)**
  - Evidência: Resposta: fetchFieldNdvi = 1 busca STAC + 18 chamadas titiler (9 pixels x 2 bandas) (C:\Users\stefa\roca\api\_lib\tools\ndvi.ts:388-407). Card: fetchSceneThumb REFAZ findLatestScene + bbox thumb (ndvi.ts:304-334, chamado por api\card.ts:139-143) — a mesma cena resolvida duas vezes, a segunda no fetch do WhatsApp. O cache (farm_derived, 7 dias — db.ts:207-232) guarda só a leitura numérica, não a cena nem o thumb. O próprio código avisa 2x: 'Production should self-host titiler or move to GEE' (ndvi.ts:19, 302). Timeouts de 9s/8s no caminho crítico do fazendeiro.
  - Arquivos: C:\Users\stefa\roca\api\_lib\tools\ndvi.ts, C:\Users\stefa\roca\api\card.ts, C:\Users\stefa\roca\api\_lib\db.ts
  - Recomendação: Persistir scene href + thumb (data-uri) no farm_derived junto com a leitura — elimina a segunda busca STAC e o fetch bbox no card. Self-host titiler (container barato) ou GEE via programa de startups ANTES de qualquer campanha de aquisição.
- [MEDIUM][S] **Endpoint público de card: CPU ativa cara (resvg) protegida por rate limit por instância — amplificação de custo ainda aberta**
  - Evidência: C:\Users\stefa\roca\api\card.ts:45-50 usa limiter em memória (C:\Users\stefa\roca\api\_lib\httpRateLimit.ts) que o próprio header do arquivo admite não ser garantia global: em Fluid, N instâncias concorrentes = N x 120 req/min cada. Variar lat/lon fura o CDN e cada hit paga fetches upstream (weather/soil/geo/STAC) + rasterização resvg — CPU ativa, exatamente o que a Vercel fatura. O raster de 5-11s por PNG torna o multiplicador pior.
  - Arquivos: C:\Users\stefa\roca\api\card.ts, C:\Users\stefa\roca\api\_lib\httpRateLimit.ts, C:\Users\stefa\roca\api\_lib\reportToken.ts
  - Recomendação: Os URLs de card são gerados exclusivamente pelo pipeline — assinar os params com HMAC (o mecanismo já existe em reportToken.ts) e rejeitar requests não assinados. Mata a alavanca de lat/lon arbitrário sem infra nova; o limiter vira segunda linha.
- [MEDIUM][S] **Cotações: 4 fetches Yahoo por pergunta, sem nenhum cache, com o primeiro serial — e a tese de produto é justamente criar hábito diário de preço**
  - Evidência: C:\Users\stefa\roca\api\_lib\tools\prices.ts:105-140 — fetchPrices busca BRL=X primeiro (serial, timeout 8s) e só depois até 3 símbolos em paralelo; nenhuma camada de cache apesar de closes diários não mudarem intra-hora. O comentário em pipeline.ts:666-685 chama isso de 'price habit loop' e o card é desenhado para ser encaminhado em grupos — ou seja, o volume desse intent é o que mais deve crescer. A chart API do Yahoo é não-oficial e rate-limita padrões de tráfego server-side.
  - Arquivos: C:\Users\stefa\roca\api\_lib\tools\prices.ts
  - Recomendação: Cache de 10-15 min por símbolo (em memória por instância já resolve 90%, DB se quiser consistência) + paralelizar BRL=X com os demais símbolos. Custo marginal do intent vira ~zero e a resposta vira instantânea.
- [LOW][M] **Cadeia de guards serial: 6-9 round trips Supabase sequenciais antes de qualquer trabalho útil em TODA mensagem**
  - Evidência: C:\Users\stefa\roca\api\_lib\pipeline.ts:1158-1216 — findPartnerByPhone → upsertUser → claimInbound → handleProspectInbound (findProspectByPhone) → countRecentInbound → buildRouteContext, todos await sequenciais, + getRecentTurns/getFarmProfile no fallback. A ~30-100ms por round trip, são ~0,3-1s de latência fixa por mensagem antes do primeiro byte de valor.
  - Arquivos: C:\Users\stefa\roca\api\_lib\pipeline.ts
  - Recomendação: Paralelizar os lookups independentes (partner ∥ prospect; profile ∥ history no reasonFallback) com Promise.all. Ganho modesto mas gratuito; só vale junto com outra mexida no pipeline.
- [LOW][S] **Transcrição de voz trunca áudio longo em silêncio: maxTokens 500 corta a mensagem no meio e a Stevi responde à metade**
  - Evidência: C:\Users\stefa\roca\api\_lib\transcribe.ts:28-34 — transcrição com maxTokens 500 (~1.500-2.000 chars). Áudio de 2-3 min (comum com produtor rural, o público-alvo declarado prefere voz) excede isso; como llm.ts descarta finish_reason, o corte é indetectável e o pipeline processa meia mensagem como se fosse inteira.
  - Arquivos: C:\Users\stefa\roca\api\_lib\transcribe.ts, C:\Users\stefa\roca\api\_lib\llm.ts
  - Recomendação: Subir para ~1200-1500 tokens (custo marginal irrisório no Gemini Flash) e logar finish_reason para detectar truncamento; se truncou, avisar o produtor ('seu áudio era longo, entendi até X').
- [LOW][S] **Dispatch cron: maxDuration 120s (viola a regra da casa de ≤60s) faturando ~40s de sleep por run + 1 query de recheck de cap por envio**
  - Evidência: C:\Users\stefa\roca\vercel.json:23 (120s) contra a regra 'maxDuration ≤60s' do CLAUDE.md. C:\Users\stefa\roca\api\_lib\prospect\dispatch.ts:79-83+291 — delay jitterado ~5,6s médio entre envios: batch de 8 ≈ 40s de sleep dentro da função (memória provisionada faturada por wall-time no Fluid, ainda que CPU ativa ~0), + countSentSince por prospect (dispatch.ts:234) = N+1 de queries. Irrelevante em reais hoje (3 runs/dia), mas é o padrão que escala linearmente com o cap (até 60/dia) e o run com bumps já flerta com o budget.
  - Arquivos: C:\Users\stefa\roca\vercel.json, C:\Users\stefa\roca\api\_lib\prospect\dispatch.ts
  - Recomendação: Manter (custo real baixo) mas documentar a exceção à regra dos 60s; se o cap subir para 60/dia, migrar o pacing para claims com sent_at futuro em vez de sleep in-function.

**Quick wins:**
- AbortSignal.timeout por tentativa em chatOnce (llm.ts) — 30 min de trabalho, elimina o pior caso de 60s de função pendurada no OpenRouter
- Logar response.usage de cada chamada OpenRouter em uma tabela llm_usage — troca estimativa por custo real por conversa/intent/lead e revela se o prompt caching está gerando algum hit
- Cache de 10-15 min nas cotações Yahoo + paralelizar o fetch do BRL=X com os símbolos (prices.ts)
- maxTokens da transcrição de voz: 500 → ~1200, com detecção de finish_reason truncado (transcribe.ts)
- Separar texto e card em mensagens distintas em finalizeAndSend — o fazendeiro lê a resposta em segundos e o card chega quando renderizar (pipeline.ts:1117-1123)

**Movimentos estratégicos:**
- Webhook assíncrono: ack imediato pós-assinatura + processamento em background (waitUntil/fila) — remove a classe inteira de timeout/redelivery de provedor, tira o teto de 60s do caminho de foto e destrava UX progressiva ('recebi sua foto, analisando 🔍' em 1s, diagnóstico em 20s)
- Pré-renderizar cards async para Supabase Storage no momento da resposta e enviar URLs de arquivo estático — o endpoint público de compute (raster 5-11s + fetches upstream, superfície de abuso de CPU) deixa de existir
- Self-host titiler (ou migrar para GEE via programa de startups) e persistir cena+thumb no cache NDVI — hoje a feature satélite inteira, um diferencial do produto, depende de titiler.xyz demo que o próprio código marca como não-produção
- Planejar o vencimento do preço introdutório do Sonnet 5 (31/08/2026: $2/$10 → $3/$15 por MTok, +50% no custo por mensagem): com o usage logging em mãos, decidir quais intents (smalltalk, extrações, respostas curtas) descem para Haiku 4.5 sem perda de qualidade

---
## Prospecção & Leads (outbound Vitória, dispatch, funil, SLA)

**Área:** Prospecção & Leads (outbound Vitória, dispatch, funil, SLA)  |  **Nota:** 4.5

**Veredito:** A engenharia do motor de disparo é a melhor parte do repo — fail-closed de verdade, claims atômicos, preflight de shape derivado do registry, latch, 1.152 linhas de teste — mas está blindando uma decisão estrategicamente frágil: cold outreach de MARKETING para números raspados do Google Places, sem opt-in (violação da política de mensagens do WhatsApp), disparado do MESMO número que serve o produto para os produtores, número que o próprio flight plan chama de "ativo único e insubstituível". Enquanto isso, o funil está MORTO há 4+ dias (PROSPECT_DAILY_CAP=0 desde 21/jul) com a causa raiz das falhas pós-aceite ainda não identificada em nenhum commit, e o kill switch é invisível por design — nenhuma superfície diária lembra o founder de que a prospecção está parada. Quando religar, há bugs prontos para disparar mensagem errada: o bump D+3 manda o pitch de lead-gen (o que o red-team F3 classificou como ameaça competitiva) para coops/revendas, e a costura de vocabulário de kinds tem três dialetos com exclusão silenciosa. O "learning loop" ainda não aprende nada mensurável: minera conversas sem rótulo de resultado num n minúsculo. Nota reflete: armadura excelente, estratégia com risco existencial, funil congelado e quase zero sinal aprendível gerado até agora.

**Forças:**
- Disciplina fail-closed real no dispatch: opt-outs/cap/saúde/latch inverificáveis abortam o run; enviado-mas-não-gravado para o batch e pagina com o wamid (dispatch.ts:149-193, 274-290)
- Postmortem do #132000 virou correção estrutural, não band-aid: param count derivado do registry, preflight de shape fail-closed nos DOIS templates, canário valida shape e não só status (commit 81de090; template.ts:165-174)
- Opt-out honrado na hora e defendido em profundidade: blocklist lida antes de todo envio (throw se ilegível), promoção a parceiro recusa número opted-out (db.ts:57-64; promote.ts:96-112)
- Máquina de status monotônica com allowedFrom DERIVADO de nextSendStatus — as duas autoridades não podem divergir (health.ts:27-46) — e 7 arquivos de teste dedicados (1.152 linhas)
- Gym adversarial testa o cérebro REAL de produção (mesmo prompt, gate, playbook) contra personas hostis, incluindo detector de bot e menu institucional (gym.ts:39-120)

**Findings:**
- [CRITICAL][M] **Cold outreach sem opt-in no número do produto — risco existencial concentrado**
  - Evidência: source.ts:1-11 raspa Google Places; template.ts:189 registra templates category MARKETING; send.ts:29-30 e transport/cloud.ts:230 usam o MESMO WHATSAPP_CLOUD_PHONE_NUMBER_ID — prospecção fria e tráfego de produtores compartilham o número. A política de business messaging da Meta exige opt-in para mensagem business-initiated; números raspados de diretório não são opt-in. Flight plan (linha 9): '+55 bloqueado por meses (o +1 é ativo único e insubstituível)'. Todo o aparato (caps, latch, termômetro, canário quality_rating) mitiga sintomas de uma violação estrutural: um ban não mata a prospecção, mata a Stevi inteira.
  - Arquivos: api/_lib/prospect/source.ts, api/_lib/prospect/send.ts, api/_lib/transport/cloud.ts, .claude/plans/2026-07-13-flight-plan/README.md
  - Recomendação: Separar a prospecção do número do produto (segundo phone number no WABA, ~US$0 extra) ANTES de religar o dispatch; em paralelo, reavaliar se cold-WA é o canal certo — a própria tese do flight plan é 'confiança emprestada, nunca número frio', e o canal que fecha parceiro no plano é voz do founder. O cold outreach contradiz a tese que o scorecard testa.
- [HIGH][S] **Funil morto há 4+ dias: kill switch sem prazo, sem lembrete, invisível, e causa raiz não resolvida**
  - Evidência: Commit 18f2170 (21/jul): 'PROSPECT_DAILY_CAP=0 — emergency stop while delivery-failure cause (pos-accept callbacks) is identified'. Hoje é 25/jul e nenhum commit posterior identifica a causa. O stop manual deliberadamente não alerta (dispatch.ts:195-212) e o digest diário não tem UMA linha de prospecção (grep em digest.ts: zero menções). Agravante: o override manual bypassa o termômetro INTEIRO (health.ts:256-263), inclusive recordDispatchPause — episódios de pausa não contam pro latch durante o stop, e ao religar a janela de 7 dias já decaiu → reentra 'warming' cap 20 como se nada tivesse acontecido.
  - Arquivos: api/_lib/prospect/dispatch.ts, api/_lib/prospect/health.ts, api/_lib/digest.ts
  - Recomendação: 1) Linha fixa no digest: 'Prospecção: PARADA (cap=0) há N dias'. 2) Postmortem escrito do pós-aceite (é exatamente a assinatura de problema de qualidade do número — #131049/limite por usuário — que credencial re-sincronizada NÃO conserta) antes de qualquer religada. 3) Religar com cap degradado (10), não warming (20).
- [HIGH][S] **Bump D+3 manda pitch de lead-gen para coops/revendas — o exato erro que o red-team F3 proibiu**
  - Evidência: kindAllowed foi alargado em 19/jul para incluir cooperativa/revenda (dispatch.ts:51-53) e a MESMA função gateia intros E bumps (dispatch.ts:375). Mas existe um único BUMP_TEMPLATE (dispatch.ts:316, 401-404) cujo corpo é o pitch de lead-gen: 'a gente indica produtores... que precisam de receituário' (template.ts:46-51). O comentário em dispatch.ts:373-374 ainda afirma que o gating protege coops do bump — está STALE desde o unlock. Cenário: coop recebe pitch de distribuição no D0 ('devolve o produtor pros SEUS agrônomos') e no D+3 recebe o pitch oposto ('a gente indica produtores' = concorrência). Incoerência que queima o segmento inteiro de distribuição.
  - Arquivos: api/_lib/prospect/dispatch.ts, api/_lib/prospect/template.ts
  - Recomendação: Excluir cooperativa/revenda do bump (1 linha no filter de runBumpDispatch) até existir um bump coop-específico aprovado; corrigir o comentário stale.
- [HIGH][S] **Três dialetos de 'kind' com falha silenciosa — prospects presos em 'ready' pra sempre e template errado**
  - Evidência: CSV (core.ts:138): VALID_KINDS={coop,revenda,sindicato,agronomo}, desconhecido→'revenda' (core.ts:160). Sourcing (source.ts:23-29): consultoria/revenda/cooperativa. kindAllowed default (dispatch.ts:53): agronomo,consultoria,cooperativa,revenda. Consequências: kind='coop' (importado por CSV) e 'sindicato' NUNCA passam em kindAllowed — ficam 'ready' eternamente, sem envio e sem aviso; CSV ',consultoria' não está em VALID_KINDS → vira 'revenda' → templateForKind manda o template de DISTRIBUIÇÃO para uma consultoria (pitch errado). E .env.example:25 ainda documenta PROSPECT_SEND_KINDS=agronomo,consultoria — o mesmo padrão env-drift-vs-código que causou o outage de 13/jul; impossível verificar daqui qual valor está em prod.
  - Arquivos: api/_lib/prospect/core.ts, api/_lib/prospect/dispatch.ts, api/_lib/prospect/source.ts, .env.example
  - Recomendação: Um enum canônico de kinds validado em TODAS as entradas (CSV, sourcing, painel); normalizar 'coop'→'cooperativa' na escrita; alerta no painel quando existir 'ready' elegível-zero por kind; atualizar .env.example.
- [HIGH][S] **Opt-out pode falhar no aliasing do 9º dígito BR — SAIR ignorado e bump enviado a quem respondeu**
  - Evidência: inbound.ts:47-51: match de prospect é igualdade exata do E.164 normalizado. Se o wa_id do prospect chegar sem o 9º dígito (forma canônica de contas BR antigas na Meta), normalizePhoneBR devolve null (sub começando em 6-9 falha o teste de landline, core.ts:59-62) ou um número de 10 dígitos que não bate com o armazenado de 11 → findProspectByPhone falha → o SAIR cai no pipeline de farmer, o opt-out NÃO é registrado, status nunca vira 'replied' e o bump D+3 sai mesmo assim. NÃO consegui verificar em prod como a Meta reporta wa_ids desses números — mas o custo do falso negativo é LGPD + ban, e não há nenhum tratamento de variante com/sem 9 no repo (grep negativo).
  - Arquivos: api/_lib/prospect/inbound.ts, api/_lib/prospect/core.ts, api/_lib/prospect/db.ts
  - Recomendação: findProspectByPhone com lookup nas duas variantes (com/sem 9) — padrão consagrado em integrações WA no Brasil; teste com um número real antigo antes de religar.
- [MEDIUM][M] **Termômetro cego abaixo de 20 envios e sem circuit-breaker intra-dia**
  - Evidência: health.ts:103 minWindowSends=20 + gradeCap:181-183: com <20 envios rastreados na janela o grade é 'warming' cap 20 MESMO com 0% de entrega — no regime atual (tracking floor 13/jul, volume baixo), a proteção automática só engata depois de queimar ~20 prospects. E não há corte intra-dia: grace de 2h (health.ts:96) + cron 3×/dia significa que uma manhã com 8/8 falhas pós-aceite não impede o batch das 13h (o alerta por falha individual em applyProspectStatuses pagina, mas não pausa).
  - Arquivos: api/_lib/prospect/health.ts, api/_lib/prospect/dispatch.ts
  - Recomendação: Kill rápido ortogonal ao termômetro: N falhas pós-aceite nas últimas X horas ⇒ pausa imediata do dia (não só página). Barato e teria contido tanto 13/jul quanto o episódio atual.
- [MEDIUM][M] **O 'learning loop' não aprende: mineração sem rótulo de resultado, n minúsculo, e canal de prompt-injection**
  - Evidência: learn.ts:102-153: minera até 400 mensagens de 14 dias SEM saber quais conversas converteram (nenhum join com status replied/partner — o LLM vê texto cru sem outcome). Nenhuma validação de que o playbook injetado melhora qualquer métrica. O bloco entra no system prompt da Vitória a partir de texto controlado por prospects (agent.ts:139-146) — um prospect hostil pode plantar instrução que o minerador destila; o gate PRICE_COMMIT_RE só cobre a classe R$. Com o funil no tamanho atual, isso institucionaliza ruído com verniz de aprendizado.
  - Arquivos: api/_lib/prospect/learn.ts, api/_lib/prospect/agent.ts
  - Recomendação: Rotular threads com outcome (replied→call→partner→optout) e minerar SÓ contrastando ganhas vs perdidas; até lá, desligar a injeção do playbook (custo zero — os hard rules já dominam).
- [MEDIUM][S] **SLA de lead quente checado 1×/dia — latência de alerta efetiva de até ~48h**
  - Evidência: alertStaleLeads (partners.ts:54-91, SLA 24h) roda apenas no monitor diário (monitor.ts:129-137; vercel.json: '0 11 * * *' = 8h BRT). Um lead que estoura as 24h às 9h BRT só alerta no dia seguinte às 8h — o founder fica sabendo com até 47h, tarde demais para agir dentro do SLA de 48h prometido ao parceiro (flight plan, acordo Michel). Um produtor consentido esperando é exatamente o que o comentário do próprio código chama de 'the fastest way to burn both sides of the marketplace'. E o pipeline novo/contatado/fechado não tem estado negativo terminal — closeRate só sobe (viés admitido em cohort.ts:142-148).
  - Arquivos: api/_lib/partners.ts, api/cron/monitor.ts, api/_lib/cohort.ts, vercel.json
  - Recomendação: Rodar alertStaleLeads também no cron de dispatch (3×/dia úteis, invocação já paga); adicionar status 'perdido' para o funil parar de mentir por omissão.
- [MEDIUM][S] **Funil sem instrumentação por template/estágio — o scorecard nunca vai ser legível**
  - Evidência: template_used é gravado (db.ts:239) mas computeFunnelStats agrega só por kind (learn.ts:37-65); não existe replied_at (a transição para 'replied' sobrescreve updated_at) nem registro de touch que gerou a resposta — impossível medir touch→reply→call→partner por variante ou comparar v2 vs coop vs bump. O scorecard pré-registrado exige ≥100 envios POR SEGMENTO para ler reply-rate (flight plan linha 91); sem carimbo por estágio/segmento, essa leitura nunca será limpa, e a decisão de 60 dias fica sem o dado que ela mesma pediu.
  - Arquivos: api/_lib/prospect/learn.ts, api/_lib/prospect/db.ts
  - Recomendação: replied_at + template_used no rollup do funil (2 colunas, 1 função pura já testável no padrão da casa). Fazer ANTES de religar — dado de estágio não se reconstrói retroativamente.
- [MEDIUM][S] **Persona 'Vitória': disclosure só sob pergunta + roteiro do +1 que promete o que o plano nega**
  - Evidência: agent.ts:91-93: honestidade sobre ser IA apenas SE perguntarem. agent.ts:97-99: script diz 'o número brasileiro está em processo' enquanto o flight plan (linha 9) registra '+55 bloqueado por meses'. O próprio prompt formula o risco: 'uma pessoa falsa desmascarada gera denúncia' — e denúncia é exatamente o sinal que derruba quality_rating. Cold B2B de número +1 no interior de MG já dispara heurística de golpe (a gym tem a persona 'detector-de-bot' porque vocês sabem disso). Honestidade condicional num funil cujo ativo é confiança é aposta assimétrica: economiza pouco reply-rate, arrisca o número.
  - Arquivos: api/_lib/prospect/agent.ts, .claude/plans/2026-07-13-flight-plan/README.md
  - Recomendação: Disclosure proativa leve na primeira resposta do agente ('sou a assistente digital da equipe da Stevi') e corrigir o script do +1 para algo verdadeiro sem promessa de prazo.
- [LOW][S] **Loop com auto-atendimento institucional sem trava de código**
  - Evidência: respondAsProspectAgent (inbound.ts:77-108) responde a TODO inbound de prospect; a regra 'não converse com robô' vive só no prompt (agent.ts:87-88). Um menu automático que responde a cada mensagem gera ping-pong ilimitado — custo de LLM e ruído de tráfego no número — com a aderência do LLM como única defesa.
  - Arquivos: api/_lib/prospect/inbound.ts
  - Recomendação: Cap duro: máx 2 outbound consecutivos sem inbound classificado como humano ⇒ silêncio + nota no painel.

**Quick wins:**
- Excluir cooperativa/revenda do bump D+3 (1 linha em runBumpDispatch) + corrigir o comentário stale — antes de qualquer religada
- Linha fixa no digest diário: 'Prospecção: PARADA (cap=0) há N dias' — o kill switch deixa de ser invisível
- Rodar alertStaleLeads no cron de dispatch (3×/dia) — SLA de lead quente cai de ~48h para ~3h de latência de alerta
- Unificar o enum de kinds ('coop'→'cooperativa', validar 'consultoria' no CSV) e atualizar .env.example PROSPECT_SEND_KINDS
- Adicionar replied_at + rollup por template_used antes de religar — dado de estágio não se reconstrói depois

**Movimentos estratégicos:**
- Separar a prospecção do número do produto (segundo phone number no WABA) — hoje um ban de cold outreach mata a Stevi inteira, não só o funil B2B
- Decidir honestamente se cold-WA sobrevive à própria tese: o flight plan diz 'nunca por número frio' para produtores mas pratica número frio para parceiros; considerar migrar o primeiro toque B2B para voz/intro vouchada (o canal que de fato fecha parceiro no plano) e usar a Vitória só como follow-up de quem JÁ respondeu
- Postmortem escrito do episódio pós-aceite (20-21/jul) com hipótese testável ANTES de religar — 'credencial re-sincronizada' não explica falha pós-aceite; se for qualidade do número, religar acelera o ban
- Circuit-breaker de falhas pós-aceite (N falhas em X horas ⇒ pausa imediata) — fecha o buraco que nem o termômetro (cego <20 envios) nem o latch (só pós-episódio) cobrem

---
## Arquitetura & qualidade de código

**Área:** Arquitetura & qualidade de código  |  **Nota:** 7

**Veredito:** O código é bem acima da média para pré-receita: TypeScript strict quase sem any, abstração de transporte limpa (Twilio/Cloud atrás de uma interface, HMAC sobre raw body), idempotência via índice único no banco, 57 arquivos de teste, e a refatoração do handleInbound para route table (em master) foi feita com disciplina real — testes de caracterização antes, lift literal, guard test de taxonomia de intents. Mas há três buracos materiais: (1) semântica at-most-once — mensagem "claimed" que morre antes do send é perdida em silêncio e a redelivery do provider é descartada como duplicata; (2) escritas críticas do caderno de aplicações falham em log-only enquanto a resposta confirma "Anotado" — mentira silenciosa no artefato central do produto; (3) o adapter Cloud degrada envios sem logar nada, exatamente a classe de falha silenciosa que causou o outage recente. Aguenta 100x sem reescrita? Quase: a única mudança estrutural necessária é ack-antes-de-processar (hoje o webhook segura Twilio/Meta pela cadeia inteira de LLM), o resto escala horizontalmente. Nota rebaixada pelo pipeline.ts de 1.223 linhas pós-refactor e pela divergência de branches num arquivo quente.

**Forças:**
- Abstração de transporte genuinamente limpa: TransportAdapter com 2 implementações simétricas, verificação HMAC sobre bytes crus, adapter escolhido por shape da request (api/webhook.ts:39-45) — migrar Twilio→Meta não exige mudança de código no pipeline
- Refatoração route table (master d820ec5) com disciplina: match predicates puros, intent estático por rota, ordem documentada como prioridade, testes de caracterização T0 + guard test que trava sincronia ROUTES↔FASTPATH_INTENTS (tests/intent-taxonomy.test.ts)
- Idempotência e abuso levados a sério: claimInbound com índice único parcial (migração 20260707000006), rate limit antes de trabalho caro, fail-closed quando o DB cai antes de gastar LLM (pipeline.ts master:930-952)
- Nenhum catch vazio no core (grep confirmou zero), logger mascara telefones (LGPD), retry com backoff+jitter e sleep injetável, prompt-cache breakpoint no llm.ts — maturidade incomum para 2 founders
- tsc --noEmit limpo em strict mode; casts frouxos restritos a 2 'as unknown as' em db.ts e 1 'any' em opsData.ts

**Findings:**
- [HIGH][M] **At-most-once: mensagem claimed que morre antes do send é perdida em silêncio**
  - Evidência: pipeline.ts (master): guardDuplicateInbound faz claimInbound ANTES do fetch de mídia/LLM/send (l.959-970 e l.1166); se a function estoura maxDuration 60s (vercel.json) ou crasheia no caminho de visão (2-3 chamadas reasoning-tier com retry), a redelivery do provider bate no 23505 e é descartada como duplicata (db.ts:283) — o produtor nunca recebe resposta e ninguém é alertado. O catch-all do webhook (api/webhook.ts:117-120) dá ack 200 sem alertFounders.
  - Arquivos: api/_lib/pipeline.ts, api/_lib/db.ts, api/webhook.ts
  - Recomendação: Claim em duas fases: marcar replied_at após o send; redelivery de mensagem claimed-sem-reply mais velha que N segundos reprocessa (ou no mínimo dispara alertFounders). Adicionar alertFounders no catch-all do webhook.
- [HIGH][S] **Resposta confirma escrita que pode ter falhado — falso 'Anotado' no caderno de aplicações**
  - Evidência: db.ts:463-483 insertApplication retorna void e só loga erro; pipeline.ts (master) applicationLogRoute l.650-663 responde formatApplicationConfirm(app) incondicionalmente. Mesmo padrão em setFarmCrops (db.ts:149-155 + cropsOnlyRoute l.485-496 'Anotado: você trabalha com...') e createReferralRequest (retorna null em erro mas REFERRAL_REPLY diz 'Anotei seu interesse'). O caderno é o registro de compliance que o produtor leva pro banco/agrônomo — perda silenciosa com confirmação é o pior modo de falha possível para esse produto.
  - Arquivos: api/_lib/db.ts, api/_lib/pipeline.ts
  - Recomendação: Fazer as funções de escrita retornarem sucesso/falha; em falha, responder honesto ('não consegui anotar agora, manda de novo') ou enfileirar retry. Priorizar insertApplication.
- [HIGH][S] **Adapter Cloud degrada envios em silêncio total — a classe exata do outage recente**
  - Evidência: transport/cloud.ts:260-261: falha no envio de mídia (PNG/PDF do caderno) cai para texto sem logar status nem body; :299-304: falha no interactive lê o body e o descarta sem log. O adapter Twilio loga ambos (twilio.ts:154,186). Com o histórico de outage silencioso de envio (template #132000, credenciais re-sincronizadas), o caminho de send do Cloud é onde observabilidade mais importa — hoje um PDF que nunca chega não deixa rastro nenhum.
  - Arquivos: api/_lib/transport/cloud.ts
  - Recomendação: log.error com status+body.slice(0,200) nos dois fallbacks; contar fallbacks de mídia no canary (taxa elevada = card endpoint quebrado).
- [MEDIUM][M] **Webhook síncrono segura o provider pela cadeia inteira de LLM — o único teto estrutural para 100x**
  - Evidência: api/webhook.ts:115-116: `await handleInbound(...); ack();`. Voz = transcribe→route→reason; foto = 2 chamadas de visão + compose; 10-30s típicos contra timeout de 15s do Twilio e retry agressivo do Meta. Hoje funciona porque a dedup transforma redeliveries em acks rápidos, mas isso registra taxa de erro no provider — e o Meta pausa webhooks com falha sustentada. Em 100x isso vira incidente.
  - Arquivos: api/webhook.ts, vercel.json
  - Recomendação: Ack imediato + processamento assíncrono (waitUntil do Vercel ou fila tipo QStash). O pipeline já é transport-agnóstico e idempotente — é a única mudança estrutural necessária para 100x, sem reescrita.
- [MEDIUM][S] **Divergência de branches num arquivo quente: fix de produção vive só na branch lateral**
  - Evidência: master (HEAD 4ad9de5) tem a refatoração route table mas NÃO tem o fix do PRICE_INTENT — em master, 'quanto tá a saca do café' não casa o fast-path (pipeline-master l.146-147 não tolera 'saca/arroba de') e cai no router LLM sem card de preço. O fix (011eb7e) existe só em claude/lucid-raman-615d63, aplicado sobre a versão PRÉ-refactor do arquivo — o merge vai conflitar em ~1.000 linhas e arrisca perder o fix.
  - Arquivos: api/_lib/pipeline.ts, tests/prices.test.ts
  - Recomendação: Portar o fix do PRICE_INTENT (com seus testes) para master imediatamente, re-aplicado sobre a versão refatorada; matar a branch lateral. Regra: fix em arquivo sob refactor ativo entra via master, nunca via branch baseada no estado antigo.
- [MEDIUM][M] **pipeline.ts continua um god-file de 1.223 linhas depois da refatoração**
  - Evidência: master api/_lib/pipeline.ts: 15 rotas + 6 guards + 7 regexes de intent + buttonsForIntent + 3 builders de card URL + finalizeAndSend + 80 linhas de imports, tudo num arquivo. A refatoração melhorou a FORMA (route table) mas não as FRONTEIRAS — o threshold de smell da casa é ~800 linhas e qualquer mudança de rota toca o mesmo arquivo que os guards de segurança e o tail de envio.
  - Arquivos: api/_lib/pipeline.ts
  - Recomendação: Dividir mantendo pipeline.ts como composition root: routes/ (rotas + regexes de intent por domínio), guards.ts, finalize.ts, cards-url.ts. Mecânico agora que as costuras existem; o guard test de taxonomia protege o split.
- [MEDIUM][M] **db.ts é um grab-bag de 775 linhas com casts manuais em toda query — drift de schema compila limpo e falha em runtime**
  - Evidência: api/_lib/db.ts mistura 9 domínios (users, farms, cache NDVI/soil, messages, applications, referrals, cache Twilio Content, ops_login_attempts, purge LGPD). Toda query faz `data as X` (ex.: l.52, l.119-124, l.614/639 'as unknown as') sem tipos gerados do Supabase — renomear uma coluna passa no tsc e vira null logado em produção.
  - Arquivos: api/_lib/db.ts
  - Recomendação: supabase gen types + tipar o client; dividir por domínio seguindo o precedente que o próprio repo já tem (prospect/db.ts).
- [LOW][S] **Null-checks mortos pós-refactor contradizem os tipos e escondem invariantes**
  - Evidência: RouteContext.userId é `string` não-nulo (pipeline master l.374), mas quase toda rota mantém `userId ? ... : ...` do lift literal (financingReport l.568, history l.635-637, brief l.701, referral l.721) e guardRateLimit tem `if (!userId) return false` (l.979) — inalcançável. Idem `firstContact && userId` em finalizeAndSend l.1126. TransportAdapter.isSync é setado pelos 2 adapters e lido por ninguém (grep confirma). Código morto que mente sobre quais garantias os guards já estabeleceram.
  - Arquivos: api/_lib/pipeline.ts, api/_lib/transport/types.ts
  - Recomendação: Passada única de tightening: remover os ternários mortos e o isSync. O lift literal foi a escolha certa para o refactor; agora cabe o passo 2.
- [LOW][S] **Fallback de messageId do Twilio é derivado do conteúdo — colide na dedup**
  - Evidência: transport/twilio.ts:118: `b.MessageSid || `twilio-${from}-${b.Body ?? ''}``. Se o MessageSid faltar, duas mensagens idênticas consecutivas ('sim', 'oi') geram a mesma chave no índice único e a segunda é descartada como 'duplicata' — silenciosamente. A dedup existe para retries do provider, que sempre repetem o mesmo Sid.
  - Arquivos: api/_lib/transport/twilio.ts
  - Recomendação: Fallback para randomUUID() — mensagem sem Sid nunca deve deduplicar por conteúdo.
- [LOW][S] **Fan-out de DB pré-rota é todo sequencial — 5+ round-trips antes de qualquer trabalho útil**
  - Evidência: pipeline.ts (master) handleInbound: upsertUser → claimInbound → handleProspectInbound (lookup) → findPartnerByPhone (via guardPartnerReply, l.1159) → countRecentInbound, em série. Lookups de partner e prospect são independentes entre si. Latência somada em toda mensagem; a regra da casa é Promise.all para fetches independentes.
  - Arquivos: api/_lib/pipeline.ts
  - Recomendação: Paralelizar os lookups independentes (partner + prospect) e considerar cachear findPartnerByPhone (tabela minúscula, muda raramente).

**Quick wins:**
- Adicionar log.error nos 2 fallbacks silenciosos do cloud.ts (envio de mídia e interactive) — 10 linhas, fecha o buraco de observabilidade da classe do outage recente
- alertFounders no catch-all do api/webhook.ts — hoje um crash de pipeline vira ack 200 e uma linha de log que ninguém lê
- Portar o fix do PRICE_INTENT ('saca do café') para master antes que o conflito de merge cresça — o bug está vivo em produção se prod == master
- insertApplication retornar boolean e a rota responder honesto em falha — protege o artefato central (caderno) com ~20 linhas
- Passada de tightening: remover null-checks mortos de userId nas rotas e o isSync nunca lido

**Movimentos estratégicos:**
- Ack-primeiro, processar-depois (waitUntil/fila): a única mudança estrutural que 100x exige — o pipeline já é idempotente e transport-agnóstico, então é cirúrgica, não reescrita
- Claim de inbound em duas fases (claimed → replied) para converter at-most-once em at-least-once com dedup — elimina a perda silenciosa de mensagens em timeout
- Dividir pipeline.ts (routes/, guards, finalize) e db.ts (por domínio) + tipos gerados do Supabase — as costuras já existem e o guard test de taxonomia protege o split
- Política de escrita honesta: toda escrita que a resposta afirma ('anotei', 'registrei') retorna status e a resposta reflete a realidade — princípio de produto, não só de código

---
## Geração de imagem (cards) & PDFs

**Área:** Geração de imagem (cards) & PDFs  |  **Nota:** 6

**Veredito:** A engenharia de render é acima da média para o estágio: SVG hand-authored → @resvg sem headless browser, raster medido em 56–240ms (o mito dos "5–11s" é cold start + refetch upstream, não raster), fontes bundled, modelo de acesso correto para o dado sensível (HMAC + TTL no caderno). Os dois cards piloto (prices, frost) são genuinamente bons. Mas a tese estratégica falha no próprio ponto declarado: os cards são "o canal de aquisição" e nenhum deles carrega um caminho de volta acionável (número, wa.me, QR) — o destinatário de um forward não consegue chegar na Stevi. Pior: o endpoint público renderiza texto arbitrário de atacante em card oficial da marca (geada falsa, praga falsa), exatamente o tipo de veneno que mata confiança em grupo de WhatsApp. E o design system v2 existe mais no plano do que no código — metade da superfície não migrou e a "hard rule" da escala tipográfica é violada em praticamente todo card.

**Forças:**
- Arquitetura de render enxuta e barata: SVG → @resvg com fontes bundled e cache, sem puppeteer; raster medido em 56-67ms warm / PNGs 47-53 KB (bem abaixo do cap de 5 MB do WhatsApp) — api/_lib/cards/render.ts
- Prices e frost cards têm design real: hierarquia clara, serif nos números, sparkline honesta (só renderiza com ≥3 closes reais), trend chips desenhados (tofu-proof), pill de data — api/_lib/cards/prices.ts, frost.ts
- Modelo de acesso correto por sensibilidade: cards públicos de baixo risco vs caderno de aplicações atrás de HMAC + expiry + 'private, no-store', com fallback gate-safe textual quando não há secret — api/_lib/reportToken.ts, api/card.ts:209-224
- Compliance renderizada no pixel: 'Produto e dose: só o agrônomo, no receituário' no pest card (pest.ts:112), rodapés legais em todos os PDFs, e o PDF PRONAF diz explicitamente o que NÃO é (pdf.ts:243-245)
- esc() consistente contra injection de SVG e testes cobrindo conteúdo dos cards (tests/cards.test.ts); rate limit proporcional ao estágio nos endpoints públicos

**Findings:**
- [HIGH][S] **Viral loop quebrado: cards de forward não têm caminho de volta acionável**
  - Evidência: prices.ts:80 ('Quer todo dia? Manda "cotação" pra Stevi no WhatsApp.') e frost.ts:73 ('manda um "oi" pra Stevi no WhatsApp') — sem número, sem wa.me, sem QR. A CTA é a MENOR tipografia do card (small=15px em 900px → ~5,5px na thumbnail do WhatsApp) em cinza muted. O próprio código declara o card como 'the product's organic distribution surface' (prices.ts:3-5). PUBLIC_WA_NUMBER já existe e alimenta o vCard (contactCard.ts:10-11) e a landing usa wa.me/19705509125 (public/index.html:79). Quem recebe o forward num grupo não tem como achar a Stevi.
  - Arquivos: api/_lib/cards/prices.ts, api/_lib/cards/frost.ts, api/_lib/cards/render.ts
  - Recomendação: Rodapé padrão em TODOS os cards: 'wa.me/XXXXXXXXX' (ou número formatado BR) em peso 700, no verde da marca, tamanho body — não micro. Considerar wa.me com ?text= pré-preenchido por tipo de card para medir forward→conversão.
- [HIGH][M] **Forgery de marca: /api/card renderiza conteúdo arbitrário de atacante em card oficial**
  - Evidência: api/card.ts:186-208 (pest: pest/evidence/crop são texto livre da query), :105-123 (frost: datas/temperaturas arbitrárias), :70-104 (prices: números arbitrários). Endpoint não autenticado e sem assinatura — qualquer um forja 'GEADA PROVÁVEL −5°C' ou um pest card com texto malicioso, hospedado no domínio oficial, e espalha em grupos rurais. esc() bloqueia XSS mas não forgery de conteúdo. A infra de assinatura já existe (reportToken.ts) e só protege type=applications.
  - Arquivos: api/card.ts, api/_lib/reportToken.ts
  - Recomendação: Assinar toda URL de card com HMAC curto sobre os params (mesmo padrão de reportToken, secret já configurado). Card sem sig válida → 403. Custa ~20 linhas e mata forgery + enumeration de uma vez.
- [MEDIUM][M] **Farm/spray/NDVI refazem fetches upstream no momento do fetch do WhatsApp — latência, custo dobrado e risco de card ≠ texto**
  - Evidência: api/card.ts:162-166 (farm: fetchSoil + fetchHourlyWeather + reverseGeocodeUf de novo), :65 (spray: fetchHourlyWeather de novo), :143 (ndvi: fetchSceneThumb no titiler) — tudo dado que o reply path acabou de buscar. Raster medido em 56-67ms warm (bench local com o código do repo); a latência real percebida é cold start do binário resvg + esses fetches seriais. farm.ts:5-7 alega 'the card can't drift from the words', mas recomputa minutos depois — o verdict de pulverização pode virar entre o texto e a imagem. O padrão correto já existe no repo: prices e frost empacotam os dados na URL (card.ts:71-73, alerts.ts:206-213).
  - Arquivos: api/card.ts, api/_lib/pipeline.ts:195-235, api/_lib/cards/farm.ts
  - Recomendação: Estender o padrão pack-in-URL para spray e farm (verdict + deltaT + vento + horas cabem na query como o prices já faz). Elimina refetch, garante card==texto e corta a latência do fetch do provedor.
- [MEDIUM][S] **Cache de CDN quase inútil (lat/lon full-precision na URL) + coordenadas exatas da fazenda em URL pública**
  - Evidência: pipeline.ts:204 e :209 interpolam lat/lon com precisão total → cada pin gera URL única, s-maxage=900 nunca acerta entre usuários e raramente no mesmo usuário. Cada fetch = raster + upstream no origin (custo Vercel Active CPU). Além disso, card.ts:4-5 alega 'No secrets, no PII', mas o pin exato da propriedade rural em URL não autenticada (logada em proxies/CDN) é dado de localização pessoal sob LGPD.
  - Arquivos: api/_lib/pipeline.ts:195-235, api/card.ts
  - Recomendação: Arredondar lat/lon a 3 casas decimais (~110m — dentro da resolução de solo/clima) na construção da URL: melhora cache hit, reduz cardinalidade e degrada a precisão do vazamento de localização. Sinergia com a assinatura HMAC do finding 2.
- [MEDIUM][M] **Design system v2 é aspiracional: metade dos cards não migrou e a 'hard rule' da escala é violada em quase todos**
  - Evidência: Plano (.claude/plans/2026-07-16-card-design-system/README.md:13-14) fixa 5 steps: 44/30/22/18/15/12.5, 'Nothing off-scale'. Real: prices usa 26 e 34 (render.ts:103 brandHeader=34); pest usa 60/19/20/21/22 (pest.ts:89,60,92,97,101); spray 17/20; frost 22/24; ndvi 84/17/26; farm usa 46/20/26/19 E margens 48 vs 56 misturadas (farm.ts:38,82-92) sem brandHeader; applications nem usa cardShell/brandHeader — header próprio, sem atmosfera (applications.ts:119-123). Rollout parou no passo 1-2 de 4 (README:33-38). Dois cards encaminhados juntos parecem produtos diferentes.
  - Arquivos: api/_lib/cards/farm.ts, api/_lib/cards/applications.ts, api/_lib/cards/pest.ts
  - Recomendação: Terminar a migração (farm e applications são os piores) e transformar a hard rule em teste: lint que extrai font-size dos SVGs gerados e falha fora da escala — senão o sistema deriva de novo em um mês.
- [MEDIUM][S] **Decimais com ponto em cards pt-BR: 'pH ~5.1', 'Delta T 9.1 °C', 'NDVI 0.62'**
  - Evidência: farm.ts:54 (`pH ~${ph}`), farm.ts:67 e spray.ts:70,83 (deltaT raw), ndviCard.ts:101 (toFixed(2) → 'NDVI 0.62'). Confirmado nos renders. prices.ts:24 e frost.ts:38 fazem certo com toLocaleString('pt-BR'). Para o público-alvo (fazendeiro brasileiro, muitas vezes baixa escolaridade), vírgula decimal é o único formato familiar — ponto lê como erro ou coisa de gringo, num produto cuja tese é 'fala a língua do campo'.
  - Arquivos: api/_lib/cards/farm.ts:54, api/_lib/cards/spray.ts:70, api/_lib/cards/ndviCard.ts:101
  - Recomendação: Helper único de formatação numérica pt-BR em render.ts, usado por todos os cards. Grep por toFixed( nos cards para achar todos.
- [MEDIUM][S] **Spray card sem data/hora: 'agora' congelado vive para sempre no histórico e em forwards**
  - Evidência: spray.ts renderiza 'Melhor não agora' + horas '08h…19h' sem nenhuma data ou hora de geração. O PNG fica no chat e em encaminhamentos — dois dias depois ainda afirma um verdict de 'agora' sem qualquer carimbo. Prices tem pill de data (prices.ts:73-74), frost tem datas, NDVI tem data da cena; spray e farm não têm nada.
  - Arquivos: api/_lib/cards/spray.ts, api/_lib/cards/farm.ts
  - Recomendação: Carimbo 'hoje, dd/mm · HH:mm' no header do spray e do farm card — mesmo pattern do pill de data do prices.
- [LOW][S] **Bug no wrap() do pest card: a segunda linha recebe UMA palavra e descarta o resto**
  - Evidência: pest.ts:36-55 — quando lines.length atinge maxLines-1 o loop dá break com cur = apenas a próxima palavra. Confirmado no render: evidence 'Manchas circulares castanhas com centro claro e halo amarelado nas folhas mais velhas' vira linha 2 = 'nas…', jogando fora 'folhas mais velhas'. O pipeline manda até 160 chars (pipeline.ts:259) mas o card mostra ~70 no pior caso. Além disso agrofitLine é double-escaped (esc() em pest.ts:82 dentro de string que leva esc() de novo na :109).
  - Arquivos: api/_lib/cards/pest.ts:36-55, api/_lib/cards/pest.ts:82
  - Recomendação: Corrigir o loop para preencher a última linha até o limite antes de truncar; remover o esc() interno da :82 (a :109 já escapa).
- [LOW][S] **PDF: san() destrói em-dashes do texto legal e o documento de maior stake perde toda a identidade da marca**
  - Evidência: pdf.ts:52-54 — classe `[^\x20-\x7E -ÿ]` remove qualquer char > U+00FF; os rodapés legais usam '—' U+2014 ('produtor — não é receituário', pdf.ts:133) que some silenciosamente, deixando espaço duplo em TODO PDF emitido — sendo que WinAnsi/CP1252 codifica em-dash (0x97) e o pdf-lib aceita. E a justificativa para Helvetica ('custom TTF embedding is too slow', pdf.ts:26-27) não tem medição — InstrumentSerif tem 70KB; embed via fontkit é dezenas de ms. O PDF que vai pro banco/cooperativa é a superfície de marca de maior stake e é a única sem a identidade.
  - Arquivos: api/_lib/report/pdf.ts:52-54, api/_lib/report/pdf.ts:26-36
  - Recomendação: Trocar san() por transliteração dos poucos chars fora do WinAnsi (— → -, ' → ') em vez de strip; medir o embed das TTFs da marca antes de aceitar Helvetica como permanente.
- [LOW][S] **NDVI: marker linear sobre 5 segmentos de largura igual cai na banda errada perto dos breaks — o código afirma o contrário**
  - Evidência: ndviCard.ts:64-70 desenha 5 segmentos IGUAIS (boundaries visuais em 0.17/0.34/0.51/0.68 do domínio 0–0.85) mas os breaks reais são 0.15/0.30/0.50/0.70 (tools/ndvi.ts:95-100). NDVI 0.69 → label 'vigorosa' (banda 4) mas o marker (t=0.81) aponta o segmento 'dossel fechado'. O comentário jura que 'its colour ramp and marker can't drift from these labels' (ndvi.ts:88-89) — pode, nas bordas. Mina a honestidade visual que o design system promete.
  - Arquivos: api/_lib/cards/ndviCard.ts:60-70, api/_lib/tools/ndvi.ts:95-100
  - Recomendação: Desenhar os segmentos com larguras proporcionais aos breaks reais (mesmo mapeamento linear do marker) — 6 linhas de mudança.

**Quick wins:**
- Rodapé com wa.me/número em negrito verde em todos os cards (env já existe) — o viral loop passa a fechar
- Arredondar lat/lon a 3 casas nas URLs de card: cache de CDN passa a funcionar e o vazamento de pin degrada para ~110m
- Vírgula decimal pt-BR em farm/spray/ndvi via helper único em render.ts
- Corrigir o wrap() do pest card (linha 2 com uma palavra só) e o double-escape do agrofitLine
- Transliterar em vez de strippar no san() do PDF — os rodapés legais param de perder o em-dash

**Movimentos estratégicos:**
- Assinar todas as URLs de card com HMAC curto (infra do reportToken já existe): fecha forgery de marca e enumeration em um movimento — pré-requisito para apostar nos cards como canal viral
- Estender o padrão pack-data-in-URL (prices/frost) para spray/farm: elimina refetch upstream no fetch do WhatsApp, garante card==texto e corta a latência real (que é cold start + upstream, não raster — medido 56-67ms warm)
- Terminar a migração v2 (farm, applications) e codificar as hard rules do plano como teste de lint sobre os SVGs gerados — senão o sistema tipográfico deriva de novo
- Instrumentar o card como unidade de aquisição: wa.me com ?text= pré-preenchido + código de origem por tipo de card, para medir forward→primeira mensagem e decidir com dados se o 'viral loop' existe

---
## result

### RED-TEAM / CRÍTICO

**Findings desafiados:**
- Performance: 'card rasteriza em 5-11s' — o auditor de imagem mediu 56-240ms warm; os 5-11s são cold start + refetch upstream. O diagnóstico errado muda o remédio: a resposta certa é pack-data-in-URL/pré-render seletivo, não tratar o raster como gargalo. Manter só o quick-win de 'texto primeiro, card depois'.
- Segurança: trocar === por safeEqual no bearer dos 3 crons — timing attack contra comparação de string via rede em serverless Vercel é impraticável na vida real. Não é quick win, é higiene de backlog. O que importa ali é o secret ser obrigatório.
- Resiliência: NDVI com viés BOA +1000 marcado como CRITICAL — é uma hipótese não verificada ('provavelmente'). A severidade certa é 'verificar empiricamente esta semana contra um talhão conhecido', não critical. A máscara de nuvem (SCL) é o achado mais defensável do par e deveria ser o headline.
- Arquitetura: 'dividir pipeline.ts e db.ts + tipos gerados do Supabase' como strategic move — 1.223 linhas com 547 testes verdes e guard test de taxonomia não é risco de sobrevivência. É exatamente o polish que o tripwire da própria estratégia (commits > conversas) manda congelar.
- Performance: tabela llm_usage e planejamento do reajuste do Sonnet (ago/2026) — o próprio auditor calcula <US$0,10 por conversa. Instrumentar custo que não dói, 13 meses antes do reajuste, é otimização prematura em estado puro.
- Resiliência: 'cease-and-desist do Yahoo Finance' — risco jurídico superestimado no volume atual (dezenas de usuários). Vira relevante SE o card de preços virar loop viral; até lá, um fallback (stooq) resolve o risco operacional, que é o real.
- Segurança: 2FA/TOTP + identidade por founder no painel — o painel tem 2 usuários. Session secret obrigatório e senha forte bastam pré-receita; 2FA é custo de fricção sem ameaça correspondente agora.
- Testes: smoke E2E sintético pós-deploy via GitHub Action — para 2 pessoas, branch protection + o canary existente cobrem ~80% do risco por uma fração da manutenção. E2E sintético contra produção com usuário de teste é infra frágil que ninguém vai manter.
- Dados: 'catálogo LGPD executável como argumento de venda para coops' — especulativo. Coop compra resultado (filtro de leads, caderno dos associados), não metadata de compliance. Fazer LIA + retenção mínima, sim; catálogo por tabela como feature de venda, não.
- UI/UX: 'domínio próprio antes de escalar prospecção' como strategic move independente — é derivado do CNPJ (pré-requisito do .agr.br e da verificação Meta). Não é um item separado, é consequência do item existencial que a estratégia já apontou.
- Produto: resposta em áudio (TTS) — hipótese razoável de assimetria, mas nenhuma evidência de demanda citada (nenhum produtor pediu). Não entra na fila antes do gate de validação.
- Segurança/LGPD: truncar lat/lon nas URLs de card tratado como risco de privacidade relevante — o card é encaminhado voluntariamente pelo próprio produtor. O risco real no endpoint é forgery de marca (esse sim high). Truncar é bom para cache de CDN; a justificativa de privacidade está inflada.

**O que ninguém cobriu:**
- NÚMEROS DE TRAÇÃO REAL: nenhum dos 12 auditores reportou quantos produtores ativos existem, retenção W1/W4, conversas/dia, ou quantos usuários voltaram após a primeira sessão. Toda a auditoria é sobre o código; a decisão de sobrevivência (e o gate de 60 dias) depende de tração que ninguém mediu. É a lacuna mais grave do exercício inteiro.
- RUNWAY E BURN: zero cobertura de caixa — custo mensal total (Vercel + Twilio + OpenRouter + Supabase + Meta), meses de pista, plano de captação ou bootstrap. Para 2 founders pré-receita, runway é a variável que domina todas as outras prioridades.
- RESPONSABILIDADE CIVIL AGRONÔMICA: LGPD foi coberta, mas ninguém auditou o risco de a triagem errada causar perda de lavoura — limites jurídicos do 'triagem, não prescrição' perante CREA e CDC, disclaimers no produto (grep por 'não prescrição'/disclaimer nos prompts não retorna nada), e o papel formal do Michel como responsável técnico se algo der errado. Um produtor que perde a safra seguindo a Stevi é risco existencial tão real quanto um ban da Meta.
- CANAIS DE AQUISIÇÃO ALTERNATIVOS: toda a discussão de GTM orbita cold-WA da Vitória e viral cards. Ninguém avaliou grupos de WhatsApp rurais existentes, sindicatos, EMATER/ATER, revendas como distribuição, rádio rural — canais onde o público-alvo já está e onde 'confiança emprestada' (a própria tese) é nativa.
- ALOCAÇÃO DE TEMPO DOS FOUNDERS: a estratégia nota de passagem que 'o founder de campo que o plano exige não existe', mas ninguém auditou a divisão real de trabalho dos 2 founders — quem vende, quem codifica, quantas horas/semana em conversa com usuário. O tripwire commits>conversas é sintoma disso.
- BACKUP/DR DO SUPABASE: o moat declarado é o dado (caderno, triage_events futuros), e não há nenhuma configuração de backup/PITR auditada nem mencionada. Perder o banco = perder a empresa, e ninguém checou.
- FORNECEDOR LLM ÚNICO: OpenRouter caído = produto mudo. O auditor de resiliência cobriu timeout, mas não redundância de provider (fallback direto Anthropic/Google) nem o risco de conta suspensa/rate-limit do intermediário único da feature central.
- CONCORRÊNCIA COMO PROCESSO: a pesquisa competitiva foi feita uma vez (16/jul). Bots de WhatsApp agro estão surgindo rápido; ninguém propôs monitoramento contínuo nem trigger de reavaliação do posicionamento.

**TOP 10 prioridades:**
- [agora] **Memo de 1 página: tese de receita + beachhead (lead-gen agrônomo vs caderno/crédito; café vs hortifruti)** — Duas teses semi-testadas em 60 dias = zero teses validadas. Toda outra prioridade (o que consertar, o que matar, quem prospectar) depende desta decisão, aberta desde 16/jul.
- [agora] **Levantar os números reais de tração e falar com os usuários ativos** — Nenhum auditor sabe quantos produtores ativos existem nem a retenção. Sem esse baseline o gate de 60 dias é inoperável e as 5 referrals soja/milho paradas são a demanda orgânica mais quente da empresa — atendê-las (recrutando 1 agrônomo SP/MT ou declarando fora do beachhead) é aprendizado de mercado puro.
- [agora] **Postmortem escrito do dispatch pausado + religar com guard-rails (linha no digest, cap=10, bump coop excluído, disclosure de IA na 1ª mensagem)** — O funil está morto há 4+ dias no meio da janela de validação, com causa raiz não identificada. Religar sem postmortem acelera um ban; não religar queima a janela. As 4 correções de 1 linha cada entram no mesmo pacote.
- [agora] **Iniciar CNPJ esta semana (destrava +55, verificação Meta, display name, domínio .br)** — A empresa inteira é um número +1 que a Meta já sinaliza. O caminho crítico leva semanas e nenhum resultado do flight-plan sobrevive a um ban — é pré-requisito existencial, não milestone.
- [agora] **Formalizar Michel por escrito (5 linhas de WhatsApp) + sessão para assinar os 36 casos golden** — O QA agronômico, o CREA público e o molde do modelo estão em UMA pessoa sem acordo. A assinatura dos casos é a ação de maior alavancagem/custo de toda a dimensão de qualidade: transforma a métrica central de opinião de LLM em verdade de especialista.
- [30d] **Pacote confiabilidade do caminho crítico (1-2 dias): AbortSignal.timeout no chatOnce, alertFounders no catch-all do webhook, log.error nos fallbacks do cloud.ts, texto antes do card, 'Anotado' honesto no caderno** — Verificado no repo: llm.ts sem nenhum timeout e webhook sem catch-all alertado. São as falhas silenciosas da classe do outage recente e a mentira do 'Anotado' corrói o artefato central. Tudo cirúrgico, nada de refactor.
- [30d] **Consertar o loop de alertas de ponta a ponta (canal por usuário, templates aprovados geada/fogo, template-first fora da janela)** — Verificado: crons hard-codam TwilioAdapter — o loop de retenção declarado não chega em usuário Cloud nem dormente >24h. Sem isso a tese de re-engajamento não é testável, e retenção é a métrica de sobrevivência.
- [30d] **Separar prospecção do número do produto + decidir honestamente se cold-WA sobrevive à própria tese ('nunca número frio')** — Um ban por denúncia de cold outreach hoje mata a Stevi inteira, não só o funil B2B. E o canal que fecha parceiro no próprio plano é voz/intro vouchada — a Vitória vira follow-up de quem já respondeu.
- [30d] **Começar o moat de dados barato: triage_events + ndvi_readings append-only + rodapé wa.me em todos os cards** — Custo marginal ~zero (migration + poucas linhas nos pontos que já montam o card) e para de destruir os dois únicos datasets que compõem com escala. O wa.me fecha o viral loop declarado — hoje um forward não tem caminho de volta.
- [90d] **Gate de deploy mínimo (branch protection + check verify) e tirar titiler.xyz do caminho crítico se o onboarding escalar** — Deploy sem gate já quebrou produção duas vezes; branch protection custa 10 minutos. O titiler demo só vira urgente quando houver volume de onboarding — sequenciar atrás da tração, não antes.

**Kill list:**
- Cold outreach de marketing sem opt-in no número do produto — desligado permanece até existir número separado E decisão explícita de que cold-WA continua sendo canal (a tese do próprio plano diz que não).
- Migração design system v2 dos cards + lint tipográfico de SVG — congelar até o gate S4; nenhum produtor deixa de usar a Stevi por causa da escala tipográfica.
- Refactors estéticos: split de pipeline.ts/db.ts, tipos gerados do Supabase, passada de tightening de null-checks — o tripwire commits>conversas já disparou.
- Experimentos de gym/personas da Vitória — parados há 16 dias e sem funil ligado não geram sinal; retomar só depois do outbound religado e com outcome real.
- Citros e pastagem do discurso, roadmap e landing (se café for confirmado como beachhead no memo).
- Tabela llm_usage e planejamento do reajuste Sonnet ago/2026 como prioridade — custo é irrisório por admissão do próprio auditor.
- 2FA/TOTP no painel e safeEqual nos crons como itens de agora — backlog de higiene, não fila ativa.
- A promessa 'quando a rede estiver pronta' do REFERRAL_REPLY — matar a copy imediatamente, mesmo antes de decidir o que a substitui.

**Restart list:**
- Primeiro toque B2B: refazer do zero como intro vouchada/voz do founder (o canal que o próprio flight-plan diz que fecha parceiro), com a Vitória rebaixada a follow-up de quem já respondeu — não é patch no dispatch, é outro desenho de funil.
- Fluxo de referral do produtor: substituir a promessa vazia por entrega imediata (dossiê/caderno pronto para levar ao agrônomo local) — o fluxo atual coleta demanda real e a joga fora.
- Página/texto de base legal LGPD (/verificar + CONSENT_NOTE): reescrever com a base legal verdadeira (legítimo interesse com LIA) em vez de corrigir a alegação falsa de consentimento por remendos — a mentira pública é o pior dos dois mundos.
- Entrega de alertas proativos: reconstruir channel-aware (provider persistido por usuário, template-first) em vez de remendar o TwilioAdapter hard-coded — o desenho atual está errado por construção, não bugado.
- Copy do CTA da landing + seção B2B: reescrever alinhada ao fluxo real de entrada e ao lado parceiro do modelo (com Michel CREA-ES como âncora) — a página atual converte o público errado com instruções contraditórias.

**Research list:**
- Causa raiz das falhas pós-aceite de 20-21/jul (assinatura de qualidade de número #131049 vs credencial) — pesquisa obrigatória ANTES de religar o dispatch; 'credencial re-sincronizada' não explica falha pós-aceite.
- NDVI: verificação empírica do offset BOA +1000 e da necessidade de máscara SCL contra 1-2 talhões conhecidos (comparar com Copernicus Browser) — antes de mexer no cálculo; hoje é hipótese, não fato.
- Responsabilidade civil de recomendação agronômica: até onde 'triagem, não prescrição' protege perante CREA e CDC, que disclaimer o produto precisa exibir, e qual o papel formal do responsável técnico — consultar advogado antes de escalar usuários.
- Processo e custo real de: segundo número no mesmo WABA, verificação de negócio Meta com CNPJ novo, e display name — para sequenciar CNPJ → +55 → número de prospecção sem retrabalho.
- Entrevistar as 5 referrals soja/milho SP/MT antes de fechar o memo de beachhead — é a única demanda orgânica observada e pode invalidar a aposta café-MG.
- Programa de startups do Google Earth Engine vs self-host titiler (custo, prazo de aprovação) — decidir só quando houver volume de onboarding que justifique.
- Licenciamento de dados de preço (B3 delayed / CEPEA) — só se o memo decidir que o card de cotações vira loop de crescimento; até lá, fallback stooq resolve.
- Backup/PITR do Supabase no plano atual: o que existe hoje, custo de ativar, e teste de restore — o moat declarado é o dado e ninguém sabe se ele sobrevive a um acidente.
- Canais de distribuição com confiança nativa (sindicatos rurais, EMATER/ATER, grupos de WhatsApp existentes, revendas): mapear 3-5 e testar 1 com esforço de founder — alternativa ao cold-WA que a própria tese prefere.