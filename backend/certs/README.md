# Supabase public root CA

`supabase-prod-ca-2021.crt` is a public certificate, not a private key.

Downloaded on 2026-09-12 from:
https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt

The download location was verified against Supabase's dashboard configuration:
https://github.com/supabase/supabase/blob/master/apps/studio/hooks/custom-content/custom-content.json

SHA-256 certificate fingerprint:
`80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`

Expires 2031-04-26. Recheck the provider's published certificate when it rotates.
The backend uses this CA only for recognized Supabase database/pooler hostnames.
Explicit `DB_SSL_CA` or `DB_SSL_CA_FILE` overrides it. Hostname verification stays
enabled. A read-only SELECT 1 against the configured pooler passed with this CA.
