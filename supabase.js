(function () {
  const SUPABASE_URL = "";
  const SUPABASE_ANON_KEY = "";

  const enabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

  function isEnabled() {
    return enabled;
  }

  async function request(path, options = {}) {
    if (!enabled) return null;
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      ...options,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
        ...(options.headers || {}),
      },
    });
    if (!response.ok) {
      const message = await response.text().catch(() => "");
      throw new Error(message || `Supabase request failed: ${response.status}`);
    }
    if (response.status === 204) return null;
    return response.json().catch(() => null);
  }

  function normalizeWallet(wallet) {
    return String(wallet || "").toLowerCase();
  }

  async function upsertProfile(wallet, metadata = {}) {
    const walletAddress = normalizeWallet(wallet);
    if (!walletAddress) return null;
    return request("profiles", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        wallet_address: walletAddress,
        display_name: metadata.displayName || null,
        avatar_url: metadata.avatarUrl || null,
        last_seen_at: new Date().toISOString(),
      }),
    });
  }

  async function recordActivity(type, payload = {}) {
    const walletAddress = normalizeWallet(payload.wallet);
    return request("activity_events", {
      method: "POST",
      body: JSON.stringify({
        wallet_address: walletAddress || null,
        event_type: type,
        page: location.pathname,
        metadata: payload,
        created_at: new Date().toISOString(),
      }),
    });
  }

  async function savePortfolioCache(wallet, positions = []) {
    const walletAddress = normalizeWallet(wallet);
    if (!walletAddress) return null;
    return request("portfolio_cache", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        wallet_address: walletAddress,
        positions,
        updated_at: new Date().toISOString(),
      }),
    });
  }

  async function loadPortfolioCache(wallet) {
    const walletAddress = normalizeWallet(wallet);
    if (!enabled || !walletAddress) return null;
    const data = await request(`portfolio_cache?wallet_address=eq.${walletAddress}&select=positions,updated_at&limit=1`, {
      method: "GET",
      headers: { Prefer: "return=representation" },
    });
    return Array.isArray(data) ? data[0] || null : null;
  }

  async function setWatchlist(wallet, marketId, watched) {
    const walletAddress = normalizeWallet(wallet);
    if (!walletAddress || !marketId) return null;
    if (!watched) {
      return request(`watchlists?wallet_address=eq.${walletAddress}&market_id=eq.${Number(marketId)}`, {
        method: "DELETE",
      });
    }
    return request("watchlists", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        wallet_address: walletAddress,
        market_id: Number(marketId),
        created_at: new Date().toISOString(),
      }),
    });
  }

  window.PredictArcSupabase = {
    isEnabled,
    upsertProfile,
    recordActivity,
    savePortfolioCache,
    loadPortfolioCache,
    setWatchlist,
  };
})();
