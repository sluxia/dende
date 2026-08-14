-- Up Migration
CREATE TABLE accounts.delivery_outbox(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),identity_id uuid NOT NULL REFERENCES accounts.identities(id) ON DELETE RESTRICT,
  challenge_id uuid NOT NULL REFERENCES accounts.challenges(id) ON DELETE RESTRICT,delivery_type text NOT NULL CHECK(delivery_type IN('verify_identity','recover_account')),
  destination_masked text NOT NULL,development_url text,status text NOT NULL DEFAULT 'queued' CHECK(status IN('queued','sent','failed','development_only')),
  created_at timestamptz NOT NULL DEFAULT now(),sent_at timestamptz
);
CREATE INDEX challenges_rate_idx ON accounts.challenges(identity_id,challenge_type,created_at DESC);
-- Down Migration
DROP TABLE accounts.delivery_outbox;
