-- Up Migration
CREATE SCHEMA commerce;
CREATE TABLE commerce.markets(
  market_key text PRIMARY KEY,country_code char(2) NOT NULL UNIQUE,
  default_locale text NOT NULL, supported_locales text[] NOT NULL,
  default_currency char(3) NOT NULL,status text NOT NULL DEFAULT 'planned' CHECK(status IN('planned','active','paused')),
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(default_locale=ANY(supported_locales)),CHECK(default_currency~'^[A-Z]{3}$')
);
CREATE TABLE commerce.products(
  product_key text PRIMARY KEY,category text NOT NULL CHECK(category IN('screening','report','verification','monitoring','professional')),
  fulfilment_type text NOT NULL CHECK(fulfilment_type IN('automated','human_assisted','recurring')),
  name_key text NOT NULL,description_key text NOT NULL,status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','active','retired')),
  credit_cost integer CHECK(credit_cost IS NULL OR credit_cost>0),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE commerce.market_products(
  market_key text NOT NULL REFERENCES commerce.markets(market_key) ON DELETE RESTRICT,
  product_key text NOT NULL REFERENCES commerce.products(product_key) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','active','paused')),
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,PRIMARY KEY(market_key,product_key)
);
CREATE TABLE commerce.prices(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),product_key text NOT NULL REFERENCES commerce.products(product_key) ON DELETE RESTRICT,
  market_key text NOT NULL REFERENCES commerce.markets(market_key) ON DELETE RESTRICT,currency char(3) NOT NULL,
  amount_minor bigint NOT NULL CHECK(amount_minor>=0),tax_behavior text NOT NULL CHECK(tax_behavior IN('inclusive','exclusive','not_applicable')),
  sales_channel text NOT NULL CHECK(sales_channel IN('web','assisted','api','contract')),
  status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','active','retired')),valid_from timestamptz NOT NULL,valid_to timestamptz,
  approved_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),CHECK(currency~'^[A-Z]{3}$'),CHECK(valid_to IS NULL OR valid_to>valid_from),
  CHECK(status<>'active' OR approved_at IS NOT NULL)
);
CREATE UNIQUE INDEX commerce_one_active_price ON commerce.prices(product_key,market_key,currency,sales_channel) WHERE status='active' AND valid_to IS NULL;
CREATE TABLE commerce.translation_messages(
  locale text NOT NULL,message_key text NOT NULL,version integer NOT NULL CHECK(version>0),message text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','active','retired')),created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(locale,message_key,version)
);
CREATE UNIQUE INDEX commerce_active_translation ON commerce.translation_messages(locale,message_key) WHERE status='active';

INSERT INTO commerce.markets(market_key,country_code,default_locale,supported_locales,default_currency,status,configuration)
VALUES('NG','NG','en-NG',ARRAY['en-NG'],'NGN','active','{"defaultCrs":"EPSG:4326","paymentEnabled":false}'::jsonb);
INSERT INTO commerce.products(product_key,category,fulfilment_type,name_key,description_key,status,credit_cost) VALUES
('manual-preliminary-check','screening','automated','product.manual_check.name','product.manual_check.description','active',1),
('survey-plan-scan-check','screening','automated','product.scan_check.name','product.scan_check.description','active',2),
('detailed-evidence-report','report','automated','product.evidence_report.name','product.evidence_report.description','draft',NULL),
('identity-document-verification','verification','human_assisted','product.identity_verification.name','product.identity_verification.description','draft',NULL),
('plot-monitoring','monitoring','recurring','product.monitoring.name','product.monitoring.description','draft',NULL),
('professional-due-diligence','professional','human_assisted','product.professional_due_diligence.name','product.professional_due_diligence.description','draft',NULL);
INSERT INTO commerce.market_products(market_key,product_key,status) SELECT 'NG',product_key,CASE WHEN status='active' THEN 'active' ELSE 'draft' END FROM commerce.products;
INSERT INTO commerce.translation_messages(locale,message_key,version,message,status) VALUES
('en-NG','product.manual_check.name',1,'Manual preliminary check','active'),
('en-NG','product.manual_check.description',1,'Automated screening using manually entered boundary coordinates.','active'),
('en-NG','product.scan_check.name',1,'Survey-plan scan and check','active'),
('en-NG','product.scan_check.description',1,'Survey-plan extraction followed by automated spatial screening.','active');

-- Down Migration
DROP SCHEMA commerce CASCADE;
