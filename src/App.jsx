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

const C = { gold: "#C5A258", dark: "#111", bg: "#FAF8F5", text: "#1A1A1A", muted: "#888", lmuted: "#999" };
const TIER = {
  silver: { hex: "#A8A8A8", bg: "#F7F7F7", txt: "#666", grad: "linear-gradient(135deg,#e8e8e8,#d0d0d0)" },
  gold: { hex: "#C5A258", bg: "#FDF8EE", txt: "#8B6914", grad: "linear-gradient(135deg,#C5A258,#D4B978 50%,#A88B3A)" },
  platinum: { hex: "#5C5C5C", bg: "#2D2D2D", txt: "#fff", grad: "linear-gradient(135deg,#3a3a3a,#1a1a1a 50%,#4a4a4a)" },
  corporate: { hex: "#1A3A5C", bg: "#E8EFF5", txt: "#1A3A5C", grad: "linear-gradient(135deg,#1A3A5C,#2A5A8C)" },
  staff: { hex: "#2E7D32", bg: "#E8F5E9", txt: "#2E7D32", grad: "linear-gradient(135deg,#2E7D32,#4CAF50)" },
};
const CAT = { "Cafés": { icon: "☕", clr: "#7B9E6B" }, Restaurants: { icon: "🍽️", clr: "#B85C38" }, Bars: { icon: "🍸", clr: "#6B4E8B" }, Wines: { icon: "🍷", clr: "#8B2252" } };
const FONT = { h: "'Playfair Display',Georgia,serif", b: "'DM Sans',system-ui,sans-serif", m: "'JetBrains Mono',monospace" };

const TIER_INFO = {
  silver: { name: "Silver", fee: "Free", earn: "$1 = 1 pt", bday: "10%", nonStop: false, vCount: 1, vValue: 10, benefits: ["Base earn rate ($1 = 1 point)","10% birthday discount on total bill","1×$10 welcome voucher","Café stamp card","Gift card access"] },
  gold: { name: "Paid Gold", fee: "$40/yr", earn: "$1 = 1.5 pts", bday: "15%", nonStop: true, vCount: 10, vValue: 20, benefits: ["Enhanced earn rate ($1 = 1.5 points)","15% birthday discount on total bill","10×$20 dining vouchers (Non-Stop Hits)","Priority reservations","Exclusive event access","Café stamp card"] },
  platinum: { name: "Paid Platinum", fee: "$80/yr", earn: "$1 = 2 pts", bday: "20%", nonStop: true, vCount: 10, vValue: 25, benefits: ["Premium earn rate ($1 = 2 points)","20% birthday discount on total bill","10×$25 dining vouchers (Non-Stop Hits)","VIP reservations","Concierge service","Chef's table access","Café stamp card"] },
  corporate: { name: "Corporate", fee: "Invite", earn: "$1 = 1.5 pts", bday: "15%", nonStop: true, vCount: 10, vValue: 20, benefits: ["Corporate earn rate ($1 = 1.5 points)","15% birthday discount","10×$20 dining vouchers (Non-Stop Hits)","Bulk gift cards","Event coordination","Dedicated account manager"] },
  staff: { name: "Staff", fee: "Internal", earn: "$1 = 1 pt", bday: "TBC", nonStop: false, vCount: 0, vValue: 0, benefits: ["Staff dining vouchers","Internal events","Staff-only promotions"] },
};

const STAMPS = [
  { s: 1 }, { s: 2 },
  { s: 3, reward: "1-for-1 main lunch set", auto: false, note: "Valid next visit only; no stamp earnings on that visit" },
  { s: 4 },
  { s: 5, reward: "Complimentary cake of the day", auto: false },
  { s: 6, reward: "1-for-1 pasta", auto: false },
  { s: 7 },
  { s: 8, reward: "20% off dine-in", auto: true, note: "Valid next visit only" },
  { s: 9 },
  { s: 10, reward: "Mixed Berry Croffle", auto: true, note: "Card completes — cycle restarts" },
];

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
  {id:"wscafe-fh",name:"Wildseed Café @ 1-Flowerhill",category:"Cafés",location:"1-Flowerhill",stamps:true},
  {id:"wscafe-sh",name:"Wildseed Café @ The Summerhouse",category:"Cafés",location:"The Summerhouse",stamps:true},
  {id:"wscafe-am",name:"Wildseed Café @ The Alkaff Mansion",category:"Cafés",location:"The Alkaff Mansion",stamps:true},
  {id:"wscafe-bg",name:"Wildseed Café @ Botanic Gardens",category:"Cafés",location:"Singapore Botanic Gardens",stamps:true},
];

const REDEEM_TIERS = [
  { points: 100, value: 10 },
  { points: 150, value: 15 },
  { points: 250, value: 25 },
];

const VIEW = { LANDING: 0, SIGNIN: 1, HOME: 2, REWARDS: 3, STAMPS: 4, PROFILE: 5 };

const s = {
  app: { fontFamily: FONT.b, background: C.bg, color: C.text, minHeight: "100vh", maxWidth: 480, margin: "0 auto", position: "relative" },
  header: { background: C.dark, padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 52 },
  logo: { fontFamily: FONT.h, color: C.gold, fontSize: 16, fontWeight: 700, letterSpacing: 1 },
  page: { padding: 20, paddingBottom: 80 },
  btn: { background: C.gold, color: "#fff", border: "none", borderRadius: 8, padding: "12px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FONT.b, width: "100%" },
  btnOutline: { background: "transparent", color: C.gold, border: "1.5px solid " + C.gold, borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT.b, width: "100%" },
  btnSm: { background: C.gold, color: "#fff", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT.b },
  input: { border: "1px solid #ddd", borderRadius: 10, padding: "14px 16px", fontSize: 15, fontFamily: FONT.b, width: "100%", boxSizing: "border-box", outline: "none", background: "#fff" },
  card: { background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 1px 8px rgba(0,0,0,.04)", marginBottom: 12 },
  h2: { fontFamily: FONT.h, fontSize: 22, fontWeight: 600, marginBottom: 16, color: C.text },
  h3: { fontFamily: FONT.h, fontSize: 16, fontWeight: 600, marginBottom: 10, color: C.text },
  mono: { fontFamily: FONT.m, fontSize: 12 },
  bottomNav: { position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "#fff", borderTop: "1px solid #eee", display: "flex", justifyContent: "space-around", padding: "8px 0", zIndex: 99 },
  navItem: (a) => ({ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, fontSize: 10, color: a ? C.gold : C.muted, cursor: "pointer", fontWeight: a ? 600 : 400 }),
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
      supaFetch("members?id=eq." + memberId),
      supaFetch("rewards?active=eq.true&order=id.asc"),
      supaFetch("transactions?member_id=eq." + memberId + "&order=created_at.desc&limit=20"),
    ]);
    if (Array.isArray(m) && m[0]) setMember(m[0]);
    if (Array.isArray(r)) setRewards(r);
    if (Array.isArray(t)) setTxns(t);
  }, []);

  const signOut = () => { setMember(null); setView(VIEW.LANDING); };

  // Demo reset: Ctrl+Shift+R resets Sophia to test defaults before page reloads
  const DEMO_DEFAULTS = { points: 5000, stamps: 10, vouchers_remaining: 10, voucher_sets_used: 1 };
  useEffect(() => {
    const handleKey = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === "R") {
        e.preventDefault();
        fetch(SUPA_URL + "/rest/v1/members?id=eq.M0001", {
          method: "PATCH",
          headers: { apikey: SUPA_KEY, Authorization: "Bearer " + SUPA_KEY, "Content-Type": "application/json", Prefer: "return=representation" },
          body: JSON.stringify(DEMO_DEFAULTS),
        }).then(function() { window.location.reload(); });
      }
    };
    window.addEventListener("keydown", handleKey);
    return function() { window.removeEventListener("keydown", handleKey); };
  }, []);

  return (
    <div style={s.app}>
      <style>{
        "@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=DM+Sans:wght@300;400;500;600;700&display=swap');" +
        "@keyframes spin { to { transform:rotate(360deg) } }" +
        "@keyframes fadeIn { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:none } }" +
        "* { box-sizing: border-box; margin: 0; padding: 0; }"
      }</style>

      {view !== VIEW.LANDING && (
        <div style={s.header}>
          <div style={s.logo}>✦ 1-INSIDER</div>
          {member && <div style={{ fontSize: 11, color: "#888" }}>{member.name}</div>}
        </div>
      )}

      {view === VIEW.LANDING && <Landing onSignIn={() => setView(VIEW.SIGNIN)} />}
      {view === VIEW.SIGNIN && <SignIn onSuccess={(m) => { setMember(m); loadMemberData(m.id); setView(VIEW.HOME); }} onBack={() => setView(VIEW.LANDING)} />}
      {view === VIEW.HOME && member && <Home member={member} transactions={transactions} setView={setView} reload={() => loadMemberData(member.id)} />}
      {view === VIEW.REWARDS && member && <RewardsView member={member} rewards={rewards} reload={() => loadMemberData(member.id)} />}
      {view === VIEW.STAMPS && member && <StampsView member={member} reload={() => loadMemberData(member.id)} />}
      {view === VIEW.PROFILE && member && <Profile member={member} signOut={signOut} />}

      {member && view >= VIEW.HOME && (
        <div style={s.bottomNav}>
          {[
            { icon: "🏠", label: "Home", v: VIEW.HOME },
            { icon: "🎁", label: "Rewards", v: VIEW.REWARDS },
            { icon: "☕", label: "Cafe Stamp Card", v: VIEW.STAMPS },
            { icon: "👤", label: "Profile", v: VIEW.PROFILE },
          ].map((n, i) => (
            <div key={i} style={{ ...s.navItem(view === n.v), flex: 1, textAlign: "center", padding: "0 2px" }} onClick={() => setView(n.v)}>
              <span style={{ fontSize: 20 }}>{n.icon}</span>
              <span style={{ lineHeight: 1.1 }}>{n.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Landing({ onSignIn }) {
  const tiers = [
    { id: "silver", name: "Silver", sub: "Free — start earning today", icon: "✧" },
    { id: "gold", name: "Gold", sub: "$40/yr — enhanced rewards", icon: "★" },
    { id: "platinum", name: "Platinum", sub: "$80/yr — premium experience", icon: "♦" },
  ];
  return (
    <div style={{ animation: "fadeIn .4s ease" }}>
      <div style={{ background: "linear-gradient(135deg," + C.dark + ",#1a180f)", padding: "48px 24px", textAlign: "center" }}>
        <div style={{ fontFamily: FONT.h, fontSize: 12, color: C.gold, letterSpacing: 3, textTransform: "uppercase", marginBottom: 12 }}>✦ 1-GROUP SINGAPORE</div>
        <h1 style={{ fontFamily: FONT.h, fontSize: 32, color: "#fff", fontWeight: 700, marginBottom: 12 }}>1-Insider</h1>
        <p style={{ fontSize: 14, color: "#ccc", maxWidth: 320, margin: "0 auto 20px", lineHeight: 1.55 }}>Earn points on every meal. Unlock member-only rates. 25 premium dining destinations across Singapore.</p>

        {/* Value-prop bullets */}
        <div style={{ display: "flex", justifyContent: "center", gap: 14, marginBottom: 24, flexWrap: "wrap", color: "#aaa", fontSize: 11 }}>
          <span>✦ Up to 2× points</span>
          <span>✦ Birthday rewards</span>
          <span>✦ Non-Stop Hits</span>
        </div>

        <button onClick={onSignIn} style={{ ...s.btn, maxWidth: 260, margin: "0 auto 10px", display: "block" }}>Sign In</button>
        <div style={{ fontSize: 12, color: "#888" }}>New to 1-Insider? <span style={{ color: C.gold }}>Explore tiers below ↓</span></div>

        {/* Demo mode badge */}
        <div style={{ marginTop: 24, display: "inline-block", padding: "4px 12px", background: "rgba(255,193,7,.12)", border: "1px solid rgba(255,193,7,.3)", borderRadius: 10, fontSize: 10, color: "#ffc107", letterSpacing: 1, textTransform: "uppercase" }}>⚠ Preview · Demo mode</div>
      </div>
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
                <div style={{ fontSize: 11, opacity: 0.7 }}>{TIER_INFO[t.id].earn}</div>
              </div>
            </div>
          ))}
        </div>
        <h2 style={{ ...s.h2, textAlign: "center", marginTop: 28 }}>Our Venues</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {Object.entries(CAT).map(([name, { icon, clr }]) => {
            const count = VENUES.filter(v => v.category === name).length;
            return (
              <div key={name} style={{ background: "#fff", borderRadius: 12, padding: 16, textAlign: "center", border: "1px solid " + clr + "22", boxShadow: "0 1px 8px rgba(0,0,0,.04)" }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>{icon}</div>
                <div style={{ fontWeight: 600, fontSize: 14, color: clr }}>{name}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{count} venue{count !== 1 ? "s" : ""}</div>
              </div>
            );
          })}
        </div>

        {/* Bottom CTA — second sign-in entry after users scan the tiers */}
        <div style={{ marginTop: 28, padding: 20, background: "#FAF8F5", borderRadius: 12, textAlign: "center" }}>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 10 }}>Already a member?</div>
          <button onClick={onSignIn} style={{ ...s.btn, maxWidth: 260, margin: "0 auto", display: "block" }}>Sign in to your account</button>
        </div>
      </div>
    </div>
  );
}

function SignIn({ onSuccess, onBack }) {
  const [step, setStep] = useState(1);
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const sendOtp = () => {
    setError("");
    if (!mobile || mobile.length < 4) { setError("Enter a valid mobile number"); return; }
    setStep(2);
  };

  const verifyOtp = async () => {
    setError("");
    if (otp.length < 4) { setError("Enter the 6-digit OTP"); return; }
    setLoading(true);
    try {
      let m = await supaFetch("members?mobile=eq." + encodeURIComponent(mobile));
      if (!Array.isArray(m) || !m.length) m = await supaFetch("members?mobile=eq." + encodeURIComponent("+65" + mobile));
      if (!Array.isArray(m) || !m.length) m = await supaFetch("members?mobile=eq." + encodeURIComponent("+65 " + mobile));
      if (!Array.isArray(m) || !m.length) m = await supaFetch("members?id=eq.M0001");
      if (Array.isArray(m) && m[0]) onSuccess(m[0]);
      else setError("Verification failed");
    } catch(e) { setError("Connection error"); }
    setLoading(false);
  };

  return (
    <div style={{ padding: 24, paddingTop: 60, animation: "fadeIn .3s ease" }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontFamily: FONT.h, fontSize: 12, color: C.gold, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>✦ 1-INSIDER</div>
        <h2 style={{ fontFamily: FONT.h, fontSize: 24, fontWeight: 700 }}>Sign in to continue</h2>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>Enter your mobile number to receive a one-time passcode</div>
      </div>
      {step === 1 ? (
        <div>
          <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 6 }}>Mobile Number</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <div style={{ ...s.input, width: 60, textAlign: "center", flexShrink: 0, color: C.muted }}>+65</div>
            <input style={s.input} placeholder="8123 4567" value={mobile} onChange={e => setMobile(e.target.value.replace(/\D/g, ""))} maxLength={8} />
          </div>
          {error && <div style={{ color: "#D32F2F", fontSize: 12, marginBottom: 12 }}>{error}</div>}
          <button onClick={sendOtp} style={s.btn}>Send OTP</button>
          <div style={{ textAlign: "center", marginTop: 12, fontSize: 12, color: C.muted }}>Demo mode: any OTP works</div>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 13, color: C.muted, textAlign: "center", marginBottom: 16 }}>OTP sent to +65 {mobile}</div>
          <input style={{ ...s.input, textAlign: "center", fontSize: 24, letterSpacing: 8, fontFamily: FONT.m, marginBottom: 16 }} placeholder="000000" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ""))} maxLength={6} />
          {error && <div style={{ color: "#D32F2F", fontSize: 12, marginBottom: 12, textAlign: "center" }}>{error}</div>}
          <button onClick={verifyOtp} disabled={loading} style={{ ...s.btn, opacity: loading ? 0.6 : 1 }}>
            {loading ? "Verifying…" : "Verify & Sign In"}
          </button>
          <div style={{ textAlign: "center", marginTop: 12 }}>
            <span style={{ fontSize: 12, color: C.gold, cursor: "pointer" }} onClick={() => { setStep(1); setOtp(""); setError(""); }}>← Change number</span>
          </div>
        </div>
      )}
      <div style={{ textAlign: "center", marginTop: 24 }}>
        <span style={{ fontSize: 12, color: C.muted, cursor: "pointer" }} onClick={onBack}>← Back to home</span>
      </div>
    </div>
  );
}

function Home({ member, transactions, setView, reload }) {
  const tier = TIER[member.tier] || TIER.silver;
  const info = TIER_INFO[member.tier] || TIER_INFO.silver;
  const isDark = ["platinum", "corporate", "staff"].includes(member.tier);

  
  const [showUseVoucher, setShowUseVoucher] = useState(false);
  const [voucherUsed, setVoucherUsed] = useState(null);

  const vouchersRemaining = member.vouchers_remaining != null ? member.vouchers_remaining : (info.vCount || 0);
  const hasNonStop = info.nonStop;

  const useVoucher = async () => {
    var newV = Math.max(0, vouchersRemaining - 1);
    await supaFetch("members?id=eq." + member.id, { method: "PATCH", body: { vouchers_remaining: newV } });
    await supaFetch("transactions", { method: "POST", body: { member_id: member.id, venue: "1-Insider Vouchers", amount: info.vValue, points: 0, type: "redeem", reward_name: "$" + info.vValue + " Dining Voucher (Non-Stop Hits)" } });
    setVoucherUsed(true);
    setShowUseVoucher(false);
    reload();
    setTimeout(() => setVoucherUsed(null), 3000);
  };

  const claimNewSet = async () => {
    await supaFetch("members?id=eq." + member.id, { method: "PATCH", body: { vouchers_remaining: 10, voucher_sets_used: (member.voucher_sets_used || 0) + 1 } });
    await supaFetch("transactions", { method: "POST", body: { member_id: member.id, venue: "1-Insider Vouchers", amount: 0, points: 0, type: "adjust", reward_name: "Non-Stop Hits — New voucher set claimed" } });
    reload();
  };

  return (
    <div style={{ ...s.page, animation: "fadeIn .3s ease" }}>
      {/* Tier Card */}
      <div style={{ background: tier.grad, borderRadius: 16, padding: 24, color: isDark ? "#fff" : C.text, marginBottom: 20 }}>
        <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 2, opacity: 0.7, marginBottom: 4 }}>✦ 1-Insider {info.name}</div>
        <div style={{ fontFamily: FONT.h, fontSize: 24, fontWeight: 700, marginBottom: 16 }}>{member.name}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {[
            { l: "Points", v: (member.points || 0).toLocaleString() },
            { l: "Visits", v: member.visits || 0 },
            { l: "Cafe Stamps", v: (member.stamps || 0) + "/10" },
          ].map((k, i) => (
            <div key={i} style={{ background: "rgba(255,255,255,.15)", borderRadius: 10, padding: 10, textAlign: "center" }}>
              <div style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: 1, opacity: 0.7 }}>{k.l}</div>
              <div style={{ fontFamily: FONT.h, fontSize: 20, fontWeight: 700, marginTop: 2 }}>{k.v}</div>
            </div>
          ))}
        </div>
        <div style={{ fontFamily: FONT.m, fontSize: 10, opacity: 0.5, marginTop: 12 }}>{member.id} · {info.earn}</div>
      </div>

      {/* Voucher Wallet */}
      <h3 style={s.h3}>🎟️ Dining Vouchers</h3>
      {info.vCount > 0 ? (
        <div style={{ ...s.card, padding: 0, overflow: "hidden" }}>
          <div style={{ background: "linear-gradient(135deg," + C.dark + ",#1a180f)", padding: 16, color: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 11, color: C.gold, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                  {hasNonStop ? "✦ Non-Stop Hits" : "Welcome Voucher"}
                </div>
                <div style={{ fontFamily: FONT.h, fontSize: 20, fontWeight: 700 }}>{"$" + info.vValue + " Dining Voucher" + (info.vCount > 1 ? "s" : "")}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: FONT.h, fontSize: 28, fontWeight: 700, color: C.gold }}>{vouchersRemaining}</div>
                <div style={{ fontSize: 10, opacity: 0.6 }}>of {info.vCount} left</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 4, marginTop: 12, flexWrap: "wrap" }}>
              {Array.from({ length: info.vCount }).map((_, i) => (
                <div key={i} style={{
                  width: 22, height: 22, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10,
                  background: i < (10 - vouchersRemaining) ? "rgba(255,255,255,.1)" : C.gold,
                  color: i < (10 - vouchersRemaining) ? "#666" : "#fff", fontWeight: 600,
                }}>{i < (10 - vouchersRemaining) ? "✓" : "$"}</div>
              ))}
            </div>
          </div>
          <div style={{ padding: 16 }}>
            {vouchersRemaining > 0 ? (
              <button onClick={() => setShowUseVoucher(true)} style={s.btn}>
                {"Use $" + info.vValue + " Voucher at Restaurant"}
              </button>
            ) : hasNonStop ? (
              <div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, textAlign: "center" }}>All vouchers used! Claim your next set of {info.vCount}×${info.vValue} vouchers.</div>
                <button onClick={claimNewSet} style={{ ...s.btn, background: "#4CAF50" }}>🔄 Claim New Voucher Set (Non-Stop Hits)</button>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: C.muted, textAlign: "center" }}>All vouchers used. Upgrade for Non-Stop Hits!</div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ ...s.card, textAlign: "center", color: C.muted, fontSize: 13 }}>No dining vouchers for your current tier</div>
      )}

      {voucherUsed && (
        <div style={{ background: "#E8F5E9", border: "1px solid #A5D6A7", borderRadius: 10, padding: 14, fontSize: 13, color: "#1B5E20", textAlign: "center", marginBottom: 12 }}>
          {"✅ $" + info.vValue + " dining voucher applied! Present this to your server."}
        </div>
      )}

      {showUseVoucher && (
        <div style={s.modal} onClick={() => setShowUseVoucher(false)}>
          <div style={s.modalInner} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: FONT.h, fontSize: 18, marginBottom: 12 }}>Use Dining Voucher</h3>
            <div style={{ background: C.bg, borderRadius: 10, padding: 16, textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontFamily: FONT.h, fontSize: 32, fontWeight: 700, color: C.gold }}>{"$" + info.vValue}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Valid at all participating restaurants</div>
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
              <strong>Stacking rules:</strong> 1 dining voucher per check. Can combine with 1 points voucher. Cannot combine with birthday discount or active promotions.
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontSize: 12 }}>Remaining after use:</div>
              <div style={{ fontWeight: 600 }}>{vouchersRemaining - 1} voucher{vouchersRemaining - 1 !== 1 ? "s" : ""}</div>
            </div>
            <button onClick={useVoucher} style={{ ...s.btn, marginBottom: 8 }}>Confirm — Use Voucher</button>
            <button onClick={() => setShowUseVoucher(false)} style={s.btnOutline}>Cancel</button>
          </div>
        </div>
      )}

      {/* Benefits */}
      <h3 style={s.h3}>Your Benefits</h3>
      <div style={s.card}>
        {info.benefits.map((b, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", fontSize: 12.5, borderBottom: i < info.benefits.length - 1 ? "1px solid #f5f5f5" : "none" }}>
            <span style={{ color: C.gold }}>✦</span> {b}
          </div>
        ))}
      </div>

      {/* Recent Activity (U05) */}
      <RecentActivity transactions={transactions} />

      <button onClick={reload} style={{ ...s.btnOutline, marginTop: 16, fontSize: 12 }}>↻ Refresh Data</button>
    </div>
  );
}

// U05: describe a raw transaction row as a human-readable activity entry
function describeTransaction(t) {
  const venue = t.venue || "";
  const name = t.reward_name || "";
  const pts = t.points || 0;
  const amt = parseFloat(t.amount || 0);

  // Voucher usage — "1-Insider Vouchers" venue string + amount > 0
  if (t.type === "redeem" && venue === "1-Insider Vouchers" && amt > 0) {
    return {
      icon: "🎟️",
      iconBg: "#FDF8EE",
      title: `Used $${amt.toFixed(2)} dining voucher`,
      subtitle: name.includes("Non-Stop") ? "Non-Stop Hits" : "Dining voucher",
      delta: `−$${amt.toFixed(0)}`,
      deltaColor: "#D32F2F",
    };
  }

  // Stamp reward claim — reward_name starts with "Stamp Reward:"
  if (t.type === "redeem" && name.startsWith("Stamp Reward:")) {
    const rewardLabel = name.replace(/^Stamp Reward:\s*/, "");
    return {
      icon: "☕",
      iconBg: "#F7F7F7",
      title: `Claimed: ${rewardLabel}`,
      subtitle: "Cafe Stamp Card reward",
      delta: "Claimed",
      deltaColor: "#2E7D32",
    };
  }

  // Points redemption — "1-Insider Rewards" venue + negative points
  if (t.type === "redeem" && venue === "1-Insider Rewards" && pts < 0) {
    return {
      icon: "🎁",
      iconBg: "#EDE7F6",
      title: `Redeemed: ${name || "reward"}`,
      subtitle: "Points reward",
      delta: `${pts} pts`,
      deltaColor: "#D32F2F",
    };
  }

  // Non-Stop Hits refill adjustment
  if (t.type === "adjust" && name.includes("Non-Stop Hits")) {
    return {
      icon: "🔄",
      iconBg: "#FDF8EE",
      title: "New voucher set claimed",
      subtitle: "Non-Stop Hits refill",
      delta: "+10 vouchers",
      deltaColor: "#C5A258",
    };
  }

  // Stamp earned/deducted
  if (name.toLowerCase().includes("stamp") && pts === 0) {
    const deducted = t.type === "adjust" && name.toLowerCase().includes("deduct");
    return {
      icon: "☕",
      iconBg: "#F7F7F7",
      title: deducted ? "Stamp deducted" : "Stamp earned",
      subtitle: venue || "Wildseed Café",
      delta: deducted ? "−1 stamp" : "+1 stamp",
      deltaColor: deducted ? "#D32F2F" : "#2E7D32",
    };
  }

  // Points earned — type=earn with positive points (real venue transaction)
  if (t.type === "earn" && pts > 0) {
    return {
      icon: "✦",
      iconBg: "#FDF8EE",
      title: `Earned points at ${venue || "a 1-Group venue"}`,
      subtitle: amt > 0 ? `$${amt.toFixed(2)} spend` : null,
      delta: `+${pts} pts`,
      deltaColor: "#2E7D32",
    };
  }

  // Generic earn fallback (points = 0)
  if (t.type === "earn") {
    return {
      icon: "✦",
      iconBg: "#FDF8EE",
      title: name || `Activity at ${venue}`,
      subtitle: venue,
      delta: pts !== 0 ? `${pts > 0 ? "+" : ""}${pts} pts` : null,
      deltaColor: pts > 0 ? "#2E7D32" : "#888",
    };
  }

  // Generic adjust fallback
  if (t.type === "adjust") {
    return {
      icon: "⚙",
      iconBg: "#F5F5F5",
      title: name || "Account adjustment",
      subtitle: venue,
      delta: pts !== 0 ? `${pts > 0 ? "+" : ""}${pts} pts` : null,
      deltaColor: pts > 0 ? "#2E7D32" : pts < 0 ? "#D32F2F" : "#888",
    };
  }

  // Unknown fallback
  return {
    icon: "•",
    iconBg: "#F5F5F5",
    title: name || venue || "Activity",
    subtitle: venue && name ? venue : null,
    delta: pts !== 0 ? `${pts > 0 ? "+" : ""}${pts} pts` : null,
    deltaColor: pts > 0 ? "#2E7D32" : pts < 0 ? "#D32F2F" : "#888",
  };
}

// U05: friendly date formatter — "Today", "Yesterday", "17 Apr", "17 Apr 2025" for older
function friendlyDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const dayMs = 86400000;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDate = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfToday - startOfDate) / dayMs);
  if (diffDays === 0) return "Today · " + d.toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit", hour12: true });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString("en-SG", { day: "numeric", month: "short" });
  return d.toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });
}

// U05: Recent Activity component
function RecentActivity({ transactions }) {
  const [expanded, setExpanded] = useState(false);
  const visibleCount = expanded ? 15 : 5;
  const visible = transactions.slice(0, visibleCount);
  const hasMore = transactions.length > 5;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h3 style={{ ...s.h3, marginBottom: 8 }}>Recent Activity</h3>
        {transactions.length > 0 && (
          <div style={{ fontSize: 11, color: C.muted }}>
            {transactions.length} entr{transactions.length === 1 ? "y" : "ies"}
          </div>
        )}
      </div>

      {transactions.length === 0 ? (
        <div style={{ ...s.card, padding: 20, textAlign: "center", color: C.muted, fontSize: 12.5 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>✨</div>
          <div style={{ fontWeight: 500, color: C.text, marginBottom: 4 }}>No activity yet</div>
          <div style={{ fontSize: 11 }}>Points, voucher uses, and stamp rewards will appear here as they happen.</div>
        </div>
      ) : (
        <>
          <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 8px rgba(0,0,0,.04)", overflow: "hidden" }}>
            {visible.map((t, i) => {
              const desc = describeTransaction(t);
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderBottom: i < visible.length - 1 ? "1px solid #f5f5f5" : "none" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: desc.iconBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                    {desc.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: C.text, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {desc.title}
                    </div>
                    <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>
                      {desc.subtitle ? `${desc.subtitle} · ${friendlyDate(t.created_at)}` : friendlyDate(t.created_at)}
                    </div>
                  </div>
                  {desc.delta && (
                    <div style={{ fontSize: 12, fontWeight: 600, color: desc.deltaColor, flexShrink: 0, whiteSpace: "nowrap" }}>
                      {desc.delta}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {hasMore && (
            <div style={{ textAlign: "center", marginTop: 10 }}>
              <button onClick={() => setExpanded(!expanded)} style={{ background: "none", border: "none", color: C.gold, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 6 }}>
                {expanded ? "Show less" : `Show more (${Math.min(transactions.length, 15) - 5} more)`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

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
    } catch(e) { setResult({ success: false }); }
    setConfirming(false);
  };

  return (
    <div style={{ ...s.page, animation: "fadeIn .3s ease" }}>
      <h2 style={s.h2}>Rewards</h2>
      <div style={{ fontSize: 13, marginBottom: 16 }}>
        <span style={{ fontWeight: 600 }}>{(member.points || 0).toLocaleString()}</span> <span style={{ color: C.muted }}>points available</span>
      </div>

      <div style={{ ...s.card, background: "linear-gradient(135deg," + C.dark + ",#1a180f)", color: "#fff", marginBottom: 20 }}>
        <div style={{ fontSize: 10, color: C.gold, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 600, marginBottom: 8 }}>✦ Redeem Points for Vouchers</div>
        <div style={{ display: "flex", gap: 8 }}>
          {REDEEM_TIERS.map((r, i) => (
            <div key={i} style={{ flex: 1, background: "rgba(255,255,255,.1)", borderRadius: 10, padding: 10, textAlign: "center", opacity: (member.points || 0) >= r.points ? 1 : 0.4 }}>
              <div style={{ fontFamily: FONT.h, fontSize: 16, fontWeight: 700 }}>{"$" + r.value}</div>
              <div style={{ fontSize: 10, color: "#aaa" }}>{r.points} pts</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto" }}>
        {cats.map(c => (
          <div key={c} onClick={() => setCatFilter(c)} style={{
            padding: "6px 14px", borderRadius: 20, fontSize: 11.5, fontWeight: catFilter === c ? 600 : 400,
            background: catFilter === c ? C.gold : "#fff", color: catFilter === c ? "#fff" : C.muted,
            cursor: "pointer", whiteSpace: "nowrap", border: "1px solid #eee",
          }}>{catLabels[c]}</div>
        ))}
      </div>

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

      {result && (
        <div style={s.modal} onClick={() => { setResult(null); setRedeeming(null); }}>
          <div style={{ ...s.modalInner, textAlign: "center" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>{result.success ? "🎉" : "❌"}</div>
            <h3 style={{ fontFamily: FONT.h, fontSize: 20, marginBottom: 8 }}>{result.success ? "Redeemed!" : "Error"}</h3>
            {result.success ? (
              <div>
                <div style={{ fontSize: 13, color: C.muted, marginBottom: 4 }}>{result.reward}</div>
                <div style={{ fontSize: 13 }}>New balance: <strong>{(result.pts || 0).toLocaleString()} pts</strong></div>
              </div>
            ) : <div style={{ fontSize: 13, color: "#D32F2F" }}>Something went wrong. Please try again.</div>}
            <button onClick={() => { setResult(null); setRedeeming(null); }} style={{ ...s.btn, marginTop: 16 }}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}

function StampsView({ member, reload }) {
  const stampCount = member.stamps || 0;
  const displayStamps = Math.min(stampCount, 10);
  const [claiming, setClaiming] = useState(null);
  const [lastClaimed, setLastClaimed] = useState(null);

  const claimReward = async (milestone) => {
    setClaiming(milestone.s);
    var newStamps = Math.max(0, stampCount - milestone.s);
    await supaFetch("members?id=eq." + member.id, { method: "PATCH", body: { stamps: newStamps } });
    await supaFetch("transactions", { method: "POST", body: { member_id: member.id, venue: "Wildseed Café", amount: 0, points: 0, type: "redeem", reward_name: "Stamp Reward: " + milestone.reward, note: stampCount + " stamps → claimed " + milestone.reward + " (cost " + milestone.s + ") → " + newStamps + " stamps remaining" } });
    setLastClaimed({ reward: milestone.reward, burned: milestone.s, remaining: newStamps });
    setClaiming(null);
    await reload();
    setTimeout(function() { setLastClaimed(null); }, 5000);
  };

  return (
    <div style={{ ...s.page, animation: "fadeIn .3s ease" }}>
      <h2 style={s.h2}>Cafe Stamp Card</h2>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}>Earn 1 stamp per $10 spent at Wildseed Café outlets</div>
      <div style={{ fontSize: 12, color: C.text, marginBottom: 20, lineHeight: 1.6 }}>
        Redeeming a reward <strong>burns</strong> that number of stamps. For example: 5 stamps → claim 3-stamp reward → 2 stamps remain → earn 3 more to reach the next reward.
      </div>

      {/* Claim success banner */}
      {lastClaimed && (
        <div style={{ background: "#E8F5E9", border: "1px solid #A5D6A7", borderRadius: 10, padding: 14, fontSize: 13, color: "#1B5E20", marginBottom: 16 }}>
          ✅ <strong>{lastClaimed.reward}</strong> claimed! {lastClaimed.burned} stamps burned → {lastClaimed.remaining} stamps remaining.
        </div>
      )}

      {/* Stamp Grid — 10 slots per cycle */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 24 }}>
        {STAMPS.map(function(st, i) {
          var filled = i < displayStamps;
          var hasReward = !!st.reward;
          return (
            <div key={i} style={{
              aspectRatio: "1", borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              background: filled ? (hasReward ? C.gold : "#333") : (hasReward ? "#FFF8E1" : "#f5f5f5"),
              border: hasReward ? "2px solid " + (st.auto ? "#4CAF50" : "#FFB300") : "2px solid transparent",
              color: filled ? "#fff" : C.text,
            }}>
              <div style={{ fontFamily: FONT.h, fontSize: 18, fontWeight: 700 }}>{st.s}</div>
              {filled ? <div style={{ fontSize: 10, marginTop: 2 }}>✓</div>
                : hasReward ? <div style={{ fontSize: 6, fontWeight: 700, color: st.auto ? "#2E7D32" : "#F57F17", marginTop: 1 }}>{st.auto ? "AUTO" : "🎁"}</div>
                : null}
            </div>
          );
        })}
      </div>

      {/* Progress */}
      <div style={{ ...s.card, textAlign: "center" }}>
        <div style={{ fontFamily: FONT.h, fontSize: 28, fontWeight: 700, color: C.gold }}>{stampCount}</div>
        <div style={{ fontSize: 12, color: C.muted }}>stamps collected</div>
        <div style={{ height: 6, background: "#f0f0f0", borderRadius: 3, marginTop: 12, overflow: "hidden" }}>
          <div style={{ height: 6, background: C.gold, borderRadius: 3, width: Math.min(100, stampCount / 10 * 100) + "%", transition: "width .3s" }} />
        </div>
      </div>

      {/* Reward Cards */}
      <h3 style={{ ...s.h3, marginTop: 20 }}>Stamp Rewards</h3>
      {STAMPS.filter(function(st) { return st.reward; }).map(function(st, i) {
        var canClaim = stampCount >= st.s;
        var stampsNeeded = Math.max(0, st.s - stampCount);
        var isLoading = claiming === st.s;
        return (
          <div key={i} style={{ ...s.card, display: "flex", alignItems: "center", gap: 12, opacity: canClaim ? 1 : 0.55 }}>
            <div style={{
              width: 44, height: 44, borderRadius: "50%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0,
              background: canClaim ? C.gold : "#f0f0f0", color: canClaim ? "#fff" : C.muted,
            }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{st.s}</div>
              <div style={{ fontSize: 7, fontWeight: 600 }}>stamps</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{st.reward}</div>
              {st.note && <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{st.note}</div>}
              {canClaim ? (
                <div style={{ fontSize: 10, marginTop: 3, color: "#4CAF50", fontWeight: 600 }}>
                  {st.auto ? "Auto-issued ✓" : "Ready to claim · Uses " + st.s + " of your " + stampCount + " stamps"}
                </div>
              ) : (
                <div style={{ fontSize: 10, marginTop: 3, color: "#FF9800", fontWeight: 600 }}>
                  {"Need " + stampsNeeded + " more stamp" + (stampsNeeded !== 1 ? "s" : "") + " · You have " + stampCount + " of " + st.s + " required"}
                </div>
              )}
            </div>
            {!st.auto && canClaim && (
              <button onClick={function() { claimReward(st); }} disabled={isLoading} style={{ ...s.btnSm, fontSize: 11, padding: "8px 14px", opacity: isLoading ? 0.5 : 1 }}>
                {isLoading ? "…" : "Claim"}
              </button>
            )}
            {st.auto && canClaim && <span style={{ color: "#4CAF50", fontSize: 11, fontWeight: 600 }}>Issued ✓</span>}
          </div>
        );
      })}

      <h3 style={{ ...s.h3, marginTop: 24 }}>Participating Outlets</h3>
      {VENUES.filter(function(v) { return v.stamps; }).map(function(v, i) {
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #f5f5f5", fontSize: 12.5 }}>
            <span>☕</span>
            <div>
              <div style={{ fontWeight: 500 }}>{v.name}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{v.location}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Profile({ member, signOut }) {
  var tier = TIER[member.tier] || TIER.silver;
  var info = TIER_INFO[member.tier] || TIER_INFO.silver;
  var isDark = ["platinum", "corporate"].includes(member.tier);

  return (
    <div style={{ ...s.page, animation: "fadeIn .3s ease" }}>
      <div style={{ background: tier.grad, borderRadius: 16, padding: 24, textAlign: "center", color: isDark ? "#fff" : C.text, marginBottom: 20 }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(255,255,255,.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", fontFamily: FONT.h, fontSize: 28, fontWeight: 700 }}>
          {(member.name || "?")[0]}
        </div>
        <div style={{ fontFamily: FONT.h, fontSize: 20, fontWeight: 700 }}>{member.name}</div>
        <div style={{ opacity: 0.8, fontSize: 12, marginTop: 4 }}>{info.name} Member</div>
        <div style={{ fontFamily: FONT.m, fontSize: 10, opacity: 0.5, marginTop: 8 }}>{member.id}</div>
      </div>

      <h3 style={s.h3}>Account Details</h3>
      <div style={s.card}>
        {[
          { l: "Mobile", v: member.mobile || "—" },
          { l: "Email", v: member.email || "—" },
          { l: "Birthday Month", v: member.birthday_month ? "Month " + member.birthday_month : "—" },
          { l: "Member Since", v: member.signup_date ? new Date(member.signup_date).toLocaleDateString() : "—" },
          { l: "Last Visit", v: member.last_visit ? new Date(member.last_visit).toLocaleDateString() : "—" },
        ].map((d, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: i < 4 ? "1px solid #f5f5f5" : "none", fontSize: 12.5 }}>
            <span style={{ color: C.muted }}>{d.l}</span>
            <span style={{ fontWeight: 500 }}>{d.v}</span>
          </div>
        ))}
      </div>

      <h3 style={s.h3}>Tier Status</h3>
      <div style={s.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{info.name}</div>
            <div style={{ fontSize: 12, color: C.muted }}>{info.fee + " · " + info.earn + " · " + info.bday + " birthday"}</div>
          </div>
          <div style={{ padding: "4px 12px", borderRadius: 10, background: tier.bg, color: tier.txt, fontWeight: 600, fontSize: 11 }}>{member.tier}</div>
        </div>
        {member.membership_expiry && (
          <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>Expires: {new Date(member.membership_expiry).toLocaleDateString()}</div>
        )}
        {member.tier === "silver" && (
          <div style={{ marginTop: 12, background: "#FDF8EE", borderRadius: 10, padding: 12, textAlign: "center" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#8B6914" }}>Upgrade to Gold for $40/year</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>1.5× earn rate · 10×$20 dining vouchers · Priority reservations</div>
          </div>
        )}
      </div>

      <button onClick={signOut} style={{ ...s.btnOutline, marginTop: 16, color: "#D32F2F", borderColor: "#D32F2F" }}>Sign Out</button>
    </div>
  );
}
