-- Up Migration
ALTER TABLE registry.plots ADD COLUMN owner_user_id uuid REFERENCES accounts.users(id) ON DELETE RESTRICT;
ALTER TABLE registry.plots ADD COLUMN created_by_user_id uuid REFERENCES accounts.users(id) ON DELETE RESTRICT;
ALTER TABLE registry.ownership_notices ADD COLUMN owner_user_id uuid REFERENCES accounts.users(id) ON DELETE RESTRICT;
ALTER TABLE registry.evidence_reports ADD COLUMN owner_user_id uuid REFERENCES accounts.users(id) ON DELETE RESTRICT;
CREATE INDEX plots_owner_idx ON registry.plots(owner_user_id,created_at DESC) WHERE owner_user_id IS NOT NULL;
CREATE INDEX notices_owner_idx ON registry.ownership_notices(owner_user_id,submitted_at DESC) WHERE owner_user_id IS NOT NULL;
CREATE INDEX reports_owner_idx ON registry.evidence_reports(owner_user_id,generated_at DESC) WHERE owner_user_id IS NOT NULL;
ALTER TABLE registry.evidence_reports DISABLE TRIGGER evidence_reports_no_update;
UPDATE registry.evidence_reports r SET owner_user_id=p.owner_user_id FROM registry.plots p WHERE p.id=r.plot_id AND r.owner_user_id IS NULL;
ALTER TABLE registry.evidence_reports ENABLE TRIGGER evidence_reports_no_update;
-- Down Migration
DROP INDEX registry.reports_owner_idx;DROP INDEX registry.notices_owner_idx;DROP INDEX registry.plots_owner_idx;ALTER TABLE registry.evidence_reports DROP COLUMN owner_user_id;ALTER TABLE registry.ownership_notices DROP COLUMN owner_user_id;ALTER TABLE registry.plots DROP COLUMN created_by_user_id,DROP COLUMN owner_user_id;
