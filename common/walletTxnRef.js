/**
 * Display reference for wallet_peer_transfer rows (e.g. Recco0000001087).
 * Numeric part is zero-padded to at least 10 digits; longer ids stay full length.
 */
function formatWalletPeerTransferRef(insertId) {
  if (insertId == null || insertId === "") {
    return null;
  }
  const s = String(insertId);
  const width = Math.max(10, s.length);
  return "Recco" + s.padStart(width, "0");
}

module.exports = {formatWalletPeerTransferRef};
