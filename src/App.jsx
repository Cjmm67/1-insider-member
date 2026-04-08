import { useState, useEffect, useRef } from "react";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const VENUES = [
  { id:"oumi", name:"Oumi", cat:"Restaurants", loc:"CapitaSpring Lvl 51", cuisine:"Modern Japanese Omakase" },
  { id:"kaarla", name:"Kaarla", cat:"Restaurants", loc:"CapitaSpring Lvl 51", cuisine:"Modern Australian" },
  { id:"solluna", name:"Sol & Luna", cat:"Restaurants", loc:"CapitaSpring Lvl 51", cuisine:"Mediterranean" },
  { id:"camille", name:"Camille", cat:"Restaurants", loc:"CapitaSpring Lvl 51", cuisine:"French" },
  { id:"fire", name:"FIRE", cat:"Restaurants", loc:"One Fullerton", cuisine:"Modern Grill" },
  { id:"monti", name:"Monti", cat:"Restaurants", loc:"Fullerton Pavilion", cuisine:"Italian" },
  { id:"flnt", name:"FLNT", cat:"Restaurants", loc:"CapitaSpring Lvl 51", cuisine:"Flint-fired Contemporary" },
  { id:"botanico", name:"Botanico", cat:"Restaurants", loc:"Botanic Gardens", cuisine:"Modern European" },
  { id:"mimi", name:"Mimi", cat:"Restaurants", loc:"Clarke Quay", cuisine:"Pan-Asian" },
  { id:"una", name:"UNA", cat:"Restaurants", loc:"Rochester Commons", cuisine:"Italian" },
  { id:"yang", name:"Yang", cat:"Restaurants", loc:"1-Altitude", cuisine:"Contemporary Asian" },
  { id:"zorba", name:"Zorba", cat:"Restaurants", loc:"The Summerhouse", cuisine:"Greek" },
  { id:"alfaro", name:"1-Alfaro", cat:"Restaurants", loc:"Raffles Place", cuisine:"Spanish" },
  { id:"coast", name:"1-Altitude Coast", cat:"Bars", loc:"One Fullerton Rooftop" },
  { id:"arden", name:"1-Arden Bar", cat:"Bars", loc:"CapitaSpring" },
  { id:"1918", name:"1918 Heritage Bar", cat:"Bars", loc:"The Riverhouse" },
  { id:"solora", name:"Sol & Ora", cat:"Bars", loc:"CapitaSpring" },
  { id:"pixies", name:"Pixies", cat:"Bars", loc:"Portfolio" },
  { id:"wsbar", name:"Wildseed Bar", cat:"Bars", loc:"The Summerhouse" },
  { id:"wscafe-fh", name:"Wildseed Café @ 1-Flowerhill", cat:"Cafés", loc:"1-Flowerhill" },
  { id:"wscafe-sh", name:"Wildseed Café @ The Summerhouse", cat:"Cafés", loc:"The Summerhouse" },
  { id:"wscafe-am", name:"Wildseed Café @ The Alkaff Mansion", cat:"Cafés", loc:"The Alkaff Mansion" },
  { id:"wscafe-bg", name:"Wildseed Café @ SBG", cat:"Cafés", loc:"Singapore Botanic Gardens" },
  { id:"melaka", name:"1-Altitude Melaka", cat:"Bars", loc:"Melaka, Malaysia" },
];

const CAFE_OUTLETS = VENUES.filter(v => v.cat === "Cafés");

const TIERS = [
  { id:"silver", name:"Silver", hex:"#A8A8A8", bg:"#F7F7F7", earn:1.0, paid:false, benefits:["1 point per $1 spent","Birthday dessert or drink","Welcome $10 voucher","Café stamp card","Gift card access"] },
  { id:"gold", name:"Gold", hex:"#C5A258", bg:"#FDF8EE", earn:1.5, paid:true, benefits:["1.5× points on every dollar","Priority reservations","Upgraded birthday rewards","Exclusive events","Unlimited dining vouchers","Welcome $10 voucher"] },
  { id:"platinum", name:"Platinum", hex:"#5C5C5C", bg:"#2D2D2D", earn:2.0, paid:true, benefits:["2× points on every dollar","VIP reservations","Premium birthday experience","Concierge service","Unlimited dining vouchers","Partner benefits","Chef's table access"] },
  { id:"corporate", name:"Corporate", hex:"#1A3A5C", bg:"#E8EFF5", earn:1.5, paid:true, benefits:["1.5× points","Unlimited dining vouchers","Bulk gift cards","Event coordination","Dedicated account manager"] },
  { id:"staff", name:"Staff", hex:"#2E7D32", bg:"#E8F5E9", earn:1.0, paid:false, benefits:["Staff dining vouchers","Birthday reward","Internal event access"] },
];

const CATEGORIES = [
  { id:"cafes", name:"Cafés", icon:"☕", color:"#7B9E6B", desc:"Brunches, bakes & casual dining" },
  { id:"restaurants", name:"Restaurants", icon:"🍽️", color:"#B85C38", desc:"Fine dining & tasting menus" },
  { id:"bars", name:"Bars", icon:"🍸", color:"#6B4E8B", desc:"Cocktails, spirits & nightlife" },
  { id:"wines", name:"Wines", icon:"🍷", color:"#8B2252", desc:"Curated vintages & pairings" },
];

const fmtDate = d => new Date(d).toLocaleDateString('en-SG',{day:'numeric',month:'short',year:'numeric'});
const fmtNum = n => new Intl.NumberFormat('en-SG').format(n);

// ─── SUPABASE ────────────────────────────────────────────────────────────────
const SUPA_URL = "https://tobtmtshxgpkkucsaxyk.supabase.co";
const SUPA_KEY = "sb_publishable_M_yQLmU_5yc0yTccm4F_oA_xWKyTqx9";
const supaFetch = async (path, opts = {}) => {
  const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    headers: { "apikey": SUPA_KEY, "Authorization": `Bearer ${SUPA_KEY}`, "Content-Type": "application/json", "Prefer": opts.prefer || "return=representation", ...opts.headers },
    method: opts.method || "GET", body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  return res.json();
};
const mapMember = m => ({
  id:m.id, name:m.name, mobile:m.mobile, email:m.email, tier:m.tier, points:m.points,
  totalSpend:m.total_spend||0, categoryPref:m.category_pref||"restaurants", birthdayMonth:m.birthday_month||1,
  signupDate:m.signup_date||m.created_at, lastVisit:m.last_visit||m.created_at, visits:m.visits||0,
  favouriteVenue:m.favourite_venue||"oumi", stamps:m.stamps||0, voucherSetsUsed:m.voucher_sets_used||0,
  membershipExpiry:m.membership_expiry||null,
});
const db = {
  async getMembers(){ try{ const d=await supaFetch("members?order=id.asc"); return Array.isArray(d)?d.map(mapMember):[]; }catch{ return []; }},
  async getRewards(){ try{ const d=await supaFetch("rewards?active=eq.true&order=points_cost.asc"); return Array.isArray(d)?d:[]; }catch{ return []; }},
  async getTransactions(memberId){ try{ const d=await supaFetch(`transactions?member_id=eq.${memberId}&order=created_at.desc`); return Array.isArray(d)?d:[]; }catch{ return []; }},
  async getTiers(){ try{ const d=await supaFetch("tiers?order=threshold.asc"); return Array.isArray(d)?d:[]; }catch{ return []; }},
  async redeemReward(memberId, reward, currentPoints){
    const newPoints = currentPoints - reward.points_cost;
    // Deduct points
    await supaFetch(`members?id=eq.${memberId}`, { method:"PATCH", body:{points:newPoints} });
    // Increment redemptions
    await supaFetch(`rewards?id=eq.${reward.id}`, { method:"PATCH", body:{redemptions:(reward.redemptions||0)+1} });
    // Insert transaction
    await supaFetch("transactions", { method:"POST", body:{member_id:memberId, venue:"1-Insider Rewards", amount:0, points:-reward.points_cost, type:"redeem", reward_name:reward.name} });
    return newPoints;
  },
};

// ─── TYPOGRAPHY & STYLES ────────────────────────────────────────────────────
const font = {
  h: "'Playfair Display', Georgia, serif",
  b: "'DM Sans', system-ui, sans-serif",
};

const tierColors = {
  silver: { text:"#666", bg:"#F7F7F7", accent:"#A8A8A8", card:"linear-gradient(135deg,#e8e8e8 0%,#d0d0d0 100%)" },
  gold: { text:"#8B6914", bg:"#FDF8EE", accent:"#C5A258", card:"linear-gradient(135deg,#C5A258 0%,#D4B978 50%,#A88B3A 100%)" },
  platinum: { text:"#fff", bg:"#2D2D2D", accent:"#5C5C5C", card:"linear-gradient(135deg,#3a3a3a 0%,#1a1a1a 50%,#4a4a4a 100%)" },
  corporate: { text:"#1A3A5C", bg:"#E8EFF5", accent:"#1A3A5C", card:"linear-gradient(135deg,#1A3A5C 0%,#2A5A8C 100%)" },
  staff: { text:"#2E7D32", bg:"#E8F5E9", accent:"#2E7D32", card:"linear-gradient(135deg,#2E7D32 0%,#4CAF50 100%)" },
};

// (Seed data removed — using Supabase for members, rewards, transactions)

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [view,setView]=useState("landing"); // landing | otp | dashboard
  const [phone,setPhone]=useState("");
  const [otp,setOtp]=useState("");
  const [member,setMember]=useState(null);
  const [tab,setTab]=useState("home");
  const [members,setMembers]=useState([]);
  const [loading,setLoading]=useState(true);
  const [catFilter,setCatFilter]=useState("all");
  const [redeemModal,setRedeemModal]=useState(null);
  const [redeemSuccess,setRedeemSuccess]=useState(false);
  const [supaRewards,setSupaRewards]=useState([]);
  const [transactions,setTransactions]=useState([]);

  useEffect(()=>{(async()=>{
    // Load members from Supabase
    const m = await db.getMembers();
    setMembers(m.length ? m : []);
    // Load rewards from Supabase
    const r = await db.getRewards();
    setSupaRewards(r);
    setLoading(false);
  })()},[]);

  const handleLogin = async () => {
    const found = members.find(m=>m.mobile.replace(/\s/g,'').includes(phone.replace(/\s/g,'').replace('+65','')));
    const loggedIn = found || (members.length>0 ? members[0] : null);
    if(loggedIn){
      setMember(loggedIn);
      const txs = await db.getTransactions(loggedIn.id);
      setTransactions(txs);
      setView("dashboard");
    }
  };

  if(loading) return (
    <div style={{fontFamily:font.b,background:"#111",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
      <div style={{fontSize:30,color:"#C5A258",fontFamily:font.h,fontWeight:700,letterSpacing:3}}>1-INSIDER</div>
      <div style={{fontSize:10,color:"#555",letterSpacing:2.5,textTransform:"uppercase"}}>Dining Rewards by 1-Group</div>
      <div style={{width:36,height:36,border:"3px solid #333",borderTopColor:"#C5A258",borderRadius:"50%",animation:"spin .7s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  // ─── LANDING PAGE ────────────────────────────────────────────────────────
  if(view==="landing") return (
    <div style={{fontFamily:font.b,background:"#111",minHeight:"100vh",color:"#fff"}}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        .fu{animation:fadeUp .6s ease both}
        .fu2{animation:fadeUp .6s ease .15s both}
        .fu3{animation:fadeUp .6s ease .3s both}
        .fu4{animation:fadeUp .6s ease .45s both}
        button:hover{opacity:.88}
      `}</style>

      {/* Hero */}
      <div style={{padding:"80px 24px 60px",textAlign:"center",maxWidth:480,margin:"0 auto"}}>
        <div className="fu" style={{fontSize:11,color:"#C5A258",letterSpacing:4,textTransform:"uppercase",marginBottom:20,fontWeight:600}}>1-Group Singapore</div>
        <h1 className="fu2" style={{fontFamily:font.h,fontSize:42,fontWeight:700,margin:"0 0 16px",letterSpacing:1,lineHeight:1.15,color:"#fff"}}>1-INSIDER</h1>
        <p className="fu3" style={{color:"#888",fontSize:15,lineHeight:1.7,margin:"0 0 36px"}}>
          Your passport to Singapore's finest dining, bars, and cafés. Earn points at {VENUES.length} venues. Redeem for extraordinary experiences.
        </p>
        <button className="fu4" onClick={()=>setView("otp")} style={{background:"#C5A258",color:"#fff",border:"none",padding:"16px 48px",borderRadius:10,fontSize:15,fontWeight:600,fontFamily:font.b,cursor:"pointer",letterSpacing:.5,transition:"all .2s"}}>
          Sign In / Join Free
        </button>
        <div className="fu4" style={{marginTop:16,fontSize:12,color:"#555"}}>No app download required</div>
      </div>

      {/* Tier Cards */}
      <div style={{padding:"0 24px 50px",maxWidth:480,margin:"0 auto"}}>
        <div style={{fontSize:10,color:"#C5A258",letterSpacing:3,textTransform:"uppercase",marginBottom:16,fontWeight:600,textAlign:"center"}}>Membership Tiers</div>
        {TIERS.filter(t=>t.id!=='staff'&&t.id!=='corporate').map((t,i)=>(
          <div key={t.id} style={{background:tierColors[t.id].card,borderRadius:14,padding:22,marginBottom:12,position:"relative",overflow:"hidden"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <div style={{fontSize:18,fontWeight:700,fontFamily:font.h,color:t.id==='platinum'||t.id==='gold'?"#fff":"#333"}}>{t.name}</div>
                <div style={{fontSize:11,color:t.id==='platinum'?"#aaa":t.id==='gold'?"rgba(255,255,255,.8)":"#888",marginTop:3}}>
                  {t.paid?"Paid annual membership":"Free to join"}
                </div>
              </div>
              <div style={{fontSize:24,fontWeight:700,fontFamily:font.h,color:t.id==='platinum'||t.id==='gold'?"rgba(255,255,255,.9)":"#666"}}>{t.earn}×</div>
            </div>
            <div style={{marginTop:14,display:"flex",flexWrap:"wrap",gap:6}}>
              {t.benefits.slice(0,3).map((b,j)=><span key={j} style={{fontSize:10,padding:"3px 8px",borderRadius:6,background:"rgba(255,255,255,.15)",color:t.id==='platinum'||t.id==='gold'?"rgba(255,255,255,.85)":"#555"}}>{b}</span>)}
            </div>
          </div>
        ))}
      </div>

      {/* Venue Strip */}
      <div style={{padding:"0 24px 60px",maxWidth:480,margin:"0 auto"}}>
        <div style={{fontSize:10,color:"#C5A258",letterSpacing:3,textTransform:"uppercase",marginBottom:16,fontWeight:600,textAlign:"center"}}>{VENUES.length} Venues</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {VENUES.slice(0,8).map(v=>(
            <div key={v.id} style={{background:"#1a1a1a",borderRadius:10,padding:14,border:"1px solid #222"}}>
              <div style={{fontWeight:600,fontSize:13,color:"#fff"}}>{v.name}</div>
              <div style={{fontSize:10,color:"#666",marginTop:3}}>{v.cuisine||v.cat} · {v.loc}</div>
            </div>
          ))}
        </div>
        <div style={{textAlign:"center",marginTop:12,fontSize:12,color:"#555"}}>+ {VENUES.length-8} more venues</div>
      </div>
    </div>
  );

  // ─── OTP SCREEN ──────────────────────────────────────────────────────────
  if(view==="otp") return (
    <div style={{fontFamily:font.b,background:"#111",minHeight:"100vh",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
        .fu{animation:fadeUp .5s ease both}
        input:focus{border-color:#C5A258!important;box-shadow:0 0 0 3px rgba(197,162,88,.15)}
        button:hover{opacity:.88}
      `}</style>
      <div className="fu" style={{maxWidth:380,width:"100%",padding:32,textAlign:"center"}}>
        <div style={{fontSize:28,fontFamily:font.h,fontWeight:700,color:"#C5A258",letterSpacing:2,marginBottom:6}}>1-INSIDER</div>
        <p style={{color:"#666",fontSize:13,marginBottom:32}}>Enter your mobile number to sign in</p>

        <div style={{background:"#1a1a1a",borderRadius:12,padding:28,border:"1px solid #222"}}>
          <div style={{marginBottom:16}}>
            <div style={{fontSize:10,color:"#888",textTransform:"uppercase",letterSpacing:1.5,marginBottom:8,textAlign:"left"}}>Mobile Number</div>
            <div style={{display:"flex",gap:8}}>
              <div style={{background:"#222",borderRadius:8,padding:"12px 14px",fontSize:14,color:"#888",fontFamily:font.b}}>+65</div>
              <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="9XXX XXXX" style={{flex:1,background:"#222",border:"1px solid #333",borderRadius:8,padding:"12px 14px",fontSize:14,color:"#fff",fontFamily:font.b,outline:"none"}}/>
            </div>
          </div>

          <div style={{marginBottom:20}}>
            <div style={{fontSize:10,color:"#888",textTransform:"uppercase",letterSpacing:1.5,marginBottom:8,textAlign:"left"}}>OTP Code</div>
            <input value={otp} onChange={e=>setOtp(e.target.value)} placeholder="Enter 6-digit code" style={{width:"100%",background:"#222",border:"1px solid #333",borderRadius:8,padding:"12px 14px",fontSize:14,color:"#fff",fontFamily:font.b,outline:"none",boxSizing:"border-box",letterSpacing:4,textAlign:"center"}}/>
          </div>

          <button onClick={handleLogin} style={{width:"100%",background:"#C5A258",color:"#fff",border:"none",padding:"14px",borderRadius:8,fontSize:14,fontWeight:600,fontFamily:font.b,cursor:"pointer"}}>
            Sign In
          </button>

          <div style={{marginTop:16,padding:10,background:"rgba(197,162,88,.08)",borderRadius:8,fontSize:11,color:"#C5A258",lineHeight:1.5}}>
            Demo mode — enter any number and tap Sign In to explore the member dashboard.
          </div>
        </div>

        <button onClick={()=>setView("landing")} style={{marginTop:20,background:"none",border:"none",color:"#555",fontSize:12,cursor:"pointer",fontFamily:font.b}}>← Back</button>
      </div>
    </div>
  );

  // ─── MEMBER DASHBOARD ────────────────────────────────────────────────────
  const tier = TIERS.find(t=>t.id===member?.tier)||TIERS[0];
  const tc = tierColors[member?.tier||"silver"];
  // Use real transactions from Supabase
  const activity = transactions.map((t,i)=>({
    id:t.id||i, type:t.type, venue:t.venue||t.reward_name, points:t.points,
    date:t.created_at, desc:t.type==="redeem"?`Redeemed: ${t.reward_name}`:`Dining at ${t.venue}`,
  }));
  // Use Supabase rewards, mapped to UI format
  const catIcons = {cafes:"☕",restaurants:"🍽️",bars:"🍸",wines:"🍷"};
  const rewards = supaRewards.filter(r=>r.points_cost>0).map(r=>({
    ...r, icon:catIcons[r.category]||"★", points:r.points_cost,
  }));
  const filteredRewards = catFilter==="all"?rewards:rewards.filter(r=>r.category===catFilter);
  const activeVouchers = [
    {name:"Welcome $10 Voucher",value:10,expiry:"2026-05-15",status:"active"},
    ...(tier.paid?[{name:`${tier.name} Dining $${tier.id==='platinum'?30:tier.id==='gold'?20:25} Voucher`,value:tier.id==='platinum'?30:tier.id==='gold'?20:25,expiry:"2026-12-31",status:"active"}]:[]),
  ];

  const TABS = [
    {id:"home",label:"Home",icon:"◆"},
    {id:"rewards",label:"Rewards",icon:"★"},
    {id:"stamps",label:"Stamps",icon:"●"},
    {id:"activity",label:"Activity",icon:"≡"},
    {id:"profile",label:"Profile",icon:"◉"},
  ];

  return (
    <div style={{fontFamily:font.b,background:"#FAFAF8",minHeight:"100vh",color:"#1A1A1A",maxWidth:480,margin:"0 auto",position:"relative",paddingBottom:72}}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
      <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .fade{animation:fadeIn .3s ease}
        button:hover{opacity:.9}
        ::-webkit-scrollbar{width:0}
      `}</style>

      {/* Header */}
      <div style={{background:"#111",padding:"16px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:50}}>
        <div style={{fontSize:18,fontFamily:font.h,fontWeight:700,color:"#C5A258",letterSpacing:2}}>1-INSIDER</div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:11,color:"#888"}}>{member?.name?.split(' ')[0]}</span>
          <div style={{width:32,height:32,borderRadius:"50%",background:tc.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:"#fff"}}>{member?.name?.[0]}</div>
        </div>
      </div>

      {/* Content */}
      <div style={{padding:"20px"}} className="fade">

        {/* ─── HOME TAB ─── */}
        {tab==="home"&&<div>
          <div style={{marginBottom:20}}>
            <div style={{fontSize:13,color:"#888"}}>Welcome back,</div>
            <h1 style={{fontFamily:font.h,fontSize:26,fontWeight:700,margin:"4px 0 0"}}>{member?.name}</h1>
          </div>

          {/* Tier Card */}
          <div style={{background:tc.card,borderRadius:16,padding:24,marginBottom:20,position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:0,right:0,width:120,height:120,borderRadius:"50%",background:"rgba(255,255,255,.06)",transform:"translate(30%,-30%)"}}/>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <div style={{fontSize:10,color:"rgba(255,255,255,.5)",textTransform:"uppercase",letterSpacing:2,marginBottom:4}}>1-Insider · {tier.name}</div>
                <div style={{fontSize:34,fontWeight:700,fontFamily:font.h,color:"#fff"}}>{fmtNum(member?.points||0)}</div>
                <div style={{fontSize:12,color:"rgba(255,255,255,.6)",marginTop:2}}>points available</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:28,fontWeight:700,fontFamily:font.h,color:"rgba(255,255,255,.8)"}}>{tier.earn}×</div>
                <div style={{fontSize:10,color:"rgba(255,255,255,.4)"}}>earn rate</div>
              </div>
            </div>
            <div style={{marginTop:18,display:"flex",gap:8}}>
              <div style={{flex:1,background:"rgba(255,255,255,.1)",borderRadius:8,padding:10,textAlign:"center"}}>
                <div style={{fontSize:9,color:"rgba(255,255,255,.4)",textTransform:"uppercase",letterSpacing:1}}>Visits</div>
                <div style={{fontSize:18,fontWeight:700,color:"#fff",fontFamily:font.h}}>{member?.visits||0}</div>
              </div>
              <div style={{flex:1,background:"rgba(255,255,255,.1)",borderRadius:8,padding:10,textAlign:"center"}}>
                <div style={{fontSize:9,color:"rgba(255,255,255,.4)",textTransform:"uppercase",letterSpacing:1}}>Stamps</div>
                <div style={{fontSize:18,fontWeight:700,color:"#fff",fontFamily:font.h}}>{member?.stamps||0}/10</div>
              </div>
              <div style={{flex:1,background:"rgba(255,255,255,.1)",borderRadius:8,padding:10,textAlign:"center"}}>
                <div style={{fontSize:9,color:"rgba(255,255,255,.4)",textTransform:"uppercase",letterSpacing:1}}>Member</div>
                <div style={{fontSize:18,fontWeight:700,color:"#fff",fontFamily:font.h}}>{member?.id}</div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:24}}>
            {[
              {label:"Rewards",icon:"★",tab:"rewards",bg:"#FDF8EE",c:"#C5A258"},
              {label:"My Stamps",icon:"●",tab:"stamps",bg:"#E8F5E9",c:"#2E7D32"},
              {label:"Activity",icon:"≡",tab:"activity",bg:"#E8EFF5",c:"#1A3A5C"},
              {label:"Profile",icon:"◉",tab:"profile",bg:"#F5F5F5",c:"#666"},
            ].map(q=><button key={q.tab} onClick={()=>setTab(q.tab)} style={{background:q.bg,border:"none",borderRadius:12,padding:18,cursor:"pointer",textAlign:"left",fontFamily:font.b,transition:"all .2s"}}>
              <div style={{fontSize:20,marginBottom:6}}>{q.icon}</div>
              <div style={{fontSize:13,fontWeight:600,color:q.c}}>{q.label}</div>
            </button>)}
          </div>

          {/* Active Vouchers */}
          <div style={{marginBottom:24}}>
            <div style={{fontSize:14,fontWeight:600,fontFamily:font.h,marginBottom:12}}>Your Vouchers</div>
            {activeVouchers.map((v,i)=>(
              <div key={i} style={{background:"#fff",borderRadius:12,padding:16,marginBottom:8,border:"1px solid rgba(0,0,0,.04)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontWeight:500,fontSize:13}}>{v.name}</div>
                  <div style={{fontSize:11,color:"#888",marginTop:2}}>Expires {fmtDate(v.expiry)}</div>
                </div>
                <div style={{fontSize:20,fontWeight:700,fontFamily:font.h,color:"#C5A258"}}>${v.value}</div>
              </div>
            ))}
          </div>

          {/* Benefits */}
          <div>
            <div style={{fontSize:14,fontWeight:600,fontFamily:font.h,marginBottom:12}}>Your {tier.name} Benefits</div>
            {tier.benefits.map((b,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:i<tier.benefits.length-1?"1px solid #f0f0f0":"none"}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:tc.accent,flexShrink:0}}/>
              <span style={{fontSize:12,color:"#444"}}>{b}</span>
            </div>)}
          </div>
        </div>}

        {/* ─── REWARDS TAB ─── */}
        {tab==="rewards"&&<div>
          <h1 style={{fontFamily:font.h,fontSize:24,fontWeight:700,margin:"0 0 4px"}}>Rewards</h1>
          <p style={{color:"#888",fontSize:12,margin:"0 0 18px"}}>{fmtNum(member?.points||0)} points available · Browse by category</p>

          <div style={{display:"flex",gap:8,marginBottom:20,overflowX:"auto"}}>
            <button onClick={()=>setCatFilter("all")} style={{padding:"8px 16px",borderRadius:20,border:"none",background:catFilter==="all"?"#111":"#f0f0f0",color:catFilter==="all"?"#C5A258":"#666",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:font.b,whiteSpace:"nowrap"}}>All</button>
            {CATEGORIES.map(c=><button key={c.id} onClick={()=>setCatFilter(c.id)} style={{padding:"8px 16px",borderRadius:20,border:"none",background:catFilter===c.id?"#111":"#f0f0f0",color:catFilter===c.id?"#C5A258":"#666",fontSize:12,fontWeight:500,cursor:"pointer",fontFamily:font.b,whiteSpace:"nowrap"}}>{c.icon} {c.name}</button>)}
          </div>

          {filteredRewards.map(r=>{
            const canRedeem = (member?.points||0)>=r.points;
            return <div key={r.id} style={{background:"#fff",borderRadius:14,padding:18,marginBottom:10,border:"1px solid rgba(0,0,0,.04)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:20}}>{r.icon}</span>
                    <div style={{fontWeight:600,fontSize:14}}>{r.name}</div>
                  </div>
                  <div style={{fontSize:11,color:"#888",marginTop:4,marginLeft:28}}>{r.description}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:16,fontWeight:700,fontFamily:font.h,color:"#C5A258"}}>{fmtNum(r.points)}</div>
                  <div style={{fontSize:9,color:"#999",textTransform:"uppercase",letterSpacing:1}}>points</div>
                </div>
              </div>
              <button onClick={()=>canRedeem&&setRedeemModal(r)} style={{marginTop:12,width:"100%",padding:"10px",borderRadius:8,border:"none",background:canRedeem?"#111":"#eee",color:canRedeem?"#C5A258":"#bbb",fontSize:12,fontWeight:600,cursor:canRedeem?"pointer":"default",fontFamily:font.b}}>
                {canRedeem?"Redeem Now":`Need ${fmtNum(r.points-(member?.points||0))} more points`}
              </button>
            </div>;
          })}

          {redeemModal&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,backdropFilter:"blur(4px)",padding:20}} onClick={()=>setRedeemModal(null)}>
            <div style={{background:"#fff",borderRadius:16,padding:28,maxWidth:340,width:"100%",textAlign:"center"}} onClick={e=>e.stopPropagation()}>
              <div style={{fontSize:36,marginBottom:12}}>{redeemModal.icon}</div>
              <h3 style={{fontFamily:font.h,fontSize:20,margin:"0 0 8px"}}>{redeemModal.name}</h3>
              <p style={{color:"#888",fontSize:12,margin:"0 0 20px"}}>{redeemModal.description}</p>
              <div style={{background:"#FAF8F5",borderRadius:10,padding:14,marginBottom:20}}>
                <div style={{fontSize:10,color:"#999",textTransform:"uppercase",letterSpacing:1}}>Cost</div>
                <div style={{fontSize:28,fontWeight:700,fontFamily:font.h,color:"#C5A258"}}>{fmtNum(redeemModal.points)} pts</div>
              </div>
              <button onClick={async()=>{
                const newPts = await db.redeemReward(member.id, redeemModal, member.points);
                setMember(prev=>({...prev,points:newPts}));
                const txs = await db.getTransactions(member.id);
                setTransactions(txs);
                const freshRewards = await db.getRewards();
                setSupaRewards(freshRewards);
                setRedeemSuccess(true);
                setTimeout(()=>{setRedeemModal(null);setRedeemSuccess(false)},2000);
              }} style={{width:"100%",background:"#C5A258",color:"#fff",border:"none",padding:14,borderRadius:8,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:font.b}}>{redeemSuccess?"✓ Redeemed!":"Confirm Redemption"}</button>
              <button onClick={()=>setRedeemModal(null)} style={{marginTop:10,background:"none",border:"none",color:"#888",fontSize:12,cursor:"pointer"}}>Cancel</button>
            </div>
          </div>}
        </div>}

        {/* ─── STAMPS TAB ─── */}
        {tab==="stamps"&&<div>
          <h1 style={{fontFamily:font.h,fontSize:24,fontWeight:700,margin:"0 0 4px"}}>Café Stamps</h1>
          <p style={{color:"#888",fontSize:12,margin:"0 0 22px"}}>Earn 1 stamp per $10 spent at any Wildseed Café</p>

          {/* Stamp Grid */}
          <div style={{background:"#fff",borderRadius:16,padding:24,marginBottom:20,border:"1px solid rgba(0,0,0,.04)"}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10}}>
              {[1,2,3,4,5,6,7,8,9,10].map(n=>{
                const filled = n<=(member?.stamps||0);
                const isThreshold = [3,5,6,8,10].includes(n);
                return <div key={n} style={{aspectRatio:"1",borderRadius:12,background:filled?"#7B9E6B":"#f5f5f5",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",border:isThreshold?"2px solid #7B9E6B":"2px solid transparent",transition:"all .2s"}}>
                  <div style={{fontSize:filled?16:14,fontWeight:700,color:filled?"#fff":"#ccc",fontFamily:font.h}}>{filled?"☕":n}</div>
                  {isThreshold&&<div style={{fontSize:7,color:filled?"rgba(255,255,255,.7)":"#7B9E6B",marginTop:2,fontWeight:600}}>REWARD</div>}
                </div>;
              })}
            </div>
            <div style={{textAlign:"center",marginTop:16}}>
              <div style={{fontSize:24,fontWeight:700,fontFamily:font.h,color:"#7B9E6B"}}>{member?.stamps||0}/10</div>
              <div style={{fontSize:11,color:"#888",marginTop:2}}>stamps collected</div>
            </div>
          </div>

          {/* Café Outlets */}
          <div style={{fontSize:14,fontWeight:600,fontFamily:font.h,marginBottom:12}}>Participating Outlets</div>
          {CAFE_OUTLETS.map(v=><div key={v.id} style={{background:"#fff",borderRadius:10,padding:14,marginBottom:8,border:"1px solid rgba(0,0,0,.04)",display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:10,height:10,borderRadius:"50%",background:"#7B9E6B",flexShrink:0}}/>
            <div><div style={{fontWeight:500,fontSize:13}}>{v.name}</div><div style={{fontSize:10,color:"#888"}}>{v.loc}</div></div>
          </div>)}
        </div>}

        {/* ─── ACTIVITY TAB ─── */}
        {tab==="activity"&&<div>
          <h1 style={{fontFamily:font.h,fontSize:24,fontWeight:700,margin:"0 0 4px"}}>Activity</h1>
          <p style={{color:"#888",fontSize:12,margin:"0 0 22px"}}>Points earned, redeemed, and venue visits</p>

          {activity.map(a=><div key={a.id} style={{background:"#fff",borderRadius:12,padding:16,marginBottom:8,border:"1px solid rgba(0,0,0,.04)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontWeight:500,fontSize:13}}>{a.desc}</div>
              <div style={{fontSize:11,color:"#888",marginTop:3}}>{fmtDate(a.date)}</div>
            </div>
            <div style={{fontSize:16,fontWeight:700,fontFamily:font.h,color:a.type==="earn"?"#4CAF50":"#D32F2F"}}>
              {a.type==="earn"?"+":""}{fmtNum(a.points)}
            </div>
          </div>)}
        </div>}

        {/* ─── PROFILE TAB ─── */}
        {tab==="profile"&&<div>
          <h1 style={{fontFamily:font.h,fontSize:24,fontWeight:700,margin:"0 0 22px"}}>Profile</h1>

          {/* Tier Card Mini */}
          <div style={{background:tc.card,borderRadius:14,padding:20,marginBottom:22,color:"#fff"}}>
            <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:2,color:"rgba(255,255,255,.5)"}}>Current Tier</div>
            <div style={{fontSize:24,fontWeight:700,fontFamily:font.h,marginTop:4}}>{tier.name}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.6)",marginTop:2}}>{tier.paid?"Paid membership":"Free membership"}</div>
            {member?.membershipExpiry&&<div style={{fontSize:11,color:"rgba(255,255,255,.5)",marginTop:8}}>Expires: {fmtDate(member.membershipExpiry)}</div>}
          </div>

          {/* Details */}
          <div style={{background:"#fff",borderRadius:14,padding:20,marginBottom:16,border:"1px solid rgba(0,0,0,.04)"}}>
            {[
              {l:"Name",v:member?.name},
              {l:"Member ID",v:member?.id},
              {l:"Mobile",v:member?.mobile},
              {l:"Email",v:member?.email},
              {l:"Birthday Month",v:new Date(2026,(member?.birthdayMonth||1)-1).toLocaleString('en',{month:'long'})},
              {l:"Member Since",v:member?.signupDate?fmtDate(member.signupDate):"—"},
            ].map((f,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"11px 0",borderBottom:i<5?"1px solid #f5f5f5":"none"}}>
              <span style={{fontSize:12,color:"#888"}}>{f.l}</span>
              <span style={{fontSize:12,fontWeight:500}}>{f.v}</span>
            </div>)}
          </div>

          {/* Category Preference */}
          <div style={{background:"#fff",borderRadius:14,padding:20,marginBottom:16,border:"1px solid rgba(0,0,0,.04)"}}>
            <div style={{fontSize:13,fontWeight:600,marginBottom:12}}>Reward Category Preference</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {CATEGORIES.map(c=>{
                const active = c.id===member?.categoryPref;
                return <div key={c.id} style={{background:active?c.color+"18":"#f8f8f8",borderRadius:10,padding:14,textAlign:"center",border:active?`2px solid ${c.color}`:"2px solid transparent",cursor:"pointer"}}>
                  <div style={{fontSize:22}}>{c.icon}</div>
                  <div style={{fontSize:12,fontWeight:active?600:400,color:active?c.color:"#888",marginTop:4}}>{c.name}</div>
                  <div style={{fontSize:9,color:"#aaa",marginTop:2}}>{c.desc}</div>
                </div>;
              })}
            </div>
          </div>

          {/* Upgrade Path */}
          {tier.id==='silver'&&<div style={{background:"#FDF8EE",borderRadius:14,padding:20,border:"1px solid #E8D5A8"}}>
            <div style={{fontSize:13,fontWeight:600,color:"#8B6914",marginBottom:6}}>Upgrade to Gold</div>
            <p style={{fontSize:12,color:"#5D4037",lineHeight:1.5,margin:0}}>Unlock 1.5× earn rate, priority reservations, unlimited dining vouchers, and exclusive event access with a Gold membership.</p>
            <button style={{marginTop:14,background:"#C5A258",color:"#fff",border:"none",padding:"10px 24px",borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:font.b}}>Learn More</button>
          </div>}

          <button onClick={()=>{setView("landing");setMember(null);setTab("home")}} style={{marginTop:20,width:"100%",background:"none",border:"1px solid #ddd",padding:"12px",borderRadius:10,fontSize:12,color:"#888",cursor:"pointer",fontFamily:font.b}}>Sign Out</button>
        </div>}
      </div>

      {/* Bottom Navigation */}
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:"#fff",borderTop:"1px solid #eee",display:"flex",justifyContent:"space-around",padding:"8px 0 12px",zIndex:50}}>
        {TABS.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"4px 12px",fontFamily:font.b}}>
          <span style={{fontSize:16,color:tab===t.id?"#C5A258":"#ccc"}}>{t.icon}</span>
          <span style={{fontSize:9,fontWeight:tab===t.id?600:400,color:tab===t.id?"#C5A258":"#999",textTransform:"uppercase",letterSpacing:.8}}>{t.label}</span>
        </button>)}
      </div>
    </div>
  );
}
