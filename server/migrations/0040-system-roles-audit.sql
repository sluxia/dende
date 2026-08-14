-- Up Migration
CREATE TABLE accounts.system_role_permissions(
  role text NOT NULL,
  permission text NOT NULL,
  PRIMARY KEY(role,permission)
);
INSERT INTO accounts.system_role_permissions(role,permission) VALUES
  ('operator','internal.read'),('operator','intelligence.write'),('operator','intelligence.review'),('operator','sources.manage'),
  ('reviewer','internal.read'),('reviewer','intelligence.review'),
  ('source_manager','internal.read'),('source_manager','sources.manage'),
  ('support','internal.read');

CREATE TABLE accounts.system_role_assignments(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES accounts.users(id) ON DELETE RESTRICT,
  role text NOT NULL CHECK(role IN('operator','reviewer','source_manager','support')),
  status text NOT NULL DEFAULT 'active' CHECK(status IN('active','revoked')),
  assigned_by_user_id uuid REFERENCES accounts.users(id) ON DELETE RESTRICT,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CHECK(expires_at IS NULL OR expires_at > starts_at),
  CHECK((status='active' AND revoked_at IS NULL) OR status='revoked')
);
CREATE INDEX system_role_assignments_active_user_idx ON accounts.system_role_assignments(user_id,role,expires_at) WHERE status='active';

CREATE TABLE accounts.privileged_access_events(
  id bigserial PRIMARY KEY,
  actor_user_id uuid REFERENCES accounts.users(id) ON DELETE RESTRICT,
  worker_identity text,
  permission text NOT NULL,
  method text NOT NULL,
  path text NOT NULL,
  outcome text NOT NULL CHECK(outcome IN('allowed','denied')),
  request_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK((actor_user_id IS NOT NULL)::int + (worker_identity IS NOT NULL)::int = 1)
);
CREATE TRIGGER privileged_access_no_mutation BEFORE UPDATE OR DELETE ON accounts.privileged_access_events FOR EACH ROW EXECUTE FUNCTION accounts.reject_audit_mutation();

-- Down Migration
DROP TRIGGER privileged_access_no_mutation ON accounts.privileged_access_events;
DROP TABLE accounts.privileged_access_events;
DROP TABLE accounts.system_role_assignments;
DROP TABLE accounts.system_role_permissions;
