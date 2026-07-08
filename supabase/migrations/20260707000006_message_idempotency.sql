-- Webhook idempotency: providers (Twilio/Meta) redeliver on timeout, and slow
-- paths (photo triage) can exceed the webhook window. A partial unique index on
-- the inbound provider_message_id lets us reject a duplicate delivery instead of
-- reprocessing it (double reply + double LLM spend).
create unique index if not exists messages_provider_msg_in_uidx
  on public.messages (provider_message_id)
  where direction = 'in' and provider_message_id is not null;
