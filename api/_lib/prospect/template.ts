/**
 * WhatsApp template management for prospecting — submit and track the
 * personalized v2 first-touch template via the Graph API, using the same
 * WHATSAPP_CLOUD_TOKEN the transport already has. Meta requires
 * business-initiated messages to be pre-approved templates; this keeps the
 * submit/approve loop inside the ops console instead of the WhatsApp Manager
 * UI. The WABA id is resolved from the token itself (debug_token), with
 * WHATSAPP_WABA_ID as an env override.
 */

import { createLogger } from '../logger';

const log = createLogger('prospect-template');
const GRAPH = 'https://graph.facebook.com/v21.0';

export const V2_NAME = 'stevi_parceria_v2';

// Must match personalize.ts buildTemplateParams order: {{1}}=name, {{2}}=hook, {{3}}=city.
const V2_BODY =
  'Oi! Aqui é a Vitória, da Stevi 🌱 Falo com a {{1}}? Vi que vocês {{2}} na região de {{3}}. ' +
  'A Stevi é uma assistente gratuita de WhatsApp que faz triagem agronômica pra produtores de café — ' +
  'e quando o produtor precisa de receituário, a gente indica um agrônomo parceiro da região. ' +
  'Faz sentido trocar uma ideia rápida sobre parceria?';
const V2_FOOTER = 'Pra não receber mais mensagens, responda SAIR.';

function token(): string {
  const t = process.env.WHATSAPP_CLOUD_TOKEN;
  if (!t) throw new Error('WHATSAPP_CLOUD_TOKEN not configured');
  return t;
}

/** WABA id: env override, else derived from the token's granted scopes. */
export async function resolveWabaId(): Promise<string> {
  const override = process.env.WHATSAPP_WABA_ID;
  if (override) return override;
  const t = token();
  const res = await fetch(
    `${GRAPH}/debug_token?input_token=${encodeURIComponent(t)}&access_token=${encodeURIComponent(t)}`
  );
  const json = (await res.json()) as {
    data?: { granular_scopes?: Array<{ scope: string; target_ids?: string[] }> };
  };
  const scopes = json.data?.granular_scopes ?? [];
  const mgmt = scopes.find((s) => s.scope === 'whatsapp_business_management');
  const id = mgmt?.target_ids?.[0];
  if (!id) throw new Error('could not resolve WABA id from token (set WHATSAPP_WABA_ID)');
  return id;
}

export interface TemplateStatus {
  name: string;
  status: string; // APPROVED | PENDING | REJECTED | ...
  id?: string;
  rejectedReason?: string | null;
}

/** Current status of a template by name (null if it doesn't exist yet). */
export async function getTemplateStatus(name: string): Promise<TemplateStatus | null> {
  const waba = await resolveWabaId();
  const res = await fetch(
    `${GRAPH}/${waba}/message_templates?name=${encodeURIComponent(name)}&fields=name,status,id,rejected_reason`,
    { headers: { Authorization: `Bearer ${token()}` } }
  );
  const json = (await res.json()) as {
    data?: Array<{ name: string; status: string; id: string; rejected_reason?: string }>;
    error?: { message: string };
  };
  if (json.error) throw new Error(`template status failed: ${json.error.message}`);
  const hit = (json.data ?? []).find((t) => t.name === name);
  return hit
    ? { name: hit.name, status: hit.status, id: hit.id, rejectedReason: hit.rejected_reason ?? null }
    : null;
}

/**
 * Submit the v2 template. Idempotent from the caller's view: if it already
 * exists (any status), returns its current status instead of resubmitting.
 */
export async function submitV2Template(): Promise<{ submitted: boolean; status: TemplateStatus }> {
  const existing = await getTemplateStatus(V2_NAME);
  if (existing) return { submitted: false, status: existing };

  const waba = await resolveWabaId();
  const res = await fetch(`${GRAPH}/${waba}/message_templates`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: V2_NAME,
      language: 'pt_BR',
      category: 'MARKETING',
      components: [
        {
          type: 'BODY',
          text: V2_BODY,
          example: {
            body_text: [['Agro Forte', 'atendem produtores no dia a dia', 'Varginha']],
          },
        },
        { type: 'FOOTER', text: V2_FOOTER },
      ],
    }),
  });
  const json = (await res.json()) as {
    id?: string;
    status?: string;
    error?: { message: string; error_user_msg?: string };
  };
  if (json.error) {
    const msg = json.error.error_user_msg || json.error.message;
    log.error('template submit failed:', msg);
    throw new Error(`template submit failed: ${msg}`);
  }
  return {
    submitted: true,
    status: { name: V2_NAME, status: json.status ?? 'PENDING', id: json.id },
  };
}
