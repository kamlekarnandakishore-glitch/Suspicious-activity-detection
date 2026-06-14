-- Run in Supabase SQL Editor (Dashboard → SQL)

-- Security personnel who receive alerts
CREATE TABLE IF NOT EXISTS security_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT DEFAULT 'security',
  notify_email BOOLEAN DEFAULT TRUE,
  notify_sms BOOLEAN DEFAULT FALSE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Log of every notification attempt
CREATE TABLE IF NOT EXISTS alert_dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id BIGINT,
  contact_id UUID REFERENCES security_contacts(id) ON DELETE SET NULL,
  contact_name TEXT,
  channel TEXT NOT NULL,
  status TEXT NOT NULL,
  detail TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- Allow anon key from your app (adjust RLS for production)
ALTER TABLE security_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_dispatches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for security_contacts" ON security_contacts
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for alert_dispatches" ON alert_dispatches
  FOR ALL USING (true) WITH CHECK (true);

-- Example contact
INSERT INTO security_contacts (name, email, role, notify_email)
VALUES ('Security Lead', 'security@yourcompany.com', 'lead', true)
ON CONFLICT DO NOTHING;
