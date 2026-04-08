import { useState, useEffect, useCallback } from "react";

// ─── Supabase ───
const SUPA_URL = "https://tobtmtshxgpkkucsaxyk.supabase.co";
const SUPA_KEY = "sb_publishable_M_yQLmU_5yc0yTccm4F_oA_xWKyTqx9";
const supaFetch = async (path, opts = {}) => {
  const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, "Content-Type": "application/json", Prefer: opts.prefer || "return=representation" },
    method: opts.method || "GET", body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  return res.json();
};

const redeemReward = async (memberId, reward, currentPoints) => {
  const newPoints = currentPoints - reward.points_cost;
  await supaFetch(`members?id=eq.${memberId}`, { method: "PATCH", body: { points: newPoints } });
  await supaFetch(`rewards?id=eq.${reward.id}`, { method: "PATCH", body: { redemptions: (reward.redemptions || 0) + 1 } });
  await supaFetch("transactions", { method: "POST", body: { member_id: memberId, venue: "1-Insider Rewards", amount: 0, points: -reward.points_cost, type: "redeem", reward_name: reward.name } });
  return newPoints;
};

// ─── Brand Tokens ───
const C = { gold: "#C5A258", dark: "#111", bg: "#FAF8F5", text: "#1A1A1A", muted: "#888", lmuted: "#999", white: "#fff" };
const TIER = {
  silver: { hex: "#A8A8A8", bg: "#F7F7F7", txt: "#666", grad: "linear-gradient(135deg,#e8e8e8,#d0d0d0)" },
  gold: { hex: "#C5A258", bg: "#FDF8EE", txt: "#8B6914", grad: "linear-gradient(135deg,#C5A258,#D4B978 50%,#A88B3A)" },
  platinum: { hex: "#5C5C5C", bg: "#2D2D2D", txt: "#fff", grad: "linear-gradient(135deg,#3a3a3a,#1a1a1a 50%,#4a4a4a)" },
  corporate: { hex: "#1A3A5C", bg: "#E8EFF5", txt: "#1A3A5C", grad: "linear-gradient(135deg,#1A3A5C,#2A5A8C)" },
  staff: { hex: "#2E7D32", bg: "#E8F5E9", txt: "#2E7D32", grad: "linear-gradient(135deg,#2E7D32,#4CAF50)" },
};
const CAT = { "Cafés": { icon: "☕", clr: "#7B9E6B" }, Restaurants: { icon: "🍽️", clr: "#B85C38" }, Bars: { icon: "🍸", clr: "#6B4E8B" }, Wines: { icon: "🍷", clr: "#8B2252" } };
const FONT = { h: "'Playfair Display',Georgia,serif", b: "'DM Sans',system-ui,sans-serif", m: "'JetBrains Mono',monospace" };

// ─── Tier Benefits ───
const TIER_INFO = {
  silver: { name: "Silver", fee: "Free", earn: "$1 = 1 pt", bday: "10%", vouchers: "1×$10 welcome", benefits: ["Base earn rate","10% birthday discount","Welcome voucher","Café stamps","Gift cards"] },
  gold: { name: "Paid Gold", fee: "$40/yr", earn: "$1 = 1.5 pts", bday: "15%", vouchers: "10×$20 Non-Stop Hits", benefits: ["Enhanced earn rate","15% birthday discount","10×$20 dining vouchers","Priority reservations","Exclusive events"] },
  platinum: { name: "Paid Platinum", fee: "$80/yr", earn: "$1 = 2 pts", bday: "20%", vouchers: "10×$25 Non-Stop Hits", benefits: ["Premium earn rate","20% birthday discount","10×$25 dining vouchers","VIP reservations","Concierge","Chef's table"] },
  corporate: { name: "Corporate", fee: "Invite", earn: "$1 = 1.5 pts", bday: "15%", vouchers: "10×$20 Non-Stop Hits", benefits: ["Corporate earn rate","15% birthday discount","10×$20 dining vouchers","Bulk gift cards","Dedicated account mgr"] },
  staff: { name: "Staff", fee: "Internal", earn: "$1 = 1 pt", bday: "TBC", vouchers: "Staff vouchers", benefits: ["Staff dining vouchers","Internal events","Staff promos"] },
};

// ─── Stamp Milestones ───
const STAMPS = [
  { s: 1 }, { s: 2 },
  { s: 3, reward: "1-for-1 lunch set", auto: false },
  { s: 4 },
  { s: 5, reward: "Cake of the day", auto: false },
  { s: 6, reward: "1-for-1 pasta", auto: false },
  { s: 7 },
  { s: 8, reward: "20% off dine-in", auto: true },
  { s: 9 },
  { s: 10, reward: "Mixed Berry Croffle", auto: true },
];

// ─── Venues ───
const VENUES = [
  {id:"oumi",name:"Oumi",category:"Restaurants",location:"CapitaSpring Lvl 51"},
  {id:"kaarla",name:"Kaarla",category:"Restaurants",location:"CapitaSpring Lvl 51"},
  {id:"solluna",name:"Sol & Luna",category:"Restaurants",location:"CapitaSpring Lvl 51"},
  {id:"camille",name:"Camille",category:"Restaurants",location:"CapitaSpring Lvl 51"},
  {id:"fire",name:"FIRE",category:"Restaurants",location:"One Fullerton"},
  {id:"monti",name:"Monti",category:"Restaurants",location:"Fullerton Pavilion"},
  {id:"flnt",name:"FLNT",category:"Restaurants",location:"CapitaSpring Lvl 51"},
  {id:"botanico",name:"Botanico",category:"Restaurants",location:"Singapore Botanic Gardens"},
  {id:"mimi",name:"Mimi",category:"Restaurants",location:"Clarke Quay"},
  {id:"una",name:"UNA",category:"Restaurants",location:"Rochester Commons"},
  {id:"yang",name:"Yang",category:"Restaurants",location:"1-Altitude"},
  {id:"zorba",name:"Zorba",category:"Restaurants",location:"The Summerhouse"},
  {id:"coast",name:"1-Altitude Coast",category:"Bars",location:"One Fullerton Rooftop"},
  {id:"arden",name:"1-Arden Bar",category:"Bars",location:"CapitaSpring"},
  {id:"wscafe-fh",name:"Wildseed Café @ 1-Flowerhill",category:"Cafés",location:"1-Flowerhill"},
  {id:"wscafe-sh",name:"Wildseed Café @ The Summerhouse",category:"Cafés",location:"The Summerhouse"},
  {id:"wscafe-am",name:"Wildseed Café @ The Alkaff Mansion",category:"Cafés",location:"The Alkaff Mansion"},
  {id:"wscafe-bg",name:"Wildseed Café @ Botanic Gardens",category:"Cafés",location:"Singapore Botanic Gardens"},
];

// ─── Points Redemption Tiers (base rate) ───
const REDEEM_TIERS = [
  { points: 100, value: 10, label: "100 pts = $10" },
  { points: 150, value: 15, label: "150 pts = $15" },
  { points: 250, value: 25, label: "250 pts = $25" },
];

// ─── Views ───
const VIEW = { LANDING: 0, SIGNIN: 1, HOME: 2, REWARDS: 3, STAMPS: 4, PROFILE: 5 };

// ─── Styles ───
const s = {
  app: { fontFamily: FONT.b, background: C.bg, color: C.text, minHeight: "100vh", maxWidth: 480, margin: "0 auto", position: "relative" },
  header: { background: C.dark, padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 52 },
  logo: { fontFamily: FONT.h, color: C.gold, fontSize: 16, fontWeight: 700, letterSpacing: 1 },
  page: { padding: 20, paddingBottom: 80 },
  btn: { background: C.gold, color: "#fff", border: "none", borderRadius: 8, padding: "12px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FONT.b, width: "100%" },
  btnOutline: { background: "transparent", color: C.gold, border: `1.5px solid ${C.gold}`, borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT.b, width: "100%" },
  btnSm: { background: C.gold, color: "#fff", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT.b },
  input: { border: "1px solid #ddd", borderRadius: 10, padding: "14px 16px", fontSize: 15, fontFamily: FONT.b, width: "100%", boxSizing: "border-box", outline: "none", background: "#fff" },
  card: { background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 1px 8px rgba(0,0,0,.04)", marginBottom: 12 },
  badge: (tier) => ({ display: "inline-block", padding: "3px 10px", borderRadius: 10, fontSize: 11, fontWeight: 600, background: TIER[tier]?.bg || "#eee", color: TIER[tier]?.txt || "#666" }),
  h2: { fontFamily: FONT.h, fontSize: 22, fontWeight: 600, marginBottom: 16, color: C.text },
  h3: { fontFamily: FONT.h, fontSize: 16, fontWeight: 600, marginBottom: 10, color: C.text },
  mono: { fontFamily: FONT.m, fontSize: 12 },
  bottomNav: { position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "#fff", borderTop: "1px solid #eee", display: "flex", justifyContent: "space-around", padding: "8px 0", zIndex: 99 },
  navItem: (active) => ({ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, fontSize: 10, color: active ? C.gold : C.muted, cursor: "pointer", fontWeight: active ? 600 : 400 }),
  modal: { position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 20 },
  modalInner: { background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 400, boxShadow: "0 24px 64px rgba(0,0,0,.2)" },
};

export default function App() {
  const [view, setView] = useState(VIEW.LANDING);
  const [member, setMember] = useState(null);
  const [rewards, setRewards] = useState([]);
  const [transactions, setTxns] = useState([]);

  const loadMemberData = useCallback(async (memberId) => {
    const [m, r, t] = await Promise.all([
      supaFetch(`members?id=eq.${memberId}`),
      supaFetch("rewards?active=eq.true&order=id.asc"),
      supaFetch(`transactions?member_id=eq.${memberId}&order=created_at.desc&limit=20`),
    ]);
    if (Array.isArray(m) && m[0]) setMember(m[0]);
    if (Array.isArray(r)) setRewards(r);
    if (Array.isArray(t)) setTxns(t);
  }, []);

  const signOut = () => { setMember(null); setView(VIEW.LANDING); };

  return (
    <div style={s.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        @keyframes spin { to { transform:rotate(360deg) } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:none } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>

      {/* Header */}
      {view !== VIEW.LANDING && (
        <div style={s.header}>
          <div style={s.logo}>✦ 1-INSIDER</div>
          {member && <div style={{ fontSize: 11, color: "#888" }}>{member.name}</div>}
        </div>
      )}

      {/* Views */}
      {view === VIEW.LANDING && <Landing onSignIn={() => setView(VIEW.SIGNIN)} />}
      {view === VIEW.SIGNIN && <SignIn onSuccess={(m) => { setMember(m); loadMemberData(m.id); setView(VIEW.HOME); }} onBack={() => setView(VIEW.LANDING)} />}
      {view === VIEW.HOME && member && <Home member={member} transactions={transactions} setView={setView} reload={() => loadMemberData(member.id)} />}
      {view === VIEW.REWARDS && member && <RewardsView member={member} rewards={rewards} reload={() => loadMemberData(member.id)} />}
      {view === VIEW.STAMPS && member && <StampsView member={member} />}
      {view === VIEW.PROFILE && member && <Profile member={member} signOut={signOut} />}

      {/* Bottom Nav */}
      {member && view >= VIEW.HOME && (
        <div style={s.bottomNav}>
          {[
            { icon: "🏠", label: "Home", v: VIEW.HOME },
            { icon: "🎁", label: "Rewards", v: VIEW.REWARDS },
            { icon: "☕", label: "Stamps", v: VIEW.STAMPS },
            { icon: "👤", label: "Profile", v: VIEW.PROFILE },
          ].map((n, i) => (
            <div key={i} style={s.navItem(view === n.v)} onClick={() => setView(n.v)}>
              <span style={{ fontSize: 20 }}>{n.icon}</span>
              {n.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// LANDING PAGE
// ═══════════════════════════════════════════════
function Landing({ onSignIn }) {
  const tiers = [
    { id: "silver", name: "Silver", sub: "Free — start earning today", icon: "✧" },
    { id: "gold", name: "Gold", sub: "$40/yr — enhanced rewards", icon: "★" },
    { id: "platinum", name: "Platinum", sub: "$80/yr — premium experience", icon: "♦" },
  ];

  return (
    <div style={{ animation: "fadeIn .4s ease" }}>
      {/* Hero */}
      <div style={{ background: `linear-gradient(135deg, ${C.dark} 0%, #1a180f 100%)`, padding: "48px 24px", textAlign: "center" }}>
        <div style={{ fontFamily: FONT.h, fontSize: 12, color: C.gold, letterSpacing: 3, textTransform: "uppercase", marginBottom: 12 }}>✦ 1-GROUP SINGAPORE</div>
        <h1 style={{ fontFamily: FONT.h, fontSize: 32, color: "#fff", fontWeight: 700, marginBottom: 12, lineHeight: 1.2 }}>1-Insider</h1>
        <p style={{ fontSize: 14, color: "#aaa", maxWidth: 300, margin: "0 auto 24px", lineHeight: 1.5 }}>Your passport to 25 premium dining destinations across Singapore</p>
        <button onClick={onSignIn} style={{ ...s.btn, maxWidth: 260, margin: "0 auto", display: "block" }}>Sign In</button>
        <div style={{ marginTop: 12, fontSize: 12, color: "#666" }}>Not a member? <span style={{ color: C.gold, cursor: "pointer" }}>Join Now</span></div>
      </div>

      {/* Tier Showcase */}
      <div style={{ padding: 20 }}>
        <h2 style={{ ...s.h2, textAlign: "center" }}>Choose Your Tier</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {tiers.map(t => (
            <div key={t.id} style={{ background: TIER[t.id].grad, borderRadius: 16, padding: 20, color: t.id === "platinum" ? "#fff" : C.text }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontFamily: FONT.h, fontSize: 20, fontWeight: 700 }}>{t.icon} {t.name}</div>
                  <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>{t.sub}</div>
                </div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>
                  {TIER_INFO[t.id].earn}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Venue Categories */}
        <h2 style={{ ...s.h2, textAlign: "center", marginTop: 28 }}>Our Venues</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {Object.entries(CAT).map(([name, { icon, clr }]) => {
            const count = VENUES.filter(v => v.category === name).length;
            return (
              <div key={name} style={{ background: "#fff", borderRadius: 12, padding: 16, textAlign: "center", border: `1px solid ${clr}22`, boxShadow: "0 1px 8px rgba(0,0,0,.04)" }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>{icon}</div>
                <div style={{ fontWeight: 600, fontSize: 14, color: clr }}>{name}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{count} venue{count !== 1 ? "s" : ""}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// OTP SIGN-IN
// ═══════════════════════════════════════════════
function SignIn({ onSuccess, onBack }) {
  const [step, setStep] = useState(1);
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const sendOtp = async () => {
    setError("");
    if (!mobile || mobile.length < 4) { setError("Enter a valid mobile number"); return; }
    setStep(2); // Demo mode — skip validation, any number proceeds
  };

  const verifyOtp = async () => {
    setError("");
    if (otp.length < 4) { setError("Enter the 6-digit OTP"); return; }
    setLoading(true);
    try {
      // Try exact match, then +65 prefix, then +65 with space
      let m = await supaFetch(`members?mobile=eq.${encodeURIComponent(mobile)}`);
      if (!Array.isArray(m) || m.length === 0) m = await supaFetch(`members?mobile=eq.${encodeURIComponent("+65" + mobile)}`);
      if (!Array.isArray(m) || m.length === 0) m = await supaFetch(`members?mobile=eq.${encodeURIComponent("+65 " + mobile)}`);
      // Demo fallback — default to Sophia Chen (M0001)
      if (!Array.isArray(m) || m.length === 0) m = await supaFetch("members?id=eq.M0001");
      if (Array.isArray(m) && m[0]) { onSuccess(m[0]); }
      else { setError("Verification failed"); }
    } catch { setError("Connection error"); }
    setLoading(false);
  };

  return (
    <div style={{ padding: 24, paddingTop: 60, animation: "fadeIn .3s ease" }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontFamily: FONT.h, fontSize: 12, color: C.gold, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>✦ 1-INSIDER</div>
        <h2 style={{ fontFamily: FONT.h, fontSize: 24, fontWeight: 700 }}>Welcome Back</h2>
      </div>

      {step === 1 ? (
        <>
          <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 6 }}>Mobile Number</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <div style={{ ...s.input, width: 60, textAlign: "center", flexShrink: 0, color: C.muted }}>+65</div>
            <input style={s.input} placeholder="8123 4567" value={mobile} onChange={e => setMobile(e.target.value.replace(/\D/g, ""))} maxLength={8} />
          </div>
          {error && <div style={{ color: "#D32F2F", fontSize: 12, marginBottom: 12 }}>{error}</div>}
          <button onClick={sendOtp} disabled={loading} style={{ ...s.btn, opacity: loading ? 0.6 : 1 }}>
            {loading ? "Checking…" : "Send OTP"}
          </button>
          <div style={{ textAlign: "center", marginTop: 16, fontSize: 12, color: C.muted }}>Demo mode: any OTP works</div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 13, color: C.muted, textAlign: "center", marginBottom: 16 }}>OTP sent to +65 {mobile}</div>
          <input style={{ ...s.input, textAlign: "center", fontSize: 24, letterSpacing: 8, fontFamily: FONT.m, marginBottom: 16 }} placeholder="000000" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ""))} maxLength={6} />
          {error && <div style={{ color: "#D32F2F", fontSize: 12, marginBottom: 12, textAlign: "center" }}>{error}</div>}
          <button onClick={verifyOtp} disabled={loading} style={{ ...s.btn, opacity: loading ? 0.6 : 1 }}>
            {loading ? "Verifying…" : "Verify & Sign In"}
          </button>
          <div style={{ textAlign: "center", marginTop: 12 }}>
            <span style={{ fontSize: 12, color: C.gold, cursor: "pointer" }} onClick={() => { setStep(1); setOtp(""); setError(""); }}>← Change number</span>
          </div>
        </>
      )}
      <div style={{ textAlign: "center", marginTop: 24 }}>
        <span style={{ fontSize: 12, color: C.muted, cursor: "pointer" }} onClick={onBack}>← Back to home</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// HOME / DASHBOARD
// ═══════════════════════════════════════════════
function Home({ member, transactions, setView, reload }) {
  const tier = TIER[member.tier] || TIER.silver;
  const info = TIER_INFO[member.tier] || TIER_INFO.silver;
  const isDark = member.tier === "platinum" || member.tier === "corporate" || member.tier === "staff";

  return (
    <div style={{ ...s.page, animation: "fadeIn .3s ease" }}>
      {/* Tier Card */}
      <div style={{ background: tier.grad, borderRadius: 16, padding: 24, color: isDark ? "#fff" : C.text, marginBottom: 20, position: "relative" }}>
        <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 2, opacity: 0.7, marginBottom: 4 }}>✦ 1-Insider {info.name}</div>
        <div style={{ fontFamily: FONT.h, fontSize: 24, fontWeight: 700, marginBottom: 16 }}>{member.name}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {[
            { l: "Points", v: (member.points || 0).toLocaleString() },
            { l: "Visits", v: member.visits || 0 },
            { l: "Stamps", v: `${member.stamps || 0}/10` },
          ].map((k, i) => (
            <div key={i} style={{ background: "rgba(255,255,255,.15)", borderRadius: 10, padding: 10, textAlign: "center" }}>
              <div style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: 1, opacity: 0.7 }}>{k.l}</div>
              <div style={{ fontFamily: FONT.h, fontSize: 20, fontWeight: 700, marginTop: 2 }}>{k.v}</div>
            </div>
          ))}
        </div>
        <div style={{ ...s.mono, fontSize: 10, opacity: 0.5, marginTop: 12 }}>{member.id} · {info.earn}</div>
      </div>

      {/* Quick Actions */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
        {[
          { icon: "🎁", label: "Rewards", v: VIEW.REWARDS },
          { icon: "☕", label: "Stamps", v: VIEW.STAMPS },
          { icon: "👤", label: "Profile", v: VIEW.PROFILE },
        ].map((a, i) => (
          <div key={i} onClick={() => setView(a.v)} style={{ background: "#fff", borderRadius: 12, padding: 14, textAlign: "center", cursor: "pointer", boxShadow: "0 1px 8px rgba(0,0,0,.04)" }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>{a.icon}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.text }}>{a.label}</div>
          </div>
        ))}
      </div>

      {/* Benefits */}
      <h3 style={s.h3}>Your Benefits</h3>
      <div style={s.card}>
        {info.benefits.map((b, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", fontSize: 12.5, borderBottom: i < info.benefits.length - 1 ? "1px solid #f5f5f5" : "none" }}>
            <span style={{ color: C.gold }}>✦</span> {b}
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <h3 style={s.h3}>Recent Activity</h3>
      {transactions.length > 0 ? transactions.slice(0, 5).map((t, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f5f5f5", fontSize: 12 }}>
          <div>
            <div style={{ fontWeight: 500 }}>{t.type === "redeem" ? t.reward_name : t.venue}</div>
            <div style={{ color: C.muted, fontSize: 11 }}>{new Date(t.created_at).toLocaleDateString()}</div>
          </div>
          <div style={{ fontWeight: 600, color: t.points > 0 ? "#4CAF50" : "#D32F2F" }}>
            {t.points > 0 ? "+" : ""}{t.points} pts
          </div>
        </div>
      )) : <div style={{ color: C.muted, fontSize: 12 }}>No activity yet — visit any 1-Group venue to start earning!</div>}

      <button onClick={reload} style={{ ...s.btnOutline, marginTop: 16, fontSize: 12 }}>↻ Refresh Data</button>
    </div>
  );
}

// ═══════════════════════════════════════════════
// REWARDS
// ═══════════════════════════════════════════════
function RewardsView({ member, rewards, reload }) {
  const [catFilter, setCatFilter] = useState("all");
  const [redeeming, setRedeeming] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState(null);

  const cats = ["all", "cafes", "restaurants", "bars", "wines"];
  const catLabels = { all: "All", cafes: "☕ Cafés", restaurants: "🍽️ Restaurants", bars: "🍸 Bars", wines: "🍷 Wines" };
  const filtered = rewards.filter(r => catFilter === "all" || r.category === catFilter);

  const handleRedeem = async () => {
    if (!redeeming) return;
    setConfirming(true);
    try {
      const newPts = await redeemReward(member.id, redeeming, member.points);
      setResult({ success: true, pts: newPts, reward: redeeming.name });
      reload();
    } catch { setResult({ success: false }); }
    setConfirming(false);
  };

  return (
    <div style={{ ...s.page, animation: "fadeIn .3s ease" }}>
      <h2 style={s.h2}>Rewards</h2>
      <div style={{ fontSize: 13, marginBottom: 16 }}>
        <span style={{ fontWeight: 600 }}>{(member.points || 0).toLocaleString()}</span> <span style={{ color: C.muted }}>points available</span>
      </div>

      {/* Points Redemption */}
      <div style={{ ...s.card, background: `linear-gradient(135deg,${C.dark},#1a180f)`, color: "#fff", marginBottom: 20 }}>
        <div style={{ fontSize: 10, color: C.gold, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 600, marginBottom: 8 }}>✦ Redeem Points for Vouchers</div>
        <div style={{ display: "flex", gap: 8 }}>
          {REDEEM_TIERS.map((r, i) => (
            <div key={i} style={{ flex: 1, background: "rgba(255,255,255,.1)", borderRadius: 10, padding: 10, textAlign: "center", opacity: (member.points || 0) >= r.points ? 1 : 0.4 }}>
              <div style={{ fontFamily: FONT.h, fontSize: 16, fontWeight: 700 }}>${r.value}</div>
              <div style={{ fontSize: 10, color: "#aaa" }}>{r.points} pts</div>
            </div>
          ))}
        </div>
      </div>

      {/* Category Filter */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto" }}>
        {cats.map(c => (
          <div key={c} onClick={() => setCatFilter(c)} style={{
            padding: "6px 14px", borderRadius: 20, fontSize: 11.5, fontWeight: catFilter === c ? 600 : 400,
            background: catFilter === c ? C.gold : "#fff", color: catFilter === c ? "#fff" : C.muted,
            cursor: "pointer", whiteSpace: "nowrap", border: "1px solid #eee",
          }}>{catLabels[c]}</div>
        ))}
      </div>

      {/* Reward Cards */}
      {filtered.length > 0 ? filtered.map(r => {
        const canAfford = (member.points || 0) >= r.points_cost;
        return (
          <div key={r.id} style={{ ...s.card, display: "flex", justifyContent: "space-between", alignItems: "center", opacity: canAfford ? 1 : 0.5 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{r.name}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{r.description}</div>
              <div style={{ fontSize: 11, color: C.gold, fontWeight: 600, marginTop: 4 }}>{r.points_cost} pts</div>
            </div>
            <button disabled={!canAfford} onClick={() => setRedeeming(r)} style={{ ...s.btnSm, opacity: canAfford ? 1 : 0.4 }}>Redeem</button>
          </div>
        );
      }) : <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: 20 }}>No rewards in this category</div>}

      {/* Redemption Modal */}
      {redeeming && !result && (
        <div style={s.modal} onClick={() => { setRedeeming(null); setConfirming(false); }}>
          <div style={s.modalInner} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: FONT.h, fontSize: 18, marginBottom: 12 }}>Confirm Redemption</h3>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{redeeming.name}</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>{redeeming.description}</div>
            <div style={{ background: C.bg, borderRadius: 10, padding: 14, marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
              <div><div style={{ fontSize: 10, color: C.lmuted, textTransform: "uppercase" }}>Cost</div><div style={{ fontWeight: 600 }}>{redeeming.points_cost} pts</div></div>
              <div style={{ textAlign: "right" }}><div style={{ fontSize: 10, color: C.lmuted, textTransform: "uppercase" }}>Balance After</div><div style={{ fontWeight: 600 }}>{(member.points - redeeming.points_cost).toLocaleString()} pts</div></div>
            </div>
            <button onClick={handleRedeem} disabled={confirming} style={{ ...s.btn, opacity: confirming ? 0.6 : 1, marginBottom: 8 }}>
              {confirming ? "Redeeming…" : "Confirm"}
            </button>
            <button onClick={() => setRedeeming(null)} style={s.btnOutline}>Cancel</button>
          </div>
        </div>
      )}

      {/* Result Modal */}
      {result && (
        <div style={s.modal} onClick={() => { setResult(null); setRedeeming(null); }}>
          <div style={{ ...s.modalInner, textAlign: "center" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>{result.success ? "🎉" : "❌"}</div>
            <h3 style={{ fontFamily: FONT.h, fontSize: 20, marginBottom: 8 }}>{result.success ? "Redeemed!" : "Error"}</h3>
            {result.success ? (
              <>
                <div style={{ fontSize: 13, color: C.muted, marginBottom: 4 }}>{result.reward}</div>
                <div style={{ fontSize: 13 }}>New balance: <strong>{result.pts?.toLocaleString()} pts</strong></div>
              </>
            ) : <div style={{ fontSize: 13, color: "#D32F2F" }}>Something went wrong. Please try again.</div>}
            <button onClick={() => { setResult(null); setRedeeming(null); }} style={{ ...s.btn, marginTop: 16 }}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// STAMPS
// ═══════════════════════════════════════════════
function StampsView({ member }) {
  const stampCount = member.stamps || 0;

  return (
    <div style={{ ...s.page, animation: "fadeIn .3s ease" }}>
      <h2 style={s.h2}>Café Stamps</h2>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>Earn 1 stamp per $10 spent at Wildseed Café outlets</div>

      {/* Stamp Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 24 }}>
        {STAMPS.map((st, i) => {
          const filled = i < stampCount;
          const hasReward = !!st.reward;
          return (
            <div key={i} style={{
              aspectRatio: "1", borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              background: filled ? (hasReward ? C.gold : "#333") : (hasReward ? "#FFF8E1" : "#f5f5f5"),
              border: hasReward ? `2px solid ${st.auto ? "#4CAF50" : "#FFB300"}` : "2px solid transparent",
              color: filled ? "#fff" : C.text, position: "relative",
            }}>
              <div style={{ fontFamily: FONT.h, fontSize: 18, fontWeight: 700 }}>{st.s}</div>
              {filled && <div style={{ fontSize: 10, marginTop: 2 }}>✓</div>}
              {hasReward && !filled && (
                <div style={{ fontSize: 6, textAlign: "center", padding: "0 2px", color: st.auto ? "#2E7D32" : "#F57F17", fontWeight: 700, marginTop: 1 }}>
                  {st.auto ? "AUTO" : "CLAIM"}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Progress */}
      <div style={{ ...s.card, textAlign: "center" }}>
        <div style={{ fontFamily: FONT.h, fontSize: 28, fontWeight: 700, color: C.gold }}>{stampCount}/10</div>
        <div style={{ fontSize: 12, color: C.muted }}>stamps collected</div>
        <div style={{ height: 6, background: "#f0f0f0", borderRadius: 3, marginTop: 12, overflow: "hidden" }}>
          <div style={{ height: 6, background: C.gold, borderRadius: 3, width: `${(stampCount / 10) * 100}%`, transition: "width .3s" }} />
        </div>
      </div>

      {/* Milestones */}
      <h3 style={{ ...s.h3, marginTop: 20 }}>Milestone Rewards</h3>
      {STAMPS.filter(st => st.reward).map((st, i) => (
        <div key={i} style={{ ...s.card, display: "flex", alignItems: "center", gap: 12, opacity: stampCount >= st.s ? 1 : 0.5 }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14,
            background: stampCount >= st.s ? C.gold : "#eee", color: stampCount >= st.s ? "#fff" : C.muted,
          }}>{st.s}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{st.reward}</div>
            <div style={{ fontSize: 10, color: st.auto ? "#4CAF50" : "#FF9800", fontWeight: 600 }}>{st.auto ? "Auto-issued" : "Claim from Discover tab"}</div>
          </div>
          {stampCount >= st.s && <span style={{ color: "#4CAF50", fontSize: 16 }}>✓</span>}
        </div>
      ))}

      {/* Café Outlets */}
      <h3 style={{ ...s.h3, marginTop: 20 }}>Participating Outlets</h3>
      {VENUES.filter(v => v.stamps).map((v, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #f5f5f5", fontSize: 12.5 }}>
          <span>☕</span>
          <div>
            <div style={{ fontWeight: 500 }}>{v.name}</div>
            <div style={{ fontSize: 11, color: C.muted }}>{v.location}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════
// PROFILE
// ═══════════════════════════════════════════════
function Profile({ member, signOut }) {
  const tier = TIER[member.tier] || TIER.silver;
  const info = TIER_INFO[member.tier] || TIER_INFO.silver;
  const isDark = member.tier === "platinum" || member.tier === "corporate";

  return (
    <div style={{ ...s.page, animation: "fadeIn .3s ease" }}>
      {/* Profile Card */}
      <div style={{ background: tier.grad, borderRadius: 16, padding: 24, textAlign: "center", color: isDark ? "#fff" : C.text, marginBottom: 20 }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(255,255,255,.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", fontFamily: FONT.h, fontSize: 28, fontWeight: 700 }}>
          {(member.name || "?")[0]}
        </div>
        <div style={{ fontFamily: FONT.h, fontSize: 20, fontWeight: 700 }}>{member.name}</div>
        <div style={{ opacity: 0.8, fontSize: 12, marginTop: 4 }}>{info.name} Member</div>
        <div style={{ ...s.mono, fontSize: 10, opacity: 0.5, marginTop: 8 }}>{member.id}</div>
      </div>

      {/* Details */}
      <h3 style={s.h3}>Account Details</h3>
      <div style={s.card}>
        {[
          { l: "Mobile", v: member.mobile || "—" },
          { l: "Email", v: member.email || "—" },
          { l: "Category Preference", v: member.category_pref || "Not set" },
          { l: "Birthday Month", v: member.birthday_month ? `Month ${member.birthday_month}` : "—" },
          { l: "Member Since", v: member.signup_date ? new Date(member.signup_date).toLocaleDateString() : "—" },
          { l: "Last Visit", v: member.last_visit ? new Date(member.last_visit).toLocaleDateString() : "—" },
        ].map((d, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: i < 5 ? "1px solid #f5f5f5" : "none", fontSize: 12.5 }}>
            <span style={{ color: C.muted }}>{d.l}</span>
            <span style={{ fontWeight: 500 }}>{d.v}</span>
          </div>
        ))}
      </div>

      {/* Tier Status */}
      <h3 style={s.h3}>Tier Status</h3>
      <div style={s.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{info.name}</div>
            <div style={{ fontSize: 12, color: C.muted }}>{info.fee} · {info.earn}</div>
          </div>
          <div style={{ display: "inline-block", padding: "4px 12px", borderRadius: 10, background: tier.bg, color: tier.txt, fontWeight: 600, fontSize: 11 }}>{member.tier}</div>
        </div>
        {member.membership_expiry && (
          <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>Expires: {new Date(member.membership_expiry).toLocaleDateString()}</div>
        )}
        {member.tier === "silver" && (
          <div style={{ marginTop: 12, background: "#FDF8EE", borderRadius: 10, padding: 12, textAlign: "center" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#8B6914" }}>Upgrade to Gold for $40/year</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>1.5× earn rate, 10×$20 dining vouchers, priority reservations</div>
          </div>
        )}
      </div>

      <button onClick={signOut} style={{ ...s.btnOutline, marginTop: 16, color: "#D32F2F", borderColor: "#D32F2F" }}>Sign Out</button>
    </div>
  );
}
