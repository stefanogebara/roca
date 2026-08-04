/**
 * Provisionador do agente Vitória-voz no ElevenLabs. Idempotente: cria o
 * agente se não existe (pelo nome AGENT_NAME_EL), atualiza se existe. Rodar:
 *
 *   npm run el:setup            # cria/atualiza o agente
 *   npm run el:setup -- --vozes # só lista vozes pt-BR pra escolher a voice_id
 *
 * Pré-requisitos no .env (todos gerados pelo Stefano, nunca por automação):
 *   ELEVENLABS_API_KEY   — Profile → API Keys na conta EL
 *   ELEVENLABS_VOICE_ID  — escolhida com --vozes (decisão de ouvido)
 *   EL_TOOLS_SECRET      — string aleatória; a MESMA vai na env da Vercel
 *
 * Passos manuais que a API não cobre (dashboard EL): ativar o post-call
 * webhook apontando pra https://roca-black.vercel.app/api/el-webhook e copiar
 * o secret pra ELEVENLABS_WEBHOOK_SECRET na Vercel; importar o número Twilio
 * em Phone Numbers e vinculá-lo ao agente.
 */

import { readFileSync } from 'node:fs';
import { montarConfigAgente, AGENT_NAME_EL } from '../api/_lib/voice/elAgent';

// .env manual (mesmo padrão dos outros scripts do repo).
for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const i = line.indexOf('=');
  if (i > 0 && !line.trimStart().startsWith('#')) {
    const k = line.slice(0, i).trim();
    if (!process.env[k]) process.env[k] = line.slice(i + 1).trim();
  }
}

const API = 'https://api.elevenlabs.io/v1';
const TOOLS_URL = process.env.EL_TOOLS_URL || 'https://roca-black.vercel.app/api/el-tools';

async function el(path: string, init: RequestInit = {}): Promise<Response> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('ELEVENLABS_API_KEY ausente no .env — gere em Profile → API Keys e cole lá.');
  return fetch(`${API}${path}`, {
    ...init,
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
}

async function listarVozes(): Promise<void> {
  const res = await el('/voices');
  if (!res.ok) throw new Error(`GET /voices ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as { voices?: Array<{ voice_id: string; name: string; labels?: Record<string, string> }> };
  console.log('\nVozes disponíveis (escolha uma pt-BR de ouvido e ponha em ELEVENLABS_VOICE_ID):\n');
  for (const v of j.voices ?? []) {
    const labels = Object.values(v.labels ?? {}).join(', ');
    console.log(`  ${v.voice_id}  ${v.name}${labels ? `  (${labels})` : ''}`);
  }
  console.log('\nOuça cada uma no dashboard (Voices) antes de decidir — voz é decisão de ouvido.');
}

async function acharAgente(): Promise<string | null> {
  const res = await el('/convai/agents?page_size=100');
  if (!res.ok) throw new Error(`GET /convai/agents ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as { agents?: Array<{ agent_id: string; name: string }> };
  return (j.agents ?? []).find((a) => a.name === AGENT_NAME_EL)?.agent_id ?? null;
}

async function main(): Promise<void> {
  if (process.argv.includes('--vozes')) {
    await listarVozes();
    return;
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  const toolsSecret = process.env.EL_TOOLS_SECRET;
  if (!voiceId) throw new Error('ELEVENLABS_VOICE_ID ausente — rode `npm run el:setup -- --vozes` e escolha uma.');
  if (!toolsSecret) throw new Error('EL_TOOLS_SECRET ausente — gere uma string aleatória e ponha no .env E na Vercel.');

  const cfg = montarConfigAgente({ voiceId, toolsUrl: TOOLS_URL, toolsSecret });
  const existente = await acharAgente();

  if (existente) {
    const res = await el(`/convai/agents/${existente}`, { method: 'PATCH', body: JSON.stringify(cfg) });
    if (!res.ok) throw new Error(`PATCH agente ${res.status}: ${(await res.text()).slice(0, 300)}`);
    console.log(`✅ Agente atualizado: ${AGENT_NAME_EL} (${existente})`);
  } else {
    const res = await el('/convai/agents/create', { method: 'POST', body: JSON.stringify(cfg) });
    if (!res.ok) throw new Error(`POST create ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const j = (await res.json()) as { agent_id?: string };
    console.log(`✅ Agente criado: ${AGENT_NAME_EL} (${j.agent_id})`);
  }

  console.log(`
Próximos passos manuais (dashboard EL, ~3 min):
 1. Settings → Webhooks: ativar post-call webhook → URL https://roca-black.vercel.app/api/el-webhook
    e copiar o secret pra ELEVENLABS_WEBHOOK_SECRET (Vercel + .env).
 2. Phone Numbers → Import: número Twilio BR, e vincular ao agente.
 3. EL_TOOLS_SECRET também na env da Vercel (o header das tools depende dele).
 4. Teste: ligar VOCÊ pro número e conversar com a Vitória em pt-BR — 10
    ligações internas antes de qualquer uso real (plano 2026-08-04-agente-voz).`);
}

main().catch((e) => {
  console.error('❌', (e as Error).message);
  process.exit(1);
});
