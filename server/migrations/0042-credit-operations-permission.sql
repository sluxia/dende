-- Up Migration
INSERT INTO accounts.system_role_permissions(role,permission) VALUES
  ('operator','credits.manage'),('support','credits.manage');

-- Down Migration
DELETE FROM accounts.system_role_permissions WHERE permission='credits.manage';
