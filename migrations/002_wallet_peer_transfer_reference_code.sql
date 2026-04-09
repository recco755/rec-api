-- Run if you already applied early 001 (no reference_code).
-- New installs: use updated 001 (column + unique key included).

ALTER TABLE wallet_peer_transfer
  ADD COLUMN reference_code VARCHAR(32) NULL DEFAULT NULL AFTER note,
  ADD UNIQUE KEY uq_wallet_peer_transfer_ref (reference_code);
