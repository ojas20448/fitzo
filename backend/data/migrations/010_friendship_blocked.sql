-- Blocking has never worked in production.
--
-- POST /api/friends/:id/block deletes both friendship rows and then inserts
-- status='blocked', but friendship_status only had ('pending','accepted',
-- 'rejected'). The INSERT threw 22P02 while the DELETE had already committed —
-- the two statements were separate pool.query calls with no transaction — so
-- pressing Block silently UN-FRIENDED the pair, returned a 500, and left the
-- blocked user free to send a fresh request.
--
-- Adding the value the code has always assumed exists. ALTER TYPE ... ADD VALUE
-- is run on its own here rather than inside a transaction: on PostgreSQL the
-- new label cannot be USED by statements in the same transaction that adds it,
-- so bundling it with anything that references 'blocked' would fail.

ALTER TYPE friendship_status ADD VALUE IF NOT EXISTS 'blocked';
