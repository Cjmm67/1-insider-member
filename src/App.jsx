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
  if (currentPoints < reward.points_cost) {
    throw new Error(`Not enough points. You have ${currentPoints.toLocaleString()}, this reward costs ${reward.points_cost.toLocaleString()}.`);
  }
  const newPoints = currentPoints - reward.points_cost;
  await supaFetch(`members?id=eq.${memberId}`, { method: "PATCH", body: { points: newPoints } });
  await supaFetch(`rewards?id=eq.${reward.id}`, { method: "PATCH", body: { redemptions: (reward.redemptions || 0) + 1 } });
  await supaFetch("transactions", { method: "POST", body: { member_id: memberId, venue: "1-Insider Rewards", amount: 0, points: -reward.points_cost, type: "redeem", reward_name: reward.name } });
  return newPoints;
};

// U09: Convert points into a cash dining voucher (separate from the rewards path)
const redeemPointsToVoucher = async (memberId, pointsCost, voucherValue, currentPoints) => {
  if (currentPoints < pointsCost) {
    throw new Error(`Not enough points. You have ${currentPoints.toLocaleString()}, this voucher costs ${pointsCost.toLocaleString()}.`);
  }
  const newPoints = currentPoints - pointsCost;
  // 1. Deduct points
  await supaFetch(`members?id=eq.${memberId}`, { method: "PATCH", body: { points: newPoints } });
  // 2. Create voucher row in U16 vouchers table
  const voucherRes = await supaFetch("vouchers", {
    method: "POST",
    body: {
      member_id: memberId,
      type: "points",
      value: voucherValue,
      status: "active",
      source: "points_redemption",
    },
  });
  const voucher = Array.isArray(voucherRes) && voucherRes[0] ? voucherRes[0] : null;
  // 3. Write transaction log with both the points deduction and the voucher creation
  await supaFetch("transactions", {
    method: "POST",
    body: {
      member_id: memberId,
      venue: "1-Insider Rewards",
      amount: voucherValue,
      points: -pointsCost,
      type: "redeem",
      reward_name: `Points voucher: $${voucherValue}`,
      note: voucher ? `Voucher #${String(voucher.id).slice(0, 8)} added to wallet` : null,
    },
  });
  return { newPoints, voucher };
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

const VIEW = { LANDING: 0, SIGNIN: 1, HOME: 2, REWARDS: 3, STAMPS: 4, PROFILE: 5, WALLET: 6, GIFTCARDS: 7 };

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
  const [vouchers, setVouchers] = useState([]);
  const [giftCards, setGiftCards] = useState([]);
  const [tiers, setTiers] = useState([]);

  const loadMemberData = useCallback(async (memberId) => {
    const [m, r, t, v, g, tiersList] = await Promise.all([
      supaFetch("members?id=eq." + memberId),
      supaFetch("rewards?active=eq.true&order=id.asc"),
      supaFetch("transactions?member_id=eq." + memberId + "&order=created_at.desc&limit=20"),
      supaFetch("vouchers?member_id=eq." + memberId + "&order=issued_at.desc"),
      supaFetch("gift_cards?purchaser_id=eq." + memberId + "&order=created_at.desc"),
      supaFetch("tiers?select=*&order=annual_fee.asc"),
    ]);
    if (Array.isArray(m) && m[0]) setMember(m[0]);
    if (Array.isArray(r)) setRewards(r);
    if (Array.isArray(t)) setTxns(t);
    if (Array.isArray(v)) setVouchers(v);
    if (Array.isArray(g)) setGiftCards(g);
    if (Array.isArray(tiersList)) setTiers(tiersList);
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
      {view === VIEW.HOME && member && <Home member={member} transactions={transactions} vouchers={vouchers} giftCards={giftCards} setView={setView} reload={() => loadMemberData(member.id)} />}
      {view === VIEW.REWARDS && member && <RewardsView member={member} rewards={rewards} reload={() => loadMemberData(member.id)} />}
      {view === VIEW.STAMPS && member && <StampsView member={member} reload={() => loadMemberData(member.id)} />}
      {view === VIEW.PROFILE && member && <Profile member={member} tiers={tiers} signOut={signOut} reload={() => loadMemberData(member.id)} />}
      {view === VIEW.WALLET && member && <Wallet member={member} vouchers={vouchers} setView={setView} reload={() => loadMemberData(member.id)} />}
      {view === VIEW.GIFTCARDS && member && <GiftCards member={member} giftCards={giftCards} setView={setView} reload={() => loadMemberData(member.id)} />}

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

function Home({ member, transactions, vouchers, giftCards, setView, reload }) {
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

      {/* U10: Voucher Wallet entry card — shows individual vouchers (points, admin-added, etc.) */}
      {(() => {
        const activeIndividual = (vouchers || []).filter(v => v.status === "active" || v.status === "pending_scan");
        if (activeIndividual.length === 0) return null;
        const totalValue = activeIndividual.reduce((a, v) => a + parseFloat(v.value || 0), 0);
        return (
          <div onClick={() => setView(VIEW.WALLET)} style={{
            background: "linear-gradient(135deg,#fff,#FAF6ED)",
            border: "1.5px solid " + C.gold + "55",
            borderRadius: 12, padding: 14, marginBottom: 14,
            display: "flex", alignItems: "center", gap: 14,
            cursor: "pointer", boxShadow: "0 1px 8px rgba(0,0,0,.04)",
          }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: C.gold + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🎟️</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: FONT.h, fontSize: 15, fontWeight: 600 }}>My Voucher Wallet</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                {activeIndividual.length} individual voucher{activeIndividual.length === 1 ? "" : "s"} · ${totalValue.toFixed(0)} total · redeem by QR
              </div>
            </div>
            <div style={{ color: C.gold, fontSize: 18, fontWeight: 600 }}>→</div>
          </div>
        );
      })()}

      {/* U06: Gift Cards entry card — always visible; routes to Gift Cards view */}
      {(() => {
        const activeCards = (giftCards || []).filter(g => g.status === "active");
        const totalBalance = activeCards.reduce((a, g) => a + parseFloat(g.balance || 0), 0);
        return (
          <div onClick={() => setView(VIEW.GIFTCARDS)} style={{
            background: "linear-gradient(135deg,#fff,#F5F9F2)",
            border: "1.5px solid #7B9E6B55",
            borderRadius: 12, padding: 14, marginBottom: 14,
            display: "flex", alignItems: "center", gap: 14,
            cursor: "pointer", boxShadow: "0 1px 8px rgba(0,0,0,.04)",
          }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: "#7B9E6B22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>💳</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: FONT.h, fontSize: 15, fontWeight: 600 }}>Gift Cards</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                {activeCards.length === 0 ? "Buy a gift card for yourself or a friend" : `${activeCards.length} active · $${totalBalance.toFixed(0)} balance`}
              </div>
            </div>
            <div style={{ color: "#7B9E6B", fontSize: 18, fontWeight: 600 }}>→</div>
          </div>
        );
      })()}

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

  // U11: Tier upgrade
  if (t.type === "adjust" && name.startsWith("Tier upgrade:")) {
    const upgradeMatch = name.match(/Tier upgrade:\s*(\w+)\s*→\s*(\w+)/);
    const from = upgradeMatch ? upgradeMatch[1] : "";
    const to = upgradeMatch ? upgradeMatch[2] : "";
    return {
      icon: "✦",
      iconBg: "#FDF8EE",
      title: `Upgraded to ${to.charAt(0).toUpperCase() + to.slice(1)}`,
      subtitle: from ? `from ${from}` : "Tier upgrade",
      delta: amt > 0 ? `$${amt.toFixed(0)}/yr` : null,
      deltaColor: "#C5A258",
    };
  }

  // U06: Gift card purchase (admin-free member action)
  if (t.type === "adjust" && name.startsWith("Purchased $") && name.includes("gift card")) {
    return {
      icon: "💳",
      iconBg: "#F5F9F2",
      title: name.replace(/\s+\([^)]+\)$/, ""), // strip trailing "(1G-XXXX-XXXX)" code
      subtitle: t.note || "Gift card purchase",
      delta: `+$${amt.toFixed(0)}`,
      deltaColor: "#7B9E6B",
    };
  }

  // U06: Gift card redemption
  if (t.type === "redeem" && name.startsWith("Gift card redemption:")) {
    return {
      icon: "💳",
      iconBg: "#F5F9F2",
      title: `Gift card redeemed`,
      subtitle: name.replace(/^Gift card redemption:\s*/, "").replace(/\s+\([^)]+\)$/, "") + " used",
      delta: `−$${amt.toFixed(0)}`,
      deltaColor: "#D32F2F",
    };
  }

  // Voucher usage — "1-Insider Vouchers" venue string + amount > 0
  if (t.type === "redeem" && venue === "1-Insider Vouchers" && amt > 0) {
    // U10: distinguish QR redemptions by the "(QR redemption)" suffix in reward_name
    if (name.includes("QR redemption")) {
      const typeMatch = name.match(/\$(\d+(?:\.\d+)?)\s+(\w+)\s+voucher/);
      const vType = typeMatch ? typeMatch[2] : "dining";
      return {
        icon: "📱",
        iconBg: "#FDF8EE",
        title: `Redeemed $${amt.toFixed(0)} ${vType} voucher via QR`,
        subtitle: "QR redemption",
        delta: `−$${amt.toFixed(0)}`,
        deltaColor: "#D32F2F",
      };
    }
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
  // U09: separate state for points-to-voucher conversion
  const [pointsVoucher, setPointsVoucher] = useState(null); // { points, value }
  const [convertingVoucher, setConvertingVoucher] = useState(false);
  const [voucherResult, setVoucherResult] = useState(null);

  const cats = ["all", "cafes", "restaurants", "bars", "wines"];
  const catLabels = { all: "All", cafes: "☕ Cafés", restaurants: "🍽️ Restaurants", bars: "🍸 Bars", wines: "🍷 Wines" };

  // U08: split rewards by cost kind — points-earned experiences vs complimentary perks
  const catFiltered = rewards.filter(r => catFilter === "all" || r.category === catFilter);
  const experienceRewards = catFiltered.filter(r => (r.points_cost || 0) > 0);
  const complimentaryPerks = catFiltered.filter(r => (r.points_cost || 0) === 0);

  const handleRedeem = async () => {
    if (!redeeming) return;
    setConfirming(true);
    try {
      const newPts = await redeemReward(member.id, redeeming, member.points);
      setResult({ success: true, pts: newPts, reward: redeeming.name });
      reload();
    } catch(e) {
      setResult({ success: false, error: e.message || "Unable to redeem. Please try again." });
    }
    setConfirming(false);
  };

  // U09: Convert points to cash voucher
  const handleConvertToVoucher = async () => {
    if (!pointsVoucher) return;
    setConvertingVoucher(true);
    try {
      const { newPoints, voucher } = await redeemPointsToVoucher(member.id, pointsVoucher.points, pointsVoucher.value, member.points || 0);
      setVoucherResult({ success: true, pts: newPoints, value: pointsVoucher.value, voucherId: voucher?.id });
      reload();
    } catch (e) {
      setVoucherResult({ success: false, error: e.message || "Unable to convert points. Please try again." });
    }
    setConvertingVoucher(false);
  };

  return (
    <div style={{ ...s.page, animation: "fadeIn .3s ease" }}>
      <h2 style={s.h2}>Rewards</h2>
      <div style={{ fontSize: 13, marginBottom: 14 }}>
        <span style={{ fontWeight: 600 }}>{(member.points || 0).toLocaleString()}</span> <span style={{ color: C.muted }}>points available</span>
      </div>

      {/* U08: Explainer card — clarifies the three reward types up front */}
      <div style={{ background: "#FAF6ED", borderRadius: 10, padding: 12, marginBottom: 20, border: "1px solid #EDE0C1" }}>
        <div style={{ fontSize: 10.5, color: "#8B6914", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>How rewards work</div>
        <div style={{ fontSize: 11.5, color: "#5D4037", lineHeight: 1.6 }}>
          <div style={{ marginBottom: 3 }}><strong>✦ Points Vouchers</strong> — convert points into cash vouchers you can use on any bill.</div>
          <div style={{ marginBottom: 3 }}><strong>🎁 Experience Rewards</strong> — redeem points for specific experiences and treats.</div>
          <div><strong>🌟 Complimentary Perks</strong> — free benefits included with your tier. No points required.</div>
        </div>
      </div>

      {/* ─── SECTION 1: Points Vouchers (U09 flow) ─── */}
      <h3 style={s.h3}>✦ Points Vouchers</h3>
      <div style={{ ...s.card, background: "linear-gradient(135deg," + C.dark + ",#1a180f)", color: "#fff", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 10.5, color: C.gold, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 600 }}>Convert points to cash vouchers</div>
          <div style={{ fontSize: 10, color: "#888" }}>Tap a tier</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {REDEEM_TIERS.map((r, i) => {
            const canAfford = (member.points || 0) >= r.points;
            return (
              <div key={i}
                onClick={() => canAfford && setPointsVoucher({ points: r.points, value: r.value })}
                style={{
                  flex: 1,
                  background: "rgba(255,255,255,.1)",
                  borderRadius: 10,
                  padding: 12,
                  textAlign: "center",
                  opacity: canAfford ? 1 : 0.4,
                  cursor: canAfford ? "pointer" : "not-allowed",
                  border: canAfford ? "1px solid rgba(197,162,88,.3)" : "1px solid transparent",
                  transition: "all .2s",
                }}>
                <div style={{ fontFamily: FONT.h, fontSize: 18, fontWeight: 700 }}>{"$" + r.value}</div>
                <div style={{ fontSize: 10, color: "#aaa", marginTop: 2 }}>{r.points} pts</div>
                {canAfford && <div style={{ fontSize: 9, color: C.gold, marginTop: 4, letterSpacing: 0.8 }}>REDEEM →</div>}
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 10, color: "#888", marginTop: 10, textAlign: "center" }}>
          Vouchers appear in your wallet · redeem by QR at any venue
        </div>
      </div>

      {/* Category chips (shared filter for Experience + Complimentary sections) */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto" }}>
        {cats.map(c => (
          <div key={c} onClick={() => setCatFilter(c)} style={{
            padding: "6px 14px", borderRadius: 20, fontSize: 11.5, fontWeight: catFilter === c ? 600 : 400,
            background: catFilter === c ? C.gold : "#fff", color: catFilter === c ? "#fff" : C.muted,
            cursor: "pointer", whiteSpace: "nowrap", border: "1px solid #eee",
          }}>{catLabels[c]}</div>
        ))}
      </div>

      {/* ─── SECTION 2: Experience Rewards (cost > 0) ─── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <h3 style={{ ...s.h3, margin: 0 }}>🎁 Experience Rewards</h3>
        <div style={{ fontSize: 10.5, color: C.muted }}>{experienceRewards.length} available</div>
      </div>
      {experienceRewards.length > 0 ? experienceRewards.map(r => {
        const canAfford = (member.points || 0) >= r.points_cost;
        return (
          <div key={r.id} style={{ ...s.card, display: "flex", justifyContent: "space-between", alignItems: "center", opacity: canAfford ? 1 : 0.55 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{r.name}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{r.description}</div>
              <div style={{ fontSize: 11, color: C.gold, fontWeight: 600, marginTop: 4 }}>{r.points_cost} pts</div>
            </div>
            <button disabled={!canAfford} onClick={() => setRedeeming(r)} style={{ ...s.btnSm, opacity: canAfford ? 1 : 0.4 }}>Redeem</button>
          </div>
        );
      }) : (
        <div style={{ ...s.card, padding: 20, textAlign: "center", color: C.muted, fontSize: 12 }}>
          No experience rewards in this category right now
        </div>
      )}

      {/* ─── SECTION 3: Complimentary Perks (cost = 0) ─── */}
      {complimentaryPerks.length > 0 && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10, marginTop: 20 }}>
            <h3 style={{ ...s.h3, margin: 0 }}>🌟 Complimentary Perks</h3>
            <div style={{ fontSize: 10.5, color: C.muted }}>{complimentaryPerks.length} included</div>
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>Included with your {(member.tier || "").charAt(0).toUpperCase() + (member.tier || "").slice(1)} tier · no points required</div>
          {complimentaryPerks.map(r => (
            <div key={r.id} style={{ ...s.card, borderLeft: "3px solid #7B9E6B", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{r.name}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{r.description}</div>
                <div style={{ fontSize: 11, color: "#7B9E6B", fontWeight: 600, marginTop: 4 }}>Free perk · no points needed</div>
              </div>
              <button onClick={() => setRedeeming(r)} style={{ ...s.btnSm, background: "#7B9E6B" }}>Claim</button>
            </div>
          ))}
        </>
      )}

      {/* Rewards confirmation modal */}
      {redeeming && !result && (
        <div style={s.modal} onClick={() => { setRedeeming(null); setConfirming(false); }}>
          <div style={s.modalInner} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: FONT.h, fontSize: 18, marginBottom: 12 }}>{redeeming.points_cost === 0 ? "Claim Perk" : "Confirm Redemption"}</h3>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{redeeming.name}</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>{redeeming.description}</div>
            <div style={{ background: C.bg, borderRadius: 10, padding: 14, marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
              <div><div style={{ fontSize: 10, color: C.lmuted, textTransform: "uppercase" }}>Cost</div><div style={{ fontWeight: 600 }}>{redeeming.points_cost === 0 ? "Free perk" : redeeming.points_cost + " pts"}</div></div>
              <div style={{ textAlign: "right" }}><div style={{ fontSize: 10, color: C.lmuted, textTransform: "uppercase" }}>Balance After</div><div style={{ fontWeight: 600 }}>{((member.points || 0) - (redeeming.points_cost || 0)).toLocaleString()} pts</div></div>
            </div>
            <button onClick={handleRedeem} disabled={confirming} style={{ ...s.btn, opacity: confirming ? 0.6 : 1, marginBottom: 8, background: redeeming.points_cost === 0 ? "#7B9E6B" : C.gold }}>
              {confirming ? "Processing…" : (redeeming.points_cost === 0 ? "Claim" : "Confirm")}
            </button>
            <button onClick={() => setRedeeming(null)} style={s.btnOutline}>Cancel</button>
          </div>
        </div>
      )}

      {/* Rewards result modal */}
      {result && (
        <div style={s.modal} onClick={() => { setResult(null); setRedeeming(null); }}>
          <div style={{ ...s.modalInner, textAlign: "center" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>{result.success ? "🎉" : "❌"}</div>
            <h3 style={{ fontFamily: FONT.h, fontSize: 20, marginBottom: 8 }}>{result.success ? "Redeemed!" : "Unable to redeem"}</h3>
            {result.success ? (
              <div>
                <div style={{ fontSize: 13, color: C.muted, marginBottom: 4 }}>{result.reward}</div>
                <div style={{ fontSize: 13 }}>New balance: <strong>{(result.pts || 0).toLocaleString()} pts</strong></div>
              </div>
            ) : <div style={{ fontSize: 13, color: "#D32F2F" }}>{result.error || "Something went wrong. Please try again."}</div>}
            <button onClick={() => { setResult(null); setRedeeming(null); }} style={{ ...s.btn, marginTop: 16 }}>Done</button>
          </div>
        </div>
      )}

      {/* U09: Points voucher conversion modal */}
      {pointsVoucher && !voucherResult && (
        <div style={s.modal} onClick={() => { setPointsVoucher(null); setConvertingVoucher(false); }}>
          <div style={s.modalInner} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: FONT.h, fontSize: 18, marginBottom: 12 }}>Convert points to voucher</h3>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 16, lineHeight: 1.5 }}>
              Convert {pointsVoucher.points.toLocaleString()} points into a <strong style={{ color: C.text }}>${pointsVoucher.value} dining voucher</strong>. The voucher will be added to your wallet and you can use it on any bill at a 1-Group venue.
            </div>
            <div style={{ background: C.bg, borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: C.muted }}>Points to convert</div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>−{pointsVoucher.points.toLocaleString()} pts</div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: C.muted }}>Voucher value</div>
                <div style={{ fontWeight: 600, fontSize: 13, color: C.gold }}>+${pointsVoucher.value}</div>
              </div>
              <div style={{ borderTop: "1px solid #eee", paddingTop: 8, marginTop: 8, display: "flex", justifyContent: "space-between" }}>
                <div style={{ fontSize: 12, color: C.muted }}>Points balance after</div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{((member.points || 0) - pointsVoucher.points).toLocaleString()} pts</div>
              </div>
            </div>
            <button onClick={handleConvertToVoucher} disabled={convertingVoucher} style={{ ...s.btn, opacity: convertingVoucher ? 0.6 : 1, marginBottom: 8 }}>
              {convertingVoucher ? "Converting…" : `Convert to $${pointsVoucher.value} voucher`}
            </button>
            <button onClick={() => setPointsVoucher(null)} style={s.btnOutline}>Cancel</button>
          </div>
        </div>
      )}

      {/* U09: Points voucher conversion result modal */}
      {voucherResult && (
        <div style={s.modal} onClick={() => { setVoucherResult(null); setPointsVoucher(null); }}>
          <div style={{ ...s.modalInner, textAlign: "center" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>{voucherResult.success ? "🎟️" : "❌"}</div>
            <h3 style={{ fontFamily: FONT.h, fontSize: 20, marginBottom: 8 }}>{voucherResult.success ? "Voucher added!" : "Conversion failed"}</h3>
            {voucherResult.success ? (
              <div>
                <div style={{ fontSize: 14, color: C.text, marginBottom: 6 }}>
                  <strong>${voucherResult.value}</strong> dining voucher is now in your wallet
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>New points balance: <strong>{(voucherResult.pts || 0).toLocaleString()} pts</strong></div>
                {voucherResult.voucherId && <div style={{ fontSize: 10, color: C.lmuted, fontFamily: FONT.m, marginTop: 6 }}>ID: {String(voucherResult.voucherId).slice(0, 8)}</div>}
              </div>
            ) : <div style={{ fontSize: 13, color: "#D32F2F" }}>{voucherResult.error || "Something went wrong. Please try again."}</div>}
            <button onClick={() => { setVoucherResult(null); setPointsVoucher(null); }} style={{ ...s.btn, marginTop: 16 }}>Done</button>
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

// ─── U10: WALLET VIEW ───
function Wallet({ member, vouchers, setView, reload }) {
  const [redeeming, setRedeeming] = useState(null); // voucher being redeemed
  const [filter, setFilter] = useState("active"); // 'active' | 'all'

  // Split into active and historical
  const activeVouchers = vouchers.filter(v => v.status === "active");
  const visible = filter === "active" ? activeVouchers : vouchers;

  const nshValue = (TIER_INFO[member.tier] || {}).vValue || 0;
  const nshCount = member.vouchers_remaining || 0;

  // Total wallet value (active individual + NSH aggregate)
  const individualActiveValue = activeVouchers.reduce((a, v) => a + parseFloat(v.value || 0), 0);
  const nshTotalValue = nshCount * nshValue;
  const totalWalletValue = individualActiveValue + nshTotalValue;

  return (
    <div style={{ ...s.page, animation: "fadeIn .3s ease" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <button onClick={() => setView(VIEW.HOME)} style={{ background: "none", border: "none", color: C.gold, fontSize: 14, cursor: "pointer", padding: 0 }}>← Home</button>
      </div>
      <h2 style={s.h2}>My Voucher Wallet</h2>

      {/* Summary card */}
      <div style={{ background: "linear-gradient(135deg," + C.dark + ",#1a180f)", borderRadius: 12, padding: 18, color: "#fff", marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: C.gold, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 600, marginBottom: 4 }}>Total wallet value</div>
        <div style={{ fontFamily: FONT.h, fontSize: 32, fontWeight: 700 }}>${totalWalletValue}</div>
        <div style={{ fontSize: 11, color: "#aaa", marginTop: 6 }}>
          {activeVouchers.length} individual voucher{activeVouchers.length === 1 ? "" : "s"}
          {nshCount > 0 && ` + ${nshCount} Non-Stop Hits × $${nshValue}`}
        </div>
      </div>

      {/* Non-Stop Hits aggregate card (Phase 1 mechanic, still live) */}
      {nshCount > 0 && (
        <div style={{ background: "#fff", borderRadius: 12, padding: 16, marginBottom: 12, boxShadow: "0 1px 8px rgba(0,0,0,.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 10, color: C.gold, textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 600 }}>✦ Non-Stop Hits</div>
              <div style={{ fontFamily: FONT.h, fontSize: 18, fontWeight: 600, marginTop: 2 }}>${nshValue} Dining Vouchers</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: FONT.h, fontSize: 26, fontWeight: 700, color: C.gold }}>{nshCount}</div>
              <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: 1 }}>of 10 left</div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: C.muted }}>
            The Non-Stop Hits bank is managed on Home → <span style={{ color: C.gold, cursor: "pointer" }} onClick={() => setView(VIEW.HOME)}>go to Home to use</span>. Individual vouchers with QR redemption are listed below.
          </div>
        </div>
      )}

      {/* Filter chips */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {[{ id: "active", label: `Active (${activeVouchers.length})` }, { id: "all", label: `All (${vouchers.length})` }].map(c => (
          <div key={c.id} onClick={() => setFilter(c.id)} style={{
            padding: "6px 14px", borderRadius: 20, fontSize: 11.5, fontWeight: filter === c.id ? 600 : 400,
            background: filter === c.id ? C.gold : "#fff", color: filter === c.id ? "#fff" : C.muted,
            cursor: "pointer", whiteSpace: "nowrap", border: "1px solid #eee",
          }}>{c.label}</div>
        ))}
      </div>

      {/* Voucher list */}
      {visible.length === 0 ? (
        <div style={{ ...s.card, padding: 30, textAlign: "center", color: C.muted, fontSize: 13 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🎟️</div>
          <div style={{ fontWeight: 500, color: C.text, marginBottom: 4 }}>No {filter === "active" ? "active" : ""} vouchers in your wallet</div>
          <div style={{ fontSize: 11 }}>Earn vouchers by converting points on the Rewards tab, or wait for birthday and renewal auto-issues.</div>
        </div>
      ) : (
        visible.map(v => <VoucherCard key={v.id} voucher={v} onRedeem={() => setRedeeming(v)} />)
      )}

      {/* QR Redemption Modal */}
      {redeeming && (
        <QRRedemptionModal
          voucher={redeeming}
          member={member}
          onClose={() => { setRedeeming(null); reload(); }}
        />
      )}
    </div>
  );
}

// ─── U10: Individual voucher card ───
function VoucherCard({ voucher, onRedeem }) {
  const isActive = voucher.status === "active";
  const isConsumed = voucher.status === "consumed";
  const isPending = voucher.status === "pending_scan";

  const typeConfig = {
    points:   { icon: "✦", bg: "#EDE7F6", fg: "#4527A0", label: "Points voucher" },
    dining:   { icon: "🍽️", bg: "#FDF8EE", fg: "#8B6914", label: "Dining voucher" },
    cash:     { icon: "💵", bg: "#E8F5E9", fg: "#2E7D32", label: "Cash voucher" },
    welcome:  { icon: "✨", bg: "#FFF8E1", fg: "#5D4037", label: "Welcome voucher" },
    birthday: { icon: "🎂", bg: "#FCE4EC", fg: "#880E4F", label: "Birthday voucher" },
    tactical: { icon: "🎯", bg: "#E3F2FD", fg: "#1565C0", label: "Tactical voucher" },
  };
  const tc = typeConfig[voucher.type] || { icon: "🎟️", bg: "#f5f5f5", fg: "#666", label: voucher.type };

  const statusLabel = {
    active: "Available",
    consumed: "Used",
    removed: "Removed",
    expired: "Expired",
    pending_scan: "Awaiting scan",
  }[voucher.status] || voucher.status;

  return (
    <div style={{
      background: "#fff", borderRadius: 12, padding: 14, marginBottom: 10,
      boxShadow: "0 1px 8px rgba(0,0,0,.04)",
      opacity: isActive || isPending ? 1 : 0.6,
      border: isPending ? "2px solid " + C.gold : "1px solid transparent",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: isActive || isPending ? 10 : 0 }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: tc.bg, color: tc.fg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
          {tc.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
            <div style={{ fontFamily: FONT.h, fontSize: 17, fontWeight: 700 }}>${parseFloat(voucher.value).toFixed(0)}</div>
            <span style={{
              fontSize: 9.5, fontWeight: 600, padding: "2px 8px", borderRadius: 8,
              background: isActive ? "#E8F5E9" : isPending ? "#FFF8E1" : isConsumed ? "#E3F2FD" : "#F5F5F5",
              color: isActive ? "#2E7D32" : isPending ? "#5D4037" : isConsumed ? "#1565C0" : "#888",
              textTransform: "uppercase", letterSpacing: 0.8,
            }}>{statusLabel}</span>
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
            {tc.label}
            {voucher.source && ` · ${(voucher.source || "").replace(/_/g, " ")}`}
          </div>
          <div style={{ fontSize: 10, color: C.lmuted, ...s.mono, marginTop: 3 }}>
            #{String(voucher.id).slice(0, 8)}
            {voucher.issued_at && ` · issued ${friendlyDate(voucher.issued_at)}`}
          </div>
        </div>
      </div>
      {(isActive || isPending) && (
        <button onClick={onRedeem} style={{ ...s.btnSm, width: "100%", fontSize: 12 }}>
          {isPending ? "Show QR again" : "Redeem with QR"}
        </button>
      )}
    </div>
  );
}

// ─── U10: QR Redemption Modal with 15-min countdown ───
function QRRedemptionModal({ voucher, member, onClose }) {
  const PENDING_MINUTES = 15;
  const [nonce] = useState(() => {
    // 12-char alphanumeric nonce — demo signature. Real POS integration would verify server-side.
    return Array.from({ length: 12 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
  });
  const [pendingUntil, setPendingUntil] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [phase, setPhase] = useState("generating"); // 'generating' | 'active' | 'redeeming' | 'redeemed' | 'expired' | 'error'
  const [errorMsg, setErrorMsg] = useState("");

  // Lock the voucher with pending_until + nonce on mount
  useEffect(() => {
    (async () => {
      try {
        const expires = new Date(Date.now() + PENDING_MINUTES * 60 * 1000).toISOString();
        const r = await supaFetch(`vouchers?id=eq.${voucher.id}`, {
          method: "PATCH",
          body: { status: "pending_scan", pending_until: expires, nonce },
        });
        if (Array.isArray(r) && r[0]) {
          setPendingUntil(expires);
          setPhase("active");
        } else {
          setPhase("error");
          setErrorMsg("Could not generate QR code. Please try again.");
        }
      } catch (e) {
        setPhase("error");
        setErrorMsg("Connection error. Please try again.");
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Countdown tick
  useEffect(() => {
    if (phase !== "active") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [phase]);

  // Auto-expire
  useEffect(() => {
    if (phase !== "active" || !pendingUntil) return;
    if (Date.now() >= new Date(pendingUntil).getTime()) {
      setPhase("expired");
      // Revert voucher to active state so member can try again later
      supaFetch(`vouchers?id=eq.${voucher.id}`, {
        method: "PATCH",
        body: { status: "active", pending_until: null, nonce: null },
      }).catch(() => {});
    }
  }, [now, phase, pendingUntil, voucher.id]);

  const secondsRemaining = pendingUntil ? Math.max(0, Math.floor((new Date(pendingUntil).getTime() - now) / 1000)) : PENDING_MINUTES * 60;
  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;

  // QR payload: encodes everything a POS scanner needs to verify
  const qrPayload = JSON.stringify({
    v: 1, // format version
    vid: voucher.id,
    mid: member.id,
    val: voucher.value,
    typ: voucher.type,
    exp: pendingUntil,
    n: nonce,
  });
  const qrEncoded = encodeURIComponent(qrPayload);
  const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=0&data=${qrEncoded}`;

  // Mark as redeemed (demo button — simulates staff POS scan confirmation)
  const markAsRedeemed = async () => {
    setPhase("redeeming");
    try {
      const consumedAt = new Date().toISOString();
      await supaFetch(`vouchers?id=eq.${voucher.id}`, {
        method: "PATCH",
        body: { status: "consumed", consumed_at: consumedAt, pending_until: null },
      });
      // Transaction log
      await supaFetch("transactions", {
        method: "POST",
        body: {
          member_id: member.id,
          venue: "1-Insider Vouchers",
          amount: parseFloat(voucher.value),
          points: 0,
          type: "redeem",
          reward_name: `$${parseFloat(voucher.value).toFixed(0)} ${voucher.type} voucher (QR redemption)`,
          note: `Voucher #${String(voucher.id).slice(0, 8)} · nonce ${nonce}`,
        },
      });
      setPhase("redeemed");
    } catch (e) {
      setPhase("error");
      setErrorMsg("Failed to mark as redeemed. Please try again.");
    }
  };

  const handleCancel = async () => {
    // If the voucher is still in pending_scan state, revert to active so it stays usable
    if (phase === "active" || phase === "error") {
      try {
        await supaFetch(`vouchers?id=eq.${voucher.id}`, {
          method: "PATCH",
          body: { status: "active", pending_until: null, nonce: null },
        });
      } catch (e) { /* best-effort; fine if it fails */ }
    }
    onClose();
  };

  const fmtTime = (m, s) => `${m}:${String(s).padStart(2, "0")}`;

  return (
    <div style={s.modal} onClick={handleCancel}>
      <div style={{ ...s.modalInner, maxWidth: 360 }} onClick={e => e.stopPropagation()}>
        {phase === "generating" && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <div style={{ fontSize: 14, color: C.muted }}>Generating secure QR code…</div>
          </div>
        )}

        {phase === "active" && (
          <>
            <div style={{ textAlign: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: C.gold, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 600, marginBottom: 4 }}>✦ Show to venue staff</div>
              <div style={{ fontFamily: FONT.h, fontSize: 22, fontWeight: 700 }}>${parseFloat(voucher.value).toFixed(0)} Voucher</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2, textTransform: "capitalize" }}>{voucher.type} · #{String(voucher.id).slice(0, 8)}</div>
            </div>

            {/* QR code */}
            <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 12, padding: 16, textAlign: "center", marginBottom: 14 }}>
              <img
                src={qrImgUrl}
                alt="Voucher QR code"
                style={{ width: 240, height: 240, display: "block", margin: "0 auto" }}
                onError={e => { e.target.style.display = "none"; e.target.nextSibling.style.display = "block"; }}
              />
              <div style={{ display: "none", padding: 30, fontSize: 11, color: C.muted, textAlign: "center" }}>
                QR image failed to load.<br />Show this code to staff:<br />
                <div style={{ ...s.mono, marginTop: 8, fontSize: 10, wordBreak: "break-all", background: "#f5f5f5", padding: 10, borderRadius: 6 }}>{nonce}</div>
              </div>
            </div>

            {/* Countdown */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              background: secondsRemaining < 60 ? "#FFEBEE" : "#FFF8E1",
              borderRadius: 10, padding: "10px 14px", marginBottom: 14,
            }}>
              <div style={{ fontSize: 11, color: secondsRemaining < 60 ? "#B71C1C" : "#5D4037", fontWeight: 600 }}>
                ⏱️ Valid for
              </div>
              <div style={{ ...s.mono, fontSize: 16, fontWeight: 700, color: secondsRemaining < 60 ? "#B71C1C" : "#5D4037" }}>
                {fmtTime(mins, secs)}
              </div>
            </div>

            <div style={{ fontSize: 10.5, color: C.muted, textAlign: "center", marginBottom: 14, lineHeight: 1.5 }}>
              Staff will scan this QR. Once scanned by the POS, the voucher will be marked as used and deducted from your bill. Tap &ldquo;Mark as redeemed&rdquo; only after staff confirm the scan succeeded.
            </div>

            <button onClick={markAsRedeemed} style={{ ...s.btn, marginBottom: 8 }}>Mark as redeemed (demo)</button>
            <button onClick={handleCancel} style={s.btnOutline}>Cancel</button>
          </>
        )}

        {phase === "redeeming" && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <div style={{ fontSize: 14 }}>Marking voucher as redeemed…</div>
          </div>
        )}

        {phase === "redeemed" && (
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
            <h3 style={{ fontFamily: FONT.h, fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Voucher redeemed</h3>
            <div style={{ fontSize: 13, color: C.text, marginBottom: 4 }}>${parseFloat(voucher.value).toFixed(0)} deducted from your bill</div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 20 }}>The venue has been notified. Enjoy your meal.</div>
            <button onClick={onClose} style={s.btn}>Done</button>
          </div>
        )}

        {phase === "expired" && (
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>⏱️</div>
            <h3 style={{ fontFamily: FONT.h, fontSize: 20, fontWeight: 700, marginBottom: 8 }}>QR expired</h3>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>The 15-minute redemption window closed. Your voucher is still active — tap &ldquo;Redeem with QR&rdquo; again to generate a new code.</div>
            <button onClick={onClose} style={s.btn}>Done</button>
          </div>
        )}

        {phase === "error" && (
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>❌</div>
            <h3 style={{ fontFamily: FONT.h, fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Something went wrong</h3>
            <div style={{ fontSize: 13, color: "#D32F2F", marginBottom: 20 }}>{errorMsg}</div>
            <button onClick={handleCancel} style={s.btn}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── U06: GIFT CARDS VIEW ───
function GiftCards({ member, giftCards, setView, reload }) {
  const [purchasing, setPurchasing] = useState(false);
  const [showRedeemForCard, setShowRedeemForCard] = useState(null);

  const activeCards = giftCards.filter(g => g.status === "active");
  const usedCards = giftCards.filter(g => g.status !== "active");
  const totalActiveBalance = activeCards.reduce((a, g) => a + parseFloat(g.balance || 0), 0);

  return (
    <div style={{ ...s.page, animation: "fadeIn .3s ease" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <button onClick={() => setView(VIEW.HOME)} style={{ background: "none", border: "none", color: C.gold, fontSize: 14, cursor: "pointer", padding: 0 }}>← Home</button>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h2 style={s.h2}>Gift Cards</h2>
        <div style={{ fontSize: 11, color: C.muted }}>{giftCards.length} total</div>
      </div>

      {/* Summary card */}
      <div style={{ background: "linear-gradient(135deg,#5D7B4E,#7B9E6B)", borderRadius: 12, padding: 20, color: "#fff", marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,.8)", textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 600, marginBottom: 4 }}>✦ Active Balance</div>
        <div style={{ fontFamily: FONT.h, fontSize: 32, fontWeight: 700 }}>${totalActiveBalance.toFixed(0)}</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,.75)", marginTop: 4 }}>
          across {activeCards.length} active card{activeCards.length === 1 ? "" : "s"}
        </div>
      </div>

      {/* Purchase CTA */}
      <button onClick={() => setPurchasing(true)} style={{ ...s.btn, background: "#7B9E6B", marginBottom: 20 }}>
        + Buy Gift Card
      </button>

      {/* Active cards */}
      <h3 style={s.h3}>Active</h3>
      {activeCards.length === 0 ? (
        <div style={{ ...s.card, padding: 24, textAlign: "center", color: C.muted, fontSize: 13 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>💳</div>
          <div style={{ fontWeight: 500, color: C.text, marginBottom: 4 }}>No active gift cards</div>
          <div style={{ fontSize: 11 }}>Tap &ldquo;Buy Gift Card&rdquo; above to purchase one for yourself or as a gift.</div>
        </div>
      ) : (
        activeCards.map(g => <GiftCardDisplay key={g.id} card={g} onRedeem={() => setShowRedeemForCard(g)} />)
      )}

      {/* History */}
      {usedCards.length > 0 && (
        <>
          <h3 style={{ ...s.h3, marginTop: 20 }}>History</h3>
          {usedCards.map(g => <GiftCardDisplay key={g.id} card={g} onRedeem={null} />)}
        </>
      )}

      {/* Purchase modal */}
      {purchasing && (
        <PurchaseGiftCardModal
          member={member}
          onClose={() => { setPurchasing(false); reload(); }}
        />
      )}

      {/* Redemption modal */}
      {showRedeemForCard && (
        <RedeemGiftCardModal
          card={showRedeemForCard}
          member={member}
          onClose={() => { setShowRedeemForCard(null); reload(); }}
        />
      )}
    </div>
  );
}

// ─── U06: Single gift card display ───
function GiftCardDisplay({ card, onRedeem }) {
  const isActive = card.status === "active";
  const isRedeemed = card.status === "redeemed";
  const balancePct = card.denomination > 0 ? (parseFloat(card.balance) / parseFloat(card.denomination)) * 100 : 0;

  return (
    <div style={{
      background: isActive
        ? "linear-gradient(135deg,#A7C49A,#7B9E6B)"
        : "linear-gradient(135deg,#ccc,#aaa)",
      borderRadius: 14, padding: 18, marginBottom: 12,
      color: "#fff", position: "relative", overflow: "hidden",
      boxShadow: "0 2px 12px rgba(0,0,0,.08)",
      opacity: isActive ? 1 : 0.7,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, opacity: 0.8, textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 600 }}>1-Group Gift Card</div>
          <div style={{ fontFamily: FONT.m, fontSize: 13, marginTop: 4, letterSpacing: 1, opacity: 0.95 }}>{card.code}</div>
        </div>
        <span style={{
          fontSize: 9.5, fontWeight: 600, padding: "3px 10px", borderRadius: 8,
          background: "rgba(255,255,255,.25)", color: "#fff",
          textTransform: "uppercase", letterSpacing: 0.8,
        }}>{card.status}</span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, opacity: 0.8, textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 600 }}>Balance</div>
          <div style={{ fontFamily: FONT.h, fontSize: 28, fontWeight: 700 }}>${parseFloat(card.balance).toFixed(0)}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, opacity: 0.7 }}>of ${parseFloat(card.denomination).toFixed(0)} original</div>
          {card.recipient && card.recipient !== "Self" && <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>To: {card.recipient}</div>}
        </div>
      </div>

      {/* Balance bar */}
      <div style={{ height: 5, background: "rgba(255,255,255,.2)", borderRadius: 3, overflow: "hidden", marginBottom: 10 }}>
        <div style={{ width: `${balancePct}%`, height: "100%", background: "#fff" }} />
      </div>

      {isActive && onRedeem && (
        <button onClick={onRedeem} style={{ width: "100%", background: "rgba(255,255,255,.2)", border: "1px solid rgba(255,255,255,.3)", color: "#fff", padding: "10px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT.b }}>
          Show QR to redeem
        </button>
      )}
      {isRedeemed && (
        <div style={{ fontSize: 11, opacity: 0.7, textAlign: "center", paddingTop: 4 }}>Fully redeemed</div>
      )}
    </div>
  );
}

// ─── U06: Purchase gift card modal ───
function PurchaseGiftCardModal({ member, onClose }) {
  const [denomination, setDenomination] = useState(50);
  const [customDenom, setCustomDenom] = useState("");
  const [recipientMode, setRecipientMode] = useState("self"); // 'self' | 'someone'
  const [recipientName, setRecipientName] = useState("");
  const [phase, setPhase] = useState("picking"); // 'picking' | 'processing' | 'success' | 'error'
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  const presets = [50, 100, 250, 500, 1000];
  const finalDenom = customDenom ? parseFloat(customDenom) : denomination;

  const purchase = async () => {
    if (!finalDenom || finalDenom < 10) { alert("Minimum gift card value is $10"); return; }
    if (finalDenom > 10000) { alert("Maximum gift card value is $10,000"); return; }
    if (recipientMode === "someone" && !recipientName.trim()) { alert("Enter recipient name"); return; }

    setPhase("processing");
    try {
      // Generate a unique gift card ID (g-prefix + timestamp suffix)
      const gid = "g" + Date.now().toString(36).toUpperCase();
      // Generate a readable gift card code: 1G-XXXX-XXXX
      const codeChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      const seg = () => Array.from({ length: 4 }, () => codeChars[Math.floor(Math.random() * codeChars.length)]).join("");
      const code = `1G-${seg()}-${seg()}`;

      const body = {
        id: gid,
        code,
        denomination: finalDenom,
        balance: finalDenom,
        purchaser: member.name,
        purchaser_id: member.id,
        recipient: recipientMode === "self" ? "Self" : recipientName.trim(),
        status: "active",
      };
      const r = await supaFetch("gift_cards", { method: "POST", body });
      if (!Array.isArray(r) || !r[0]) throw new Error("Gift card creation failed");
      const card = r[0];

      // Transaction log
      await supaFetch("transactions", {
        method: "POST",
        body: {
          member_id: member.id,
          venue: "1-Insider Rewards",
          amount: finalDenom,
          points: 0,
          type: "adjust",
          reward_name: `Purchased $${finalDenom} gift card (${code})`,
          note: recipientMode === "self" ? null : `For ${recipientName.trim()}`,
        },
      });

      setResult(card);
      setPhase("success");
    } catch (e) {
      console.error("Purchase failed:", e);
      setErrorMsg(e.message || "Unable to process purchase. Please try again.");
      setPhase("error");
    }
  };

  return (
    <div style={s.modal} onClick={() => phase !== "processing" && onClose()}>
      <div style={{ ...s.modalInner, maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        {phase === "picking" && (
          <>
            <h3 style={{ fontFamily: FONT.h, fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Buy a Gift Card</h3>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>Redeemable at any 1-Group venue. Never expires.</div>

            {/* Denomination */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 10.5, color: C.lmuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, display: "block" }}>Amount</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {presets.map(p => (
                  <label key={p} style={{
                    border: "1.5px solid " + (!customDenom && denomination === p ? C.gold : "#ddd"),
                    borderRadius: 8, padding: "10px 6px", cursor: "pointer", textAlign: "center",
                    background: !customDenom && denomination === p ? "#FDF8EE" : "#fff",
                    fontSize: 14, fontWeight: 600,
                  }}>
                    <input type="radio" checked={!customDenom && denomination === p} onChange={() => { setDenomination(p); setCustomDenom(""); }} style={{ display: "none" }} />
                    ${p}
                  </label>
                ))}
              </div>
              <div style={{ marginTop: 8 }}>
                <input type="number" min="10" max="10000" placeholder="Or custom amount ($10–$10,000)"
                  value={customDenom} onChange={e => setCustomDenom(e.target.value)}
                  style={{ ...s.input, fontSize: 13 }} />
              </div>
            </div>

            {/* Recipient */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 10.5, color: C.lmuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, display: "block" }}>Recipient</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[{ id: "self", label: "For me" }, { id: "someone", label: "As a gift" }].map(r => (
                  <label key={r.id} style={{
                    border: "1.5px solid " + (recipientMode === r.id ? C.gold : "#ddd"),
                    borderRadius: 8, padding: "10px 6px", cursor: "pointer", textAlign: "center",
                    background: recipientMode === r.id ? "#FDF8EE" : "#fff",
                    fontSize: 13, fontWeight: 500,
                  }}>
                    <input type="radio" checked={recipientMode === r.id} onChange={() => setRecipientMode(r.id)} style={{ display: "none" }} />
                    {r.label}
                  </label>
                ))}
              </div>
              {recipientMode === "someone" && (
                <input type="text" placeholder="Recipient name"
                  value={recipientName} onChange={e => setRecipientName(e.target.value)}
                  style={{ ...s.input, fontSize: 13, marginTop: 8 }} />
              )}
            </div>

            <div style={{ background: "#FFF8E1", border: "1px solid #FFE082", borderRadius: 8, padding: 10, fontSize: 10.5, color: "#5D4037", marginBottom: 14, lineHeight: 1.5 }}>
              ⚠️ Demo mode: purchase will create a live gift card in your wallet but Stripe is not wired in. No real charge is made.
            </div>

            <button onClick={purchase} style={{ ...s.btn, background: "#7B9E6B", marginBottom: 8 }}>
              Purchase ${finalDenom || 0} gift card
            </button>
            <button onClick={onClose} style={s.btnOutline}>Cancel</button>
          </>
        )}

        {phase === "processing" && (
          <div style={{ textAlign: "center", padding: "30px 0" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <div style={{ fontSize: 14, color: C.muted }}>Processing your purchase…</div>
          </div>
        )}

        {phase === "success" && result && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✨</div>
            <h3 style={{ fontFamily: FONT.h, fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Gift Card Created</h3>
            <div style={{ fontFamily: FONT.h, fontSize: 28, fontWeight: 700, color: "#7B9E6B", marginBottom: 4 }}>${parseFloat(result.denomination).toFixed(0)}</div>
            <div style={{ ...s.mono, fontSize: 12, color: C.muted, marginBottom: 14, letterSpacing: 1.5 }}>{result.code}</div>
            {result.recipient !== "Self" && <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>For {result.recipient}</div>}
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 16 }}>{result.recipient === "Self" ? "Added to your gift card wallet." : "You can share the code and QR with the recipient from your wallet."}</div>
            <button onClick={onClose} style={{ ...s.btn, background: "#7B9E6B" }}>Done</button>
          </div>
        )}

        {phase === "error" && (
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>❌</div>
            <h3 style={{ fontFamily: FONT.h, fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Purchase failed</h3>
            <div style={{ fontSize: 13, color: "#D32F2F", marginBottom: 20 }}>{errorMsg}</div>
            <button onClick={onClose} style={s.btn}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── U06: Redeem gift card via QR modal ───
function RedeemGiftCardModal({ card, member, onClose }) {
  const [redeemAmount, setRedeemAmount] = useState(Math.min(parseFloat(card.balance), 50));
  const [phase, setPhase] = useState("picking"); // 'picking' | 'qr' | 'redeeming' | 'redeemed' | 'error'
  const [errorMsg, setErrorMsg] = useState("");
  const [nonce] = useState(() => Array.from({ length: 12 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join(""));

  const balanceNum = parseFloat(card.balance);
  const qrPayload = JSON.stringify({ v: 1, type: "giftcard", gid: card.id, code: card.code, bal: balanceNum, amt: redeemAmount, mid: member.id, n: nonce });
  const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=0&data=${encodeURIComponent(qrPayload)}`;

  const markRedeemed = async () => {
    const amt = parseFloat(redeemAmount);
    if (!amt || amt <= 0) { alert("Enter a valid amount"); return; }
    if (amt > balanceNum) { alert(`Cannot redeem $${amt} — balance is only $${balanceNum}`); return; }

    setPhase("redeeming");
    try {
      const newBalance = balanceNum - amt;
      const newStatus = newBalance <= 0.01 ? "redeemed" : "active";

      await supaFetch(`gift_cards?id=eq.${card.id}`, {
        method: "PATCH",
        body: { balance: newBalance, status: newStatus },
      });
      await supaFetch("transactions", {
        method: "POST",
        body: {
          member_id: member.id,
          venue: "1-Insider Rewards",
          amount: amt,
          points: 0,
          type: "redeem",
          reward_name: `Gift card redemption: $${amt} (${card.code})`,
          note: `Balance: $${newBalance.toFixed(2)} remaining · nonce ${nonce}`,
        },
      });
      setPhase("redeemed");
    } catch (e) {
      console.error("Redemption failed:", e);
      setErrorMsg(e.message || "Unable to mark as redeemed.");
      setPhase("error");
    }
  };

  return (
    <div style={s.modal} onClick={() => phase !== "redeeming" && onClose()}>
      <div style={{ ...s.modalInner, maxWidth: 360 }} onClick={e => e.stopPropagation()}>
        {phase === "picking" && (
          <>
            <h3 style={{ fontFamily: FONT.h, fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Redeem Gift Card</h3>
            <div style={{ ...s.mono, fontSize: 11, color: C.muted, marginBottom: 2, letterSpacing: 1 }}>{card.code}</div>
            <div style={{ fontSize: 13, color: C.text, marginBottom: 16 }}>Balance: <strong>${balanceNum.toFixed(2)}</strong></div>

            <label style={{ fontSize: 10.5, color: C.lmuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Amount to redeem</label>
            <input type="number" step="0.01" min="0.01" max={balanceNum} style={{ ...s.input, marginTop: 4, marginBottom: 16, ...s.mono, fontSize: 18, textAlign: "center" }}
              value={redeemAmount} onChange={e => setRedeemAmount(e.target.value)} />

            <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
              {[10, 25, 50, 100].filter(n => n <= balanceNum).map(n => (
                <button key={n} onClick={() => setRedeemAmount(n)} style={{ ...s.btnSm, background: "#f5f5f5", color: "#555", fontSize: 11, padding: "6px 12px" }}>${n}</button>
              ))}
              <button onClick={() => setRedeemAmount(balanceNum)} style={{ ...s.btnSm, background: "#f5f5f5", color: "#555", fontSize: 11, padding: "6px 12px" }}>Full ${balanceNum.toFixed(0)}</button>
            </div>

            <button onClick={() => setPhase("qr")} disabled={!redeemAmount || parseFloat(redeemAmount) <= 0 || parseFloat(redeemAmount) > balanceNum} style={{ ...s.btn, background: "#7B9E6B", marginBottom: 8, opacity: (!redeemAmount || parseFloat(redeemAmount) <= 0 || parseFloat(redeemAmount) > balanceNum) ? 0.4 : 1 }}>
              Generate QR
            </button>
            <button onClick={onClose} style={s.btnOutline}>Cancel</button>
          </>
        )}

        {phase === "qr" && (
          <>
            <div style={{ textAlign: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: "#7B9E6B", textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 600, marginBottom: 4 }}>✦ Show to venue staff</div>
              <div style={{ fontFamily: FONT.h, fontSize: 22, fontWeight: 700 }}>${parseFloat(redeemAmount).toFixed(0)} Redemption</div>
              <div style={{ ...s.mono, fontSize: 11, color: C.muted, marginTop: 2, letterSpacing: 1 }}>{card.code}</div>
            </div>
            <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 12, padding: 16, textAlign: "center", marginBottom: 14 }}>
              <img src={qrImgUrl} alt="Gift card QR" style={{ width: 220, height: 220, display: "block", margin: "0 auto" }}
                onError={e => { e.target.style.display = "none"; e.target.nextSibling.style.display = "block"; }} />
              <div style={{ display: "none", padding: 30, fontSize: 11, color: C.muted }}>
                QR image failed to load. Nonce:<br />
                <div style={{ ...s.mono, marginTop: 8, fontSize: 10, wordBreak: "break-all", background: "#f5f5f5", padding: 10, borderRadius: 6 }}>{nonce}</div>
              </div>
            </div>
            <div style={{ fontSize: 10.5, color: C.muted, textAlign: "center", marginBottom: 14, lineHeight: 1.5 }}>
              Staff will scan this QR. After scanning, tap &ldquo;Mark as redeemed&rdquo; to deduct ${parseFloat(redeemAmount).toFixed(0)} from your balance.
            </div>
            <button onClick={markRedeemed} style={{ ...s.btn, background: "#7B9E6B", marginBottom: 8 }}>Mark as redeemed (demo)</button>
            <button onClick={() => setPhase("picking")} style={s.btnOutline}>Back</button>
          </>
        )}

        {phase === "redeeming" && (
          <div style={{ textAlign: "center", padding: "30px 0" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <div style={{ fontSize: 14 }}>Processing redemption…</div>
          </div>
        )}

        {phase === "redeemed" && (
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <h3 style={{ fontFamily: FONT.h, fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Redeemed</h3>
            <div style={{ fontSize: 13, color: C.text, marginBottom: 4 }}>${parseFloat(redeemAmount).toFixed(0)} deducted from your gift card</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 20 }}>Remaining balance: ${(balanceNum - parseFloat(redeemAmount)).toFixed(2)}</div>
            <button onClick={onClose} style={{ ...s.btn, background: "#7B9E6B" }}>Done</button>
          </div>
        )}

        {phase === "error" && (
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>❌</div>
            <h3 style={{ fontFamily: FONT.h, fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Redemption failed</h3>
            <div style={{ fontSize: 13, color: "#D32F2F", marginBottom: 20 }}>{errorMsg}</div>
            <button onClick={onClose} style={s.btn}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Profile({ member, tiers, signOut, reload }) {
  var tier = TIER[member.tier] || TIER.silver;
  var info = TIER_INFO[member.tier] || TIER_INFO.silver;
  var isDark = ["platinum", "corporate"].includes(member.tier);

  // U11 state — upgrade modal
  const [upgradeTarget, setUpgradeTarget] = useState(null); // the target tier row when modal is open
  const [upgradePhase, setUpgradePhase] = useState("picking"); // picking | processing | success | error
  const [upgradeError, setUpgradeError] = useState("");

  // Work out upgrade options from live tiers data
  const tierOrder = ["silver", "gold", "platinum"];
  const currentIdx = tierOrder.indexOf(member.tier);
  const availableUpgrades = (tiers || []).filter(t => {
    const idx = tierOrder.indexOf(t.id);
    return idx > currentIdx && idx >= 0;
  }).sort((a, b) => tierOrder.indexOf(a.id) - tierOrder.indexOf(b.id));

  // Build an impact-diff between current tier and target for the upgrade modal
  const diffForTarget = (target) => {
    if (!target) return [];
    const currentTier = (tiers || []).find(t => t.id === member.tier) || {};
    const changes = [];
    if ((currentTier.earn_multiplier || 1) !== target.earn_multiplier) {
      changes.push({
        label: "Earn rate",
        from: `${(currentTier.earn_multiplier || 1)}× ($1 = ${currentTier.earn_multiplier || 1} pts)`,
        to: `${target.earn_multiplier}× ($1 = ${target.earn_multiplier} pts)`,
      });
    }
    if ((currentTier.birthday_discount_pct || 0) !== target.birthday_discount_pct) {
      changes.push({ label: "Birthday discount", from: `${currentTier.birthday_discount_pct || 0}%`, to: `${target.birthday_discount_pct}%` });
    }
    if ((currentTier.voucher_count || 0) !== target.voucher_count || (currentTier.voucher_value || 0) !== target.voucher_value) {
      changes.push({
        label: "Dining vouchers",
        from: currentTier.voucher_count ? `${currentTier.voucher_count}×$${currentTier.voucher_value}` : "None",
        to: `${target.voucher_count}×$${target.voucher_value}`,
      });
    }
    if (!currentTier.non_stop_hits && target.non_stop_hits) {
      changes.push({ label: "Non-Stop Hits", from: "Not included", to: "Unlimited voucher refill" });
    }
    return changes;
  };

  const confirmUpgrade = async () => {
    if (!upgradeTarget) return;
    setUpgradePhase("processing");
    setUpgradeError("");
    try {
      // Compute new expiry — 1 year from today
      const newExpiry = new Date();
      newExpiry.setFullYear(newExpiry.getFullYear() + 1);
      const expiryIso = newExpiry.toISOString();

      await supaFetch(`members?id=eq.${member.id}`, {
        method: "PATCH",
        body: { tier: upgradeTarget.id, membership_expiry: expiryIso },
      });

      // Transaction log — the upgrade itself
      await supaFetch("transactions", {
        method: "POST",
        body: {
          member_id: member.id,
          venue: "1-Insider Rewards",
          amount: parseFloat(upgradeTarget.annual_fee || 0),
          points: 0,
          type: "adjust",
          reward_name: `Tier upgrade: ${member.tier} → ${upgradeTarget.id}`,
          note: `$${upgradeTarget.annual_fee}/yr · expires ${newExpiry.toLocaleDateString("en-SG")}`,
        },
      });

      setUpgradePhase("success");
    } catch (e) {
      console.error("Upgrade failed:", e);
      setUpgradeError(e.message || "Unable to complete upgrade");
      setUpgradePhase("error");
    }
  };

  const closeUpgradeModal = () => {
    setUpgradeTarget(null);
    setUpgradePhase("picking");
    setUpgradeError("");
    if (reload) reload();
  };

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
      </div>

      {/* U11: Upgrade CTAs — only for self-service tiers (silver/gold) */}
      {availableUpgrades.length > 0 && ["silver", "gold"].includes(member.tier) && (
        <>
          <h3 style={s.h3}>Upgrade Your Tier</h3>
          {availableUpgrades.map(target => {
            const targetTheme = TIER[target.id] || TIER.silver;
            const dark = ["platinum", "corporate"].includes(target.id);
            const changes = diffForTarget(target);
            return (
              <div key={target.id}
                onClick={() => { setUpgradeTarget(target); setUpgradePhase("picking"); }}
                style={{
                  background: targetTheme.grad,
                  borderRadius: 14, padding: 18, marginBottom: 12,
                  color: dark ? "#fff" : C.text,
                  cursor: "pointer", position: "relative",
                  boxShadow: "0 2px 12px rgba(0,0,0,.08)",
                  transition: "transform .15s",
                }}
                onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
                onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, opacity: 0.8, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 600 }}>Upgrade to</div>
                    <div style={{ fontFamily: FONT.h, fontSize: 22, fontWeight: 700 }}>{target.name}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: FONT.h, fontSize: 22, fontWeight: 700 }}>${target.annual_fee}</div>
                    <div style={{ fontSize: 10, opacity: 0.7 }}>per year</div>
                  </div>
                </div>
                {changes.length > 0 && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,.2)" }}>
                    <div style={{ fontSize: 10, opacity: 0.75, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, fontWeight: 600 }}>What you gain</div>
                    {changes.slice(0, 3).map((c, i) => (
                      <div key={i} style={{ fontSize: 11, marginBottom: 3, opacity: 0.95 }}>
                        <strong>{c.label}:</strong> <span style={{ opacity: 0.75 }}>{c.from}</span> → <span style={{ fontWeight: 600 }}>{c.to}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: 12, fontSize: 11, opacity: 0.9, fontWeight: 600, letterSpacing: 0.5 }}>Tap to upgrade →</div>
              </div>
            );
          })}
        </>
      )}

      {/* Informational state for Platinum members (top tier, no upgrade) */}
      {member.tier === "platinum" && (
        <div style={{ ...s.card, background: "linear-gradient(135deg,#2D2D2D,#1a1a1a)", color: "#fff", textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✦</div>
          <div style={{ fontFamily: FONT.h, fontSize: 16, fontWeight: 600, marginBottom: 4 }}>You&apos;re at our highest tier</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>Thank you for being a Platinum member. Enjoy every visit.</div>
        </div>
      )}

      {/* Informational state for Corporate/Staff */}
      {["corporate", "staff"].includes(member.tier) && (
        <div style={{ ...s.card, fontSize: 12, color: C.muted, textAlign: "center" }}>
          {member.tier === "corporate" ? "Corporate tier is managed by your account manager — contact them to change your plan." : "Staff tier is managed by 1-Group HR — contact your manager for changes."}
        </div>
      )}

      <button onClick={signOut} style={{ ...s.btnOutline, marginTop: 16, color: "#D32F2F", borderColor: "#D32F2F" }}>Sign Out</button>

      {/* U11: Upgrade confirmation modal (demo Stripe flow) */}
      {upgradeTarget && (
        <div style={s.modal} onClick={() => upgradePhase !== "processing" && closeUpgradeModal()}>
          <div style={{ ...s.modalInner, maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            {upgradePhase === "picking" && (
              <>
                <h3 style={{ fontFamily: FONT.h, fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Upgrade to {upgradeTarget.name}</h3>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>Your tier will upgrade immediately. Billing is annual.</div>

                {/* Cost summary */}
                <div style={{ background: "#FDF8EE", borderRadius: 10, padding: 14, marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: C.muted }}>Annual fee</span>
                    <span style={{ fontWeight: 600, fontSize: 14, fontFamily: FONT.h }}>${upgradeTarget.annual_fee}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: C.muted }}>New expiry</span>
                    <span style={{ fontWeight: 500, fontSize: 12 }}>
                      {(() => {
                        const d = new Date(); d.setFullYear(d.getFullYear() + 1);
                        return d.toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });
                      })()}
                    </span>
                  </div>
                </div>

                {/* What you gain */}
                {diffForTarget(upgradeTarget).length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 10.5, color: C.lmuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>What changes</div>
                    {diffForTarget(upgradeTarget).map((c, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: i < diffForTarget(upgradeTarget).length - 1 ? "1px solid #f5f5f5" : "none", fontSize: 12 }}>
                        <span style={{ color: C.muted }}>{c.label}</span>
                        <span style={{ textAlign: "right" }}>
                          <span style={{ color: C.lmuted, fontSize: 11 }}>{c.from}</span>
                          <span style={{ margin: "0 6px", color: C.gold }}>→</span>
                          <span style={{ fontWeight: 600 }}>{c.to}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ background: "#FFF8E1", border: "1px solid #FFE082", borderRadius: 8, padding: 10, fontSize: 10.5, color: "#5D4037", marginBottom: 14, lineHeight: 1.5 }}>
                  ⚠️ Demo mode: upgrade is processed immediately but Stripe is not wired in. No real charge is made. Your tier will update across the portal and admin dashboard.
                </div>

                <button onClick={confirmUpgrade} style={{ ...s.btn, marginBottom: 8 }}>
                  Confirm ${upgradeTarget.annual_fee} upgrade
                </button>
                <button onClick={closeUpgradeModal} style={s.btnOutline}>Cancel</button>
              </>
            )}

            {upgradePhase === "processing" && (
              <div style={{ textAlign: "center", padding: "30px 0" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
                <div style={{ fontSize: 14, color: C.muted }}>Processing upgrade…</div>
              </div>
            )}

            {upgradePhase === "success" && (
              <div style={{ textAlign: "center", padding: "10px 0" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>✨</div>
                <h3 style={{ fontFamily: FONT.h, fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Welcome to {upgradeTarget.name}</h3>
                <div style={{ fontSize: 13, color: C.text, marginBottom: 4 }}>Your tier has been upgraded immediately.</div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 20 }}>Explore your new benefits on the next visit.</div>
                <button onClick={closeUpgradeModal} style={s.btn}>Done</button>
              </div>
            )}

            {upgradePhase === "error" && (
              <div style={{ textAlign: "center", padding: "10px 0" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>❌</div>
                <h3 style={{ fontFamily: FONT.h, fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Upgrade failed</h3>
                <div style={{ fontSize: 13, color: "#D32F2F", marginBottom: 20 }}>{upgradeError}</div>
                <button onClick={closeUpgradeModal} style={s.btn}>Close</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
