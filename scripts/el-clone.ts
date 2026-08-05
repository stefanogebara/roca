/**
 * Clone da voz da Vitória no ElevenLabs (IVC — instant voice clone).
 *
 *   npm run el:clone -- <pasta-com-audios>            # cria o clone e gera amostra
 *   npm run el:clone -- <pasta-com-audios> --aplicar  # + troca a voz do agente
 *
 * Fluxo do dia da gravação:
 *   1. Stefano grava a Vitória (roteiro em .claude/plans/2026-08-04-agente-voz/
 *      gravacao-vitoria.md) e salva os arquivos numa pasta.
 *   2. `npm run el:clone -- C:/caminho/da/pasta` → cria a voz "Vitoria (Stevi)"
 *      e gera vitoria-clone-teste.mp3 pra ouvir ANTES de trocar.
 *   3. Aprovou de ouvido → rodar de novo com --aplicar (atualiza o .env e o
 *      agente ao vivo via el-setup).
 *
 * IVC não exige voice captcha; o PVC (qualidade superior, 30min+ de áudio)
 * exige a própria Vitória verificando no dashboard — fica pra depois.
 * A chave precisa da permissão de ESCRITA em Voices (mesma tela das outras).
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, extname } from 'node:path';

export const VOICE_NAME_CLONE = 'Vitoria (Stevi)';

/**
 * Caminho do .env, relativo à raiz do repositório.
 *
 * Era `new URL('../.env', import.meta.url)`. O `tsx` engole isso, mas o
 * `package.json` declara `"type": "commonjs"` e o `tsconfig` compila em
 * CommonJS — onde `import.meta` não existe. O `tsc --noEmit` quebrava
 * (TS1343), e quebrava só AQUI entre os seis scripts porque este é o único
 * alcançado pelo typecheck: `tests/el-clone.test.ts` importa `arquivosDeAudio`
 * daqui, e isso arrasta o arquivo inteiro para dentro do `include`.
 *
 * `process.cwd()` é a convenção da casa para achar arquivo (ver
 * `goldeneval.ts`, que resolve o goldenset assim). Os scripts rodam por
 * `npm run`, sempre a partir da raiz.
 */
const ENV_PATH = join(process.cwd(), '.env');
const EXTS_ACEITAS = ['.mp3', '.wav', '.m4a', '.flac', '.ogg'];

/** Filtra os arquivos de áudio aceitos pela API de clone (pura, testável). */
export function arquivosDeAudio(nomes: string[]): string[] {
  return nomes.filter((n) => EXTS_ACEITAS.includes(extname(n).toLowerCase())).sort();
}

const FRASE_TESTE =
  'Oi! Aqui é a Vitória, da Stevi... a gente combinou essa ligação pelo WhatsApp, lembra? ' +
  'Então, me conta: hoje, quando aparece um produtor novo aí, ele chega como?';

async function main(): Promise<void> {
  // .env manual (mesmo padrão dos outros scripts do repo).
  for (const line of readFileSync(ENV_PATH, 'utf8').split('\n')) {
    const i = line.indexOf('=');
    if (i > 0 && !line.trimStart().startsWith('#')) {
      const k = line.slice(0, i).trim();
      if (!process.env[k]) process.env[k] = line.slice(i + 1).trim();
    }
  }
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('ELEVENLABS_API_KEY ausente no .env.');

  const args = process.argv.slice(2).filter((a) => a !== '--aplicar');
  const aplicar = process.argv.includes('--aplicar');
  const pasta = args[0];
  if (!pasta) throw new Error('Uso: npm run el:clone -- <pasta-com-audios> [--aplicar]');

  const arquivos = arquivosDeAudio(readdirSync(pasta));
  if (!arquivos.length) throw new Error(`Nenhum áudio (${EXTS_ACEITAS.join('/')}) em ${pasta}`);
  console.log(`Áudios encontrados (${arquivos.length}):`, arquivos.join(', '));

  // Voz já existe? Reusar (idempotência pelo nome, como no el-setup).
  const lista = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': key } });
  if (!lista.ok) throw new Error(`GET /voices ${lista.status}`);
  const jl = (await lista.json()) as { voices?: Array<{ voice_id: string; name: string }> };
  let voiceId = (jl.voices ?? []).find((v) => v.name === VOICE_NAME_CLONE)?.voice_id ?? null;

  if (voiceId) {
    console.log(`Voz "${VOICE_NAME_CLONE}" já existe (${voiceId}) — reusando. Apague no dashboard pra recriar.`);
  } else {
    const form = new FormData();
    form.append('name', VOICE_NAME_CLONE);
    form.append(
      'description',
      'Clone IVC da Vitória (cofundadora) — gravação em tom de conversa, 04-05/ago/2026, com consentimento.'
    );
    form.append('remove_background_noise', 'true');
    for (const f of arquivos) {
      form.append('files', new Blob([readFileSync(join(pasta, f))]), f);
    }
    const res = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: { 'xi-api-key': key },
      body: form,
    });
    if (!res.ok) throw new Error(`POST /voices/add ${res.status}: ${(await res.text()).slice(0, 300)}`);
    voiceId = ((await res.json()) as { voice_id: string }).voice_id;
    console.log(`✅ Clone criado: ${VOICE_NAME_CLONE} (${voiceId})`);
  }

  // Amostra com as MESMAS voice_settings do agente — ouvir antes de trocar.
  const tts = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: FRASE_TESTE,
        model_id: 'eleven_flash_v2_5',
        voice_settings: { stability: 0.35, similarity_boost: 0.8, use_speaker_boost: true },
      }),
    }
  );
  if (!tts.ok) throw new Error(`amostra falhou ${tts.status}: ${(await tts.text()).slice(0, 200)}`);
  writeFileSync('vitoria-clone-teste.mp3', Buffer.from(await tts.arrayBuffer()));
  console.log('🎧 Amostra: vitoria-clone-teste.mp3 — OUÇA antes de aplicar.');

  if (!aplicar) {
    console.log(`\nAprovou de ouvido? Rode:  npm run el:clone -- ${pasta} --aplicar`);
    return;
  }

  // --aplicar: ELEVENLABS_VOICE_ID no .env + PATCH do agente via el-setup.
  const env = readFileSync(ENV_PATH, 'utf8')
    .split('\n')
    .map((l) => (l.startsWith('ELEVENLABS_VOICE_ID=') ? `ELEVENLABS_VOICE_ID=${voiceId}` : l))
    .join('\n');
  writeFileSync(ENV_PATH, env);
  console.log('ELEVENLABS_VOICE_ID atualizado no .env — aplicando no agente...');
  // execSync com string FIXA (sem input do usuário) — o shell é necessário
  // porque npm no Windows é npm.cmd.
  execSync('npm run el:setup', { stdio: 'inherit' });
  console.log('\n✅ A Vitória-voz agora fala com a voz da Vitória. Liga pro número e confere.');
}

// Só roda como script — os testes importam as funções puras sem efeito.
if (process.argv[1]?.includes('el-clone')) {
  main().catch((e) => {
    console.error('❌', (e as Error).message);
    process.exit(1);
  });
}
