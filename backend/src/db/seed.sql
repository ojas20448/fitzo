-- Fitzo Seed Data
-- Sample data for development and testing

-- ===========================================
-- GYMS
-- ===========================================
INSERT INTO gyms (id, name, qr_code) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Iron Paradise', 'IRONPARADISE01'),
  ('22222222-2222-2222-2222-222222222222', 'FitZone Studio', 'FITZONE01');

-- ===========================================
-- USERS (password: test123)
-- Hash generated with bcrypt for: test123
-- ===========================================
-- Gyms only
INSERT INTO gyms (id, name, qr_code) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Iron Paradise', 'IRONPARADISE01'),
  ('22222222-2222-2222-2222-222222222222', 'FitZone Studio', 'FITZONE01');

SELECT 'Gyms initialized successfully!' as status;


-- Done!
SELECT 'Seed data inserted successfully!' as status;
