-- Up Migration
CREATE TABLE commerce.locales(
  locale text PRIMARY KEY,english_name text NOT NULL,text_direction text NOT NULL CHECK(text_direction IN('ltr','rtl')),
  plural_rule text NOT NULL,status text NOT NULL DEFAULT 'planned' CHECK(status IN('planned','active','retired')),
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO commerce.locales(locale,english_name,text_direction,plural_rule,status) VALUES('en-NG','English (Nigeria)','ltr','one-other','active');
ALTER TABLE accounts.organizations ADD COLUMN preferred_locale text REFERENCES commerce.locales(locale) ON DELETE RESTRICT,
  ADD COLUMN preferred_currency char(3),ADD CONSTRAINT organization_currency_code CHECK(preferred_currency IS NULL OR preferred_currency~'^[A-Z]{3}$');
ALTER TABLE commerce.translation_messages ADD COLUMN message_format text NOT NULL DEFAULT 'plain' CHECK(message_format IN('plain','icu'));
INSERT INTO commerce.translation_messages(locale,message_key,version,message,status) VALUES
('en-NG','auth.signup.heading',1,'Create your account','active'),
('en-NG','auth.signup.lead',1,'Create an account and verify your email to receive three introductory check credits.','active'),
('en-NG','auth.signup.submit',1,'Create account','active'),
('en-NG','auth.login.heading',1,'Welcome back','active'),
('en-NG','auth.login.lead',1,'Sign in to your Dende account.','active'),
('en-NG','auth.login.submit',1,'Sign in','active');

-- Down Migration
DELETE FROM commerce.translation_messages WHERE message_key LIKE 'auth.%';
ALTER TABLE commerce.translation_messages DROP COLUMN message_format;
ALTER TABLE accounts.organizations DROP CONSTRAINT organization_currency_code,DROP COLUMN preferred_currency,DROP COLUMN preferred_locale;
DROP TABLE commerce.locales;
