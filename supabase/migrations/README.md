# Migrations — e a deriva entre o repo e o banco

O nome do arquivo é `<versão>_<nome>.sql`, e **a versão é a chave**: é por ela
que o `supabase db push` decide o que já rodou. Se a versão do arquivo não bate
com a que está em `supabase_migrations.schema_migrations`, o push acha que uma
migration já aplicada está pendente e tenta rodar de novo.

## O que aconteceu, duas vezes

Aplicar uma migration **pelo MCP ou pelo SQL Editor do dashboard** faz o banco
receber a mudança sem que o arquivo correspondente exista no repo com a versão
certa. A `20260803192238_founder_alerts_delivery_tracking.sql` documenta a
primeira vez; o commit `8c88ea9` (04/ago) consertou aquele caso com a mensagem
*"as migrations voltam a descrever o banco — e um banco novo volta a subir"*.

Voltou a acontecer. Em 24/ago a auditoria encontrou **10 arquivos com versão
divergente** e **4 migrations aplicadas sem arquivo** — ou seja, o `db push`
estava quebrado neste repositório: ele teria tentado reaplicar 10 migrations,
algumas com UPDATE de dados.

## O que foi feito em 24/ago

- **10 arquivos renomeados** para a versão que o banco de fato registrou. Puro
  `git mv`, nenhuma escrita no banco — os arquivos passaram a descrever a
  realidade, e a ordem entre eles passou a ser a ordem real de aplicação.
- **2 migrations reconstruídas** a partir do catálogo do Postgres, com a
  definição copiada verbatim de `pg_indexes`:
  `20260806120000_prospects_name_city_uq.sql` e
  `20260806211713_prospects_phoneless_name_city_unique.sql`.

## O que continua em aberto

**`20260804200140_create_voice_calls`** está aplicada no banco e não tem
arquivo. A tabela `voice_calls` existe e o repo já tem
`20260804185850_voice_calls.sql`, então esta parece ser uma segunda aplicação
sobre a mesma tabela — provavelmente uma correção feita direto no dashboard
durante a virada do agente de voz em 04/ago. **Não reconstruí**: sem saber o
que ela mudou, um arquivo inventado é pior que a ausência dele. Quem lembrar do
que foi feito naquele dia deve escrever o arquivo; até lá, um banco novo sobe
sem essa alteração.

**`20260824180000_farms_municipio.sql`** foi aplicada pelo SQL Editor e não
entrou no histórico. Não é problema: ela é `add column if not exists` +
`create index if not exists`, então o próximo `db push` roda de novo sem efeito
e registra a versão. O `comment on column` daquele arquivo também não foi
aplicado, e o push resolve isso junto.

## A regra, daqui pra frente

Aplique por `supabase db push`, nunca pelo dashboard nem pelo MCP. As duas
outras vias mudam o banco sem mudar o histórico, e é exatamente assim que a
deriva nasce.

Para conferir se o repo e o banco concordam, compare a lista de arquivos aqui
com `supabase_migrations.schema_migrations`. As duas listas de versão têm de ser
idênticas.
