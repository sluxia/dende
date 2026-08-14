-- Up Migration
CREATE TABLE commerce.orders(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_number text NOT NULL UNIQUE,
  owner_user_id uuid REFERENCES accounts.users(id) ON DELETE RESTRICT,owner_organization_id uuid REFERENCES accounts.organizations(id) ON DELETE RESTRICT,
  market_key text NOT NULL REFERENCES commerce.markets(market_key) ON DELETE RESTRICT,locale text NOT NULL REFERENCES commerce.locales(locale) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','awaiting_payment','paid','fulfilling','fulfilled','cancelled','refunded','partially_refunded')),
  display_currency char(3) NOT NULL,charged_currency char(3) NOT NULL,settlement_currency char(3) NOT NULL,accounting_currency char(3) NOT NULL,
  subtotal_minor bigint NOT NULL CHECK(subtotal_minor>=0),external_fees_minor bigint NOT NULL DEFAULT 0 CHECK(external_fees_minor>=0),
  tax_minor bigint NOT NULL DEFAULT 0 CHECK(tax_minor>=0),total_minor bigint NOT NULL CHECK(total_minor>=0),
  idempotency_key text NOT NULL UNIQUE,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK((owner_user_id IS NOT NULL)::int+(owner_organization_id IS NOT NULL)::int=1),
  CHECK(display_currency~'^[A-Z]{3}$' AND charged_currency~'^[A-Z]{3}$' AND settlement_currency~'^[A-Z]{3}$' AND accounting_currency~'^[A-Z]{3}$'),
  CHECK(total_minor=subtotal_minor+external_fees_minor+tax_minor)
);
CREATE TABLE commerce.order_lines(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid NOT NULL REFERENCES commerce.orders(id) ON DELETE RESTRICT,
  line_type text NOT NULL CHECK(line_type IN('product','external_fee','tax','discount')),product_key text REFERENCES commerce.products(product_key) ON DELETE RESTRICT,
  price_id uuid REFERENCES commerce.prices(id) ON DELETE RESTRICT,description_snapshot text NOT NULL,quantity integer NOT NULL CHECK(quantity>0),
  currency char(3) NOT NULL,unit_amount_minor bigint NOT NULL,line_total_minor bigint NOT NULL,price_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),CHECK(currency~'^[A-Z]{3}$'),CHECK(line_total_minor=unit_amount_minor*quantity)
);
CREATE TABLE commerce.payment_attempts(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid NOT NULL REFERENCES commerce.orders(id) ON DELETE RESTRICT,
  provider text NOT NULL,provider_reference text,status text NOT NULL DEFAULT 'created' CHECK(status IN('created','pending','authorized','captured','failed','cancelled')),
  charged_currency char(3) NOT NULL,charged_amount_minor bigint NOT NULL CHECK(charged_amount_minor>=0),
  settlement_currency char(3),settlement_amount_minor bigint,exchange_rate_snapshot jsonb,
  idempotency_key text NOT NULL UNIQUE,failure_code text,failure_message text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(charged_currency~'^[A-Z]{3}$'),CHECK(settlement_currency IS NULL OR settlement_currency~'^[A-Z]{3}$')
);
CREATE TABLE commerce.receipts(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),receipt_number text NOT NULL UNIQUE,order_id uuid NOT NULL REFERENCES commerce.orders(id) ON DELETE RESTRICT,
  payment_attempt_id uuid NOT NULL REFERENCES commerce.payment_attempts(id) ON DELETE RESTRICT,currency char(3) NOT NULL,amount_minor bigint NOT NULL CHECK(amount_minor>=0),
  snapshot jsonb NOT NULL,issued_at timestamptz NOT NULL DEFAULT now(),CHECK(currency~'^[A-Z]{3}$')
);
CREATE TABLE commerce.refunds(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid NOT NULL REFERENCES commerce.orders(id) ON DELETE RESTRICT,
  payment_attempt_id uuid NOT NULL REFERENCES commerce.payment_attempts(id) ON DELETE RESTRICT,provider_reference text,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','succeeded','failed','cancelled')),currency char(3) NOT NULL,
  amount_minor bigint NOT NULL CHECK(amount_minor>0),reason text NOT NULL,idempotency_key text NOT NULL UNIQUE,created_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz,
  CHECK(currency~'^[A-Z]{3}$')
);
CREATE TABLE commerce.external_fees(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid NOT NULL REFERENCES commerce.orders(id) ON DELETE RESTRICT,
  payee text NOT NULL,description text NOT NULL,currency char(3) NOT NULL,amount_minor bigint NOT NULL CHECK(amount_minor>=0),
  status text NOT NULL DEFAULT 'estimated' CHECK(status IN('estimated','approved','paid','waived','refunded')),evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),CHECK(currency~'^[A-Z]{3}$')
);
CREATE TABLE commerce.fulfilments(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_line_id uuid NOT NULL REFERENCES commerce.order_lines(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','queued','in_progress','blocked','completed','failed','cancelled')),
  related_resource_type text,related_resource_id text,assigned_user_id uuid REFERENCES accounts.users(id) ON DELETE RESTRICT,
  due_at timestamptz,completed_at timestamptz,metadata jsonb NOT NULL DEFAULT '{}'::jsonb,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE commerce.order_events(
  id bigserial PRIMARY KEY,order_id uuid NOT NULL REFERENCES commerce.orders(id) ON DELETE RESTRICT,actor_user_id uuid REFERENCES accounts.users(id) ON DELETE RESTRICT,
  event_type text NOT NULL,request_context jsonb NOT NULL DEFAULT '{}'::jsonb,snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER order_events_no_mutation BEFORE UPDATE OR DELETE ON commerce.order_events FOR EACH ROW EXECUTE FUNCTION accounts.reject_audit_mutation();
INSERT INTO accounts.system_role_permissions(role,permission) VALUES('operator','commerce.manage'),('support','commerce.read');

-- Down Migration
DELETE FROM accounts.system_role_permissions WHERE permission IN('commerce.manage','commerce.read');
DROP TRIGGER order_events_no_mutation ON commerce.order_events;
DROP TABLE commerce.order_events;DROP TABLE commerce.fulfilments;DROP TABLE commerce.external_fees;DROP TABLE commerce.refunds;DROP TABLE commerce.receipts;DROP TABLE commerce.payment_attempts;DROP TABLE commerce.order_lines;DROP TABLE commerce.orders;
