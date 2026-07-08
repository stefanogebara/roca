# Stevi — Webhook Contract

The single HTTP surface: `POST/GET https://roca-black.vercel.app/api/webhook`. One
endpoint serves both the Twilio sandbox and the Meta WhatsApp Cloud API; the handler
picks the adapter per request. This document is the inbound/outbound contract and the
two signature schemes.

## Table of contents

- [One endpoint, two providers](#one-endpoint-two-providers)
- [Raw body and HTTP methods](#raw-body-and-http-methods)
- [Neutral message shapes](#neutral-message-shapes)
- [Twilio path](#twilio-path)
- [Meta Cloud API path](#meta-cloud-api-path)
- [Twilio vs Meta at a glance](#twilio-vs-meta-at-a-glance)
- [Message kinds and how each is handled](#message-kinds-and-how-each-is-handled)
- [Status codes and acks](#status-codes-and-acks)
- [Rate limiting](#rate-limiting)

---

## One endpoint, two providers

`api/webhook.ts` instantiates both a `TwilioAdapter` and a `CloudApiAdapter` and
selects one per request by shape (`selectAdapter`):

- an `x-hub-signature-256` header **or** an `application/json` content-type → **Meta
  Cloud** adapter;
- otherwise → **Twilio** (the active sandbox, which posts `application/x-www-form-
  urlencoded`).

Because both providers live at one URL, moving from the Twilio sandbox to Meta is a
configuration change (point Meta's webhook here, provision the Meta env vars), not a
code change. Everything downstream of `parseInbound` is provider-agnostic — see
[the architecture doc](../architecture/).

## Raw body and HTTP methods

The function disables Vercel's body parser (`export const config = { api: {
bodyParser: false } }`) and reads the **raw bytes** itself. This is mandatory: Meta
signs the exact request body (HMAC-SHA256) and a re-serialized/parsed body would not
match; Twilio's scheme also needs the precise form params. The raw `Buffer` is passed
to the adapter as `TransportRequest.rawBody`, and each adapter parses it its own way.

| Method | Behaviour |
|--------|-----------|
| `GET` with `hub.mode` in query | Meta subscription challenge — echoes `hub.challenge` when `hub.verify_token` matches `WHATSAPP_CLOUD_VERIFY_TOKEN`, else `403`. |
| `GET` (otherwise) | Health check → `200 { "status": "ok", "service": "stevi-webhook" }`. |
| `POST` | Inbound message. Read raw body → select adapter → verify signature → parse → `handleInbound` → ack. |
| any other | `405 { "error": "Method not allowed" }`. |

Any unexpected error inside the POST path is logged and still **acked** (so the
provider doesn't retry-storm), except a failed signature check, which returns `403`.

## Neutral message shapes

Both adapters normalize to `InboundMessage` (`api/_lib/transport/types.ts`):

```ts
interface InboundMessage {
  from: string;                 // sender phone, E.164-ish, no 'whatsapp:' prefix
  messageId: string;            // provider message id
  kind: 'text' | 'image' | 'voice' | 'location' | 'unsupported';
  text: string | null;         // body, caption, or transcript
  mediaUrl: string | null;     // Twilio: a URL; Meta: a media id (resolved by fetchMedia)
  mediaMime: string | null;
  location: { lat: number; lon: number } | null;
  profileName: string | null;  // WhatsApp display name, if provided
}
```

Outbound is just `{ to, text }`. Both adapters set `isSync = false`: the webhook acks
immediately and the reply is sent out-of-band via `send()`.

## Twilio path

`api/_lib/transport/twilio.ts`.

**Signature — HMAC-SHA1.** Twilio signs each POST. The scheme:

1. Take the full request URL (`https://<host><path>`).
2. Append, for every POST parameter **sorted by key**, the key immediately followed
   by its value (no separators): `url + sortedKeys.map(k => k + params[k]).join('')`.
3. `HMAC-SHA1` that string, keyed by the Twilio **auth token**, base64-encode.
4. Compare (constant-time) to the `X-Twilio-Signature` header.

Implemented in `computeTwilioSignature(authToken, url, params)` and verified in
`verifySignature`. A missing `TWILIO_AUTH_TOKEN` or header → verification fails
(`403`). The URL is rebuilt from the `host` header + `req.url`, so the deployed
public URL must match what Twilio is configured to call.

**Inbound parse.** The URL-encoded form is read from the raw body. Fields used:
`From` (strip `whatsapp:`), `Body`, `NumMedia`, `MediaUrl0`, `MediaContentType0`,
`Latitude`/`Longitude`, `MessageSid` (→ `messageId`, with a synthetic fallback), and
`ProfileName`. A location (lat+lon present) becomes `kind: 'location'`; else
`NumMedia > 0` classifies `MediaContentType0` into `image`/`voice`/`unsupported`;
else it's `text`. An empty text message returns `null` (nothing to do).

**Send.** `POST https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json`, form
body `From`/`To=whatsapp:<to>`/`Body`, HTTP basic auth (`SID:token`). Requires
`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`.

**Media fetch.** Twilio media URLs need account basic-auth; `fetchMedia(url)` GETs the
URL and returns `{ base64, mime }` for the LLM.

## Meta Cloud API path

`api/_lib/transport/cloud.ts`. Graph API `v21.0`.

**Subscription challenge (GET).** `verifyCloudChallenge(query)` returns
`hub.challenge` when `hub.mode === 'subscribe'` and `hub.verify_token` equals
`WHATSAPP_CLOUD_VERIFY_TOKEN`; the webhook echoes it with `200`, else `403`.

**Signature — HMAC-SHA256.** `verifySignature` computes `HMAC-SHA256(rawBody)` keyed
by `WHATSAPP_APP_SECRET`, hex-encoded, and compares it (constant-time) to the
`X-Hub-Signature-256` header (which is prefixed `sha256=`). A missing app secret or a
malformed/absent header → `403`.

**Inbound parse.** JSON envelope
`entry[0].changes[0].value.{messages[0], contacts[0].profile.name}`. Status callbacks
(no `messages`) and malformed JSON return `null` (fail-soft). Message `type` mapping:

| Graph `type` | → `kind` | Notes |
|--------------|----------|-------|
| `text` | `text` | `text.body` |
| `image` | `image` | `mediaUrl` = media **id**; `mediaMime`; `caption` → `text` |
| `audio` / `voice` | `voice` | `mediaUrl` = media id |
| `location` | `location` | `latitude`/`longitude` |
| `interactive` | `text` | `button_reply.title` or `list_reply.title` → `text` |
| `button` | `text` | `button.text` |
| (other) | `unsupported` | |

**Send.** `POST {GRAPH}/{WHATSAPP_CLOUD_PHONE_NUMBER_ID}/messages` with a JSON text
message, bearer `WHATSAPP_CLOUD_TOKEN`.

**Media fetch — two hops.** `fetchMedia(mediaId)` first GETs `{GRAPH}/{mediaId}` to get
a temporary URL, then GETs that URL for the bytes (both bearer-authed), returning
`{ base64, mime }`.

## Twilio vs Meta at a glance

| Aspect | Twilio (sandbox, live) | Meta Cloud API (endgame) |
|--------|------------------------|--------------------------|
| Body | `application/x-www-form-urlencoded` | JSON |
| Signature | `X-Twilio-Signature`, HMAC-**SHA1**, keyed by auth token, over URL+sorted params | `X-Hub-Signature-256`, HMAC-**SHA256**, keyed by app secret, over raw body |
| Subscription challenge | none | `GET` `hub.challenge` echo |
| Media reference | full URL (basic-auth fetch) | media **id** (two-hop bearer fetch) |
| Extra inbound kinds | — | interactive replies, template button replies |
| Ack format | empty TwiML (`text/xml`) | `200 { "received": true }` |
| Send API | Twilio REST `Messages.json` | Graph `/{phoneId}/messages` |
| Env | `TWILIO_*` | `WHATSAPP_CLOUD_*`, `WHATSAPP_APP_SECRET` |

> **State of play.** Twilio is the live transport. The Meta adapter is implemented
> and unit-tested (`tests/cloud.test.ts`) and shares this endpoint, but going live
> needs the Meta app + env provisioning in [the deployment doc](../deployment/).

## Message kinds and how each is handled

Once normalized, the pipeline treats every provider identically:

- **text** → intent router → reasoning (grounded Q&A, spray verdict, or smalltalk),
  unless it's a crop-capture answer right after the farm card.
- **image** → always `pest_triage` → grounded two-step photo triage (`handleVision`).
- **voice** → media fetched → transcribed to PT-BR text → handled as text; if
  transcription fails, a canned "resend/type" reply.
- **location** → deterministic farm card (soil + spray window + vazio sanitário), no
  LLM, then Stevi asks what the farmer grows (`awaiting = 'crop'`).
- **unsupported / unreadable** → a short "couldn't read that, send text or audio"
  reply (empty inbound may be dropped at parse time).

## Status codes and acks

| Code | When |
|------|------|
| `200` (TwiML or JSON) | Message accepted/acked (including when parse yields no actionable message). |
| `200` (challenge string) | Meta subscription verification success. |
| `403` | Signature verification failed, or Meta challenge token mismatch. |
| `401` | Only on the separate cron endpoint (`/api/cron/monitor`) without the `CRON_SECRET` bearer. |
| `405` | Non-GET/POST method on the webhook. |

## Rate limiting

Abuse/echo-loop protection is enforced in the **pipeline**, not the transport layer:
after identifying the user, `handleInbound` counts inbound messages in the last 60 s
and, above 15, sends one heads-up then drops silently (logged as `intent:
'rate_limited'`), before any media fetch or LLM call. It is per-user and counted in
the `messages` table (stateless-compatible), fail-open on DB error. See
[the architecture doc](../architecture/) for where it sits in the loop.
