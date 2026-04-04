import { useState, useEffect, useRef } from "react";
import { createClient } from '@supabase/supabase-js';

// ─── SUPABASE CLIENT (same DB as admin dashboard) ────────────────────────────
const supabase = createClient(
  'https://tobtmtshxgpkkucsaxyk.supabase.co',
  'sb_publishable_M_yQLmU_5yc0yTccm4F_oA_xWKyTqx9'
);

const db = {
  async getMembers() {
    const { data } = await supabase.from('members').select('*').order('id');
    return (data || []).map(r => ({ id:r.id, name:r.name, mobile:r.mobile, email:r.email, tier:r.tier, points:r.points, totalSpend:Number(r.total_spend), categoryPref:r.category_pref, birthdayMonth:r.birthday_month, signupDate:r.signup_date, lastVisit:r.last_visit, visits:r.visits, favouriteVenue:r.favourite_venue }));
  },
  async getRewards() {
    const { data } = await supabase.from('rewards').select('*').order('name');
    return (data || []).map(r => ({ id:r.id, name:r.name, desc:r.description, category:r.category, tiers:r.tiers, venues:r.venues, cost:Number(r.cost), pointsCost:r.points_cost, active:r.active, redemptions:r.redemptions }));
  },
  async getTiers() {
    const { data } = await supabase.from('tiers').select('*').order('threshold');
    return (data || []).map(r => ({ id:r.id, name:r.name, hex:r.hex, bg:r.bg, threshold:r.threshold, earn:Number(r.earn), benefits:r.benefits }));
  },
  async getTransactions(memberId) {
    const { data } = await supabase.from('transactions').select('*').eq('member_id', memberId).order('created_at', { ascending: false }).limit(20);
    return (data || []).map(r => ({ id:r.id, date:r.created_at, venue:r.venue, venueId:r.venue_id, amount:Number(r.amount), points:r.points, type:r.type, reward:r.reward_name }));
  },
  async redeemReward(memberId, reward, currentPoints) {
    const newPoints = Math.max(0, currentPoints - reward.pointsCost);
    await supabase.from('members').update({ points: newPoints }).eq('id', memberId);
    await supabase.from('rewards').update({ redemptions: (reward.redemptions || 0) + 1 }).eq('id', reward.id);
    await supabase.from('transactions').insert({ member_id: memberId, venue: '1-Insider Rewards', points: -reward.pointsCost, type: 'redeem', reward_name: reward.name, amount: 0 });
    return newPoints;
  },
};

// ─── SHARED DATA (mirrors admin dashboard) ───────────────────────────────────
const VENUES = [
  { id:"oumi", name:"Oumi", cat:"Restaurants", loc:"CapitaSpring Lvl 51", cuisine:"Modern Japanese Omakase", img:"🏯" },
  { id:"kaarla", name:"Kaarla", cat:"Restaurants", loc:"CapitaSpring Lvl 51", cuisine:"Modern Australian", img:"🌿" },
  { id:"solluna", name:"Sol & Luna", cat:"Restaurants", loc:"CapitaSpring Lvl 51", cuisine:"Mediterranean", img:"☀️" },
  { id:"camille", name:"Camille", cat:"Restaurants", loc:"CapitaSpring Lvl 51", cuisine:"French", img:"🥐" },
  { id:"fire", name:"FIRE", cat:"Restaurants", loc:"One Fullerton", cuisine:"Modern Grill", img:"🔥" },
  { id:"monti", name:"Monti", cat:"Restaurants", loc:"Fullerton Pavilion", cuisine:"Italian", img:"⛵" },
  { id:"flnt", name:"FLNT", cat:"Restaurants", loc:"CapitaSpring Lvl 51", cuisine:"Flint-fired Contemporary", img:"🪨" },
  { id:"botanico", name:"Botanico", cat:"Restaurants", loc:"Botanic Gardens", cuisine:"Modern European", img:"🌺" },
  { id:"mimi", name:"Mimi", cat:"Restaurants", loc:"Clarke Quay", cuisine:"Pan-Asian", img:"🎋" },
  { id:"una", name:"UNA", cat:"Restaurants", loc:"Rochester Commons", cuisine:"Italian", img:"🍝" },
  { id:"yang", name:"Yang", cat:"Restaurants", loc:"1-Altitude", cuisine:"Contemporary Asian", img:"🎎" },
  { id:"zorba", name:"Zorba", cat:"Restaurants", loc:"The Summerhouse", cuisine:"Greek", img:"🫒" },
  { id:"alfaro", name:"1-Alfaro", cat:"Restaurants", loc:"Raffles Place", cuisine:"Spanish", img:"🇪🇸" },
  { id:"coast", name:"1-Altitude Coast", cat:"Bars", loc:"One Fullerton Rooftop", cuisine:null, img:"🌊" },
  { id:"arden", name:"1-Arden Bar", cat:"Bars", loc:"CapitaSpring", cuisine:null, img:"🍸" },
  { id:"1918", name:"1918 Heritage Bar", cat:"Bars", loc:"The Riverhouse", cuisine:null, img:"🥃" },
  { id:"solora", name:"Sol & Ora", cat:"Bars", loc:"CapitaSpring", cuisine:null, img:"✨" },
  { id:"pixies", name:"Pixies", cat:"Bars", loc:"Portfolio", cuisine:null, img:"🧚" },
  { id:"wsbar", name:"Wildseed Bar", cat:"Bars", loc:"The Summerhouse", cuisine:null, img:"🌾" },
  { id:"wscafe", name:"Wildseed Cafe", cat:"Cafés", loc:"The Summerhouse", cuisine:null, img:"☕" },
  { id:"wsbg", name:"Wildseed Bar & Grill", cat:"Cafés", loc:"The Summerhouse", cuisine:null, img:"🌿" },
  { id:"ilg", name:"Il Giardino", cat:"Cafés", loc:"Botanic Gardens", cuisine:null, img:"🌳" },
  { id:"melaka", name:"1-Altitude Melaka", cat:"Bars", loc:"Melaka, Malaysia", cuisine:null, img:"🏝️" },
];

const TIERS_DEFAULT = [
  { id:"silver", name:"Silver", hex:"#C0C0C0", bg:"#F5F5F5", threshold:0, earn:1.0, benefits:["1 point per $1 spent","Birthday dessert or drink","Monthly category rewards","Gift card access","Cross-venue earning"] },
  { id:"gold", name:"Gold", hex:"#C5A258", bg:"#FDF8EE", threshold:3000, earn:1.5, benefits:["1.5× points multiplier","Priority reservations","Upgraded birthday rewards","Exclusive event invitations","Complimentary welcome drink","All Silver benefits"] },
  { id:"platinum", name:"Platinum", hex:"#6B6B6B", bg:"#2D2D2D", threshold:8000, earn:2.0, benefits:["2× points multiplier","VIP table reservations","Premium birthday experience","Personal concierge service","Chef's table access","Partner lifestyle benefits","All Gold benefits"] },
];

const CATEGORIES = [
  { id:"cafes", name:"Cafés", icon:"☕", color:"#7B9E6B", desc:"Brunches, bakes & laid-back catchups", rewards:["Free pastry with brunch","Upgrade to premium set","Complimentary coffee flight"] },
  { id:"restaurants", name:"Restaurants", icon:"🍽️", color:"#B85C38", desc:"Sky-high dining to elegant dinners", rewards:["Complimentary dessert","Wine pairing upgrade","Chef's amuse-bouche"] },
  { id:"bars", name:"Bars", icon:"🍸", color:"#6B4E8B", desc:"Cocktails, nightcaps & rooftop nights", rewards:["Signature cocktail","Bar snack platter","Sunset drinks package"] },
  { id:"wines", name:"Wines", icon:"🍷", color:"#8B2252", desc:"Swirl, sip & savour curated vintages", rewards:["Wine flight tasting","Bottle upgrade","Sommelier's selection"] },
];

// ─── SEED DATA now lives in Supabase (schema.sql) ───────────────────────────

// ─── UTILS ───────────────────────────────────────────────────────────────────
const fmtNum = n => new Intl.NumberFormat('en-SG').format(n);
const fmtCur = n => `$${new Intl.NumberFormat('en-SG',{minimumFractionDigits:0}).format(n)}`;
const fmtDate = d => new Date(d).toLocaleDateString('en-SG',{day:'numeric',month:'short',year:'numeric'});
const normPhone = p => p.replace(/[\s\-\+]/g,'').replace(/^65/,'');

// Generate plausible transaction history from member data
const generateTransactions = (member) => {
  const venuePool = VENUES.filter(v => v.cat === (CATEGORIES.find(c=>c.id===member.categoryPref)?.name || 'Restaurants') || v.id === member.favouriteVenue);
  const tier = TIERS_DEFAULT.find(t => t.id === member.tier);
  const txCount = Math.min(member.visits, 10);
  const txs = [];
  let d = new Date(member.lastVisit);
  for (let i = 0; i < txCount; i++) {
    const venue = venuePool[Math.floor(Math.random() * venuePool.length)] || VENUES[0];
    const amount = Math.floor(Math.random() * 300 + 60);
    const pts = Math.round(amount * (tier?.earn || 1));
    txs.push({ date: d.toISOString(), venue: venue.name, venueId: venue.id, amount, points: pts, type: "earn" });
    d = new Date(d.getTime() - Math.floor(Math.random() * 10 + 3) * 86400000);
    // Sprinkle in a redemption every few transactions
    if (i === 3 || i === 7) {
      txs.push({ date: d.toISOString(), venue: venue.name, venueId: venue.id, amount: 0, points: -Math.floor(Math.random() * 600 + 400), type: "redeem", reward: "Reward Redeemed" });
      d = new Date(d.getTime() - 86400000 * 2);
    }
  }
  return txs;
};

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function OneInsiderMemberPortal() {
  const [view, setView] = useState("landing");
  const [member, setMember] = useState(null);
  const [allMembers, setAllMembers] = useState([]);
  const [allRewards, setAllRewards] = useState([]);
  const [allTiers, setAllTiers] = useState(TIERS_DEFAULT);
  const [dataReady, setDataReady] = useState(false);
  const [portalTab, setPortalTab] = useState("home");
  const [signinStep, setSigninStep] = useState(0);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["","","","","",""]);
  const [signinError, setSigninError] = useState("");
  const [matchedMember, setMatchedMember] = useState(null);
  const [scrollY, setScrollY] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [redeemModal, setRedeemModal] = useState(null);
  const [redeemSuccess, setRedeemSuccess] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const otpRefs = useRef([]);

  // ─── LOAD FROM SUPABASE ON MOUNT ─────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setAllMembers(await db.getMembers());
      setAllRewards(await db.getRewards());
      const t = await db.getTiers();
      if (t.length > 0) setAllTiers(t);
      setDataReady(true);
    })();
  }, []);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY || 0);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ─── SIGN-IN LOGIC ─────────────────────────────────────────────────────────
  const handleSignIn = () => { setView("signin"); setSigninStep(0); setPhone(""); setOtp(["","","","","",""]); setSigninError(""); setMatchedMember(null); };
  const handleJoin = () => handleSignIn();

  const handlePhoneSubmit = () => {
    const cleaned = normPhone(phone);
    if (cleaned.length < 7) { setSigninError("Please enter a valid mobile number"); return; }
    // Search shared storage for matching member
    const found = allMembers.find(m => normPhone(m.mobile) === cleaned || normPhone(m.mobile).endsWith(cleaned) || cleaned.endsWith(normPhone(m.mobile).slice(-7)));
    if (found) {
      setMatchedMember(found);
      setSigninError("");
    } else {
      // Demo mode: allow any number, sign in as first member
      setMatchedMember(null);
      setSigninError("");
    }
    setSigninStep(1);
  };

  const handleOtpChange = (idx, val) => {
    if (val.length > 1) val = val.slice(-1);
    const next = [...otp]; next[idx] = val; setOtp(next);
    if (val && idx < 5) otpRefs.current[idx+1]?.focus();
    if (next.every(d => d !== "")) {
      setSigninStep(2);
      setTimeout(async () => {
        const loggedIn = matchedMember || allMembers[0];
        if (loggedIn) {
          setMember(loggedIn);
          // Load real transaction history from Supabase
          const txs = await db.getTransactions(loggedIn.id);
          setTransactions(txs.length > 0 ? txs : generateTransactions(loggedIn));
          setView("portal");
          setPortalTab("home");
        }
      }, 1400);
    }
  };

  const handleOtpKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) otpRefs.current[idx-1]?.focus();
  };

  const handleLogout = () => { setMember(null); setView("landing"); setMatchedMember(null); };

  const handleRedeem = (reward) => { setRedeemModal(reward); setRedeemSuccess(false); };

  const confirmRedeem = async () => {
    if (!member || !redeemModal) return;
    // Redeem via Supabase: deducts points, increments redemptions, logs transaction
    const newPoints = await db.redeemReward(member.id, redeemModal, member.points);
    setMember(prev => ({ ...prev, points: newPoints }));

    // Refresh data from Supabase so both platforms stay in sync
    setAllMembers(await db.getMembers());
    setAllRewards(await db.getRewards());

    // Add to local transaction display immediately
    setTransactions(prev => [{
      date: new Date().toISOString(), venue: "1-Insider Rewards", venueId: null,
      amount: 0, points: -redeemModal.pointsCost, type: "redeem", reward: redeemModal.name
    }, ...prev]);

    setRedeemSuccess(true);
    setTimeout(() => { setRedeemModal(null); setRedeemSuccess(false); }, 2200);
  };

  // ─── DERIVED ───────────────────────────────────────────────────────────────
  const currentTier = member ? allTiers.find(t => t.id === member.tier) || TIERS_DEFAULT.find(t => t.id === member.tier) : null;
  const nextTier = member ? allTiers.find(t => t.threshold > member.totalSpend) : null;
  const progressToNext = member && nextTier ? Math.min(100, (member.totalSpend / nextTier.threshold) * 100) : 100;

  // Rewards available to this member's tier
  const memberRewards = member ? allRewards.filter(r => r.active && r.pointsCost > 0 && r.tiers.includes(member.tier)) : [];

  return (
    <div style={{ fontFamily:"'Playfair Display', Georgia, serif", background:"#F8F5EF", minHeight:"100vh", color:"#1A1A1A", overflowX:"hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700;800;900&family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(30px) } to { opacity:1; transform:none } }
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes shimmer { 0% { background-position:-200% 0 } 100% { background-position:200% 0 } }
        @keyframes float { 0%,100% { transform:translateY(0) } 50% { transform:translateY(-8px) } }
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:.5 } }
        @keyframes spin { to { transform:rotate(360deg) } }
        @keyframes scaleIn { from { opacity:0; transform:scale(.9) } to { opacity:1; transform:none } }
        @keyframes checkmark { 0% { transform:scale(0) } 50% { transform:scale(1.2) } 100% { transform:scale(1) } }
        .fu { animation: fadeUp .7s ease both }
        .fi { animation: fadeIn .6s ease both }
        .sci { animation: scaleIn .4s ease both }
        .fu1 { animation-delay:.1s } .fu2 { animation-delay:.2s } .fu3 { animation-delay:.3s }
        .fu4 { animation-delay:.4s } .fu5 { animation-delay:.5s } .fu6 { animation-delay:.6s }
        .hlift { transition: transform .25s, box-shadow .25s }
        .hlift:hover { transform:translateY(-4px); box-shadow:0 16px 40px rgba(0,0,0,.1) !important }
        button { cursor:pointer; transition: all .2s }
        button:hover { opacity:.88 }
        input:focus { outline:none; border-color:#C5A258 !important; box-shadow:0 0 0 3px rgba(197,162,88,.15) }
        ::-webkit-scrollbar { width:5px } ::-webkit-scrollbar-thumb { background:#ccc; border-radius:3px }
        .gold-shimmer { background: linear-gradient(110deg, #C5A258 0%, #E8D5A0 25%, #C5A258 50%, #A8884A 75%, #C5A258 100%);
          background-size: 200% 100%; animation: shimmer 3s linear infinite }
      `}</style>

      {view === "landing" && <LandingPage onSignIn={handleSignIn} onJoin={handleJoin} scrollY={scrollY} tiers={allTiers} />}
      {view === "signin" && <SignInPage step={signinStep} phone={phone} setPhone={setPhone} otp={otp} otpRefs={otpRefs} onPhoneSubmit={handlePhoneSubmit} onOtpChange={handleOtpChange} onOtpKeyDown={handleOtpKeyDown} onBack={() => setView("landing")} onJoin={handleJoin} error={signinError} matchedMember={matchedMember} allMembers={allMembers} tiers={allTiers} />}
      {view === "portal" && member && <MemberPortal member={member} currentTier={currentTier} tab={portalTab} setTab={setPortalTab} onLogout={handleLogout} nextTier={nextTier} progress={progressToNext} selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} redeemModal={redeemModal} onRedeem={handleRedeem} onConfirmRedeem={confirmRedeem} onCloseRedeem={() => setRedeemModal(null)} redeemSuccess={redeemSuccess} memberRewards={memberRewards} transactions={transactions} tiers={allTiers} />}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// LANDING PAGE
// ═════════════════════════════════════════════════════════════════════════════
function LandingPage({ onSignIn, onJoin, scrollY, tiers }) {
  return (
    <div>
      {/* NAV */}
      <nav style={{ position:"fixed", top:0, left:0, right:0, zIndex:100, background: scrollY > 60 ? "rgba(26,26,26,.97)" : "transparent", backdropFilter: scrollY > 60 ? "blur(12px)" : "none", transition:"all .4s", padding:"0 48px", height:72, display:"flex", alignItems:"center", justifyContent:"space-between", borderBottom: scrollY > 60 ? "1px solid rgba(197,162,88,.2)" : "1px solid transparent" }}>
        <div style={{ display:"flex", alignItems:"baseline", gap:10 }}>
          <span style={{ color:"#C5A258", fontSize:24, fontWeight:700, letterSpacing:3 }}>1-INSIDER</span>
          <span style={{ color:"rgba(255,255,255,.4)", fontSize:10, letterSpacing:4, textTransform:"uppercase", fontFamily:"'Outfit',sans-serif" }}>by 1-Group</span>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={onSignIn} style={{ background:"transparent", border:"1px solid rgba(197,162,88,.5)", color:"#C5A258", padding:"10px 28px", borderRadius:100, fontSize:13, fontFamily:"'Outfit',sans-serif", fontWeight:500 }}>Sign In</button>
          <button onClick={onJoin} style={{ background:"#C5A258", border:"none", color:"#1A1A1A", padding:"10px 28px", borderRadius:100, fontSize:13, fontFamily:"'Outfit',sans-serif", fontWeight:600 }}>Join Free</button>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ background:"#1A1A1A", minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center", padding:"120px 32px 80px", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:"10%", left:"5%", width:300, height:300, borderRadius:"50%", background:"radial-gradient(circle, rgba(197,162,88,.06) 0%, transparent 70%)", pointerEvents:"none" }} />
        <div style={{ position:"absolute", bottom:"15%", right:"8%", width:400, height:400, borderRadius:"50%", background:"radial-gradient(circle, rgba(197,162,88,.04) 0%, transparent 70%)", pointerEvents:"none" }} />

        <div className="fu fu1" style={{ opacity:0 }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"6px 20px", borderRadius:100, border:"1px solid rgba(197,162,88,.25)", marginBottom:32 }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:"#C5A258" }} />
            <span style={{ fontSize:11, letterSpacing:4, textTransform:"uppercase", color:"rgba(197,162,88,.8)", fontFamily:"'Outfit',sans-serif", fontWeight:500 }}>Singapore's Premier Dining Rewards</span>
          </div>
        </div>
        <h1 className="fu fu2" style={{ opacity:0, fontSize:68, fontWeight:800, color:"#fff", lineHeight:1.05, margin:"0 0 24px", maxWidth:800, letterSpacing:-1 }}>Dine. Earn.<br /><span style={{ color:"#C5A258" }}>Be Rewarded.</span></h1>
        <p className="fu fu3" style={{ opacity:0, fontSize:18, color:"rgba(255,255,255,.55)", fontFamily:"'Outfit',sans-serif", fontWeight:300, maxWidth:520, lineHeight:1.7, margin:"0 0 40px" }}>Earn points across 23 award-winning restaurants, bars and cafés. Choose your rewards, your way — from cocktails to omakase.</p>
        <div className="fu fu4" style={{ opacity:0, display:"flex", gap:12 }}>
          <button onClick={onJoin} style={{ background:"#C5A258", border:"none", color:"#1A1A1A", padding:"16px 48px", borderRadius:100, fontSize:15, fontFamily:"'Outfit',sans-serif", fontWeight:600 }}>Join for Free</button>
          <button onClick={() => document.getElementById('how-it-works')?.scrollIntoView({behavior:'smooth'})} style={{ background:"transparent", border:"1px solid rgba(255,255,255,.2)", color:"#fff", padding:"16px 36px", borderRadius:100, fontSize:15, fontFamily:"'Outfit',sans-serif", fontWeight:400 }}>How It Works</button>
        </div>
        <div className="fu fu5" style={{ opacity:0, display:"flex", gap:32, marginTop:64 }}>
          {[{ n:"23", l:"Venues" },{ n:"4", l:"Reward Categories" },{ n:"Free", l:"To Join" }].map((s,i) => (
            <div key={i} style={{ textAlign:"center" }}>
              <div style={{ fontSize:36, fontWeight:700, color:"#C5A258" }}>{s.n}</div>
              <div style={{ fontSize:12, color:"rgba(255,255,255,.4)", fontFamily:"'Outfit',sans-serif", letterSpacing:2, textTransform:"uppercase" }}>{s.l}</div>
            </div>
          ))}
        </div>
        <div className="fu fu6" style={{ opacity:0, position:"absolute", bottom:32, left:"50%", transform:"translateX(-50%)" }}>
          <div style={{ width:24, height:40, borderRadius:12, border:"1px solid rgba(255,255,255,.2)", display:"flex", justifyContent:"center", paddingTop:8 }}>
            <div style={{ width:3, height:10, borderRadius:2, background:"#C5A258", animation:"float 2s ease infinite" }} />
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" style={{ padding:"100px 48px", background:"#F8F5EF" }}>
        <div style={{ maxWidth:1100, margin:"0 auto", textAlign:"center" }}>
          <div style={{ fontSize:11, letterSpacing:4, textTransform:"uppercase", color:"#C5A258", fontFamily:"'Outfit',sans-serif", fontWeight:600, marginBottom:12 }}>Simple & Rewarding</div>
          <h2 style={{ fontSize:44, fontWeight:700, margin:"0 0 64px", letterSpacing:-1 }}>How 1-Insider Works</h2>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:40 }}>
            {[
              { step:"01", title:"Dine Anywhere", desc:"Visit any of our 23 restaurants, bars, and cafés across Singapore. Every dollar you spend earns you points.", icon:"◆" },
              { step:"02", title:"Choose Your Rewards", desc:"Pick from four lifestyle categories each month — Cafés, Restaurants, Bars, or Wines. Your rewards, your style.", icon:"★" },
              { step:"03", title:"Enjoy & Repeat", desc:"Redeem points for exclusive experiences — from complimentary cocktails to chef's table access.", icon:"♛" },
            ].map((s,i) => (
              <div key={i} style={{ padding:40, background:"#fff", borderRadius:16, position:"relative", textAlign:"left", boxShadow:"0 2px 20px rgba(0,0,0,.04)" }} className="hlift">
                <div style={{ position:"absolute", top:24, right:24, fontSize:48, fontWeight:800, color:"rgba(197,162,88,.1)", lineHeight:1 }}>{s.step}</div>
                <div style={{ width:48, height:48, borderRadius:12, background:"#1A1A1A", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, color:"#C5A258", marginBottom:20 }}>{s.icon}</div>
                <h3 style={{ fontSize:22, fontWeight:700, margin:"0 0 12px" }}>{s.title}</h3>
                <p style={{ fontSize:15, fontFamily:"'Outfit',sans-serif", fontWeight:300, color:"#666", lineHeight:1.7, margin:0 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TIERS — now uses live data from shared storage */}
      <section style={{ padding:"100px 48px", background:"#1A1A1A" }}>
        <div style={{ maxWidth:1100, margin:"0 auto", textAlign:"center" }}>
          <div style={{ fontSize:11, letterSpacing:4, textTransform:"uppercase", color:"#C5A258", fontFamily:"'Outfit',sans-serif", fontWeight:600, marginBottom:12 }}>Membership Tiers</div>
          <h2 style={{ fontSize:44, fontWeight:700, color:"#fff", margin:"0 0 16px", letterSpacing:-1 }}>Rise Through the Ranks</h2>
          <p style={{ fontSize:16, fontFamily:"'Outfit',sans-serif", fontWeight:300, color:"rgba(255,255,255,.45)", maxWidth:500, margin:"0 auto 64px" }}>Every tier unlocks richer experiences. Start free, earn your way to Platinum.</p>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:24 }}>
            {tiers.map(tier => (
              <div key={tier.id} style={{ borderRadius:16, padding:"40px 32px", position:"relative", overflow:"hidden", background: tier.id === 'platinum' ? "linear-gradient(160deg,#2D2D2D,#1A1A1A)" : tier.id === 'gold' ? "linear-gradient(160deg,#2a2518,#1A1A1A)" : "linear-gradient(160deg,#252525,#1A1A1A)", border: `1px solid ${tier.id === 'gold' ? 'rgba(197,162,88,.3)' : 'rgba(255,255,255,.08)'}` }} className="hlift">
                {tier.id === 'gold' && <div style={{ position:"absolute", top:0, left:0, right:0, height:2 }} className="gold-shimmer" />}
                <div style={{ width:56, height:56, borderRadius:"50%", background:`radial-gradient(circle, ${tier.hex}44, ${tier.hex}11)`, border:`2px solid ${tier.hex}`, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 20px" }}>
                  <div style={{ width:16, height:16, borderRadius:"50%", background:tier.hex, boxShadow:`0 0 16px ${tier.hex}66` }} />
                </div>
                <h3 style={{ fontSize:28, fontWeight:700, color:"#fff", margin:"0 0 4px" }}>{tier.name}</h3>
                <div style={{ fontSize:13, fontFamily:"'Outfit',sans-serif", color:"rgba(255,255,255,.4)", marginBottom:24 }}>{tier.threshold === 0 ? "Free to join" : `$${fmtNum(tier.threshold)} annual spend`}</div>
                <div style={{ fontSize:36, fontWeight:800, color:"#C5A258", marginBottom:24 }}>{tier.earn}×<span style={{ fontSize:14, fontWeight:400, fontFamily:"'Outfit',sans-serif", marginLeft:6 }}>points</span></div>
                <div style={{ display:"flex", flexDirection:"column", gap:10, textAlign:"left" }}>
                  {tier.benefits.map((b,j) => (
                    <div key={j} style={{ display:"flex", gap:10, alignItems:"flex-start", fontSize:14, fontFamily:"'Outfit',sans-serif", color:"rgba(255,255,255,.65)", fontWeight:300 }}>
                      <span style={{ color:"#C5A258", fontSize:10, marginTop:5, flexShrink:0 }}>◆</span> {b}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section style={{ padding:"100px 48px", background:"#F8F5EF" }}>
        <div style={{ maxWidth:1100, margin:"0 auto", textAlign:"center" }}>
          <div style={{ fontSize:11, letterSpacing:4, textTransform:"uppercase", color:"#C5A258", fontFamily:"'Outfit',sans-serif", fontWeight:600, marginBottom:12 }}>Your Rewards, Your Way</div>
          <h2 style={{ fontSize:44, fontWeight:700, margin:"0 0 64px", letterSpacing:-1 }}>Choose Your Lifestyle</h2>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:20 }}>
            {CATEGORIES.map(cat => (
              <div key={cat.id} style={{ borderRadius:16, padding:"36px 24px", background:"#fff", borderBottom:`4px solid ${cat.color}`, boxShadow:"0 2px 16px rgba(0,0,0,.04)" }} className="hlift">
                <div style={{ fontSize:40, marginBottom:16 }}>{cat.icon}</div>
                <h3 style={{ fontSize:20, fontWeight:700, margin:"0 0 8px" }}>{cat.name}</h3>
                <p style={{ fontSize:13, fontFamily:"'Outfit',sans-serif", fontWeight:300, color:"#888", lineHeight:1.6, margin:"0 0 20px" }}>{cat.desc}</p>
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  {cat.rewards.map((r,j) => (
                    <div key={j} style={{ fontSize:12, fontFamily:"'Outfit',sans-serif", color:"#666", display:"flex", alignItems:"center", gap:6 }}><span style={{ color:cat.color, fontSize:8 }}>●</span> {r}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* VENUES */}
      <section style={{ padding:"100px 48px", background:"#fff" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <div style={{ textAlign:"center", marginBottom:64 }}>
            <div style={{ fontSize:11, letterSpacing:4, textTransform:"uppercase", color:"#C5A258", fontFamily:"'Outfit',sans-serif", fontWeight:600, marginBottom:12 }}>Our Portfolio</div>
            <h2 style={{ fontSize:44, fontWeight:700, margin:"0 0 16px", letterSpacing:-1 }}>23 Venues. One Card.</h2>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
            {VENUES.slice(0,12).map(v => (
              <div key={v.id} style={{ padding:"20px 16px", borderRadius:12, background:"#fafaf8", border:"1px solid #f0ece4", display:"flex", alignItems:"center", gap:12 }} className="hlift">
                <div style={{ width:44, height:44, borderRadius:10, background:"#1A1A1A", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>{v.img}</div>
                <div>
                  <div style={{ fontSize:14, fontWeight:600 }}>{v.name}</div>
                  <div style={{ fontSize:11, fontFamily:"'Outfit',sans-serif", color:"#999" }}>{v.cuisine || v.cat} · {v.loc}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ textAlign:"center", marginTop:24 }}>
            <span style={{ fontSize:13, fontFamily:"'Outfit',sans-serif", color:"#999" }}>+ {VENUES.length - 12} more venues across Singapore & Melaka</span>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding:"100px 48px", background:"#1A1A1A", textAlign:"center", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:0, left:"50%", transform:"translateX(-50%)", width:600, height:600, borderRadius:"50%", background:"radial-gradient(circle, rgba(197,162,88,.08) 0%, transparent 60%)", pointerEvents:"none" }} />
        <h2 style={{ fontSize:48, fontWeight:700, color:"#fff", margin:"0 0 16px", position:"relative" }}>Start Earning Today</h2>
        <p style={{ fontSize:16, fontFamily:"'Outfit',sans-serif", fontWeight:300, color:"rgba(255,255,255,.45)", maxWidth:420, margin:"0 auto 40px", position:"relative" }}>No app to download. No fee to pay. Just scan, dine, and earn.</p>
        <button onClick={onJoin} style={{ background:"#C5A258", border:"none", color:"#1A1A1A", padding:"18px 56px", borderRadius:100, fontSize:17, fontFamily:"'Outfit',sans-serif", fontWeight:600, position:"relative" }}>Join 1-Insider — It's Free</button>
      </section>

      <footer style={{ padding:"40px 48px", background:"#111", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ display:"flex", alignItems:"baseline", gap:8 }}>
          <span style={{ color:"#C5A258", fontSize:16, fontWeight:700, letterSpacing:2 }}>1-INSIDER</span>
          <span style={{ fontSize:11, color:"rgba(255,255,255,.25)", fontFamily:"'Outfit',sans-serif" }}>by 1-Group Singapore</span>
        </div>
        <div style={{ fontSize:12, fontFamily:"'Outfit',sans-serif", color:"rgba(255,255,255,.25)" }}>rewards.1-group.sg</div>
      </footer>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SIGN IN — with member lookup from shared storage
// ═════════════════════════════════════════════════════════════════════════════
function SignInPage({ step, phone, setPhone, otp, otpRefs, onPhoneSubmit, onOtpChange, onOtpKeyDown, onBack, onJoin, error, matchedMember, allMembers, tiers }) {
  return (
    <div style={{ minHeight:"100vh", display:"flex", background:"#1A1A1A", position:"relative" }}>
      {/* Left decorative panel */}
      <div style={{ flex:"0 0 45%", background:"linear-gradient(160deg,#1A1A1A,#2a2518)", display:"flex", flexDirection:"column", justifyContent:"center", padding:"64px 56px", position:"relative" }}>
        <div style={{ position:"relative", zIndex:1 }}>
          <button onClick={onBack} style={{ background:"none", border:"none", color:"rgba(255,255,255,.4)", fontSize:13, fontFamily:"'Outfit',sans-serif", padding:0, marginBottom:48, display:"flex", alignItems:"center", gap:6 }}>← Back to home</button>
          <div style={{ color:"#C5A258", fontSize:32, fontWeight:700, letterSpacing:3, marginBottom:16 }}>1-INSIDER</div>
          <h2 style={{ fontSize:40, fontWeight:700, color:"#fff", lineHeight:1.2, margin:"0 0 20px" }}>Welcome to<br />Your Rewards</h2>
          <p style={{ fontSize:15, fontFamily:"'Outfit',sans-serif", fontWeight:300, color:"rgba(255,255,255,.4)", lineHeight:1.7, maxWidth:360 }}>Sign in with your mobile number to view your points, browse rewards, and manage your membership.</p>

          {/* Connected data indicator */}
          <div style={{ marginTop:40, padding:"16px 20px", borderRadius:12, background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.08)" }}>
            <div style={{ fontSize:10, fontFamily:"'Outfit',sans-serif", letterSpacing:2, textTransform:"uppercase", color:"rgba(255,255,255,.3)", marginBottom:10 }}>Connected Platform</div>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:"#4CAF50" }} />
              <span style={{ fontSize:12, fontFamily:"'Outfit',sans-serif", color:"rgba(255,255,255,.5)" }}>{allMembers.length} members synced from admin</span>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:"#4CAF50" }} />
              <span style={{ fontSize:12, fontFamily:"'Outfit',sans-serif", color:"rgba(255,255,255,.5)" }}>Tiers & rewards live from dashboard</span>
            </div>
          </div>

          <div style={{ marginTop:24, display:"flex", gap:16 }}>
            {tiers.map(t => (
              <div key={t.id} style={{ display:"flex", alignItems:"center", gap:6 }}>
                <div style={{ width:10, height:10, borderRadius:"50%", background:t.hex, boxShadow:`0 0 8px ${t.hex}44` }} />
                <span style={{ fontSize:12, fontFamily:"'Outfit',sans-serif", color:"rgba(255,255,255,.35)" }}>{t.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", background:"#F8F5EF" }}>
        <div style={{ width:400 }} className="sci">
          {step === 0 && (
            <div>
              <h3 style={{ fontSize:28, fontWeight:700, margin:"0 0 8px" }}>Sign In</h3>
              <p style={{ fontSize:14, fontFamily:"'Outfit',sans-serif", color:"#888", margin:"0 0 32px" }}>Enter your registered mobile number</p>
              <label style={{ fontSize:11, fontFamily:"'Outfit',sans-serif", fontWeight:600, letterSpacing:1.5, textTransform:"uppercase", color:"#999", display:"block", marginBottom:8 }}>Mobile Number</label>
              <div style={{ display:"flex", gap:8, marginBottom:8 }}>
                <div style={{ padding:"14px 16px", borderRadius:10, background:"#fff", border:"1px solid #e0dcd4", fontSize:15, fontFamily:"'Outfit',sans-serif", color:"#666", flexShrink:0 }}>+65</div>
                <input type="tel" placeholder="9XXX XXXX" value={phone} onChange={e=>setPhone(e.target.value)} onKeyDown={e=>e.key==='Enter'&&onPhoneSubmit()} style={{ padding:"14px 16px", borderRadius:10, border:"1px solid #e0dcd4", fontSize:15, fontFamily:"'Outfit',sans-serif", width:"100%", boxSizing:"border-box", background:"#fff" }} autoFocus />
              </div>
              {error && <p style={{ fontSize:12, color:"#C62828", fontFamily:"'Outfit',sans-serif", margin:"0 0 12px" }}>{error}</p>}
              <button onClick={onPhoneSubmit} style={{ width:"100%", padding:"16px", borderRadius:10, border:"none", background:"#1A1A1A", color:"#C5A258", fontSize:15, fontFamily:"'Outfit',sans-serif", fontWeight:600, marginTop:8 }}>Send Verification Code</button>

              <div style={{ marginTop:16, padding:"12px 16px", borderRadius:10, background:"#FDF8EE", border:"1px solid #E8D5A8" }}>
                <div style={{ fontSize:12, fontFamily:"'Outfit',sans-serif", color:"#8B6914", fontWeight:600, marginBottom:6 }}>⚡ Demo Mode</div>
                <div style={{ fontSize:11, fontFamily:"'Outfit',sans-serif", color:"#A08530", lineHeight:1.5 }}>Enter any number to proceed. If it matches a member in the admin dashboard, you'll see their real data. Otherwise you'll sign in as the first member ({allMembers[0]?.name || 'loading…'}).</div>
              </div>

              <div style={{ borderTop:"1px solid #e8e4dc", marginTop:24, paddingTop:20, textAlign:"center" }}>
                <p style={{ fontSize:13, fontFamily:"'Outfit',sans-serif", color:"#999", margin:0 }}>New to 1-Insider? <span onClick={onJoin} style={{ color:"#C5A258", fontWeight:600, cursor:"pointer" }}>Join for free →</span></p>
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <h3 style={{ fontSize:28, fontWeight:700, margin:"0 0 8px" }}>Verify</h3>
              <p style={{ fontSize:14, fontFamily:"'Outfit',sans-serif", color:"#888", margin:"0 0 8px" }}>Enter the 6-digit code sent to +65 {phone}</p>

              {/* Show who they'll sign in as */}
              <div style={{ padding:"12px 16px", borderRadius:10, background: matchedMember ? "#E8F5E9" : "#FFF3E0", border: matchedMember ? "1px solid #A5D6A7" : "1px solid #FFE0B2", marginBottom:24 }}>
                {matchedMember ? (
                  <div style={{ fontSize:12, fontFamily:"'Outfit',sans-serif", color:"#2E7D32" }}>
                    ✓ Member found: <strong>{matchedMember.name}</strong> · {matchedMember.tier.charAt(0).toUpperCase() + matchedMember.tier.slice(1)} · {fmtNum(matchedMember.points)} pts
                  </div>
                ) : (
                  <div style={{ fontSize:12, fontFamily:"'Outfit',sans-serif", color:"#E65100" }}>
                    No member matched — signing in as <strong>{allMembers[0]?.name}</strong> (demo)
                  </div>
                )}
              </div>

              <div style={{ display:"flex", gap:10, justifyContent:"center", marginBottom:24 }}>
                {otp.map((d,i) => (
                  <input key={i} ref={el=>otpRefs.current[i]=el} type="text" inputMode="numeric" maxLength={1} value={d} onChange={e=>onOtpChange(i,e.target.value)} onKeyDown={e=>onOtpKeyDown(i,e)} style={{ width:52, height:64, textAlign:"center", fontSize:24, fontWeight:700, borderRadius:12, border: d ? "2px solid #C5A258" : "1px solid #e0dcd4", fontFamily:"'Outfit',sans-serif", background:"#fff", boxSizing:"border-box" }} autoFocus={i===0} />
                ))}
              </div>
              <p style={{ fontSize:13, fontFamily:"'Outfit',sans-serif", color:"#999", textAlign:"center" }}>Didn't receive a code? <span style={{ color:"#C5A258", fontWeight:600, cursor:"pointer" }}>Resend</span></p>
              <div style={{ marginTop:12, padding:"10px 14px", borderRadius:8, background:"#FDF8EE", border:"1px solid #E8D5A8", textAlign:"center" }}>
                <span style={{ fontSize:11, fontFamily:"'Outfit',sans-serif", color:"#8B6914" }}>⚡ Demo Mode — Enter any 6 digits to sign in</span>
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ textAlign:"center" }}>
              <div style={{ width:56, height:56, border:"3px solid #e0dcd4", borderTopColor:"#C5A258", borderRadius:"50%", animation:"spin .8s linear infinite", margin:"0 auto 24px" }} />
              <h3 style={{ fontSize:24, fontWeight:700, margin:"0 0 8px" }}>Verifying</h3>
              <p style={{ fontSize:14, fontFamily:"'Outfit',sans-serif", color:"#888" }}>Signing you in as {matchedMember?.name || allMembers[0]?.name}…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MEMBER PORTAL — reads live data from shared storage
// ═════════════════════════════════════════════════════════════════════════════
function MemberPortal({ member, currentTier, tab, setTab, onLogout, nextTier, progress, selectedCategory, setSelectedCategory, redeemModal, onRedeem, onConfirmRedeem, onCloseRedeem, redeemSuccess, memberRewards, transactions, tiers }) {
  const PTABS = [
    { id:"home", label:"Home", icon:"◆" },
    { id:"rewards", label:"Rewards", icon:"★" },
    { id:"activity", label:"Activity", icon:"◈" },
    { id:"profile", label:"Profile", icon:"♟" },
  ];

  return (
    <div style={{ minHeight:"100vh", background:"#F8F5EF" }}>
      <nav style={{ position:"sticky", top:0, zIndex:100, background:"rgba(26,26,26,.98)", backdropFilter:"blur(12px)", padding:"0 40px", height:64, display:"flex", alignItems:"center", justifyContent:"space-between", borderBottom:"1px solid rgba(197,162,88,.15)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:32 }}>
          <span style={{ color:"#C5A258", fontSize:20, fontWeight:700, letterSpacing:2 }}>1-INSIDER</span>
          <div style={{ display:"flex", gap:0, height:64 }}>
            {PTABS.map(t => (
              <button key={t.id} onClick={()=>setTab(t.id)} style={{ background:"none", border:"none", color: tab===t.id ? "#C5A258" : "rgba(255,255,255,.45)", padding:"0 20px", fontSize:13, fontFamily:"'Outfit',sans-serif", fontWeight: tab===t.id ? 600 : 400, height:"100%", display:"flex", alignItems:"center", gap:5, borderBottom: tab===t.id ? "2px solid #C5A258" : "2px solid transparent" }}>
                <span style={{ fontSize:10 }}>{t.icon}</span> {t.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:13, fontWeight:600, color:"#fff", fontFamily:"'Outfit',sans-serif" }}>{member.name}</div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,.35)", fontFamily:"'Outfit',sans-serif" }}>{currentTier?.name || member.tier} Member</div>
          </div>
          <div style={{ width:36, height:36, borderRadius:"50%", background:`linear-gradient(135deg,${currentTier?.hex || '#ccc'}44,${currentTier?.hex || '#ccc'})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:700, color:"#fff", border:`2px solid ${currentTier?.hex || '#ccc'}` }}>{member.name.charAt(0)}</div>
          <button onClick={onLogout} style={{ background:"none", border:"1px solid rgba(255,255,255,.15)", color:"rgba(255,255,255,.4)", padding:"6px 14px", borderRadius:6, fontSize:11, fontFamily:"'Outfit',sans-serif" }}>Sign Out</button>
        </div>
      </nav>

      <main style={{ maxWidth:1100, margin:"0 auto", padding:"32px 40px" }}>
        {tab === "home" && <PortalHome member={member} currentTier={currentTier} nextTier={nextTier} progress={progress} setTab={setTab} transactions={transactions} />}
        {tab === "rewards" && <PortalRewards member={member} rewards={memberRewards} selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} onRedeem={onRedeem} />}
        {tab === "activity" && <PortalActivity transactions={transactions} />}
        {tab === "profile" && <PortalProfile member={member} currentTier={currentTier} tiers={tiers} />}
      </main>

      {/* REDEEM MODAL */}
      {redeemModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.6)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:300, backdropFilter:"blur(6px)" }} onClick={onCloseRedeem}>
          <div style={{ background:"#fff", borderRadius:20, padding:40, maxWidth:420, width:"90%", textAlign:"center" }} onClick={e=>e.stopPropagation()} className="sci">
            {!redeemSuccess ? (
              <>
                <div style={{ fontSize:48, marginBottom:16 }}>{CATEGORIES.find(c=>c.id===redeemModal.category)?.icon || "★"}</div>
                <h3 style={{ fontSize:24, fontWeight:700, margin:"0 0 8px" }}>{redeemModal.name}</h3>
                <p style={{ fontSize:14, fontFamily:"'Outfit',sans-serif", color:"#888", margin:"0 0 24px", lineHeight:1.6 }}>{redeemModal.desc}</p>
                <div style={{ padding:16, background:"#FDF8EE", borderRadius:12, marginBottom:24 }}>
                  <div style={{ fontSize:12, fontFamily:"'Outfit',sans-serif", color:"#999", marginBottom:4 }}>Points Required</div>
                  <div style={{ fontSize:32, fontWeight:800, color:"#C5A258" }}>{fmtNum(redeemModal.pointsCost)}</div>
                  <div style={{ fontSize:12, fontFamily:"'Outfit',sans-serif", color:"#888", marginTop:4 }}>Your balance: {fmtNum(member.points)} pts</div>
                </div>
                <div style={{ padding:"10px 14px", borderRadius:8, background:"#f0fdf4", border:"1px solid #bbf7d0", marginBottom:16 }}>
                  <span style={{ fontSize:11, fontFamily:"'Outfit',sans-serif", color:"#166534" }}>✓ Points will deduct in real-time — visible in admin dashboard</span>
                </div>
                <div style={{ display:"flex", gap:10 }}>
                  <button onClick={onCloseRedeem} style={{ flex:1, padding:"14px", borderRadius:10, border:"1px solid #e0dcd4", background:"#fff", fontSize:14, fontFamily:"'Outfit',sans-serif", color:"#666" }}>Cancel</button>
                  <button onClick={onConfirmRedeem} disabled={member.points < redeemModal.pointsCost} style={{ flex:1, padding:"14px", borderRadius:10, border:"none", fontSize:14, fontFamily:"'Outfit',sans-serif", fontWeight:600, background: member.points >= redeemModal.pointsCost ? "#1A1A1A" : "#ddd", color: member.points >= redeemModal.pointsCost ? "#C5A258" : "#999" }}>Redeem Now</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ width:64, height:64, borderRadius:"50%", background:"#E8F5E9", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 20px", animation:"checkmark .5s ease" }}>
                  <span style={{ fontSize:28, color:"#4CAF50" }}>✓</span>
                </div>
                <h3 style={{ fontSize:24, fontWeight:700, margin:"0 0 8px" }}>Redeemed!</h3>
                <p style={{ fontSize:14, fontFamily:"'Outfit',sans-serif", color:"#888" }}>Show this screen to your server. Points updated across both platforms.</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PORTAL HOME ─────────────────────────────────────────────────────────────
function PortalHome({ member, currentTier, nextTier, progress, setTab, transactions }) {
  return (
    <div className="fi">
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:24, marginBottom:24 }}>
        {/* Member Card */}
        <div style={{ borderRadius:20, padding:"36px 32px", position:"relative", overflow:"hidden", background: member.tier === 'platinum' ? "linear-gradient(135deg,#2D2D2D,#1A1A1A)" : member.tier === 'gold' ? "linear-gradient(135deg,#2a2518,#1f1c15)" : "linear-gradient(135deg,#3a3a3a,#1A1A1A)", boxShadow:"0 8px 32px rgba(0,0,0,.2)" }}>
          {member.tier === 'gold' && <div style={{ position:"absolute", top:0, left:0, right:0, height:2 }} className="gold-shimmer" />}
          <div style={{ position:"absolute", top:20, right:24, opacity:.06, fontSize:140, fontWeight:900, lineHeight:1, color:"#fff", pointerEvents:"none" }}>1</div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:28, position:"relative" }}>
            <div>
              <div style={{ fontSize:11, fontFamily:"'Outfit',sans-serif", letterSpacing:3, textTransform:"uppercase", color:"rgba(255,255,255,.35)", marginBottom:4 }}>1-Insider {currentTier?.name || member.tier}</div>
              <div style={{ fontSize:28, fontWeight:700, color:"#fff" }}>{member.name}</div>
            </div>
            <div style={{ width:48, height:48, borderRadius:"50%", background:`${currentTier?.hex || '#ccc'}33`, border:`2px solid ${currentTier?.hex || '#ccc'}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <div style={{ width:16, height:16, borderRadius:"50%", background:currentTier?.hex || '#ccc', boxShadow:`0 0 12px ${currentTier?.hex || '#ccc'}66` }} />
            </div>
          </div>
          <div style={{ fontSize:48, fontWeight:800, color:"#C5A258", lineHeight:1, marginBottom:4 }}>{fmtNum(member.points)}</div>
          <div style={{ fontSize:13, fontFamily:"'Outfit',sans-serif", color:"rgba(255,255,255,.4)", marginBottom:24 }}>Available Points</div>
          {nextTier && (
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, fontFamily:"'Outfit',sans-serif", color:"rgba(255,255,255,.35)", marginBottom:6 }}>
                <span>Progress to {nextTier.name}</span>
                <span>${fmtNum(member.totalSpend)} / ${fmtNum(nextTier.threshold)}</span>
              </div>
              <div style={{ height:4, background:"rgba(255,255,255,.1)", borderRadius:2, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${progress}%`, background:`linear-gradient(90deg, ${currentTier?.hex || '#ccc'}, #C5A258)`, borderRadius:2, transition:"width 1s ease" }} />
              </div>
              <div style={{ fontSize:11, fontFamily:"'Outfit',sans-serif", color:"rgba(255,255,255,.3)", marginTop:6 }}>${fmtNum(nextTier.threshold - member.totalSpend)} more to {nextTier.name}</div>
            </div>
          )}
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          {[
            { label:"Points Value", val:`$${fmtNum(Math.round(member.points * 0.03))}`, sub:"Redeemable value", color:"#C5A258" },
            { label:"Total Visits", val:member.visits, sub:"Across all venues", color:"#1A1A1A" },
            { label:"Earn Rate", val:`${currentTier?.earn || 1}×`, sub:`${currentTier?.name || 'Silver'} multiplier`, color:"#C5A258" },
            { label:"Member Since", val:fmtDate(member.signupDate).split(' ').slice(1).join(' '), sub:"Thank you!", color:"#1A1A1A" },
          ].map((s,i) => (
            <div key={i} style={{ background:"#fff", borderRadius:16, padding:"24px 20px", boxShadow:"0 2px 12px rgba(0,0,0,.04)" }} className="hlift">
              <div style={{ fontSize:10, fontFamily:"'Outfit',sans-serif", fontWeight:600, letterSpacing:1.5, textTransform:"uppercase", color:"#bbb", marginBottom:8 }}>{s.label}</div>
              <div style={{ fontSize:28, fontWeight:700, color:s.color }}>{s.val}</div>
              <div style={{ fontSize:11, fontFamily:"'Outfit',sans-serif", color:"#bbb", marginTop:2 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:24 }}>
        {[
          { label:"Browse Rewards", icon:"★", desc:"Redeem your points", action:()=>setTab("rewards") },
          { label:"View Activity", icon:"◈", desc:"Points history", action:()=>setTab("activity") },
          { label:"My Profile", icon:"♟", desc:"Settings & preferences", action:()=>setTab("profile") },
        ].map((a,i) => (
          <button key={i} onClick={a.action} style={{ background:"#fff", borderRadius:16, padding:"24px", border:"1px solid #f0ece4", textAlign:"left", display:"flex", alignItems:"center", gap:16, boxShadow:"0 2px 8px rgba(0,0,0,.03)" }} className="hlift">
            <div style={{ width:44, height:44, borderRadius:10, background:"#1A1A1A", display:"flex", alignItems:"center", justifyContent:"center", color:"#C5A258", fontSize:18, flexShrink:0 }}>{a.icon}</div>
            <div><div style={{ fontSize:15, fontWeight:600, marginBottom:2 }}>{a.label}</div><div style={{ fontSize:12, fontFamily:"'Outfit',sans-serif", color:"#999" }}>{a.desc}</div></div>
          </button>
        ))}
      </div>

      <div style={{ background:"#fff", borderRadius:16, padding:28, boxShadow:"0 2px 12px rgba(0,0,0,.04)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <h3 style={{ fontSize:20, fontWeight:700, margin:0 }}>Recent Activity</h3>
          <button onClick={()=>setTab("activity")} style={{ background:"none", border:"none", color:"#C5A258", fontSize:13, fontFamily:"'Outfit',sans-serif", fontWeight:600 }}>See All →</button>
        </div>
        {transactions.slice(0,4).map((tx,i) => (
          <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 0", borderBottom: i < 3 ? "1px solid #f5f2ec" : "none" }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:40, height:40, borderRadius:10, background: tx.type === "earn" ? "#E8F5E9" : "#FFF3E0", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>{tx.type === "earn" ? "+" : "★"}</div>
              <div>
                <div style={{ fontSize:14, fontWeight:500, fontFamily:"'Outfit',sans-serif" }}>{tx.venue}</div>
                <div style={{ fontSize:12, fontFamily:"'Outfit',sans-serif", color:"#999" }}>{tx.type === "earn" ? `Spent $${tx.amount}` : tx.reward} · {fmtDate(tx.date).split(' ').slice(0,2).join(' ')}</div>
              </div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:16, fontWeight:700, fontFamily:"'Outfit',sans-serif", color: tx.type === "earn" ? "#4CAF50" : "#C5A258" }}>{tx.type === "earn" ? `+${fmtNum(tx.points)}` : fmtNum(tx.points)}</div>
              <div style={{ fontSize:11, fontFamily:"'Outfit',sans-serif", color:"#bbb" }}>pts</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── PORTAL REWARDS — live from shared storage ───────────────────────────────
function PortalRewards({ member, rewards, selectedCategory, setSelectedCategory, onRedeem }) {
  const filtered = selectedCategory ? rewards.filter(r => r.category === selectedCategory) : rewards;
  return (
    <div className="fi">
      <h2 style={{ fontSize:28, fontWeight:700, margin:"0 0 4px" }}>Rewards</h2>
      <p style={{ fontSize:14, fontFamily:"'Outfit',sans-serif", color:"#888", margin:"0 0 28px" }}>Redeem your {fmtNum(member.points)} points for exclusive experiences · {rewards.length} rewards available for {member.tier} tier</p>
      <div style={{ display:"flex", gap:8, marginBottom:28, flexWrap:"wrap" }}>
        <button onClick={()=>setSelectedCategory(null)} style={{ padding:"8px 20px", borderRadius:100, border: !selectedCategory ? "2px solid #1A1A1A" : "1px solid #e0dcd4", background: !selectedCategory ? "#1A1A1A" : "#fff", color: !selectedCategory ? "#C5A258" : "#888", fontSize:13, fontFamily:"'Outfit',sans-serif", fontWeight:500 }}>All ({rewards.length})</button>
        {CATEGORIES.map(c => {
          const count = rewards.filter(r => r.category === c.id).length;
          return count > 0 ? (
            <button key={c.id} onClick={()=>setSelectedCategory(c.id)} style={{ padding:"8px 20px", borderRadius:100, fontSize:13, fontFamily:"'Outfit',sans-serif", fontWeight:500, border: selectedCategory === c.id ? `2px solid ${c.color}` : "1px solid #e0dcd4", background: selectedCategory === c.id ? `${c.color}12` : "#fff", color: selectedCategory === c.id ? c.color : "#888" }}>{c.icon} {c.name} ({count})</button>
          ) : null;
        })}
      </div>
      {filtered.length === 0 ? (
        <div style={{ textAlign:"center", padding:"60px 20px", color:"#999" }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🏆</div>
          <p style={{ fontFamily:"'Outfit',sans-serif", fontSize:15 }}>No rewards in this category for your tier yet. Check back soon!</p>
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:16 }}>
          {filtered.map(r => {
            const cat = CATEGORIES.find(c => c.id === r.category);
            const canAfford = member.points >= r.pointsCost;
            return (
              <div key={r.id} style={{ background:"#fff", borderRadius:16, padding:28, boxShadow:"0 2px 12px rgba(0,0,0,.04)", display:"flex", flexDirection:"column", justifyContent:"space-between", borderLeft:`4px solid ${cat?.color || '#ccc'}` }} className="hlift">
                <div>
                  <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"3px 10px", borderRadius:100, fontSize:11, fontFamily:"'Outfit',sans-serif", background:`${cat?.color}15`, color:cat?.color, fontWeight:500, marginBottom:8 }}>{cat?.icon} {cat?.name}</span>
                  <h4 style={{ fontSize:18, fontWeight:700, margin:"0 0 6px" }}>{r.name}</h4>
                  <p style={{ fontSize:13, fontFamily:"'Outfit',sans-serif", color:"#888", lineHeight:1.6, margin:"0 0 20px" }}>{r.desc}</p>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <span style={{ fontSize:22, fontWeight:800, color:"#C5A258" }}>{fmtNum(r.pointsCost)}</span>
                    <span style={{ fontSize:12, fontFamily:"'Outfit',sans-serif", color:"#bbb", marginLeft:4 }}>pts</span>
                  </div>
                  <button onClick={() => onRedeem(r)} style={{ padding:"10px 24px", borderRadius:10, border:"none", fontSize:13, fontFamily:"'Outfit',sans-serif", fontWeight:600, background: canAfford ? "#1A1A1A" : "#f0f0f0", color: canAfford ? "#C5A258" : "#bbb" }}>{canAfford ? "Redeem" : "Not enough points"}</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── PORTAL ACTIVITY ─────────────────────────────────────────────────────────
function PortalActivity({ transactions }) {
  return (
    <div className="fi">
      <h2 style={{ fontSize:28, fontWeight:700, margin:"0 0 4px" }}>Activity</h2>
      <p style={{ fontSize:14, fontFamily:"'Outfit',sans-serif", color:"#888", margin:"0 0 28px" }}>Your complete earning and redemption history</p>
      <div style={{ background:"#fff", borderRadius:16, padding:28, boxShadow:"0 2px 12px rgba(0,0,0,.04)" }}>
        {transactions.map((tx,i) => (
          <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"16px 0", borderBottom: i < transactions.length-1 ? "1px solid #f5f2ec" : "none" }}>
            <div style={{ display:"flex", alignItems:"center", gap:14 }}>
              <div style={{ width:44, height:44, borderRadius:12, background: tx.type === "earn" ? "#E8F5E9" : "#FFF3E0", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{tx.type === "earn" ? "↑" : "★"}</div>
              <div>
                <div style={{ fontSize:15, fontWeight:600, fontFamily:"'Outfit',sans-serif" }}>{tx.venue}</div>
                <div style={{ fontSize:12, fontFamily:"'Outfit',sans-serif", color:"#999", marginTop:2 }}>{tx.type === "earn" ? `Dining · Spent ${fmtCur(tx.amount)}` : `Redeemed: ${tx.reward}`}</div>
              </div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:18, fontWeight:700, fontFamily:"'Outfit',sans-serif", color: tx.type === "earn" ? "#4CAF50" : "#E65100" }}>{tx.type === "earn" ? `+${fmtNum(tx.points)}` : fmtNum(tx.points)}</div>
              <div style={{ fontSize:11, fontFamily:"'Outfit',sans-serif", color:"#bbb" }}>{fmtDate(tx.date)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── PORTAL PROFILE ──────────────────────────────────────────────────────────
function PortalProfile({ member, currentTier, tiers }) {
  const venue = VENUES.find(v=>v.id===member.favouriteVenue);
  return (
    <div className="fi">
      <h2 style={{ fontSize:28, fontWeight:700, margin:"0 0 4px" }}>My Profile</h2>
      <p style={{ fontSize:14, fontFamily:"'Outfit',sans-serif", color:"#888", margin:"0 0 28px" }}>Your 1-Insider account details</p>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:24 }}>
        <div style={{ background:"#fff", borderRadius:16, padding:28, boxShadow:"0 2px 12px rgba(0,0,0,.04)" }}>
          <h3 style={{ fontSize:18, fontWeight:700, margin:"0 0 20px" }}>Personal Information</h3>
          {[
            { label:"Name", val:member.name },
            { label:"Mobile", val:member.mobile },
            { label:"Email", val:member.email },
            { label:"Member ID", val:member.id },
            { label:"Birthday Month", val:new Date(2025,member.birthdayMonth-1).toLocaleString('en',{month:'long'}) },
            { label:"Member Since", val:fmtDate(member.signupDate) },
          ].map((f,i) => (
            <div key={i} style={{ marginBottom:16 }}>
              <div style={{ fontSize:10, fontFamily:"'Outfit',sans-serif", fontWeight:600, letterSpacing:1.5, textTransform:"uppercase", color:"#bbb", marginBottom:4 }}>{f.label}</div>
              <div style={{ fontSize:15, fontFamily:"'Outfit',sans-serif", fontWeight:500 }}>{f.val}</div>
            </div>
          ))}
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div style={{ background:"#fff", borderRadius:16, padding:28, boxShadow:"0 2px 12px rgba(0,0,0,.04)" }}>
            <h3 style={{ fontSize:18, fontWeight:700, margin:"0 0 16px" }}>Preferred Category</h3>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {CATEGORIES.map(c => (
                <div key={c.id} style={{ padding:"14px 16px", borderRadius:12, display:"flex", alignItems:"center", gap:10, background: member.categoryPref === c.id ? `${c.color}12` : "#fafaf8", border: member.categoryPref === c.id ? `2px solid ${c.color}` : "1px solid #f0ece4" }}>
                  <span style={{ fontSize:20 }}>{c.icon}</span>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, fontFamily:"'Outfit',sans-serif" }}>{c.name}</div>
                    {member.categoryPref === c.id && <div style={{ fontSize:10, color:c.color, fontFamily:"'Outfit',sans-serif", fontWeight:500 }}>Selected</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {venue && (
            <div style={{ background:"#fff", borderRadius:16, padding:28, boxShadow:"0 2px 12px rgba(0,0,0,.04)" }}>
              <h3 style={{ fontSize:18, fontWeight:700, margin:"0 0 16px" }}>Favourite Venue</h3>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:48, height:48, borderRadius:12, background:"#1A1A1A", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>{venue.img}</div>
                <div>
                  <div style={{ fontSize:16, fontWeight:600 }}>{venue.name}</div>
                  <div style={{ fontSize:12, fontFamily:"'Outfit',sans-serif", color:"#999" }}>{venue.loc}</div>
                </div>
              </div>
            </div>
          )}
          <div style={{ background:"#fff", borderRadius:16, padding:28, boxShadow:"0 2px 12px rgba(0,0,0,.04)" }}>
            <h3 style={{ fontSize:18, fontWeight:700, margin:"0 0 12px" }}>Membership Tier</h3>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:48, height:48, borderRadius:"50%", background:`${currentTier?.hex || '#ccc'}22`, border:`2px solid ${currentTier?.hex || '#ccc'}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <div style={{ width:16, height:16, borderRadius:"50%", background:currentTier?.hex || '#ccc', boxShadow:`0 0 10px ${currentTier?.hex || '#ccc'}44` }} />
              </div>
              <div>
                <div style={{ fontSize:18, fontWeight:700 }}>{currentTier?.name || member.tier}</div>
                <div style={{ fontSize:12, fontFamily:"'Outfit',sans-serif", color:"#999" }}>{currentTier?.earn || 1}× earn · {currentTier?.benefits?.length || 0} benefits</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
