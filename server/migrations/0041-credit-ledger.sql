-- Up Migration
CREATE TABLE accounts.credit_wallets(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid REFERENCES accounts.users(id) ON DELETE RESTRICT,
  owner_organization_id uuid REFERENCES accounts.organizations(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active' CHECK(status IN('active','frozen','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK((owner_user_id IS NOT NULL)::int + (owner_organization_id IS NOT NULL)::int = 1)
);
CREATE UNIQUE INDEX credit_wallet_user_unique ON accounts.credit_wallets(owner_user_id) WHERE owner_user_id IS NOT NULL;
CREATE UNIQUE INDEX credit_wallet_organization_unique ON accounts.credit_wallets(owner_organization_id) WHERE owner_organization_id IS NOT NULL;

CREATE TABLE accounts.credit_reservations(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),wallet_id uuid NOT NULL REFERENCES accounts.credit_wallets(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK(quantity>0),bucket text NOT NULL CHECK(bucket IN('promotional','purchased')),
  product_key text NOT NULL,related_reference text,status text NOT NULL DEFAULT 'active' CHECK(status IN('active','consumed','released','expired')),
  idempotency_key text NOT NULL UNIQUE,created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL,
  completed_at timestamptz, CHECK(expires_at>created_at)
);

CREATE TABLE accounts.credit_ledger(
  id bigserial PRIMARY KEY,wallet_id uuid NOT NULL REFERENCES accounts.credit_wallets(id) ON DELETE RESTRICT,
  entry_type text NOT NULL CHECK(entry_type IN('grant','purchase','reserve','consume','release','refund','expire','transfer_in','transfer_out','adjustment')),
  quantity integer NOT NULL CHECK(quantity>0),bucket text NOT NULL CHECK(bucket IN('promotional','purchased')),
  product_key text,related_reference text,reservation_id uuid REFERENCES accounts.credit_reservations(id) ON DELETE RESTRICT,
  reversal_of_id bigint REFERENCES accounts.credit_ledger(id) ON DELETE RESTRICT,actor_user_id uuid REFERENCES accounts.users(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL UNIQUE,reason text NOT NULL,expires_at timestamptz,metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX credit_ledger_wallet_created_idx ON accounts.credit_ledger(wallet_id,created_at,id);
CREATE TRIGGER credit_ledger_no_mutation BEFORE UPDATE OR DELETE ON accounts.credit_ledger FOR EACH ROW EXECUTE FUNCTION accounts.reject_audit_mutation();

-- Down Migration
DROP TRIGGER credit_ledger_no_mutation ON accounts.credit_ledger;
DROP TABLE accounts.credit_ledger;
DROP TABLE accounts.credit_reservations;
DROP TABLE accounts.credit_wallets;
