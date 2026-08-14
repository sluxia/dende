-- Up Migration

CREATE SCHEMA IF NOT EXISTS accounts;
CREATE TABLE accounts.users(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),status text NOT NULL DEFAULT 'active' CHECK(status IN('active','suspended','closed')),
  display_name text,preferred_locale text NOT NULL DEFAULT 'en-NG',timezone text NOT NULL DEFAULT 'Africa/Lagos',created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE accounts.identities(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES accounts.users(id) ON DELETE RESTRICT,
  identity_type text NOT NULL CHECK(identity_type IN('email','phone')),normalized_value text NOT NULL,display_value text NOT NULL,
  verification_status text NOT NULL DEFAULT 'unverified' CHECK(verification_status IN('unverified','pending','verified','rejected')),
  verified_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(identity_type,normalized_value)
);
CREATE TABLE accounts.password_credentials(
  user_id uuid PRIMARY KEY REFERENCES accounts.users(id) ON DELETE RESTRICT,password_hash text NOT NULL,password_salt text NOT NULL,
  algorithm text NOT NULL DEFAULT 'scrypt-v1',changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE accounts.sessions(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES accounts.users(id) ON DELETE RESTRICT,
  token_hash text NOT NULL UNIQUE,created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL,last_used_at timestamptz NOT NULL DEFAULT now(),revoked_at timestamptz,user_agent text,ip_address inet
);
CREATE INDEX account_sessions_active_idx ON accounts.sessions(token_hash,expires_at) WHERE revoked_at IS NULL;
CREATE TABLE accounts.challenges(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES accounts.users(id) ON DELETE RESTRICT,identity_id uuid REFERENCES accounts.identities(id) ON DELETE RESTRICT,
  challenge_type text NOT NULL CHECK(challenge_type IN('verify_identity','recover_account','change_sensitive_data')),
  secret_hash text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL,consumed_at timestamptz,attempt_count integer NOT NULL DEFAULT 0,metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE accounts.audit_events(
  id bigserial PRIMARY KEY,actor_user_id uuid REFERENCES accounts.users(id) ON DELETE RESTRICT,subject_user_id uuid REFERENCES accounts.users(id) ON DELETE RESTRICT,
  action text NOT NULL,request_context jsonb NOT NULL DEFAULT '{}'::jsonb,snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION accounts.reject_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Account audit events are append-only'; END $$;
CREATE TRIGGER account_audit_no_mutation BEFORE UPDATE OR DELETE ON accounts.audit_events FOR EACH ROW EXECUTE FUNCTION accounts.reject_audit_mutation();

-- Down Migration
DROP TRIGGER account_audit_no_mutation ON accounts.audit_events;DROP FUNCTION accounts.reject_audit_mutation();DROP TABLE accounts.audit_events;DROP TABLE accounts.challenges;DROP TABLE accounts.sessions;DROP TABLE accounts.password_credentials;DROP TABLE accounts.identities;DROP TABLE accounts.users;DROP SCHEMA accounts;
