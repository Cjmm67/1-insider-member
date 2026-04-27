import { useState, useEffect, useCallback, useMemo, Fragment } from "react";

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
  gold: { name: "Gold", fee: "$40/yr", earn: "$1 = 1.5 pts", bday: "15%", nonStop: true, vCount: 10, vValue: 20, benefits: ["Enhanced earn rate ($1 = 1.5 points)","15% birthday discount on total bill","10×$20 dining vouchers (Non-Stop Hits)","Priority reservations","Exclusive event access","Café stamp card"] },
  platinum: { name: "Platinum", fee: "$80/yr", earn: "$1 = 2 pts", bday: "20%", nonStop: true, vCount: 10, vValue: 25, benefits: ["Premium earn rate ($1 = 2 points)","20% birthday discount on total bill","10×$25 dining vouchers (Non-Stop Hits)","VIP reservations","Concierge service","Chef's table access","Café stamp card"] },
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

// ─── VENUE_DIRECTORY: 1-Group venues shown on Landing page ───
// URLs audited against live 1-Group websites (April 2026).
// Thumbnails sourced from each venue's own website — prefer exterior/building shots
// where available, otherwise the venue's hero brand image.
// Fallbacks to 1-group.sg parent pages where a dedicated site doesn't exist —
// flagged with comments so Chris can update as individual sites launch.
const VENUE_DIRECTORY = [
  {
    name: "1-Alfaro",
    url: "https://1-alfaro.sg/",
    thumbnail: "https://1-alfaro.sg/wp-content/uploads/2025/06/250527_ALFARO_EDITED-0610Web-1.jpg",
    subs: [
      { name: "La Luna",  url: "https://laluna.sg/" },
      { name: "La Torre", url: "https://1-alfaro.sg/la-torre/" },
    ],
  },
  {
    name: "1-Altitude Coast",
    url: "https://1-altitudecoast.sg/",
    thumbnail: "https://1-altitudecoast.sg/wp-content/uploads/2025/08/Manifest-1AltitudeCoast-35-e1717670224707-1.jpg",
    subs: [
      { name: "Sol & Ora",            url: "https://solandora.sg/" },
      { name: "1-Altitude Coast Bar", url: "https://1-altitudecoast.sg/rooftop-bar-2/" },
    ],
  },
  {
    name: "1-Altitude Melaka",
    url: "https://1-altitude.my/",
    thumbnail: "https://1-altitude.my/wp-content/uploads/2023/08/1-Altitude-Rooftop-bar.jpg",
    subs: [
      { name: "Monti",                         url: "https://www.monti.my/" },
      { name: "Mimi",                          url: "https://mimirestaurant.my/" },
      { name: "1-Altitude Bar & Sky Dining",   url: "https://1-altitude.my/rooftopbar/" },
      { name: "Wildseed Cafe",                 url: "https://wildseed.my/" },
      { name: "Wildseed Bistro",               url: "https://wildseed.my/" },
    ],
  },
  {
    name: "1-Arden",
    url: "https://www.1-arden.sg/",
    thumbnail: "https://www.1-arden.sg/wp-content/uploads/2023/08/Arden-Drone.jpg",
    subs: [
      { name: "Sol & Luna",    url: "https://solandluna.sg/" },
      { name: "Oumi",          url: "https://www.oumi.sg/" },
      { name: "Kaarla",        url: "https://kaarla.sg/" },
      { name: "1-Arden Bar",   url: "https://www.1-arden.sg/1-arden-bar/" },
    ],
  },
  {
    name: "1-Atico",
    url: "https://1-atico.sg/",
    thumbnail: "https://www.flnt.sg/wp-content/uploads/2024/12/flnt-singapore.jpg",
    subs: [
      { name: "1-Atico Lounge", url: "https://1-atico.sg/atico-lounge/" },
      { name: "Fire",           url: "https://firerestaurant.sg/" },
      { name: "Flnt",           url: "https://www.flnt.sg/" },
    ],
  },
  {
    name: "1-Flowerhill",
    url: "https://www.wildseedcafe.sg/1-flowerhill/", // TODO: swap to 1-flowerhill.sg if/when live
    thumbnail: "https://www.wildseedcafe.sg/wp-content/uploads/2025/09/817-1FlowerHill-FIF-scaled-e1757058778532.jpg",
    subs: [
      { name: "Camille",                url: "https://www.1-group.sg/camille" },
      { name: "Wildseed Cafe",          url: "https://www.wildseedcafe.sg/1-flowerhill/" },
      { name: "Wildseed Bar & Grill",   url: "https://www.1-group.sg/wildseed-bar-grill" },
    ],
  },
  {
    name: "Monti",
    url: "https://www.monti.sg/",
    thumbnail: "https://www.monti.sg/wp-content/uploads/2024/10/MONTI-Exterior-in-the-Evening.jpg",
    subs: [],
  },
  {
    name: "The Alkaff Mansion",
    url: "https://thealkaffmansion.sg/",
    thumbnail: "https://thealkaffmansion.sg/wp-content/uploads/slider/cache/f43c70e1ab3f864666cf4c0fa8bef66a/TAM-Website-Slider-1.png",
    subs: [
      { name: "Una",             url: "https://www.una.sg/" },
      { name: "1918",            url: "https://1918bar.sg/" },
      { name: "Wildseed Cafe",   url: "https://www.wildseedcafe.sg/the-alkaff-mansion/" },
    ],
  },
  {
    name: "The Garage",
    url: "https://www.wildseedcafe.sg/the-garage/",
    thumbnail: "https://www.wildseedcafe.sg/wp-content/uploads/2025/12/R0001858-1-scaled.jpg",
    subs: [
      { name: "iL Giardino",     url: "https://www.1-group.sg/il-giardino" },
      { name: "Wildseed Cafe",   url: "https://www.wildseedcafe.sg/the-garage/" },
    ],
  },
  {
    name: "The River House",
    url: "https://www.theriverhouse.sg/",
    thumbnail: "/venues/river-house.jpg",
    subs: [
      { name: "Mimi",   url: "https://www.mimirestaurant.sg/" },
      { name: "Zorba",  url: "https://www.zorba.sg/" },
      { name: "Yin",    url: "https://www.yinyang.sg/yin" },
      { name: "Yang",   url: "https://www.yinyang.sg/" },
    ],
  },
  {
    name: "The Summer House",
    url: "https://www.thesummerhouse.sg/",
    thumbnail: "https://www.thesummerhouse.sg/wp-content/uploads/2022/03/The-Summerhouse_ext-scaled.jpg",
    subs: [
      { name: "Botanico",        url: "https://botanico.sg/" },
      { name: "Wildseed Cafe",   url: "https://www.wildseedcafe.sg/the-summerhouse/" },
      { name: "Wildseed Bistro", url: "https://www.thesummerhouse.sg/wildseed-bar/" },
    ],
  },
];

const VIEW = { LANDING: 0, SIGNIN: 1, HOME: 2, REWARDS: 3, STAMPS: 4, PROFILE: 5, WALLET: 6, GIFTCARDS: 7, EXPLORE: 8, HISTORY: 9, EVENTS: 10, SIGNUP: 11 };

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

// ═══════════════════════════════════════════════════════════════════════════
// V2 — Private Club Visual System (Phase 3, 1-insider-private-club-ui skill)
// ═══════════════════════════════════════════════════════════════════════════
// Additive layer on top of Phase 1 + Phase 2. URL param ?classic=1 falls back
// to the Phase 1/2 screens unchanged. Tokens from design-tokens.md; components
// from components.md; motion from motion.md.

const V2 = {
  bg:            "#0F111A",
  card:          "#1A1D27",
  elevated:      "#2A2D36",
  overlay:       "rgba(15, 17, 26, 0.7)",
  text:          "#F2F3F5",
  textSecondary: "#A8ABB3",
  textMuted:     "#6B6E76",
  textOnGold:    "#1A1D27",
  gold:          "#F5D7A6",
  goldSoft:      "#FBE8C9",
  goldShadow:    "#C79A5A",
  info:          "#4A8DFF",
  divider:       "rgba(242, 243, 245, 0.08)",
  dividerStrong: "rgba(242, 243, 245, 0.16)",
  goldBorder:    "rgba(245, 215, 166, 0.3)",
};

const useClassicMode = () => {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("classic") === "1";
};

// Inject V2 keyframes once per mount. Safe to include alongside Phase 1's
// existing @keyframes fadeIn and spin — keyframe names are v2- prefixed.
function V2Styles() {
  return (
    <style>{
      "@keyframes v2-fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }" +
      "@keyframes v2-sheen { 0% { transform: translateX(-60%); } 100% { transform: translateX(160%); } }" +
      "@keyframes v2-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.75; transform: scale(1.04); } }" +
      "@keyframes v2-slide-up { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }" +
      "@keyframes v2-slide-down { from { transform: translateY(0); opacity: 1; } to { transform: translateY(100%); opacity: 0; } }" +
      "@keyframes v2-fab-ignite { 0% { box-shadow: 0 0 0 0 rgba(245,215,166,0.5); } 100% { box-shadow: 0 0 0 80px rgba(245,215,166,0); } }" +
      "@keyframes v2-foil-shimmer { 0% { background-position: 200% 0%, 0% 0%; } 100% { background-position: -100% 0%, 0% 0%; } }" +
      // ENVELOPE REVEAL CHOREOGRAPHY
      // Envelope arrives: scales up from 0.6 + fades in.
      "@keyframes v2-envelope-arrive { " +
        "0% { opacity: 0; transform: translateY(40px) scale(0.6); } " +
        "100% { opacity: 1; transform: translateY(0) scale(1); } " +
      "}" +
      // Wax seal lights up just after envelope settles.
      "@keyframes v2-seal-shine { " +
        "0% { opacity: 0; transform: scale(0.6) rotate(-25deg); } " +
        "60% { opacity: 1; transform: scale(1.15) rotate(0deg); } " +
        "100% { opacity: 1; transform: scale(1) rotate(0deg); } " +
      "}" +
      // Envelope flap rotates open from its top hinge.
      "@keyframes v2-flap-open { " +
        "0% { transform: rotateX(0deg); } " +
        "100% { transform: rotateX(-180deg); } " +
      "}" +
      // Invitation card emerges out of envelope and rises to centre of
      // viewport. Card starts hidden BEHIND envelope (translateY(0) means
      // sitting at its anchored position inside pocket), then slides up
      // by 95% of its own height so its bottom edge is just above the
      // envelope's top edge — fully clear of the pocket and centred for
      // reading.
      "@keyframes v2-card-emerge { " +
        "0% { transform: translateY(0); opacity: 1; } " +
        "100% { transform: translateY(-95%); opacity: 1; } " +
      "}" +
      // Envelope descends out of frame as the card emerges, so the card
      // becomes the focus of the screen rather than being stacked on top
      // of the envelope. Envelope translates down by 120% of its height
      // (fully off-screen) and fades out.
      "@keyframes v2-envelope-descend { " +
        "0% { transform: translateY(0); opacity: 1; } " +
        "70% { transform: translateY(40%); opacity: 1; } " +
        "100% { transform: translateY(120%); opacity: 0; } " +
      "}" +
      // Card exit: after the user has had a moment to read it, the card
      // slides down off the bottom of the screen, opacity fading at the
      // same rate so it doesn't ghost behind the login.
      "@keyframes v2-card-exit { " +
        "0% { transform: translateY(0); opacity: 1; } " +
        "100% { transform: translateY(150vh); opacity: 0; } " +
      "}" +
      // Envelope itself fades out as the card emerges and expands to full screen.
      "@keyframes v2-envelope-dissolve { " +
        "0% { opacity: 1; } " +
        "70% { opacity: 1; } " +
        "100% { opacity: 0; } " +
      "}" +
      // Final expansion: invitation grows beyond viewport edges, becoming
      // the login backdrop, fading out so the actual login renders cleanly.
      "@keyframes v2-card-expand { " +
        "0% { transform: scale(1); opacity: 1; } " +
        "100% { transform: scale(8); opacity: 0; } " +
      "}" +
      "@keyframes v2-gold-shimmer { 0% { background-position: 200% 50%; } 50% { background-position: 0% 50%; } 100% { background-position: -200% 50%; } }" +
      "@keyframes v2-glow-pulse { 0%, 100% { box-shadow: 0 0 32px rgba(245, 215, 166, 0.25); } 50% { box-shadow: 0 0 48px rgba(245, 215, 166, 0.4); } }" +
      "@keyframes v2-shimmer-once { from { transform: translateX(-100%); opacity: 0; } to { transform: translateX(100%); opacity: 1; } }" +
      "@media (prefers-reduced-motion: reduce) { " +
      "  *[class*='v2-'] { animation-duration: 150ms !important; } " +
      "  .v2-sheen-overlay, .v2-fab-idle, .v2-qr-glow { animation: none !important; } " +
      "}"
    }</style>
  );
}

// V2 badge — renders top-right on every redesigned screen, taps to fall back
// to the Phase 1/2 classic version via ?classic=1.
function V2Badge() {
  return (
    <div
      onClick={() => {
        const url = new URL(window.location.href);
        url.searchParams.set("classic", "1");
        window.location.href = url.toString();
      }}
      style={{
        position: "fixed", top: 16, right: 16, zIndex: 1001,
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "4px 10px", borderRadius: 10,
        fontSize: 10, fontWeight: 600, letterSpacing: "0.12em",
        textTransform: "uppercase",
        background: "rgba(245, 215, 166, 0.15)",
        color: V2.gold,
        border: "1px solid " + V2.goldBorder,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        cursor: "pointer",
        fontFamily: FONT.b,
      }}
      title="View classic design"
    >
      ✦ V2 Design · View classic
    </div>
  );
}

// Circular gold FAB with built-in press state.
// ─── Gold foil palette — sampled from gold_foil.png reference ────────────
// Deep saturated honey gold with multi-stop horizontal sheen + dark accent
// for the polished foil look on FAB, primary button, and rich gold accents.
const V2_GOLD_FOIL_BG =
  "linear-gradient(135deg, " +
    "#B88320 0%, " +     // deep amber edge
    "#D4A42D 25%, " +    // warm midtone
    "#F6E5A0 45%, " +    // bright highlight crest
    "#E8C355 60%, " +    // returning gold
    "#C99725 80%, " +    // deep gold
    "#8B5F18 100%" +     // shadow corner
  ")";
// Lighter variant — for surfaces that sit on dark backgrounds and need a
// luminous, reflective gold-foil tone rather than the deep saturated one.
// Used on the SignInV2 page logo. Stops are biased toward the bright
// highlight band so the wordmark reads as polished light foil rather than
// burnished antique gold.
const V2_GOLD_FOIL_BG_LIGHT =
  "linear-gradient(135deg, " +
    "#D4A42D 0%, " +     // warm mid-gold edge (was deep amber)
    "#E8C97A 18%, " +    // pale honey
    "#FAF0C2 38%, " +    // very light highlight zone
    "#FFF5D6 50%, " +    // brightest crest — near-white champagne
    "#FAF0C2 62%, " +    // pale honey returning
    "#E8C97A 82%, " +    // pale gold
    "#D4A42D 100%" +     // warm mid-gold (no dark shadow corner)
  ")";
// Glossy overlay shimmer — subtle moving highlight that catches the eye
// when applied as a second background layer.
const V2_GOLD_FOIL_SHEEN =
  "linear-gradient(105deg, " +
    "transparent 0%, transparent 40%, " +
    "rgba(255, 245, 200, 0.45) 50%, " +
    "transparent 60%, transparent 100%)";
// Brighter sheen for the lighter foil — pushed higher opacity so it
// catches more light against the lighter base.
const V2_GOLD_FOIL_SHEEN_LIGHT =
  "linear-gradient(105deg, " +
    "transparent 0%, transparent 38%, " +
    "rgba(255, 252, 230, 0.7) 50%, " +
    "transparent 62%, transparent 100%)";
const V2_GOLD_FOIL_TEXT = "#3A2810"; // rich espresso brown for legible foreground on foil

// V2InsiderLogo — renders the 1-INSIDER wordmark with the same animated
// gold-foil gradient + shimmer as the FAB and primary buttons. Uses CSS
// mask-image to clip the gradient div through the logo's silhouette.
// Aspect ratio of the source PNG is 539:93 ≈ 5.8:1.
//
// Pass `lighter` to use V2_GOLD_FOIL_BG_LIGHT — a brighter polished-foil
// tone for surfaces against dark backgrounds (e.g. sign-up page).
function V2InsiderLogo({ width, style, dropShadow, lighter }) {
  const w = width || 280;
  const h = Math.round(w * (93 / 539));
  const maskUrl = "url(/insider-logo-mask.png)";
  const bg = lighter ? V2_GOLD_FOIL_BG_LIGHT : V2_GOLD_FOIL_BG;
  const sheen = lighter ? V2_GOLD_FOIL_SHEEN_LIGHT : V2_GOLD_FOIL_SHEEN;
  const shadowFilter = lighter
    ? "drop-shadow(0 4px 24px rgba(255, 220, 140, 0.45))"
    : "drop-shadow(0 4px 24px rgba(218, 165, 32, 0.35))";
  return (
    <div
      role="img"
      aria-label="1-INSIDER"
      style={{
        width: w, height: h,
        background: sheen + ", " + bg,
        backgroundSize: "200% 100%, 100% 100%",
        backgroundPosition: "0% 0%, 0% 0%",
        WebkitMaskImage: maskUrl,
        maskImage: maskUrl,
        WebkitMaskSize: "100% 100%",
        maskSize: "100% 100%",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        animation: "v2-foil-shimmer 4s linear infinite",
        filter: dropShadow !== false ? shadowFilter : "none",
        ...style,
      }}
    />
  );
}

// V2EnvelopeReveal — premium invitation envelope opening animation.
// Choreography (~2.9s total):
//   0–600ms    Envelope arrives (scale up + fade in), wax seal shines
//   600–1700ms Hold: invitation text glows on the envelope face
//   1700–2400ms Seal breaks, flap rotates open (rotateX from hinge)
//   2400–2900ms Invitation card emerges + expands to fill viewport
// Calls onComplete after total duration, which the App orchestrator uses
// to unmount this component and reveal the SignInV2 panel beneath.
function V2EnvelopeReveal({ onComplete }) {
  const [stage, setStage] = useState(0);
  // Stage progression — paced so user can read each beat:
  //   0 (0-1000ms)    Envelope arrives, settles
  //   1 (1000-2300ms) Hold beat — gold foil shimmer plays
  //   2 (2300-2700ms) Wax seal breaks and falls away
  //   3 (2700-3500ms) Top flap rotates open, holds open
  //   4 (3500-5700ms) Card emerges (slow 2200ms slide up out of pocket).
  //                   Envelope simultaneously descends out of frame so
  //                   the card becomes the focal point.
  //   5 (5700-6700ms) Card holds at viewport centre — 1 second reading beat
  //   6 (6700-7500ms) Card slides DOWN off screen (envelope already gone)
  //   7 (7500ms)      onComplete fires, login revealed
  useEffect(() => {
    const t1 = setTimeout(() => setStage(1), 1000);
    const t2 = setTimeout(() => setStage(2), 2300);
    const t3 = setTimeout(() => setStage(3), 2700);
    const t4 = setTimeout(() => setStage(4), 3500);
    const t5 = setTimeout(() => setStage(5), 5700);
    const t6 = setTimeout(() => setStage(6), 6700);
    const t7 = setTimeout(() => onComplete && onComplete(), 7500);
    return () => {
      [t1, t2, t3, t4, t5, t6, t7].forEach(clearTimeout);
    };
  }, [onComplete]);

  // Envelope dimensions
  const envW = 360;
  const envH = 220;
  const flapH = envH * 0.5;

  // Foil background used for envelope body, flap, and seal
  const foilBg = V2_GOLD_FOIL_SHEEN + ", " + V2_GOLD_FOIL_BG;

  // Organic wax-blob clip-path — irregular drip edges
  const waxBlobClip =
    "polygon(50% 0%, 62% 4%, 73% 8%, 84% 14%, 92% 24%, 96% 36%, 100% 48%, " +
    "98% 60%, 95% 72%, 88% 82%, 82% 90%, 73% 96%, 64% 100%, 53% 99%, " +
    "42% 100%, 31% 95%, 22% 88%, 14% 80%, 7% 70%, 3% 58%, 0% 46%, " +
    "4% 34%, 10% 23%, 18% 14%, 28% 8%, 39% 3%)";

  // Card is the SAME size as envelope so it visually fills the envelope
  // pocket completely. The 'emerging from inside' effect comes from the
  // front pocket panel covering the lower portion as card slides up.
  const cardW = envW;
  const cardH = envH;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 200,
        pointerEvents: "none",
        background: "radial-gradient(ellipse at center, rgba(80, 60, 20, 0.35) 0%, rgba(15, 17, 26, 0.85) 60%, rgba(15, 17, 26, 0.95) 100%)",
        animation: "v2-fade-in 500ms ease-out both",
        perspective: 1400,
      }}
    >
      {/* OUTER STAGE — fixed centred container holds envelope and card as
          siblings. Both centred via flexbox. No transforms here so child
          animations don't fight a parent translate. */}
      <div
        style={{
          position: "relative",
          width: envW,
          height: envH,
          maxWidth: "85vw",
          // Both card and envelope centred via flex parent above (the
          // outer fixed div already does flex center). We position both
          // children at top:0/left:0 and let them stack in the same spot.
        }}
      >
        {/* CARD CENTRING WRAPPER — keeps card locked at viewport centre.
            Animation runs on the inner card so it doesn't overwrite the
            centring transform. */}
        <div
          style={{
            position: "absolute",
            top: 0, left: 0,
            width: "100%", height: "100%",
            zIndex: stage >= 4 ? 6 : 1,
            opacity: stage >= 4 ? 1 : 0,
            pointerEvents: "none",
          }}
        >
          {/* INVITATION CARD — same dimensions as envelope. Animation lives
              here, not on the wrapper, so translateY composes cleanly. */}
          <div
            style={{
              position: "absolute",
              top: 0, left: 0,
              width: "100%", height: "100%",
              background: "#FFFFFF",
              borderRadius: 4,
              boxShadow: "0 12px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(218, 165, 32, 0.7) inset",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "20px 16px",
              animation: stage >= 6
                ? "v2-card-exit 800ms cubic-bezier(0.55, 0.05, 0.85, 0.95) forwards"
                : stage >= 4
                  ? "v2-card-emerge 2200ms cubic-bezier(0.25, 0.1, 0.25, 1) both"
                  : "none",
            }}
          >
            {/* Gold inner trim border */}
            <div
              aria-hidden
              style={{
                position: "absolute", inset: 6,
                border: "0.5px solid rgba(218, 165, 32, 0.55)",
                borderRadius: 2,
                pointerEvents: "none",
              }}
            />
            <div style={{
              textAlign: "center",
              display: "flex", flexDirection: "column", alignItems: "center",
              gap: 10,
              width: "100%",
              position: "relative", zIndex: 2,
            }}>
              <div style={{
                fontSize: 9, color: "#8B5F18", letterSpacing: "0.3em",
                fontWeight: 700, fontFamily: FONT.b, opacity: 0.75,
              }}>
                YOUR EXCLUSIVE INVITATION
              </div>
              <V2InsiderLogo width={200} dropShadow={false} />
              <div style={{
                fontSize: 12, color: "#3A2810", marginTop: 4,
                fontFamily: FONT.h, fontStyle: "italic",
                lineHeight: 1.4,
              }}>
                Welcome to the inner circle.
              </div>
              <div style={{
                fontSize: 8, color: "#8B5F18", letterSpacing: "0.25em",
                fontFamily: FONT.b, opacity: 0.6, marginTop: 4,
                borderTop: "0.5px solid rgba(218, 165, 32, 0.4)",
                paddingTop: 6, width: 130,
              }}>
                1-GROUP SINGAPORE
              </div>
            </div>
          </div>
        </div>

        {/* ENVELOPE CENTRING WRAPPER — keeps envelope locked at viewport
            centre. Animation runs on the inner element so its translateY
            doesn't trample any centring transform. */}
        <div
          style={{
            position: "absolute",
            top: 0, left: 0,
            width: "100%", height: "100%",
            zIndex: stage >= 4 ? 2 : 5,
          }}
        >
          {/* ENVELOPE ASSEMBLY — runs arrive (stage 0) and descend (stage 4+) */}
          <div
            style={{
              position: "absolute",
              top: 0, left: 0,
              width: "100%", height: "100%",
              animation: stage >= 4
                ? "v2-envelope-descend 2200ms cubic-bezier(0.45, 0.05, 0.55, 0.95) both"
                : stage === 0
                  ? "v2-envelope-arrive 1000ms cubic-bezier(0.34, 1.56, 0.64, 1) both"
                  : "none",
              transformStyle: "preserve-3d",
            }}
          >
            {/* ENVELOPE BODY (back panel) */}
            <div
              style={{
                position: "absolute", inset: 0,
                background: foilBg,
                backgroundSize: "200% 100%, 100% 100%",
                borderRadius: 6,
                boxShadow: "0 24px 60px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 230, 150, 0.5) inset",
                animation: "v2-foil-shimmer 4s linear infinite",
                zIndex: 1,
              }}
            />
            {/* FRONT POCKET — bottom half of envelope */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                bottom: 0, left: 0, right: 0,
                height: "55%",
                background: foilBg,
                backgroundSize: "200% 100%, 100% 100%",
                borderRadius: "0 0 6px 6px",
                boxShadow: "inset 0 2px 4px rgba(0, 0, 0, 0.2)",
                animation: "v2-foil-shimmer 4s linear infinite",
                zIndex: 3,
                backgroundImage: foilBg + ", linear-gradient(135deg, transparent 49%, rgba(0,0,0,0.15) 50%, transparent 51%), linear-gradient(225deg, transparent 49%, rgba(0,0,0,0.15) 50%, transparent 51%)",
              }}
            />
            {/* TOP FLAP — V-cut, rotates open at stage 3 */}
            <div
              style={{
                position: "absolute",
                top: 0, left: 0, right: 0,
                height: flapH,
                background: foilBg,
                backgroundSize: "200% 100%, 100% 100%",
                clipPath: "polygon(0 0, 100% 0, 50% 100%)",
                transformOrigin: "top center",
                animation: stage >= 3
                  ? "v2-flap-open 800ms cubic-bezier(0.45, 0.05, 0.4, 1) forwards, v2-foil-shimmer 4s linear infinite"
                  : "v2-foil-shimmer 4s linear infinite",
                zIndex: 4,
                filter: "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))",
              }}
            />
            {/* WAX SEAL */}
            <div
              style={{
                position: "absolute",
                left: "50%", top: "50%",
                transform: stage >= 2
                  ? "translate(-50%, calc(-50% + 30px))"
                  : "translate(-50%, -50%)",
                opacity: stage >= 2 ? 0 : 1,
                transition: stage >= 2
                  ? "opacity 400ms ease-in, transform 400ms cubic-bezier(0.55, 0.05, 0.85, 0.95)"
                  : "none",
                width: 88, height: 88,
                zIndex: 6,
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  position: "absolute", inset: 0,
                  animation: stage === 0
                    ? "v2-seal-shine 1100ms cubic-bezier(0.34, 1.56, 0.64, 1) 400ms both"
                    : "none",
                }}
              >
                <div
                  aria-hidden
                  style={{
                    position: "absolute", inset: 0,
                    background: "radial-gradient(circle at 32% 28%, #F6E5A0 0%, #D4A42D 22%, #B88320 55%, #8B5F18 85%, #5C3D14 100%)",
                    clipPath: waxBlobClip,
                    WebkitClipPath: waxBlobClip,
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.55)",
                    filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.4))",
                  }}
                />
                <div
                  aria-hidden
                  style={{
                    position: "absolute", inset: "10%",
                    background: "radial-gradient(circle at 35% 30%, rgba(255,230,150,0.4) 0%, rgba(0,0,0,0) 40%), radial-gradient(circle at 65% 70%, rgba(0,0,0,0.25) 30%, rgba(0,0,0,0) 60%)",
                    borderRadius: "50%",
                    pointerEvents: "none",
                  }}
                />
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: "50%", top: "50%",
                    transform: "translate(-50%, -50%)",
                    width: 42, height: 42,
                    background: "linear-gradient(135deg, #5C3D14 0%, #3A2810 50%, #5C3D14 100%)",
                    WebkitMaskImage: "url(/insider-keyhole-mask.png)",
                    maskImage: "url(/insider-keyhole-mask.png)",
                    WebkitMaskSize: "100% 100%",
                    maskSize: "100% 100%",
                    WebkitMaskRepeat: "no-repeat",
                    maskRepeat: "no-repeat",
                    filter: "drop-shadow(0 1px 0 rgba(255,240,200,0.45)) drop-shadow(0 -1px 0 rgba(0,0,0,0.4))",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function V2GoldFAB({ onClick, children, ariaLabel, style, idlePulse }) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel || "Continue"}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      style={{
        width: 64, height: 64, borderRadius: "50%",
        background: V2_GOLD_FOIL_SHEEN + ", " + V2_GOLD_FOIL_BG,
        backgroundSize: "200% 100%, 100% 100%",
        backgroundPosition: "0% 0%, 0% 0%",
        color: V2_GOLD_FOIL_TEXT,
        border: "none",
        cursor: "pointer",
        fontSize: 26, fontWeight: 700,
        fontFamily: FONT.b,
        boxShadow: "0 0 0 1px rgba(255, 230, 150, 0.5) inset, 0 0 32px rgba(218, 165, 32, 0.45), 0 8px 24px rgba(0, 0, 0, 0.45)",
        transform: pressed ? "scale(0.94)" : "scale(1)",
        transition: "transform 120ms ease-out",
        animation: idlePulse
          ? "v2-foil-shimmer 4s linear infinite, v2-pulse 2s ease-in-out infinite"
          : "v2-foil-shimmer 4s linear infinite",
        textShadow: "0 1px 0 rgba(255, 240, 200, 0.4)",
        ...style,
      }}
    >
      {children || "→"}
    </button>
  );
}

// Solid or ghost gold button with press state.
function V2GoldButton({ children, onClick, variant, disabled, style }) {
  const [pressed, setPressed] = useState(false);
  const base = {
    fontFamily: FONT.b, fontSize: 14, fontWeight: 700, letterSpacing: "0.02em",
    borderRadius: 10, padding: "14px 24px", border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    width: "100%",
    transform: pressed ? "scale(0.97)" : "scale(1)",
    transition: "transform 120ms ease-out",
    textShadow: "0 1px 0 rgba(255, 240, 200, 0.35)",
  };
  const variants = {
    solid: {
      background: V2_GOLD_FOIL_SHEEN + ", " + V2_GOLD_FOIL_BG,
      backgroundSize: "200% 100%, 100% 100%",
      color: V2_GOLD_FOIL_TEXT,
      boxShadow: "0 0 0 1px rgba(255, 230, 150, 0.4) inset, 0 0 24px rgba(218, 165, 32, 0.35), 0 4px 14px rgba(0, 0, 0, 0.3)",
      animation: "v2-foil-shimmer 5s linear infinite",
    },
    ghost: {
      background: "transparent", color: V2.gold,
      border: "1px solid " + V2.goldBorder,
    },
  };
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      onMouseDown={() => !disabled && setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => !disabled && setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      style={{ ...base, ...(variants[variant] || variants.solid), ...style }}
    >
      {children}
    </button>
  );
}

// Glass panel with thin gold top hairline.
function V2GlassPanel({ children, style }) {
  return (
    <div
      style={{
        background: "rgba(26, 29, 39, 0.72)",
        backdropFilter: "blur(24px) saturate(120%)",
        WebkitBackdropFilter: "blur(24px) saturate(120%)",
        borderRadius: 24,
        border: "1px solid rgba(245, 215, 166, 0.18)",
        boxShadow: "0 1px 0 rgba(242, 243, 245, 0.06) inset, 0 8px 24px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(245, 215, 166, 0.15)",
        padding: 28,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// Dark-surface text input.
function V2TextInput({ label, value, onChange, type, placeholder, autoFocus, id, pulse }) {
  const [focused, setFocused] = useState(false);
  const [pulsing, setPulsing] = useState(false);

  // When the parent bumps the pulse counter, fire a 700ms gold glow.
  useEffect(() => {
    if (pulse == null || pulse === 0) return;
    setPulsing(true);
    const t = setTimeout(() => setPulsing(false), 700);
    return () => clearTimeout(t);
  }, [pulse]);

  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: V2.textSecondary, marginBottom: 8, fontFamily: FONT.b }}>
          {label}
        </div>
      )}
      <input
        id={id}
        value={value || ""}
        onChange={e => onChange(e.target.value)}
        type={type || "text"}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%",
          background: V2.elevated,
          border: "1px solid " + ((focused || pulsing) ? V2.goldBorder : V2.divider),
          borderRadius: 10,
          padding: "14px 16px",
          color: V2.text,
          fontFamily: FONT.b,
          fontSize: 15,
          outline: "none",
          boxSizing: "border-box",
          transition: "border-color 200ms ease-out, box-shadow 400ms ease-out",
          boxShadow: pulsing ? "0 0 0 3px rgba(245, 215, 166, 0.25), 0 0 24px rgba(245, 215, 166, 0.35)" : "none",
        }}
      />
    </div>
  );
}

// 6-slot OTP input — monospace, gold underline on active slot.
function V2OtpInput({ value, onChange, length }) {
  const L = length || 6;
  const str = (value || "").padEnd(L, " ").slice(0, L);
  const handle = (i, v) => {
    const digit = v.replace(/\D/g, "").slice(-1);
    const next = (value || "").split("");
    next[i] = digit;
    const joined = next.join("").replace(/\s/g, "").slice(0, L);
    onChange(joined);
    if (digit) {
      const nextInput = document.getElementById("v2-otp-" + (i + 1));
      if (nextInput) nextInput.focus();
    }
  };
  return (
    <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 24 }}>
      {Array.from({ length: L }).map((_, i) => (
        <input
          key={i}
          id={"v2-otp-" + i}
          value={str[i].trim()}
          onChange={e => handle(i, e.target.value)}
          maxLength={1}
          inputMode="numeric"
          style={{
            width: 44, height: 56,
            textAlign: "center",
            fontFamily: FONT.m, fontSize: 22, fontWeight: 500, letterSpacing: "0.05em",
            color: V2.gold,
            background: V2.elevated,
            border: "none",
            borderBottom: "2px solid " + V2.goldBorder,
            borderRadius: "10px 10px 0 0",
            outline: "none",
            transition: "border-color 200ms ease-out",
          }}
          onFocus={e => { e.target.style.borderBottomColor = V2.gold; }}
          onBlur={e => { e.target.style.borderBottomColor = V2.goldBorder; }}
        />
      ))}
    </div>
  );
}

// ─── S1: Landing / Opening Page ──────────────────────────────────────────
//
// Moodboard slide 2: full-bleed cinematic hero, gold streak overlay on left
// rail, INSIDER wordmark, single gold FAB to enter the 3-part sign-in flow.
//
// Landing video: drop /public/landing-hero.mp4 into the repo to enable the
// video hero. Until then, a dark still using the River House heritage image
// renders as the fallback (preserves Eber L12 workaround: mobile always sees
// the static image anyway).
function LandingV2({ onSignIn, dimmed, peeling }) {
  const [idle, setIdle] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);

  // Marquee venues from VENUE_DIRECTORY — order per Chris's direction:
  // Monti opens, then The Alkaff Mansion, then 1-Arden, then onward through
  // rooftops and heritage. Replace with a /public/landing-hero.mp4 once available.
  const heroImages = [
    VENUE_DIRECTORY.find(v => v.name === "Monti")?.thumbnail,
    VENUE_DIRECTORY.find(v => v.name === "The Alkaff Mansion")?.thumbnail,
    VENUE_DIRECTORY.find(v => v.name === "1-Arden")?.thumbnail,
    VENUE_DIRECTORY.find(v => v.name === "1-Atico")?.thumbnail,
    VENUE_DIRECTORY.find(v => v.name === "1-Alfaro")?.thumbnail,
    VENUE_DIRECTORY.find(v => v.name === "The River House")?.thumbnail,
    VENUE_DIRECTORY.find(v => v.name === "The Summer House")?.thumbnail,
  ].filter(Boolean);

  useEffect(() => {
    const t = setTimeout(() => setIdle(true), 6000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (heroImages.length < 2) return;
    const t = setInterval(() => {
      setHeroIndex(i => (i + 1) % heroImages.length);
    }, 4500);
    return () => clearInterval(t);
  }, [heroImages.length]);

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: V2.bg,
        color: V2.text,
        fontFamily: FONT.b,
        overflow: "hidden",
        zIndex: dimmed || peeling ? 50 : 100,
        filter: (dimmed || peeling) ? "brightness(0.45) saturate(0.85)" : "none",
        transition: "filter 480ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        pointerEvents: (dimmed || peeling) ? "none" : "auto",
      }}
    >
      <V2Styles />
      <style>{
        "@keyframes v2-kenburns { 0% { transform: scale(1.05); } 100% { transform: scale(1.15); } }"
      }</style>
      {!(dimmed || peeling) && <V2Badge />}

      {/* Hero compilation — crossfades between VENUE_DIRECTORY marquee thumbnails
          every 4.5s with a slow Ken Burns zoom. Replace with a single <video> once
          /public/landing-hero.mp4 is uploaded. */}
      {heroImages.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          style={{
            position: "absolute", inset: 0,
            width: "100%", height: "100%",
            objectFit: "cover",
            opacity: i === heroIndex ? 1 : 0,
            transition: "opacity 1200ms ease-in-out",
            filter: "saturate(0.85) contrast(1.05)",
            animation: i === heroIndex ? "v2-kenburns 6s ease-out forwards" : "none",
            transformOrigin: ["center center", "top left", "top right", "bottom left", "bottom right", "center top"][i % 6],
          }}
        />
      ))}

      {/* Gold streak on left rail */}
      <div
        aria-hidden
        style={{
          position: "absolute", top: 0, bottom: 0, left: 0, width: "22%",
          background: "linear-gradient(90deg, rgba(245, 215, 166, 0.35) 0%, transparent 100%)",
          mixBlendMode: "screen",
          pointerEvents: "none",
        }}
      />

      {/* Scrim for legibility */}
      <div
        aria-hidden
        style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(180deg, rgba(15,17,26,0.4) 0%, rgba(15,17,26,0.85) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Centre content */}
      <div
        style={{
          position: "relative", zIndex: 2,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          minHeight: "100vh",
          padding: "60px 24px 120px",
          textAlign: "center",
          animation: "v2-fade-in 800ms ease-out 200ms both",
        }}
      >
        <div
          style={{
            fontFamily: FONT.b,
            fontSize: 11, fontWeight: 600,
            letterSpacing: "0.3em", textTransform: "uppercase",
            color: V2.gold,
            marginBottom: 20,
          }}
        >
          ✦ 1-Group Singapore
        </div>
        <div style={{ marginBottom: 28, animation: "v2-fade-in 900ms ease-out 300ms both" }}>
          <V2InsiderLogo width={280} style={{ maxWidth: "78vw" }} />
        </div>
        <div
          style={{
            fontFamily: FONT.b,
            fontSize: 15, fontWeight: 400,
            color: V2.textSecondary,
            maxWidth: 320,
            lineHeight: 1.5,
          }}
        >
          Your gateway to twenty three unique venues.
        </div>
      </div>

      {/* Gold FAB bottom-right */}
      <div
        style={{
          position: "fixed",
          bottom: "calc(40px + env(safe-area-inset-bottom))",
          right: 24,
          zIndex: 3,
          animation: "v2-fade-in 400ms ease-out 600ms both",
        }}
      >
        <V2GoldFAB onClick={onSignIn} idlePulse={idle} ariaLabel="Enter INSIDER">→</V2GoldFAB>
      </div>

      {/* Existing-member CTA bottom-left — bigger + glossy gold per moodboard */}
      <div
        style={{
          position: "fixed",
          bottom: "calc(52px + env(safe-area-inset-bottom))",
          left: 24,
          zIndex: 3,
          animation: "v2-fade-in 400ms ease-out 800ms both",
        }}
      >
        <div
          onClick={onSignIn}
          style={{
            fontFamily: FONT.b, fontSize: 14, fontWeight: 500,
            color: V2.text,
            cursor: "pointer",
            letterSpacing: "0.02em",
            display: "flex", flexDirection: "column", gap: 2,
          }}
        >
          <span style={{ color: V2.textSecondary, fontSize: 12, opacity: 0.85 }}>Already a member?</span>
          <span
            style={{
              fontSize: 16, fontWeight: 700,
              background: "linear-gradient(135deg, #FBE8C9 0%, #F5D7A6 35%, #C79A5A 50%, #F5D7A6 65%, #FBE8C9 100%)",
              backgroundSize: "200% 200%",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              animation: "v2-gold-shimmer 4s ease-in-out infinite",
              textShadow: "0 1px 2px rgba(245, 215, 166, 0.25)",
              letterSpacing: "0.03em",
            }}
          >
            Sign in →
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── V2 Corporate Enquiry Modal — dark-theme port of the classic modal ───
function V2CorporateEnquiryModal({ onClose }) {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: "", company: "", email: "", phone: "", teamSize: "", message: "" });
  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const isValid = form.name.trim() && form.company.trim() && form.email.includes("@");

  const submit = () => {
    if (!isValid) return;
    // Demo-only: log locally. Real integration would POST to a corporate-enquiries
    // Supabase table or dispatch via Gmail MCP to corporate@1-group.sg.
    console.log("V2 Corporate enquiry submitted:", form);
    setSubmitted(true);
  };

  const labelStyle = { fontSize: 10.5, color: V2.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6, display: "block", fontFamily: FONT.b };
  const inputStyle = {
    width: "100%", boxSizing: "border-box",
    padding: "12px 14px", fontSize: 13,
    background: V2.elevated,
    color: V2.text,
    border: "1px solid " + V2.divider,
    borderRadius: 10,
    outline: "none",
    fontFamily: FONT.b,
    transition: "border-color 200ms",
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(11, 13, 20, 0.72)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
        zIndex: 600,
        animation: "v2-fade-in 240ms ease-out",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 440,
          background: V2.card,
          borderRadius: 18,
          border: "1px solid " + V2.goldBorder,
          padding: 24,
          boxShadow: "0 24px 64px rgba(0, 0, 0, 0.6)",
          maxHeight: "90vh", overflowY: "auto",
          color: V2.text,
          fontFamily: FONT.b,
          animation: "v2-slide-up 360ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        }}
      >
        {!submitted ? (
          <>
            <div style={{ fontSize: 10, color: V2.gold, textTransform: "uppercase", letterSpacing: "0.2em", fontWeight: 700, marginBottom: 6 }}>
              ◈ Corporate Membership
            </div>
            <div style={{ fontFamily: FONT.h, fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.2, marginBottom: 6 }}>
              Let&rsquo;s build a programme for your team
            </div>
            <div style={{ fontSize: 12, color: V2.textSecondary, marginBottom: 18, lineHeight: 1.5 }}>
              Share a few details and our Corporate team will be in touch within 2 business days.
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={labelStyle}>Your name *</label>
                <input style={inputStyle} value={form.name} onChange={e => update("name", e.target.value)} placeholder="Jane Tan" />
              </div>
              <div>
                <label style={labelStyle}>Company *</label>
                <input style={inputStyle} value={form.company} onChange={e => update("company", e.target.value)} placeholder="Acme Pte Ltd" />
              </div>
              <div>
                <label style={labelStyle}>Work email *</label>
                <input style={inputStyle} type="email" value={form.email} onChange={e => update("email", e.target.value)} placeholder="jane.tan@acme.sg" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={labelStyle}>Phone</label>
                  <input style={inputStyle} value={form.phone} onChange={e => update("phone", e.target.value)} placeholder="+65…" />
                </div>
                <div>
                  <label style={labelStyle}>Team size</label>
                  <select style={inputStyle} value={form.teamSize} onChange={e => update("teamSize", e.target.value)}>
                    <option value="">Choose…</option>
                    <option>10–25</option>
                    <option>26–50</option>
                    <option>51–100</option>
                    <option>101–500</option>
                    <option>500+</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>What are you looking for?</label>
                <textarea
                  style={{ ...inputStyle, resize: "vertical", minHeight: 80 }}
                  rows={3}
                  value={form.message}
                  onChange={e => update("message", e.target.value)}
                  placeholder="E.g. client gifting programme, team dining benefits, event venue access…"
                />
              </div>
            </div>

            <div
              style={{
                background: "rgba(74, 141, 255, 0.12)",
                border: "1px solid rgba(74, 141, 255, 0.35)",
                color: "#B3CEFF",
                borderRadius: 10,
                padding: "10px 14px",
                fontSize: 11, lineHeight: 1.5,
                marginTop: 14, marginBottom: 16,
                display: "flex", gap: 8, alignItems: "flex-start",
              }}
            >
              <span aria-hidden>✦</span>
              <span>Corporate tiers are bespoke — our team will share a tailored benefits package after a short discovery call.</span>
            </div>

            <button
              onClick={submit}
              disabled={!isValid}
              style={{
                width: "100%",
                background: V2.gold,
                color: V2.textOnGold,
                border: "none",
                padding: "13px 18px",
                borderRadius: 10,
                fontSize: 13.5, fontWeight: 700, letterSpacing: "0.02em",
                cursor: isValid ? "pointer" : "not-allowed",
                opacity: isValid ? 1 : 0.45,
                marginBottom: 10,
                fontFamily: FONT.b,
                boxShadow: isValid ? "0 4px 14px rgba(245, 215, 166, 0.2)" : "none",
                transition: "opacity 200ms, box-shadow 200ms",
              }}
            >
              Submit enquiry
            </button>
            <button
              onClick={onClose}
              style={{
                width: "100%",
                background: "transparent",
                color: V2.textMuted,
                border: "1px solid " + V2.divider,
                padding: "11px 18px",
                borderRadius: 10,
                fontSize: 13, fontWeight: 500,
                cursor: "pointer",
                fontFamily: FONT.b,
              }}
            >
              Cancel
            </button>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 14, color: V2.gold }}>✦</div>
            <div style={{ fontFamily: FONT.h, fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em", marginBottom: 10 }}>
              Enquiry received
            </div>
            <div style={{ fontSize: 13, color: V2.text, marginBottom: 6 }}>Thank you, {form.name.split(" ")[0]}.</div>
            <div style={{ fontSize: 12, color: V2.textSecondary, marginBottom: 22, lineHeight: 1.5 }}>
              Our Corporate team will reach out to <strong style={{ color: V2.gold }}>{form.email}</strong> within 2 business days to schedule a discovery call.
            </div>
            <button
              onClick={onClose}
              style={{
                width: "100%",
                background: V2.gold,
                color: V2.textOnGold,
                border: "none",
                padding: "13px 18px",
                borderRadius: 10,
                fontSize: 13.5, fontWeight: 700, letterSpacing: "0.02em",
                cursor: "pointer", fontFamily: FONT.b,
              }}
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── S2: 3-Part Slide-Up Sign-In ──────────────────────────────────────────
//
// Moodboard slide 2 (right): three stacked panels, slide-up transitioned.
// A = Brand moment · B = Login · C = 6-slot OTP verify.
//
// Email login is Eber L03 demo only — the ✦ DEMO badge on the Email row is
// mandatory. Panel C's OTP verify reuses the Phase 1 demo fallback: any
// 6-digit OTP resolves via Supabase member lookup (by email if possible,
// otherwise Sophia Chen M0001 — identical to the Phase 2 U14 mock).
function SignInV2({ onSuccess, onNewUser, onBack, revealing }) {
  // Panel 0 (brand moment) removed per feedback — direct-to-login flow.
  // Panel 1 = Login; Panel 2 = OTP verify.
  // The page-curl-down on LandingV2 reveals this panel, so panel 1's
  // own slide-up animation only fires when the user navigates here from
  // a non-curl entry (e.g. after the curl is complete and a return).
  const [panel, setPanel] = useState(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(30);
  const [intent, setIntent] = useState("signup"); // "signup" | "login" — set by which CTA was tapped
  const [expandedTier, setExpandedTier] = useState(null);
  const [sheetParent, setSheetParent] = useState(null);
  const [showCorporate, setShowCorporate] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [panel2Exiting, setPanel2Exiting] = useState(false);
  const [emailPulse, setEmailPulse] = useState(0);

  // Reverse slide-down on Back — symmetric exit, 240ms per motion spec.
  const handleBack = () => {
    if (exiting) return;
    setExiting(true);
    setTimeout(() => onBack(), 240);
  };

  // Panel 2 → Panel 1 reverse slide — same 240ms exit easing.
  const handleChangeEmail = () => {
    if (panel2Exiting) return;
    setPanel2Exiting(true);
    setTimeout(() => {
      setPanel(1);
      setOtp("");
      setError("");
      setPanel2Exiting(false);
    }, 240);
  };

  // Called from tier-card CTAs — scrolls back to top, focuses the email
  // input, and fires a gold pulse highlight so the member knows where
  // to complete their sign-up.
  const focusEmail = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    // Wait for scroll; then focus + pulse.
    setTimeout(() => {
      const el = document.getElementById("v2-email-input");
      if (el) el.focus();
      setEmailPulse(p => p + 1);
    }, 320);
  };

  useEffect(() => {
    if (panel !== 2) return;
    setResendIn(30);
    const t = setInterval(() => setResendIn(r => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, [panel]);

  const proceedToVerify = (chosenIntent) => {
    setError("");
    if (!email || !email.includes("@")) { setError("Enter a valid email address"); return; }
    setIntent(chosenIntent === "login" ? "login" : "signup");
    setPanel(2);
  };

  const verify = async () => {
    setError("");
    if (!otp || otp.length < 4) { setError("Enter the 6-digit code"); return; }
    setLoading(true);
    try {
      const trimmed = (email || "").trim().toLowerCase();
      // Demo escape: 'demo@1-group.sg' always lands on Sophia, regardless of intent.
      if (trimmed === "demo@1-group.sg") {
        const m = await supaFetch("members?id=eq.M0001");
        if (Array.isArray(m) && m[0]) { onSuccess(m[0]); setLoading(false); return; }
      }

      const m = await supaFetch("members?email=eq." + encodeURIComponent(trimmed));
      const exists = Array.isArray(m) && m[0];

      if (intent === "signup") {
        // Sign-up intent: route straight to SignUpV2 with email pre-filled.
        // If the email already belongs to a member, surface a clear message
        // rather than silently signing them in (avoids duplicate-account
        // confusion + respects PDPA accuracy obligation).
        if (exists) {
          setError("This email is already a member. Tap 'Already a member? Log in' below to sign in.");
          setLoading(false);
          return;
        }
        if (typeof onNewUser === "function") onNewUser(trimmed);
        else setError("Sign-up flow unavailable. Please refresh and try again.");
      } else {
        // Login intent: must find the account. If we don't, offer to sign up.
        if (exists) {
          onSuccess(m[0]);
        } else {
          setError("We don't have an account for this email. Tap 'Sign Up' instead — your details will carry across.");
        }
      }
    } catch (e) {
      setError("Connection error");
    }
    setLoading(false);
  };

  const panelBase = {
    position: "fixed", inset: 0,
    background: V2.bg,
    color: V2.text,
    fontFamily: FONT.b,
    overflow: "hidden",
    zIndex: 100 + panel,
  };

  return (
    <>
      <V2Styles />
      <V2Badge />

      {/* PANEL A (Brand moment) removed — Landing → Login direct.
          Existing panel constants kept as 1 and 2 for OTP flow. */}

      {/* PANEL B — Login. Slides up from below the viewport over the
          LandingV2 cinematic. Three animated layers:
          1. A soft scrim that fades in behind the panel (deepens the
             landing into a "stage" state as the curtain rises).
          2. The panel itself (v2-slide-up, 420ms cubic-bezier back-ease).
          3. A gold leading edge hairline on the panel's top, catching the
             eye as it crests over the landing (follows the skill's
             motion.md Section 2 — insider-slide-up + shimmer overlay). */}
      {panel === 1 && (
        <>
          <div
            style={{
              ...panelBase,
              zIndex: 101,
              animation: exiting
                ? "v2-slide-down 240ms cubic-bezier(0.4, 0, 1, 1) forwards"
                : "v2-fade-in 600ms ease-out 200ms both",
              overflowY: "auto",
            }}
          >
          <div
            style={{
              minHeight: "100vh",
              padding: "60px 24px 60px",
              maxWidth: 480, margin: "0 auto",
            }}
          >
            <V2GlassPanel>
              {/* shimmer-once hairline */}
              <div
                aria-hidden
                style={{
                  position: "absolute", top: -1, left: 0, right: 0, height: 1,
                  background: "linear-gradient(90deg, transparent 0%, rgba(245,215,166,0.9) 50%, transparent 100%)",
                  animation: "v2-shimmer-once 600ms ease-out",
                  borderRadius: 24,
                  overflow: "hidden",
                }}
              />
              {/* Gold-foil 1-INSIDER logo at top of login panel — lighter
                  polished-foil tone for luminous presence on dark glass */}
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 22 }}>
                <V2InsiderLogo width={180} style={{ maxWidth: "60%" }} lighter />
              </div>
              <div style={{ fontFamily: FONT.h, fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em", marginBottom: 10, lineHeight: 1.25, color: "#FFFFFF", textAlign: "center" }}>
                Join now to unlock the full potential of 1-Insider
              </div>
              <div style={{ fontSize: 13, color: "#FFFFFF", opacity: 0.8, marginBottom: 28, lineHeight: 1.5, textAlign: "center" }}>
                Your gateway to a trusted community.
              </div>

              <V2TextInput
                id="v2-email-input"
                label="Your email"
                value={email}
                onChange={setEmail}
                type="email"
                placeholder="member@insider.com"
                autoFocus
                pulse={emailPulse}
              />

              {/* Eber L03 demo notice */}
              <div
                style={{
                  background: "rgba(74, 141, 255, 0.12)",
                  border: "1px solid rgba(74, 141, 255, 0.4)",
                  color: "#B3CEFF",
                  borderRadius: 10,
                  padding: "10px 14px",
                  fontSize: 11,
                  lineHeight: 1.5,
                  marginBottom: 16,
                  display: "flex",
                  gap: 8,
                  alignItems: "flex-start",
                }}
              >
                <span aria-hidden>✦</span>
                <span>
                  <strong style={{ letterSpacing: "0.08em" }}>DEMO</strong> — Email login is an Eber L03 preview. In demo mode any 6-digit code will resolve you to your account. Production will use mobile OTP until Eber supports email.
                </span>
              </div>

              {error && <div style={{ color: "#FF8A80", fontSize: 12, marginBottom: 14 }}>{error}</div>}

              <V2GoldButton onClick={() => proceedToVerify("signup")} style={{ marginBottom: 20 }}>Sign Up</V2GoldButton>

              {/* Divider with "or" chip */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <div style={{ flex: 1, height: 1, background: V2.divider }} />
                <div style={{ fontSize: 10, color: V2.textMuted, letterSpacing: "0.2em", textTransform: "uppercase" }}>or</div>
                <div style={{ flex: 1, height: 1, background: V2.divider }} />
              </div>

              {/* Social row — Apple / Google / Email, Email carries ✦ DEMO badge */}
              <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
                {[
                  { id: "apple", label: "Apple", icon: "", demo: true },
                  { id: "google", label: "Google", icon: "G", demo: true },
                  { id: "email", label: "Email", icon: "✉", demo: true, flagged: true },
                ].map(opt => (
                  <div
                    key={opt.id}
                    onClick={() => proceedToVerify("signup")}
                    style={{
                      flex: 1,
                      padding: "14px 8px",
                      borderRadius: 10,
                      background: V2.elevated,
                      border: "1px solid " + V2.divider,
                      textAlign: "center",
                      cursor: "pointer",
                      position: "relative",
                      transition: "border-color 200ms",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = V2.goldBorder; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = V2.divider; }}
                  >
                    <div style={{ fontSize: 18, marginBottom: 4, color: V2.text }}>{opt.icon}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: V2.text }}>{opt.label}</div>
                    {opt.flagged && (
                      <div
                        style={{
                          position: "absolute", top: 4, right: 4,
                          fontSize: 8, fontWeight: 700, letterSpacing: "0.12em",
                          color: V2.gold,
                          padding: "1px 4px",
                          borderRadius: 4,
                          background: "rgba(245, 215, 166, 0.15)",
                        }}
                      >
                        ✦ DEMO
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ textAlign: "center", fontSize: 12, color: V2.textSecondary }}>
                Already a member? <span onClick={() => proceedToVerify("login")} style={{ color: V2.gold, cursor: "pointer", fontWeight: 600 }}>Log in</span>
              </div>
            </V2GlassPanel>

            <div
              onClick={handleBack}
              style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "#FFFFFF", fontWeight: 500, cursor: "pointer", letterSpacing: "0.02em" }}
            >
              ← Back
            </div>

            {/* ─── Choose Your Tier — expandable cards below login ───
                Preserved from classic Landing; tier gradients already
                render well on V2 dark bg so reused directly. */}
            <div style={{ marginTop: 48 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: V2.gold, marginBottom: 8, textAlign: "center" }}>
                ✦ Membership
              </div>
              <div style={{ fontFamily: FONT.h, fontSize: 26, fontWeight: 600, letterSpacing: "-0.01em", color: V2.text, marginBottom: 6, textAlign: "center" }}>
                Choose your tier
              </div>
              <div style={{ fontSize: 12, color: V2.textMuted, textAlign: "center", marginBottom: 18 }}>
                Tap any tier to explore full benefits
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {["silver", "gold", "platinum", "corporate"].map(tierId => {
                  const info = TIER_INFO[tierId];
                  const isExpanded = expandedTier === tierId;
                  const gradient = V2_TIER_GRADIENTS[tierId];
                  const ink = V2_TIER_INK[tierId];
                  const isEnquire = tierId === "corporate";
                  return (
                    <div
                      key={tierId}
                      style={{
                        position: "relative",
                        background: gradient,
                        borderRadius: 16,
                        color: ink,
                        overflow: "hidden",
                        boxShadow: isExpanded ? "0 0 32px rgba(245, 215, 166, 0.2), 0 12px 32px rgba(0, 0, 0, 0.4)" : "0 8px 24px rgba(0, 0, 0, 0.25)",
                        border: isExpanded ? "1px solid " + V2.goldBorder : "1px solid transparent",
                        transition: "box-shadow .25s, border-color .25s",
                      }}
                    >
                      <div
                        onClick={() => setExpandedTier(isExpanded ? null : tierId)}
                        style={{ padding: 20, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: FONT.h, fontSize: 22, fontWeight: 700 }}>
                            {tierId === "silver" ? "✧" : tierId === "gold" ? "★" : tierId === "platinum" ? "◆" : "◈"} {info.name}
                          </div>
                          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
                            {info.earn} · {info.bday} birthday
                          </div>
                        </div>
                        <div style={{ textAlign: "right", marginLeft: 10 }}>
                          <div style={{ fontFamily: FONT.h, fontSize: 17, fontWeight: 700 }}>{info.fee}</div>
                          <div
                            style={{
                              fontSize: 17, marginTop: 4, opacity: 0.75,
                              transition: "transform .25s",
                              transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                            }}
                          >▾</div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div
                          style={{
                            padding: "0 20px 20px 20px",
                            borderTop: "1px solid rgba(255,255,255,0.15)",
                            animation: "v2-fade-in 300ms ease-out",
                          }}
                        >
                          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 600, opacity: 0.75, marginTop: 14, marginBottom: 10 }}>
                            {isEnquire ? "Full entitlements" : "Your benefits"}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {info.benefits.map((b, i) => (
                              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                                <div style={{ color: ink, fontSize: 11, lineHeight: "18px", opacity: 0.8 }}>✦</div>
                                <div style={{ flex: 1, fontSize: 12.5, lineHeight: 1.5, opacity: 0.95 }}>{b}</div>
                              </div>
                            ))}
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isEnquire) {
                                setShowCorporate(true);
                              } else {
                                focusEmail();
                              }
                            }}
                            style={{
                              width: "100%", marginTop: 16,
                              padding: "12px 20px",
                              background: "rgba(255, 255, 255, 0.92)",
                              color: "#1A1D27",
                              border: "none", borderRadius: 10,
                              fontSize: 13, fontWeight: 700, cursor: "pointer",
                              fontFamily: FONT.b, letterSpacing: "0.02em",
                            }}
                          >
                            {isEnquire ? "Write in about Corporate Membership →" : "Log in to join " + info.name + " →"}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ─── Our Venues — using S5 V2VenueRow + sub-brand sheet ─── */}
            <div style={{ marginTop: 48 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: V2.gold, marginBottom: 8, textAlign: "center" }}>
                ✦ Our Venues
              </div>
              <div style={{ fontFamily: FONT.h, fontSize: 26, fontWeight: 600, letterSpacing: "-0.01em", color: V2.text, marginBottom: 6, textAlign: "center" }}>
                {VENUE_DIRECTORY.length} parent venues
              </div>
              <div style={{ fontSize: 12, color: V2.textMuted, textAlign: "center", marginBottom: 18 }}>
                Singapore & Malaysia · tap a venue to discover its concepts
              </div>

              {VENUE_DIRECTORY.map((parent, i) => (
                <V2VenueRow
                  key={parent.name}
                  index={i}
                  parent={parent}
                  onClick={() => setSheetParent(parent)}
                />
              ))}
            </div>
          </div>

          {/* Sub-brand sheet — reuses S5 component */}
          {sheetParent && (
            <V2SubBrandSheet parent={sheetParent} onClose={() => setSheetParent(null)} />
          )}
        </div>
        </>
      )}

      {/* PANEL C — Verify. Slides up on enter, slides down on 'Change email'. */}
      {panel === 2 && (
        <div
          style={{
            ...panelBase,
            animation: panel2Exiting
              ? "v2-slide-down 240ms cubic-bezier(0.4, 0, 1, 1) forwards"
              : "v2-slide-up 420ms cubic-bezier(0.2, 0.8, 0.2, 1)",
          }}
        >
          <div
            style={{
              minHeight: "100vh",
              padding: "60px 24px 40px",
              display: "flex", flexDirection: "column", justifyContent: "center",
              maxWidth: 480, margin: "0 auto",
            }}
          >
            <V2GlassPanel>
              <div
                aria-hidden
                style={{
                  position: "absolute", top: -1, left: 0, right: 0, height: 1,
                  background: "linear-gradient(90deg, transparent 0%, rgba(245,215,166,0.9) 50%, transparent 100%)",
                  animation: "v2-shimmer-once 600ms ease-out",
                }}
              />

              {/* Gold envelope-with-check icon */}
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ margin: "0 auto" }}>
                  <rect x="6" y="14" width="44" height="32" rx="4" stroke={V2.gold} strokeWidth="2" />
                  <path d="M6 18L28 32L50 18" stroke={V2.gold} strokeWidth="2" strokeLinejoin="round" />
                  <circle cx="42" cy="42" r="10" fill={V2.gold} />
                  <path d="M37 42L41 46L48 38" stroke={V2.textOnGold} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              <div style={{ fontFamily: FONT.h, fontSize: 26, fontWeight: 600, letterSpacing: "-0.01em", textAlign: "center", marginBottom: 8 }}>
                Verify
              </div>
              <div style={{ fontSize: 13, color: V2.textSecondary, textAlign: "center", marginBottom: 24, lineHeight: 1.5 }}>
                We've sent the verification code to<br />
                <span style={{ color: V2.text, fontFamily: FONT.m, fontSize: 13 }}>{email || "member@insider.com"}</span>
              </div>

              <V2OtpInput value={otp} onChange={setOtp} />

              {error && <div style={{ color: "#FF8A80", fontSize: 12, marginBottom: 14, textAlign: "center" }}>{error}</div>}

              <V2GoldButton onClick={verify} disabled={loading} style={{ marginBottom: 16 }}>
                {loading ? "Verifying…" : "Submit"}
              </V2GoldButton>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                <span
                  onClick={() => resendIn === 0 && setResendIn(30)}
                  style={{ color: resendIn === 0 ? V2.gold : V2.textMuted, cursor: resendIn === 0 ? "pointer" : "default", fontWeight: 600 }}
                >
                  Resend Code
                </span>
                <span style={{ color: V2.textMuted }}>
                  {resendIn > 0 ? "You can resend in " + resendIn + " sec" : "You can resend now"}
                </span>
              </div>
            </V2GlassPanel>

            <div
              onClick={handleChangeEmail}
              style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "#FFFFFF", fontWeight: 500, cursor: "pointer", letterSpacing: "0.02em" }}
            >
              ← Change email
            </div>

            <div style={{ textAlign: "center", marginTop: 10, fontSize: 10, color: V2.textMuted, letterSpacing: "0.15em", textTransform: "uppercase" }}>
              Page 2 of 2 · ● ●
            </div>
          </div>
        </div>
      )}

      {/* Corporate Enquiry Modal — opened from Corporate tier card CTA */}
      {showCorporate && <V2CorporateEnquiryModal onClose={() => setShowCorporate(false)} />}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SignUpV2 — Multi-step new-member sign-up flow
// ═══════════════════════════════════════════════════════════════════════════
// Triggered when SignInV2 detects an unrecognised email. PDPA-aligned:
// granular consent (terms required, marketing optional), purpose limitation
// stated inline, no pre-ticked boxes. Three panels:
//   1. Your details — name, email (pre-filled, locked), mobile, birthday month
//   2. Choose your tier — Silver (free) / Gold ($40) / Platinum ($80)
//      Paid tiers route through a Stripe-checkout placeholder.
//   3. Preferences & consent — category preference + terms + marketing opt-in
// On submit: INSERT into members + welcome bonus transaction (acquisition
// gamification by signup month) + tier audit trail. Then onSuccess routes
// straight into HOME, signed in.
// Requires Supabase columns: marketing_consent (bool), terms_accepted_at (tstz)
// — DDL must be run via Supabase Dashboard (publishable key cannot ALTER).
function SignUpV2({ prefillEmail, tiers, onSuccess, onBack }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState(prefillEmail || "");
  const [mobile, setMobile] = useState("");
  const [birthdayMonth, setBirthdayMonth] = useState("");
  const [chosenTier, setChosenTier] = useState("silver");
  const [categoryPref, setCategoryPref] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showStripeMock, setShowStripeMock] = useState(false);
  const [stripeMockPhase, setStripeMockPhase] = useState("checkout"); // checkout | processing | done

  const months = [
    { v: 1, n: "January" }, { v: 2, n: "February" }, { v: 3, n: "March" },
    { v: 4, n: "April" }, { v: 5, n: "May" }, { v: 6, n: "June" },
    { v: 7, n: "July" }, { v: 8, n: "August" }, { v: 9, n: "September" },
    { v: 10, n: "October" }, { v: 11, n: "November" }, { v: 12, n: "December" },
  ];

  const categories = [
    { id: "cafes", label: "Cafés", icon: "☕" },
    { id: "restaurants", label: "Restaurants", icon: "🍽" },
    { id: "bars", label: "Bars", icon: "🍸" },
    { id: "wines", label: "Wines", icon: "🍷" },
  ];

  const tierOptions = [
    {
      id: "silver", name: "Silver", fee: 0, feeLabel: "Free",
      tagline: "Start your insider journey",
      perks: ["$1 = 1 point", "10% birthday discount", "1 × $10 welcome voucher", "Café stamp card"],
    },
    {
      id: "gold", name: "Gold", fee: 40, feeLabel: "$40 / yr",
      tagline: "Best value for regulars",
      perks: ["$1 = 1.5 points", "15% birthday discount", "10 × $20 dining vouchers", "Non-Stop Hits — unlimited refill", "Priority reservations"],
      badge: "Most popular",
    },
    {
      id: "platinum", name: "Platinum", fee: 80, feeLabel: "$80 / yr",
      tagline: "The full insider experience",
      perks: ["$1 = 2 points", "20% birthday discount", "10 × $25 dining vouchers", "Non-Stop Hits — unlimited refill", "VIP reservations", "Concierge service", "Chef's table access"],
      badge: "Most rewarding",
    },
  ];

  const validDetails = () =>
    name.trim().length > 1 &&
    email.includes("@") && email.length > 5 &&
    mobile.replace(/\D/g, "").length >= 8 &&
    birthdayMonth;

  const proceedFromDetails = () => {
    setError("");
    if (!name.trim() || name.trim().length < 2) { setError("Please enter your full name"); return; }
    if (!email.includes("@")) { setError("Please enter a valid email"); return; }
    if (mobile.replace(/\D/g, "").length < 8) { setError("Please enter a valid Singapore mobile number"); return; }
    if (!birthdayMonth) { setError("Please select your birthday month"); return; }
    setStep(2);
  };

  const proceedFromTier = () => {
    setError("");
    if (chosenTier === "silver") {
      setStep(3);
    } else {
      setShowStripeMock(true);
      setStripeMockPhase("checkout");
    }
  };

  const completeStripeMock = () => {
    setStripeMockPhase("processing");
    setTimeout(() => {
      setStripeMockPhase("done");
      setTimeout(() => {
        setShowStripeMock(false);
        setStep(3);
      }, 800);
    }, 1400);
  };

  const cancelStripeMock = () => {
    setShowStripeMock(false);
    setStripeMockPhase("checkout");
  };

  const submitSignup = async () => {
    setError("");
    if (!termsAccepted) { setError("Please accept the terms of membership to continue"); return; }
    setLoading(true);
    try {
      // Generate next member ID. NB: not atomic — fine for demo, replace
      // with a Supabase RPC + sequence before production.
      const list = await supaFetch("members?select=id&order=id.desc&limit=1");
      const last = (Array.isArray(list) && list[0] && list[0].id) || "M0000";
      const nextNum = parseInt(last.slice(1), 10) + 1;
      const newId = "M" + String(nextNum).padStart(4, "0");

      // Singapore mobile formatting — accept with or without country code,
      // store canonically as "+65 XXXXXXXX".
      const digits = mobile.replace(/\D/g, "");
      const local = digits.startsWith("65") && digits.length === 10 ? digits.slice(2) : digits;
      const formattedMobile = "+65 " + local;

      // Acquisition gamification — January 100 / February 150 / March 200
      const signupMonth = new Date().getMonth() + 1;
      const bonusByMonth = { 1: 100, 2: 150, 3: 200 };
      const bonusPoints = bonusByMonth[signupMonth] || 0;

      // Paid-tier expiry — 1 year from signup
      let membershipExpiry = null;
      if (chosenTier !== "silver") {
        const d = new Date();
        d.setFullYear(d.getFullYear() + 1);
        membershipExpiry = d.toISOString();
      }

      const newMember = {
        id: newId,
        name: name.trim(),
        mobile: formattedMobile,
        email: email.trim().toLowerCase(),
        tier: chosenTier,
        points: bonusPoints,
        total_spend: 0,
        category_pref: categoryPref || null,
        birthday_month: parseInt(birthdayMonth, 10),
        signup_date: new Date().toISOString(),
        visits: 0,
        stamps: 0,
        voucher_sets_used: 0,
        membership_expiry: membershipExpiry,
        marketing_consent: marketingConsent,
        terms_accepted_at: new Date().toISOString(),
      };

      const inserted = await supaFetch("members", { method: "POST", body: newMember });

      // Welcome bonus transaction — acquisition gamification audit trail
      if (bonusPoints > 0) {
        await supaFetch("transactions", {
          method: "POST",
          body: {
            member_id: newId,
            venue: "1-Insider Rewards",
            amount: 0,
            points: bonusPoints,
            type: "earn",
            reward_name: "Welcome bonus",
            note: "Acquisition gamification — " + new Date().toLocaleString("en-SG", { month: "long" }) + " signup",
          },
        });
      }

      // Tier signup transaction — audit trail for paid tiers
      if (chosenTier !== "silver") {
        await supaFetch("transactions", {
          method: "POST",
          body: {
            member_id: newId,
            venue: "1-Insider Rewards",
            amount: chosenTier === "gold" ? 40 : 80,
            points: 0,
            type: "adjust",
            reward_name: "Tier signup: " + chosenTier,
            note: "Demo Stripe checkout · expires " + (membershipExpiry ? new Date(membershipExpiry).toLocaleDateString("en-SG") : "—"),
          },
        });
      }

      setStep(4);
      // Brief success animation before signing the user in.
      setTimeout(() => {
        const signedInMember = (Array.isArray(inserted) && inserted[0]) ? inserted[0] : newMember;
        onSuccess(signedInMember);
      }, 1800);
    } catch (e) {
      console.error("Signup failed:", e);
      const msg = (e && e.message) || "Could not create your account. Please try again.";
      // Friendlier messaging for known failure modes
      const friendly = /marketing_consent|terms_accepted_at/.test(msg)
        ? "Database not yet updated for sign-up. Please run the marketing_consent + terms_accepted_at migration in Supabase."
        : /duplicate key|unique/.test(msg)
        ? "This mobile number or email is already registered. Try signing in instead."
        : msg;
      setError(friendly);
      setLoading(false);
    }
  };

  // Reusable shell — V2 dark glass panel matching SignInV2
  const shell = (children) => (
    <>
      <V2Styles />
      <V2Badge />
      <div
        style={{
          position: "fixed", inset: 0,
          background: V2.bg,
          color: V2.text,
          fontFamily: FONT.b,
          overflowY: "auto",
          zIndex: 110,
          animation: "v2-fade-in 400ms ease-out",
        }}
      >
        <div style={{ minHeight: "100vh", padding: "60px 24px 60px", maxWidth: 480, margin: "0 auto" }}>
          <V2GlassPanel>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
              <V2InsiderLogo width={150} style={{ maxWidth: "55%" }} lighter />
            </div>
            {children}
          </V2GlassPanel>
        </div>
      </div>
    </>
  );

  // Step indicator dots
  const StepDots = ({ current }) => (
    <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 24 }}>
      {[1, 2, 3].map(n => (
        <div
          key={n}
          style={{
            width: n === current ? 28 : 8,
            height: 8,
            borderRadius: 4,
            background: n <= current ? V2.gold : V2.divider,
            transition: "all 300ms ease-out",
          }}
        />
      ))}
    </div>
  );

  // ── STEP 1: DETAILS ─────────────────────────────────────────────────────
  if (step === 1) {
    return shell(
      <>
        <StepDots current={1} />
        <div style={{ fontFamily: FONT.h, fontSize: 22, fontWeight: 600, color: "#fff", textAlign: "center", marginBottom: 8 }}>
          Welcome to 1-Insider
        </div>
        <div style={{ fontSize: 13, color: "#fff", opacity: 0.75, textAlign: "center", marginBottom: 24, lineHeight: 1.5 }}>
          Let's set up your account.
        </div>

        <V2TextInput label="Full name" value={name} onChange={setName} placeholder="Jane Tan" autoFocus />

        <V2TextInput label="Email" value={email} onChange={setEmail} type="email" placeholder="you@example.com" />

        {/* Mobile with +65 prefix */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: V2.textSecondary, marginBottom: 8 }}>
            Mobile number
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{
              background: V2.elevated, border: "1px solid " + V2.divider, borderRadius: 10,
              padding: "14px 16px", color: V2.textSecondary, fontFamily: FONT.m, fontSize: 14, minWidth: 64, textAlign: "center",
            }}>+65</div>
            <input
              value={mobile}
              onChange={e => setMobile(e.target.value.replace(/\D/g, "").slice(0, 8))}
              type="tel"
              placeholder="8123 4567"
              style={{
                flex: 1,
                background: V2.elevated, border: "1px solid " + V2.divider, borderRadius: 10,
                padding: "14px 16px", color: V2.text, fontFamily: FONT.b, fontSize: 15, outline: "none", boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        {/* Birthday month picker */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: V2.textSecondary, marginBottom: 8 }}>
            Birthday month
          </div>
          <div style={{ fontSize: 11, color: V2.textMuted, marginBottom: 8 }}>
            We'll surprise you with a tier-based discount during your birthday month.
          </div>
          <select
            value={birthdayMonth}
            onChange={e => setBirthdayMonth(e.target.value)}
            style={{
              width: "100%",
              background: V2.elevated, border: "1px solid " + V2.divider, borderRadius: 10,
              padding: "14px 16px", color: birthdayMonth ? V2.text : V2.textMuted, fontFamily: FONT.b, fontSize: 15,
              outline: "none", boxSizing: "border-box", appearance: "none",
              backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path d='M6 8L0 0h12z' fill='%236B6E76'/></svg>\")",
              backgroundRepeat: "no-repeat", backgroundPosition: "right 16px center",
            }}
          >
            <option value="" style={{ background: V2.elevated, color: V2.textMuted }}>Select month…</option>
            {months.map(m => (
              <option key={m.v} value={m.v} style={{ background: V2.elevated, color: V2.text }}>{m.n}</option>
            ))}
          </select>
        </div>

        {error && <div style={{ color: "#FF8A80", fontSize: 12, marginBottom: 14, textAlign: "center" }}>{error}</div>}

        <V2GoldButton onClick={proceedFromDetails} style={{ marginBottom: 14 }}>Continue</V2GoldButton>

        <div style={{ textAlign: "center", fontSize: 11, color: V2.textMuted, lineHeight: 1.5 }}>
          By continuing you agree to our use of this information to manage your membership.
          You'll choose your marketing preferences in the next step.
        </div>

        <div style={{ textAlign: "center", marginTop: 18 }}>
          <span onClick={onBack} style={{ fontSize: 12, color: V2.textSecondary, cursor: "pointer" }}>← Back to sign in</span>
        </div>
      </>
    );
  }

  // ── STEP 2: TIER PICKER ─────────────────────────────────────────────────
  if (step === 2) {
    return shell(
      <>
        <StepDots current={2} />
        <div style={{ fontFamily: FONT.h, fontSize: 22, fontWeight: 600, color: "#fff", textAlign: "center", marginBottom: 8 }}>
          Choose your membership
        </div>
        <div style={{ fontSize: 13, color: "#fff", opacity: 0.75, textAlign: "center", marginBottom: 22, lineHeight: 1.5 }}>
          You can upgrade later from your profile.
        </div>

        {tierOptions.map(t => {
          const selected = chosenTier === t.id;
          const isPlatinum = t.id === "platinum";
          const isGold = t.id === "gold";
          return (
            <div
              key={t.id}
              onClick={() => setChosenTier(t.id)}
              style={{
                padding: 18,
                marginBottom: 12,
                borderRadius: 14,
                background: selected
                  ? (isPlatinum ? "linear-gradient(135deg,#3a3a3a,#1a1a1a 60%,#4a4a4a)" :
                     isGold ? "linear-gradient(135deg,#C5A258,#D4B978 50%,#A88B3A)" :
                     "linear-gradient(135deg,#e8e8e8,#d0d0d0)")
                  : V2.elevated,
                border: selected ? "1.5px solid " + V2.gold : "1px solid " + V2.divider,
                cursor: "pointer",
                color: selected ? (isPlatinum ? "#fff" : "#1A1D27") : V2.text,
                position: "relative",
                transition: "all 200ms ease-out",
                boxShadow: selected ? "0 8px 24px rgba(245,215,166,0.18)" : "none",
              }}
            >
              {t.badge && (
                <div style={{
                  position: "absolute", top: -10, right: 14,
                  background: V2.gold, color: V2.textOnGold,
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                  padding: "4px 10px", borderRadius: 12,
                }}>{t.badge}</div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div>
                  <div style={{ fontFamily: FONT.h, fontSize: 22, fontWeight: 700 }}>{t.name}</div>
                  <div style={{ fontSize: 11, opacity: 0.75, marginTop: 2 }}>{t.tagline}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: FONT.h, fontSize: 18, fontWeight: 700 }}>{t.feeLabel}</div>
                </div>
              </div>
              <div style={{ borderTop: selected ? "1px solid rgba(0,0,0,0.15)" : "1px solid " + V2.divider, paddingTop: 10, marginTop: 10 }}>
                {t.perks.slice(0, selected ? t.perks.length : 3).map((p, i) => (
                  <div key={i} style={{ fontSize: 12, marginBottom: 4, opacity: 0.92 }}>
                    <span style={{ marginRight: 6, opacity: 0.6 }}>✓</span>{p}
                  </div>
                ))}
                {!selected && t.perks.length > 3 && (
                  <div style={{ fontSize: 11, opacity: 0.55, marginTop: 4 }}>+ {t.perks.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}

        {error && <div style={{ color: "#FF8A80", fontSize: 12, marginBottom: 14, textAlign: "center" }}>{error}</div>}

        <V2GoldButton onClick={proceedFromTier} style={{ marginTop: 8, marginBottom: 12 }}>
          {chosenTier === "silver" ? "Continue with Silver" : "Continue with " + tierOptions.find(t => t.id === chosenTier).name + " · " + tierOptions.find(t => t.id === chosenTier).feeLabel}
        </V2GoldButton>

        <div style={{ textAlign: "center" }}>
          <span onClick={() => setStep(1)} style={{ fontSize: 12, color: V2.textSecondary, cursor: "pointer" }}>← Back</span>
        </div>

        {/* Stripe checkout placeholder modal */}
        {showStripeMock && (
          <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 200, padding: 20,
          }} onClick={stripeMockPhase === "checkout" ? cancelStripeMock : undefined}>
            <div style={{
              background: "#fff", borderRadius: 16, padding: 28, width: "100%", maxWidth: 380,
              fontFamily: FONT.b, color: "#1A1D27",
            }} onClick={e => e.stopPropagation()}>
              {stripeMockPhase === "checkout" && (
                <>
                  <div style={{ fontSize: 11, color: "#6B6E76", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8 }}>
                    Secure checkout · powered by Stripe
                  </div>
                  <div style={{ fontFamily: FONT.h, fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
                    {tierOptions.find(t => t.id === chosenTier).name} membership
                  </div>
                  <div style={{ fontSize: 13, color: "#6B6E76", marginBottom: 18 }}>
                    {tierOptions.find(t => t.id === chosenTier).feeLabel} · annual
                  </div>
                  <div style={{ background: "#FFF8E1", border: "1px solid #FFE082", borderRadius: 8, padding: 12, fontSize: 11, color: "#5D4037", marginBottom: 16, lineHeight: 1.5 }}>
                    <strong>⚠️ Demo placeholder</strong> — JEPL's real Stripe account isn't wired up yet. Tapping below completes the demo signup at this tier without taking payment.
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: "1px solid #eee", fontSize: 13 }}>
                    <span>Annual fee</span>
                    <strong>${tierOptions.find(t => t.id === chosenTier).fee}.00</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: "1px solid #eee", fontSize: 14, fontWeight: 700 }}>
                    <span>Total today</span>
                    <span>${tierOptions.find(t => t.id === chosenTier).fee}.00 SGD</span>
                  </div>
                  <button
                    onClick={completeStripeMock}
                    style={{
                      width: "100%", marginTop: 16,
                      background: "#635BFF", color: "#fff", border: "none", borderRadius: 8,
                      padding: "14px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FONT.b,
                    }}
                  >Pay ${tierOptions.find(t => t.id === chosenTier).fee}.00 (demo)</button>
                  <button
                    onClick={cancelStripeMock}
                    style={{
                      width: "100%", marginTop: 8,
                      background: "transparent", color: "#6B6E76", border: "none",
                      padding: "10px", fontSize: 12, cursor: "pointer", fontFamily: FONT.b,
                    }}
                  >Cancel</button>
                </>
              )}
              {stripeMockPhase === "processing" && (
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <div style={{
                    width: 36, height: 36, border: "3px solid #eee", borderTopColor: "#635BFF",
                    borderRadius: "50%", margin: "0 auto 14px", animation: "spin 0.8s linear infinite",
                  }} />
                  <div style={{ fontSize: 13, color: "#6B6E76" }}>Processing payment…</div>
                </div>
              )}
              {stripeMockPhase === "done" && (
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>✓</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>Payment confirmed</div>
                </div>
              )}
            </div>
          </div>
        )}
      </>
    );
  }

  // ── STEP 3: PREFERENCES & CONSENT ───────────────────────────────────────
  if (step === 3) {
    return shell(
      <>
        <StepDots current={3} />
        <div style={{ fontFamily: FONT.h, fontSize: 22, fontWeight: 600, color: "#fff", textAlign: "center", marginBottom: 8 }}>
          Almost there
        </div>
        <div style={{ fontSize: 13, color: "#fff", opacity: 0.75, textAlign: "center", marginBottom: 22, lineHeight: 1.5 }}>
          Tell us what you love and review the basics.
        </div>

        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: V2.textSecondary, marginBottom: 8 }}>
          Favourite category <span style={{ opacity: 0.6, textTransform: "none", letterSpacing: 0 }}>(optional)</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 22 }}>
          {categories.map(c => (
            <div
              key={c.id}
              onClick={() => setCategoryPref(categoryPref === c.id ? "" : c.id)}
              style={{
                padding: "14px 12px",
                borderRadius: 10,
                background: categoryPref === c.id ? "rgba(245, 215, 166, 0.12)" : V2.elevated,
                border: "1px solid " + (categoryPref === c.id ? V2.gold : V2.divider),
                cursor: "pointer",
                textAlign: "center",
                transition: "all 200ms",
              }}
            >
              <div style={{ fontSize: 22, marginBottom: 4 }}>{c.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: V2.text }}>{c.label}</div>
            </div>
          ))}
        </div>

        {/* Consent block — PDPA-aligned: granular, separate, no pre-ticking */}
        <div style={{ background: V2.elevated, borderRadius: 12, padding: 16, marginBottom: 14, border: "1px solid " + V2.divider }}>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", marginBottom: 14 }}>
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={e => setTermsAccepted(e.target.checked)}
              style={{
                width: 18, height: 18, marginTop: 2, accentColor: V2.gold, cursor: "pointer", flexShrink: 0,
              }}
            />
            <div style={{ fontSize: 12, color: V2.text, lineHeight: 1.5 }}>
              <strong style={{ color: "#fff" }}>Required.</strong> I accept the <span style={{ color: V2.gold, textDecoration: "underline" }}>1-Insider Terms of Membership</span> and <span style={{ color: V2.gold, textDecoration: "underline" }}>Privacy Notice</span>. I understand 1-Group will use my data to manage my membership, issue rewards, and contact me about my account.
            </div>
          </label>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={marketingConsent}
              onChange={e => setMarketingConsent(e.target.checked)}
              style={{
                width: 18, height: 18, marginTop: 2, accentColor: V2.gold, cursor: "pointer", flexShrink: 0,
              }}
            />
            <div style={{ fontSize: 12, color: V2.text, lineHeight: 1.5 }}>
              <strong style={{ color: "#fff" }}>Optional.</strong> Yes, send me 1-Insider news, special offers, and event invitations by email and SMS. I can change my mind anytime in my profile.
            </div>
          </label>
        </div>

        <div style={{ fontSize: 10, color: V2.textMuted, lineHeight: 1.5, marginBottom: 18, textAlign: "center" }}>
          Personal data is processed in accordance with the Singapore Personal Data Protection Act 2012.
        </div>

        {error && <div style={{ color: "#FF8A80", fontSize: 12, marginBottom: 14, textAlign: "center" }}>{error}</div>}

        <V2GoldButton onClick={submitSignup} disabled={loading || !termsAccepted} style={{ marginBottom: 12 }}>
          {loading ? "Creating your account…" : "Complete sign-up"}
        </V2GoldButton>

        <div style={{ textAlign: "center" }}>
          <span onClick={() => setStep(2)} style={{ fontSize: 12, color: V2.textSecondary, cursor: "pointer" }}>← Back</span>
        </div>
      </>
    );
  }

  // ── STEP 4: SUCCESS ─────────────────────────────────────────────────────
  return shell(
    <div style={{ textAlign: "center", padding: "40px 0" }}>
      <div style={{
        width: 72, height: 72, borderRadius: "50%",
        background: "linear-gradient(135deg, #F5D7A6, #C79A5A)",
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 18px", fontSize: 36, color: "#1A1D27", fontWeight: 700,
        animation: "v2-pulse 1.6s ease-out infinite",
      }}>✓</div>
      <div style={{ fontFamily: FONT.h, fontSize: 24, fontWeight: 600, color: "#fff", marginBottom: 8 }}>
        Welcome to 1-Insider
      </div>
      <div style={{ fontSize: 13, color: "#fff", opacity: 0.75, marginBottom: 24, lineHeight: 1.5 }}>
        Your {tierOptions.find(t => t.id === chosenTier).name} membership is active. Signing you in…
      </div>
    </div>
  );
}


// ─── S3: Home — V2 helpers ────────────────────────────────────────────────
// Platinum tier uses a polished-metal conic gradient sampled from
// Chris's platiunum.png reference: cool blue rays around 213-247°,
// warm cream highlights around 303-326°, with a soft white centre
// glow. The richest of the three metallics — blends silver's
// reflectivity with subtle warm/cool dichroism for true platinum feel.
const V2_PLATINUM_METAL =
  "radial-gradient(circle at 50% 48%, rgba(255, 255, 255, 0.5) 0%, rgba(220, 230, 240, 0.0) 35%), " +
  "conic-gradient(from -90deg at 50% 50%, " +
    "#AEC0CE 0deg, #C8DADE 11deg, #D7EAEE 22deg, #C7E1EE 33deg, " +
    "#AFC9D6 45deg, #9DB9C5 56deg, #98B8D1 67deg, #AEC8D9 78deg, " +
    "#D7E3D7 90deg, #DEE2D3 101deg, #CAC7B4 112deg, #BCB598 123deg, " +
    "#B3B0A1 135deg, #BEBFB7 146deg, #DCDAC5 157deg, #E9E8D4 168deg, " +
    "#D4D9D3 180deg, #B3C0B9 191deg, #9EB2B9 202deg, #A1C0DF 213deg, " +
    "#BBD9F3 225deg, #D7E9F3 236deg, #CDE0E6 247deg, #BCC6C5 258deg, " +
    "#ADB3A9 270deg, #ADB6B5 281deg, #C2C7C3 292deg, #E7E0C6 303deg, " +
    "#EEE3C7 315deg, #D6CEB7 326deg, #BDB7A1 337deg, #ADAFA2 348deg, " +
    "#AEC0CE 360deg)";

// Silver tier uses a polished-metal conic gradient sampled from Chris's
// Pantone 20-0002 TPM "Ice Palace" reference (silver_panetone.png): two
// bright ray clusters around 45-67° and 202-225°, with darker valleys
// around 146-157° and 292-303°. Pure greyscale — every stop is R=G=B.
const V2_SILVER_METAL =
  "radial-gradient(circle at 50% 45%, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0.0) 42%), " +
  "conic-gradient(from -90deg at 50% 50%, " +
    "#C7C7C7 0deg, #D8D8D8 11deg, #E7E7E7 22deg, #FBFBFB 33deg, " +
    "#FFFFFF 45deg, #FFFFFF 56deg, #FFFFFF 67deg, #F9F9F9 78deg, " +
    "#E2E2E2 90deg, #CFCFCF 101deg, #BEBEBE 112deg, #AFAFAF 123deg, " +
    "#A5A5A5 135deg, #9C9C9C 146deg, #9E9E9E 157deg, #ABABAB 168deg, " +
    "#BDBDBD 180deg, #DBDBDB 191deg, #FEFEFE 202deg, #FFFFFF 213deg, " +
    "#FEFEFE 225deg, #E1E1E1 236deg, #CACACA 247deg, #B8B8B8 258deg, " +
    "#ADADAD 270deg, #A3A3A3 281deg, #9D9D9D 292deg, #9A9A9A 303deg, " +
    "#A0A0A0 315deg, #A8A8A8 326deg, #AFAFAF 337deg, #BBBBBB 348deg, " +
    "#C7C7C7 360deg)";

// Gold tier uses a polished-metal conic gradient sampled from Chris's
// reference image (gold2.png): four bright rays at ~11°/168°/236°/303°
// with darker valleys at ~123°/270°, plus a soft radial highlight near
// the centre to read as a metallic sheen.
const V2_GOLD_METAL =
  "radial-gradient(circle at 50% 45%, rgba(255, 250, 220, 0.55) 0%, rgba(255, 240, 190, 0.0) 38%), " +
  "conic-gradient(from -90deg at 50% 50%, " +
    "#E8CF7B 0deg, #FCE691 11deg, #F6DE84 22deg, #E5C362 33deg, " +
    "#D2A940 45deg, #CDA63D 56deg, #D7AD57 78deg, #D8B25D 90deg, " +
    "#CAA54D 101deg, #B88F37 112deg, #A57C22 123deg, #C39C37 146deg, " +
    "#E7BE55 168deg, #D9AF4B 180deg, #BD9631 202deg, #D8B64B 225deg, " +
    "#F7DB6D 236deg, #D0B059 247deg, #AE892E 258deg, #A47C1D 270deg, " +
    "#B4892A 281deg, #D2A741 292deg, #E6BD54 303deg, #DDB556 315deg, " +
    "#CEA951 326deg, #C79E4E 337deg, #CFAD65 348deg, #E8CF7B 360deg)";

// Corporate tier uses a polished-metal conic gradient sampled from
// Chris's Pantone 20-0168 TPM "Rustic Turquoise" reference
// (turquoise.png). Contrast was boosted ~1.4× from the raw samples
// since the reference swatch has a tighter brightness range than
// gold/silver/platinum — the boost gives the metallic shimmer enough
// punch to read on screen while staying within the rustic teal range.
// Cool blue-green peaks at ~11° and ~168°, deeper teal valleys around
// 67-101° and 247-281°.
const V2_CORPORATE_METAL =
  "radial-gradient(circle at 50% 45%, rgba(120, 200, 215, 0.28) 0%, rgba(80, 160, 180, 0.0) 38%), " +
  "conic-gradient(from -90deg at 50% 50%, " +
    "#295C6A 0deg, #2B616F 11deg, #2B5D6A 22deg, #25545C 33deg, " +
    "#234D56 45deg, #204750 56deg, #1D4249 67deg, #1F424B 78deg, " +
    "#1B3E46 90deg, #1C4048 101deg, #20444D 112deg, #1E434B 123deg, " +
    "#214A55 135deg, #24535D 146deg, #275664 157deg, #2B5F6D 168deg, " +
    "#2A5E6A 180deg, #295A67 191deg, #265562 202deg, #25545E 213deg, " +
    "#26525B 225deg, #214A53 236deg, #204A53 247deg, #214A53 258deg, " +
    "#214A53 270deg, #224C55 281deg, #224C55 292deg, #25515C 303deg, " +
    "#26505C 315deg, #255361 326deg, #2A5C6B 337deg, #2A5E6A 348deg, " +
    "#295C6A 360deg)";

const V2_TIER_GRADIENTS = {
  silver:    V2_SILVER_METAL,
  gold:      V2_GOLD_METAL,
  platinum:  V2_PLATINUM_METAL,
  corporate: V2_CORPORATE_METAL,
  staff:     "linear-gradient(135deg, #4A8DFF 0%, #1E5FC9 100%)",
};

const V2_TIER_INK = {
  silver: "#1A1D27", gold: "#1A1D27", platinum: "#1A1D27",
  corporate: "#F2F3F5", staff: "#F2F3F5",
};

function V2TierHero({ member }) {
  const tierId = member.tier || "silver";
  const tierInfo = TIER_INFO[tierId] || TIER_INFO.silver;
  const gradient = V2_TIER_GRADIENTS[tierId];
  const ink = V2_TIER_INK[tierId];
  const points = member.points || 0;

  // Progress semantics:
  //  - Silver: progress toward a 2000-pt "ready-for-Gold" milestone (U11 visual cue)
  //  - Gold / Platinum / Corporate / Staff: progress toward the next redemption
  //    voucher tier from points-rules.json base rate (100 / 150 / 250 pts)
  let target, caption;
  if (tierId === "silver") {
    target = 2000;
    const remaining = Math.max(0, target - points);
    caption = remaining > 0
      ? "Earn " + remaining.toLocaleString() + " points toward Gold tier"
      : "You're ready to upgrade to Gold";
  } else {
    const redeemTiers = [100, 150, 250];
    const next = redeemTiers.find(t => t > points) || 250;
    target = next;
    const value = { 100: 10, 150: 15, 250: 25 }[next];
    const remaining = Math.max(0, next - points);
    caption = remaining > 0
      ? "Earn " + remaining.toLocaleString() + " more points to redeem a $" + value + " voucher"
      : "Ready to redeem a $" + value + " voucher";
  }
  const pct = Math.min(100, (points / target) * 100);

  return (
    <div
      style={{
        position: "relative",
        borderRadius: 16,
        padding: 24,
        background: gradient,
        color: ink,
        overflow: "hidden",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35)",
        marginBottom: 16,
      }}
    >
      {/* Sheen sweep */}
      <div
        aria-hidden
        className="v2-sheen-overlay"
        style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "linear-gradient(110deg, transparent 0%, rgba(255,255,255,0.14) 45%, rgba(255,255,255,0.22) 50%, rgba(255,255,255,0.14) 55%, transparent 100%)",
          transform: "translateX(-60%)",
          animation: "v2-sheen 8s linear infinite",
        }}
      />

      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", opacity: 0.6, marginBottom: 6 }}>
          Your Current Level
        </div>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: FONT.h, fontSize: 26, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.1 }}>
              {tierInfo.name}
            </div>
            <div style={{ fontSize: 11, marginTop: 4, opacity: 0.65, fontFamily: FONT.m }}>
              {member.id} · {tierInfo.earn}
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", opacity: 0.6, marginBottom: 2 }}>
              Points
            </div>
            <div style={{ fontFamily: FONT.h, fontSize: 32, fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1 }}>
              {points.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div
          style={{
            position: "relative",
            height: 6,
            borderRadius: 9999,
            background: "rgba(26, 29, 39, 0.15)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute", left: 0, top: 0, bottom: 0,
              width: pct + "%",
              background: tierId === "corporate" || tierId === "staff"
                ? "linear-gradient(90deg, " + V2.goldSoft + " 0%, " + V2.gold + " 100%)"
                : "linear-gradient(90deg, rgba(26, 29, 39, 0.4) 0%, rgba(26, 29, 39, 0.75) 100%)",
              borderRadius: 9999,
              transition: "width 600ms cubic-bezier(0.2, 0.8, 0.2, 1)",
            }}
          />
        </div>
        <div style={{ marginTop: 8, fontSize: 11, opacity: 0.75 }}>
          {caption}
        </div>
      </div>
    </div>
  );
}

function V2StatCard({ label, value, actionLabel, onAction, accent, sub }) {
  const [pressed, setPressed] = useState(false);
  return (
    <div
      style={{
        flex: 1,
        background: V2.card,
        borderRadius: 16,
        padding: 18,
        border: "1px solid " + V2.divider,
        boxShadow: "0 1px 0 rgba(242, 243, 245, 0.04) inset, 0 8px 24px rgba(0, 0, 0, 0.25)",
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: V2.textSecondary, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontFamily: FONT.h, fontSize: 28, fontWeight: 700, letterSpacing: "-0.01em", color: accent || V2.text, lineHeight: 1, marginBottom: sub ? 4 : 12 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: V2.textMuted, marginBottom: 12 }}>
          {sub}
        </div>
      )}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          onMouseDown={() => setPressed(true)}
          onMouseUp={() => setPressed(false)}
          onMouseLeave={() => setPressed(false)}
          style={{
            background: "transparent",
            color: V2.gold,
            border: "1px solid " + V2.goldBorder,
            borderRadius: 9999,
            padding: "6px 14px",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.02em",
            cursor: "pointer",
            fontFamily: FONT.b,
            transform: pressed ? "scale(0.97)" : "scale(1)",
            transition: "transform 120ms",
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function V2PillToggle({ options, activeKey, onChange }) {
  return (
    <div
      style={{
        display: "inline-flex",
        background: V2.elevated,
        borderRadius: 9999,
        padding: 4,
        gap: 2,
      }}
    >
      {options.map(opt => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          style={{
            padding: "8px 18px",
            borderRadius: 9999,
            border: "none",
            fontFamily: FONT.b,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            background: activeKey === opt.key ? V2.gold : "transparent",
            color: activeKey === opt.key ? V2.textOnGold : V2.textSecondary,
            transition: "background 200ms ease-out, color 200ms ease-out",
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function V2TierSummaryCard({ tierId, info, isActive, onSelect }) {
  const gradient = V2_TIER_GRADIENTS[tierId];
  const ink = V2_TIER_INK[tierId];
  const [pressed, setPressed] = useState(false);
  return (
    <div
      onClick={onSelect}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        position: "relative",
        borderRadius: 16,
        padding: 20,
        background: gradient,
        color: ink,
        overflow: "hidden",
        marginBottom: 12,
        cursor: "pointer",
        transform: pressed ? "scale(0.98)" : "scale(1)",
        transition: "transform 120ms",
        border: isActive ? "2px solid " + V2.gold : "2px solid transparent",
        boxShadow: isActive ? "0 0 32px rgba(245, 215, 166, 0.3), 0 8px 24px rgba(0, 0, 0, 0.35)" : "0 8px 24px rgba(0, 0, 0, 0.25)",
      }}
    >
      <div
        aria-hidden
        className="v2-sheen-overlay"
        style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "linear-gradient(110deg, transparent 0%, rgba(255,255,255,0.1) 45%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.1) 55%, transparent 100%)",
          transform: "translateX(-60%)",
          animation: "v2-sheen 8s linear infinite",
        }}
      />
      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", opacity: 0.65, marginBottom: 3 }}>
              {info.fee}
            </div>
            <div style={{ fontFamily: FONT.h, fontSize: 20, fontWeight: 600, lineHeight: 1.1 }}>
              {info.name}
            </div>
          </div>
          {isActive && (
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", padding: "3px 8px", borderRadius: 9999, background: "rgba(26, 29, 39, 0.2)" }}>
              Current
            </div>
          )}
        </div>
        <div style={{ fontSize: 11, opacity: 0.75, marginBottom: 10 }}>{info.earn} · {info.bday} birthday</div>
        <div style={{ fontSize: 11, opacity: 0.7, lineHeight: 1.5 }}>
          {info.benefits.slice(0, 3).map((b, i) => (
            <div key={i} style={{ display: "flex", gap: 6, marginBottom: 2 }}>
              <span>✦</span><span>{b}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── S4: Pay / Bookings / Events — helpers ────────────────────────────────

// Format a timestamptz as "Sat, 27 Apr · 2:22 PM" (Singapore locale).
function v2FormatDateTime(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const day = d.toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short" });
    const time = d.toLocaleTimeString("en-SG", { hour: "numeric", minute: "2-digit" });
    return day + " · " + time;
  } catch (e) {
    return iso;
  }
}

// Is event visible to this tier? NULL tier_exclusive = visible to all.
function v2EventVisibleToTier(evt, tierId) {
  if (!evt.tier_exclusive) return true;
  if (!Array.isArray(evt.tier_exclusive) || evt.tier_exclusive.length === 0) return true;
  return evt.tier_exclusive.includes(tierId);
}

function V2ActionCard({ label, title, caption, onClick, pillLabel }) {
  const [pressed, setPressed] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "18px 20px",
        background: V2.card,
        border: "1px solid " + V2.divider,
        borderRadius: 16,
        cursor: "pointer",
        marginBottom: 20,
        boxShadow: "0 1px 0 rgba(242, 243, 245, 0.04) inset, 0 8px 24px rgba(0, 0, 0, 0.25)",
        transform: pressed ? "scale(0.985)" : "scale(1)",
        transition: "transform 120ms ease-out",
      }}
    >
      <div style={{ flex: 1, paddingRight: 14 }}>
        {label && (
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: V2.gold, marginBottom: 6 }}>
            {label}
          </div>
        )}
        <div style={{ fontFamily: FONT.h, fontSize: 16, fontWeight: 600, color: V2.text, marginBottom: 4, lineHeight: 1.2 }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: V2.textMuted, lineHeight: 1.4 }}>
          {caption}
        </div>
      </div>
      {pillLabel && (
        <div
          style={{
            flexShrink: 0,
            padding: "8px 16px",
            borderRadius: 9999,
            border: "1px solid " + V2.goldBorder,
            color: V2.gold,
            fontSize: 12, fontWeight: 600, letterSpacing: "0.02em",
          }}
        >
          {pillLabel} →
        </div>
      )}
    </div>
  );
}

function V2ShelfHeader({ title, count, onSeeAll, seeAllLabel }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "0 4px", marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <div style={{ fontFamily: FONT.h, fontSize: 20, fontWeight: 600, color: V2.text, letterSpacing: "-0.01em" }}>
          {title}
        </div>
        {count != null && (
          <div style={{ fontSize: 12, color: V2.textMuted }}>· {count}</div>
        )}
      </div>
      {onSeeAll && (
        <div
          onClick={onSeeAll}
          style={{ fontSize: 12, fontWeight: 600, color: V2.gold, cursor: "pointer", letterSpacing: "0.02em" }}
        >
          {seeAllLabel || "See all"} →
        </div>
      )}
    </div>
  );
}

// Horizontal snap-scroll shelf with edge-fade mask.
function V2Shelf({ children, noEdgeFade }) {
  const style = {
    display: "flex", gap: 12, overflowX: "auto",
    scrollSnapType: "x mandatory",
    padding: "4px 16px 8px 16px",
    margin: "0 -20px",
    scrollbarWidth: "none",
    msOverflowStyle: "none",
  };
  if (!noEdgeFade) {
    style.WebkitMaskImage = "linear-gradient(90deg, transparent 0, black 20px, black calc(100% - 20px), transparent 100%)";
    style.maskImage = "linear-gradient(90deg, transparent 0, black 20px, black calc(100% - 20px), transparent 100%)";
  }
  return (
    <div>
      <style>{".v2-shelf::-webkit-scrollbar { display: none; } .v2-shelf > * { scroll-snap-align: start; }"}</style>
      <div className="v2-shelf" style={style}>
        {children}
      </div>
    </div>
  );
}

function V2BookingCard({ thumbnail, venueName, dateTime, location, onClick, index }) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        display: "flex", flexDirection: "column",
        width: 200, flexShrink: 0,
        background: V2.card,
        borderRadius: 14,
        border: "1px solid " + V2.divider,
        overflow: "hidden",
        cursor: "pointer",
        padding: 0,
        textAlign: "left",
        transform: pressed ? "scale(0.98)" : "scale(1)",
        transition: "transform 120ms ease-out",
        animation: "v2-fade-in 400ms ease-out " + (index * 40) + "ms both",
      }}
    >
      <div style={{ width: "100%", aspectRatio: "1/1", background: V2.elevated, overflow: "hidden" }}>
        {thumbnail && (
          <img
            src={thumbnail}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover", filter: "saturate(0.9)" }}
          />
        )}
      </div>
      <div style={{ padding: 14 }}>
        <div style={{ fontFamily: FONT.h, fontSize: 15, fontWeight: 600, color: V2.text, marginBottom: 4, lineHeight: 1.2 }}>
          {venueName}
        </div>
        <div style={{ fontSize: 12, color: V2.textSecondary, marginBottom: 2 }}>
          {dateTime}
        </div>
        {location && (
          <div style={{ fontSize: 11, color: V2.textMuted }}>
            {location}
          </div>
        )}
      </div>
    </button>
  );
}

function V2EventCard({ heroImage, title, venueName, dateTime, status, tierExclusive, onClick, index }) {
  const [pressed, setPressed] = useState(false);
  const statusColor = status === "open" ? V2.gold : status === "waitlist" ? V2.info : V2.textMuted;
  const statusText = status === "open" ? "Booking open" : status === "waitlist" ? "Waitlist" : status === "soldout" ? "Sold out" : status;
  const isExclusive = Array.isArray(tierExclusive) && tierExclusive.length > 0;
  return (
    <button
      onClick={onClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        position: "relative",
        width: 280, height: 340,
        borderRadius: 16,
        overflow: "hidden",
        border: "none",
        padding: 0,
        background: V2.elevated,
        cursor: "pointer",
        flexShrink: 0,
        textAlign: "left",
        transform: pressed ? "scale(0.98)" : "scale(1)",
        transition: "transform 120ms ease-out",
        animation: "v2-fade-in 400ms ease-out " + (index * 40) + "ms both",
      }}
    >
      {heroImage && (
        <img
          src={heroImage}
          alt=""
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "saturate(0.9)" }}
        />
      )}
      <div
        aria-hidden
        style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(180deg, rgba(15,17,26,0.15) 0%, rgba(15,17,26,0.4) 55%, rgba(15,17,26,0.95) 100%)",
        }}
      />
      {isExclusive && (
        <div
          style={{
            position: "absolute", top: 12, right: 12,
            fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase",
            color: V2.gold,
            padding: "4px 10px",
            borderRadius: 9999,
            background: "rgba(15, 17, 26, 0.7)",
            border: "1px solid " + V2.goldBorder,
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
        >
          ✦ Members only
        </div>
      )}
      <div style={{ position: "absolute", bottom: 16, left: 16, right: 16, color: V2.text }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: statusColor }} />
          <span style={{ color: statusColor }}>{statusText}</span>
        </div>
        <div style={{ fontFamily: FONT.h, fontSize: 19, fontWeight: 600, marginBottom: 6, lineHeight: 1.2, letterSpacing: "-0.01em" }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: V2.textSecondary, lineHeight: 1.4 }}>
          {venueName} · {dateTime}
        </div>
      </div>
    </button>
  );
}

function V2BottomNav({ view, setView, classic, hasUnscannedVoucher, onScan }) {
  // 5-tab bottom nav with centre Scan FAB (raised).
  // Mapping: Home → HOME · Rewards → REWARDS · [Scan] → onScan callback or WALLET fallback
  // · Points → HISTORY · City → EXPLORE.
  const tabs = [
    { key: "home",    label: "Home",    icon: "⌂", v: VIEW.HOME },
    { key: "rewards", label: "Rewards", icon: "✦", v: VIEW.REWARDS },
    { key: "scan",    label: "Scan",    isFab: true, v: VIEW.WALLET },
    { key: "receipts", label: "Receipts", icon: "▭", v: VIEW.HISTORY },
    { key: "city",    label: "City",    icon: "◉", v: VIEW.EXPLORE },
  ];

  const [fabPressed, setFabPressed] = useState(false);

  return (
    <nav
      style={{
        position: "fixed", bottom: 0, left: "50%",
        transform: "translateX(-50%)",
        width: "100%", maxWidth: 480,
        height: 72,
        background: "rgba(26, 29, 39, 0.88)",
        backdropFilter: "blur(16px) saturate(120%)",
        WebkitBackdropFilter: "blur(16px) saturate(120%)",
        borderTop: "1px solid " + V2.divider,
        display: "flex", alignItems: "center", justifyContent: "space-around",
        paddingBottom: "env(safe-area-inset-bottom)",
        zIndex: 99,
      }}
    >
      {tabs.map(tab => {
        if (tab.isFab) {
          return (
            <button
              key={tab.key}
              onClick={() => (onScan ? onScan() : setView(tab.v))}
              onMouseDown={() => setFabPressed(true)}
              onMouseUp={() => setFabPressed(false)}
              onMouseLeave={() => setFabPressed(false)}
              aria-label="Scan"
              style={{
                width: 56, height: 56, borderRadius: "50%",
                background: "linear-gradient(135deg, " + V2.goldSoft + " 0%, " + V2.gold + " 100%)",
                border: "none", cursor: "pointer",
                boxShadow: "0 0 32px rgba(245, 215, 166, 0.35), 0 8px 24px rgba(0, 0, 0, 0.4)",
                transform: "translateY(-12px) " + (fabPressed ? "scale(0.94)" : "scale(1)"),
                color: V2.textOnGold,
                fontSize: 22, fontWeight: 600,
                fontFamily: FONT.b,
                transition: "transform 120ms",
                animation: hasUnscannedVoucher ? "v2-pulse 2s ease-in-out infinite" : "none",
              }}
            >
              ◉
            </button>
          );
        }
        const active = view === tab.v;
        return (
          <button
            key={tab.key}
            onClick={() => setView(tab.v)}
            style={{
              flex: 1, background: "transparent", border: "none", cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              color: active ? V2.gold : V2.textSecondary,
              fontFamily: FONT.b, fontSize: 10, fontWeight: active ? 600 : 500,
              padding: "4px 0",
            }}
          >
            <span style={{ fontSize: 18 }}>{tab.icon}</span>
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}

// ─── S3: Home / Tier + Points Hero ───────────────────────────────────────
function HomeV2({ member, transactions, vouchers, giftCards, bookings, events, tiers, rewards, setView, reload, onPay }) {
  const tierId = member.tier || "silver";
  const tierInfo = TIER_INFO[tierId] || TIER_INFO.silver;
  const isSilver = tierId === "silver";
  const [toggle, setToggle] = useState("rewards"); // 'rewards' | 'tiers'
  const [search, setSearch] = useState("");

  const vouchersRemaining = member.vouchers_remaining != null ? member.vouchers_remaining : (tierInfo.vCount || 0);
  const stamps = member.stamps || 0;
  const individualVouchers = (vouchers || []).filter(v => v.status === "active" || v.status === "pending_scan").length;

  // S4 data derivation
  const now = Date.now();
  const upcomingBookings = (bookings || [])
    .filter(b => (b.status === "confirmed" || b.status === "pending") && new Date(b.starts_at).getTime() >= now - 2 * 3600 * 1000) // include in-progress
    .slice(0, 10);
  const visibleEvents = (events || [])
    .filter(e => e.status === "open" || e.status === "waitlist")
    .filter(e => v2EventVisibleToTier(e, tierId))
    .slice(0, 10);

  const firstName = (member.name || "").split(" ")[0] || "there";
  const tierOrder = ["silver", "gold", "platinum", "corporate", "staff"];

  const filteredRewards = (rewards || []).filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (r.name || "").toLowerCase().includes(q) || (r.description || "").toLowerCase().includes(q);
  });

  return (
    <div
      style={{
        background: V2.bg,
        color: V2.text,
        fontFamily: FONT.b,
        minHeight: "100vh",
        padding: "24px 20px 100px",
        animation: "v2-fade-in 400ms ease-out",
      }}
    >
      <V2Styles />

      {/* Greeting row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: V2.textMuted, marginBottom: 4 }}>
            ✦ 1-Insider
          </div>
          <div style={{ fontFamily: FONT.h, fontSize: 24, fontWeight: 600, letterSpacing: "-0.01em", color: V2.text }}>
            Welcome, {firstName}
          </div>
        </div>
        <div
          onClick={() => setView(VIEW.PROFILE)}
          style={{
            width: 40, height: 40, borderRadius: 9999,
            background: V2.card, border: "1px solid " + V2.goldBorder,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: V2.gold, fontSize: 14, cursor: "pointer", fontWeight: 600,
            fontFamily: FONT.h, letterSpacing: "0.02em",
            transition: "all 200ms ease-out",
          }}
          title="Profile, activity & settings"
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(245, 215, 166, 0.12)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = V2.card; }}
        >
          {((member.name || "?")[0] || "?").toUpperCase()}
        </div>
      </div>

      {/* Tier hero */}
      <V2TierHero member={member} />

      {/* U11 — Silver members only: upgrade CTA pill */}
      {isSilver && (
        <div
          onClick={() => setView(VIEW.PROFILE)}
          style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "12px 16px",
            background: "rgba(245, 215, 166, 0.1)",
            border: "1px solid " + V2.goldBorder,
            borderRadius: 12,
            marginBottom: 16,
            cursor: "pointer",
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: V2.gold, marginBottom: 2 }}>
              ✦ Upgrade
            </div>
            <div style={{ fontSize: 13, color: V2.text }}>
              Unlock Gold for <span style={{ fontWeight: 600 }}>$40/yr</span> — more vouchers, priority reservations.
            </div>
          </div>
          <div style={{ color: V2.gold, fontSize: 18, fontWeight: 600 }}>→</div>
        </div>
      )}

      {/* ─── S4: Pay / Bookings / Events — stacked below the tier hero ─── */}
      {/* Pay with the app — opens QrScanPayV2 (S7) directly */}
      <V2ActionCard
        label="Pay with the app"
        title="Open your tab and pay in-app"
        caption="Scan to open your bill, redeem points, and earn on every check at any 1-Group venue"
        pillLabel="Pay now"
        onClick={() => (onPay ? onPay() : setView(VIEW.WALLET))}
      />

      {/* Upcoming bookings shelf */}
      <div style={{ marginBottom: 24 }}>
        <V2ShelfHeader
          title="Upcoming bookings"
          count={upcomingBookings.length > 0 ? upcomingBookings.length : null}
          onSeeAll={upcomingBookings.length > 0 ? () => setView(VIEW.EXPLORE) : null}
        />
        {upcomingBookings.length > 0 ? (
          <V2Shelf>
            {upcomingBookings.map((b, i) => (
              <V2BookingCard
                key={b.id}
                index={i}
                thumbnail={b.thumbnail_url}
                venueName={b.venue_name}
                dateTime={v2FormatDateTime(b.starts_at) + (b.party_size ? " · table for " + b.party_size : "")}
                location={b.location}
                onClick={() => setView(VIEW.EXPLORE)}
              />
            ))}
          </V2Shelf>
        ) : (
          <div
            onClick={() => setView(VIEW.EXPLORE)}
            style={{
              padding: "20px 18px",
              background: V2.card,
              border: "1px dashed " + V2.dividerStrong,
              borderRadius: 14,
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14,
            }}
          >
            <div>
              <div style={{ fontSize: 13, color: V2.text, marginBottom: 4 }}>
                No upcoming bookings yet
              </div>
              <div style={{ fontSize: 12, color: V2.textMuted, lineHeight: 1.4 }}>
                Explore 1-Group's 23 venues and secure your next reservation.
              </div>
            </div>
            <div style={{ color: V2.gold, fontSize: 12, fontWeight: 600 }}>Explore →</div>
          </div>
        )}
      </div>

      {/* Events shelf */}
      <div style={{ marginBottom: 24 }}>
        <V2ShelfHeader
          title="Events"
          count={visibleEvents.length > 0 ? visibleEvents.length : null}
          onSeeAll={visibleEvents.length > 0 ? () => setView(VIEW.EVENTS) : null}
        />
        {visibleEvents.length > 0 ? (
          <V2Shelf>
            {visibleEvents.map((e, i) => (
              <V2EventCard
                key={e.id}
                index={i}
                heroImage={e.hero_image_url}
                title={e.title}
                venueName={e.venue_name}
                dateTime={v2FormatDateTime(e.starts_at)}
                status={e.status}
                tierExclusive={e.tier_exclusive}
                onClick={() => {
                  if (e.booking_url) { window.open(e.booking_url, "_blank"); }
                  else { setView(VIEW.EXPLORE); }
                }}
              />
            ))}
          </V2Shelf>
        ) : (
          <div
            style={{
              padding: "20px 18px",
              background: V2.card,
              border: "1px dashed " + V2.dividerStrong,
              borderRadius: 14,
              fontSize: 12, color: V2.textMuted, lineHeight: 1.5,
            }}
          >
            No activations match your tier right now — check back soon for members-only sessions, tastings, and chef's table nights.
          </div>
        )}
      </div>

      {/* U06 GIFT CARDS SHELF GOES HERE — deliberately deferred.
          Phase 2 U06 renders the Gift Cards surface at VIEW.GIFTCARDS; once a
          V2 Gift Cards shelf lands, drop it in this slot. */}

      {/* Twin stat cards */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <V2StatCard
          label="Vouchers"
          value={vouchersRemaining + "/" + (tierInfo.vCount || 0)}
          sub={tierInfo.nonStop ? "Non-Stop Hits active" : "Welcome voucher"}
          actionLabel={individualVouchers > 0 ? "View wallet (" + individualVouchers + ")" : "View wallet"}
          onAction={() => setView(VIEW.WALLET)}
        />
        <V2StatCard
          label="Café Stamps"
          value={stamps + "/10"}
          sub={stamps >= 10 ? "Card complete" : stamps + " of 10 collected"}
          actionLabel="See stamps"
          onAction={() => setView(VIEW.STAMPS)}
          accent={stamps >= 10 ? V2.gold : undefined}
        />
      </div>

      {/* Rewards / Tiers toggle */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
        <V2PillToggle
          options={[
            { key: "rewards", label: "Rewards" },
            { key: "tiers", label: "Tiers" },
          ]}
          activeKey={toggle}
          onChange={setToggle}
        />
      </div>

      {/* Search (rewards only) */}
      {toggle === "rewards" && (
        <div style={{ marginBottom: 16 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search rewards…"
            style={{
              width: "100%",
              background: V2.card,
              border: "1px solid " + V2.divider,
              borderRadius: 10,
              padding: "12px 16px",
              color: V2.text,
              fontFamily: FONT.b,
              fontSize: 14,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
      )}

      {/* Content: Rewards grid OR Tiers summary */}
      {toggle === "rewards" ? (
        filteredRewards.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: V2.textMuted, fontSize: 13 }}>
            {search ? "No rewards match " + JSON.stringify(search) : "No rewards available right now."}
          </div>
        ) : (
          <div>
            {filteredRewards.slice(0, 6).map(r => (
              <div
                key={r.id}
                onClick={() => setView(VIEW.REWARDS)}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: 14,
                  background: V2.card,
                  border: "1px solid " + V2.divider,
                  borderRadius: 12,
                  marginBottom: 10,
                  cursor: "pointer",
                }}
              >
                <div style={{
                  width: 48, height: 48, borderRadius: 10,
                  background: V2.elevated,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22, color: V2.gold,
                }}>✦</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: FONT.h, fontSize: 15, fontWeight: 600, color: V2.text }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: V2.textMuted, marginTop: 2 }}>
                    {r.points_cost ? r.points_cost.toLocaleString() + " pts" : "Free"} · {r.category || "Rewards"}
                  </div>
                </div>
                <div style={{ color: V2.textMuted, fontSize: 16 }}>›</div>
              </div>
            ))}
            {filteredRewards.length > 6 && (
              <div
                onClick={() => setView(VIEW.REWARDS)}
                style={{ textAlign: "center", padding: 12, fontSize: 12, fontWeight: 600, color: V2.gold, cursor: "pointer" }}
              >
                View all {filteredRewards.length} rewards →
              </div>
            )}
          </div>
        )
      ) : (
        <div>
          {tierOrder.filter(t => TIER_INFO[t]).map(t => (
            <V2TierSummaryCard
              key={t}
              tierId={t}
              info={TIER_INFO[t]}
              isActive={t === tierId}
              onSelect={() => setView(VIEW.PROFILE)}
            />
          ))}
        </div>
      )}
    </div>
  );
}


// ─── S5: Venues / Explore Outlets — helpers & data ────────────────────────

// Adapted from the Phase 3 skill's venue-journeys.json, with stops resolved
// to parent names that exist in VENUE_DIRECTORY (the single source of truth).
// Sub-level deep links (e.g. Oumi, Kaarla) are referenced in desc copy only;
// taps land on the parent page.
const V2_JOURNEYS = [
  {
    id: "rooftop",
    name: "Rooftop journey",
    icon: "✦",
    tagline: "Three altitudes, one night",
    desc: "Sunset cocktails at 1-Atico. Skyline dinner at 1-Arden. Late Spanish wines at 1-Alfaro.",
    stops: ["1-Atico", "1-Arden", "1-Alfaro"],
    tierAccess: null,
  },
  {
    id: "capitaspring-51",
    name: "51st floor tasting",
    icon: "☁",
    tagline: "A progressive dinner at Level 51",
    desc: "Japanese omakase at Oumi, Modern Australian at Kaarla, Mediterranean at Sol & Luna — all under the 1-Arden roof at CapitaSpring.",
    stops: ["1-Arden"],
    tierAccess: ["gold", "platinum", "corporate"],
  },
  {
    id: "garden-heritage",
    name: "Garden heritage",
    icon: "◐",
    tagline: "Colonial mansions & botanical calm",
    desc: "Heritage dining at The Alkaff Mansion, then Botanico and Wildseed at The Summer House.",
    stops: ["The Alkaff Mansion", "The Summer House"],
    tierAccess: null,
  },
  {
    id: "river-to-flame",
    name: "River to flame",
    icon: "◈",
    tagline: "Riverfront cocktails, rooftop fire",
    desc: "1918 by the water at The River House, then up to Flnt at 1-Atico for flame-fired dining.",
    stops: ["The River House", "1-Atico"],
    tierAccess: null,
  },
  {
    id: "wildseed-crawl",
    name: "Wildseed stamp run",
    icon: "◇",
    tagline: "Four Wildseed Cafés in a day",
    desc: "Collect a stamp at each — 1-Flowerhill, The Alkaff Mansion, The Summer House, The Garage.",
    stops: ["1-Flowerhill", "The Alkaff Mansion", "The Summer House", "The Garage"],
    tierAccess: null,
  },
];

const V2_LOCATION_CLUSTERS = [
  { name: "CapitaSpring · Raffles Place", venues: ["1-Arden", "1-Atico", "1-Alfaro"] },
  { name: "Fullerton rooftop",             venues: ["1-Altitude Coast"] },
  { name: "Botanic Gardens & mansions",    venues: ["The Summer House", "The Alkaff Mansion", "The Garage"] },
  { name: "Riverside",                     venues: ["The River House", "Monti"] },
  { name: "1-Flowerhill",                  venues: ["1-Flowerhill"] },
  { name: "Malaysia",                      venues: ["1-Altitude Melaka"] },
];

// Lightweight keyword-based category inference on parent sub-brands.
const v2VenueMatchesCategory = (parent, cat) => {
  if (cat === "all") return true;
  const subs = parent.subs || [];
  if (cat === "cafes") return subs.some(s => /caf[eé]/i.test(s.name));
  if (cat === "bars") return subs.some(s => /(\bbar\b|1918|sky dining|lounge)/i.test(s.name));
  if (cat === "restaurants") return subs.some(s => !/caf[eé]|\bbar\b|1918|lounge|sky dining/i.test(s.name));
  return true;
};

const v2LookupParent = (name) => VENUE_DIRECTORY.find(p => p.name === name) || null;

// ─── S5: Venues / Explore Outlets ─────────────────────────────────────────
function ExploreOutletsV2({ member, setView }) {
  const tierId = member.tier || "silver";
  const [mode, setMode] = useState("category"); // 'category' | 'journey' | 'location'
  const [catFilter, setCatFilter] = useState("all");
  const [sheetParent, setSheetParent] = useState(null); // parent object for sub-brand sheet

  const visibleParents = VENUE_DIRECTORY.filter(p => v2VenueMatchesCategory(p, catFilter));

  const totalSubs = VENUE_DIRECTORY.reduce((a, p) => a + (p.subs || []).length, 0);

  return (
    <div
      style={{
        background: V2.bg,
        color: V2.text,
        fontFamily: FONT.b,
        minHeight: "100vh",
        padding: "24px 20px 100px",
        animation: "v2-fade-in 400ms ease-out",
      }}
    >
      <V2Styles />

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: V2.textMuted, marginBottom: 6 }}>
          ✦ Our Venues
        </div>
        <div style={{ fontFamily: FONT.h, fontSize: 28, fontWeight: 600, letterSpacing: "-0.01em", color: V2.text, marginBottom: 8, lineHeight: 1.1 }}>
          {VENUE_DIRECTORY.length} parent venues · {totalSubs} dining concepts
        </div>
        <div style={{ fontSize: 13, color: V2.textSecondary, lineHeight: 1.5 }}>
          Tap any venue to discover its restaurants, bars, and cafés.
        </div>
      </div>

      {/* Three-state toggle */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
        <V2PillToggle
          options={[
            { key: "category", label: "Category" },
            { key: "journey",  label: "Journey"  },
            { key: "location", label: "Location" },
          ]}
          activeKey={mode}
          onChange={setMode}
        />
      </div>

      {/* MODE: CATEGORY */}
      {mode === "category" && (
        <>
          {/* Category chips */}
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 16, scrollbarWidth: "none" }}>
            {[
              { k: "all",         label: "All",         count: VENUE_DIRECTORY.length },
              { k: "restaurants", label: "Restaurants", count: VENUE_DIRECTORY.filter(p => v2VenueMatchesCategory(p, "restaurants")).length },
              { k: "bars",        label: "Bars",        count: VENUE_DIRECTORY.filter(p => v2VenueMatchesCategory(p, "bars")).length },
              { k: "cafes",       label: "Cafés",       count: VENUE_DIRECTORY.filter(p => v2VenueMatchesCategory(p, "cafes")).length },
            ].map(c => (
              <button
                key={c.k}
                onClick={() => setCatFilter(c.k)}
                style={{
                  padding: "7px 14px",
                  borderRadius: 9999,
                  border: "1px solid " + (catFilter === c.k ? V2.goldBorder : V2.divider),
                  background: catFilter === c.k ? "rgba(245, 215, 166, 0.1)" : "transparent",
                  color: catFilter === c.k ? V2.gold : V2.textSecondary,
                  fontFamily: FONT.b,
                  fontSize: 12, fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {c.label} <span style={{ opacity: 0.5, marginLeft: 4 }}>{c.count}</span>
              </button>
            ))}
          </div>

          {/* Venue rows */}
          <div>
            {visibleParents.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: V2.textMuted, fontSize: 13 }}>
                No venues match this category.
              </div>
            ) : (
              visibleParents.map((parent, i) => (
                <V2VenueRow
                  key={parent.name}
                  index={i}
                  parent={parent}
                  onClick={() => setSheetParent(parent)}
                />
              ))
            )}
          </div>
        </>
      )}

      {/* MODE: JOURNEY */}
      {mode === "journey" && (
        <div>
          {V2_JOURNEYS.map((j, i) => {
            const locked = j.tierAccess && !j.tierAccess.includes(tierId);
            return (
              <V2JourneyCard
                key={j.id}
                index={i}
                journey={j}
                locked={locked}
                onTapVenue={(parentName) => {
                  const p = v2LookupParent(parentName);
                  if (p) setSheetParent(p);
                }}
                onTapUpgrade={() => setView(VIEW.PROFILE)}
              />
            );
          })}
        </div>
      )}

      {/* MODE: LOCATION */}
      {mode === "location" && (
        <div>
          {V2_LOCATION_CLUSTERS.map((cluster, ci) => (
            <div key={cluster.name} style={{ marginBottom: 24, animation: "v2-fade-in 400ms ease-out " + (ci * 50) + "ms both" }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: V2.textSecondary, marginBottom: 10, paddingLeft: 4 }}>
                {cluster.name}
              </div>
              {cluster.venues.map((vName, vi) => {
                const parent = v2LookupParent(vName);
                if (!parent) return null;
                return (
                  <V2VenueRow
                    key={vName}
                    index={vi}
                    parent={parent}
                    onClick={() => setSheetParent(parent)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Sub-brand slide-up sheet */}
      {sheetParent && (
        <V2SubBrandSheet parent={sheetParent} onClose={() => setSheetParent(null)} />
      )}
    </div>
  );
}

function V2VenueRow({ parent, onClick, index }) {
  const [pressed, setPressed] = useState(false);
  const subCount = (parent.subs || []).length;
  return (
    <button
      onClick={onClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        display: "flex", alignItems: "center", gap: 14,
        width: "100%",
        padding: 10,
        background: V2.card,
        border: "1px solid " + V2.divider,
        borderRadius: 14,
        cursor: "pointer",
        textAlign: "left",
        marginBottom: 10,
        transform: pressed ? "scale(0.99)" : "scale(1)",
        transition: "transform 120ms ease-out, border-color 200ms",
        animation: "v2-fade-in 400ms ease-out " + (index * 30) + "ms both",
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = V2.goldBorder; }}
    >
      <div style={{ width: 88, height: 66, borderRadius: 10, overflow: "hidden", flexShrink: 0, background: V2.elevated }}>
        {parent.thumbnail && (
          <img src={parent.thumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", filter: "saturate(0.9)" }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: FONT.h, fontSize: 17, fontWeight: 600, color: V2.text, marginBottom: 3, lineHeight: 1.2 }}>
          {parent.name}
        </div>
        <div style={{ fontSize: 11, color: V2.textMuted }}>
          {subCount > 0 ? "Discover " + subCount + " concept" + (subCount === 1 ? "" : "s") : "Visit venue"}
        </div>
      </div>
      <div style={{ color: V2.textMuted, fontSize: 18, paddingRight: 6 }}>›</div>
    </button>
  );
}

function V2JourneyCard({ journey, locked, onTapVenue, onTapUpgrade, index }) {
  return (
    <div
      style={{
        position: "relative",
        padding: 20,
        background: V2.card,
        border: "1px solid " + (locked ? V2.divider : V2.goldBorder),
        borderRadius: 16,
        marginBottom: 14,
        opacity: locked ? 0.85 : 1,
        overflow: "hidden",
        animation: "v2-fade-in 400ms ease-out " + (index * 40) + "ms both",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10, gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: V2.gold, marginBottom: 6 }}>
            {journey.icon} {journey.tagline}
          </div>
          <div style={{ fontFamily: FONT.h, fontSize: 20, fontWeight: 600, color: V2.text, lineHeight: 1.2, letterSpacing: "-0.01em", marginBottom: 6 }}>
            {journey.name}
          </div>
          <div style={{ fontSize: 12, color: V2.textSecondary, lineHeight: 1.5 }}>
            {journey.desc}
          </div>
        </div>
        {locked && (
          <div
            style={{
              flexShrink: 0,
              fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase",
              color: V2.gold,
              padding: "4px 10px",
              borderRadius: 9999,
              border: "1px solid " + V2.goldBorder,
            }}
          >
            ✦ Gold+
          </div>
        )}
      </div>

      {/* Stop chips with gold arrow connectors */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 14 }}>
        {journey.stops.map((stopName, si) => (
          <Fragment key={stopName + si}>
            <button
              onClick={() => !locked && onTapVenue(stopName)}
              disabled={locked}
              style={{
                padding: "6px 12px",
                borderRadius: 9999,
                background: V2.elevated,
                border: "1px solid " + V2.divider,
                color: V2.text,
                fontSize: 12, fontWeight: 600,
                cursor: locked ? "not-allowed" : "pointer",
                fontFamily: FONT.b,
              }}
            >
              {stopName}
            </button>
            {si < journey.stops.length - 1 && (
              <span style={{ color: V2.gold, fontSize: 14, fontWeight: 600 }}>→</span>
            )}
          </Fragment>
        ))}
      </div>

      {locked && (
        <div
          onClick={onTapUpgrade}
          style={{
            marginTop: 14,
            padding: "8px 14px",
            borderRadius: 9999,
            background: "rgba(245, 215, 166, 0.1)",
            border: "1px solid " + V2.goldBorder,
            color: V2.gold,
            fontSize: 11, fontWeight: 600, letterSpacing: "0.02em",
            textAlign: "center",
            cursor: "pointer",
          }}
        >
          Upgrade to Gold to unlock this journey →
        </div>
      )}
    </div>
  );
}

function V2SubBrandSheet({ parent, onClose }) {
  const subs = parent.subs || [];
  return (
    <>
      {/* Scrim */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(15, 17, 26, 0.6)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          zIndex: 200,
          animation: "v2-fade-in 220ms ease-out",
        }}
      />
      {/* Sheet */}
      <div
        style={{
          position: "fixed", bottom: 0, left: "50%",
          transform: "translateX(-50%)",
          width: "100%", maxWidth: 480,
          background: V2.card,
          borderTop: "1px solid " + V2.goldBorder,
          borderRadius: "24px 24px 0 0",
          boxShadow: "0 -20px 48px rgba(0, 0, 0, 0.5)",
          zIndex: 201,
          animation: "v2-slide-up 420ms cubic-bezier(0.2, 0.8, 0.2, 1)",
          paddingBottom: "env(safe-area-inset-bottom)",
          maxHeight: "85vh",
          overflowY: "auto",
        }}
      >
        {/* Hero */}
        <div style={{ position: "relative", width: "100%", height: 160, overflow: "hidden", borderRadius: "24px 24px 0 0" }}>
          {parent.thumbnail && (
            <img
              src={parent.thumbnail}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover", filter: "saturate(0.9)" }}
            />
          )}
          <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(15,17,26,0.2) 0%, rgba(15,17,26,0.85) 100%)" }} />
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              position: "absolute", top: 12, right: 12,
              width: 36, height: 36, borderRadius: "50%",
              background: "rgba(15, 17, 26, 0.7)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              border: "1px solid " + V2.divider,
              color: V2.text, fontSize: 18, cursor: "pointer", fontFamily: FONT.b,
            }}
          >×</button>
          <div style={{ position: "absolute", bottom: 14, left: 18, right: 18, color: V2.text }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: V2.gold, marginBottom: 4 }}>
              ✦ Parent venue
            </div>
            <div style={{ fontFamily: FONT.h, fontSize: 24, fontWeight: 600, letterSpacing: "-0.01em" }}>
              {parent.name}
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 20px 28px" }}>
          <a
            href={parent.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "block",
              padding: "14px 16px",
              background: V2.gold,
              color: V2.textOnGold,
              border: "none",
              borderRadius: 10,
              fontSize: 14, fontWeight: 600, letterSpacing: "0.02em",
              textAlign: "center",
              textDecoration: "none",
              fontFamily: FONT.b,
              marginBottom: 20,
            }}
          >
            Visit {parent.name} website ↗
          </a>

          {subs.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: V2.textSecondary, marginBottom: 10 }}>
                Concepts at this venue
              </div>
              {subs.map((sub, i) => (
                <a
                  key={sub.name + i}
                  href={sub.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "14px 16px",
                    background: V2.elevated,
                    border: "1px solid " + V2.divider,
                    borderRadius: 12,
                    marginBottom: 8,
                    textDecoration: "none",
                    color: V2.text,
                  }}
                >
                  <div>
                    <div style={{ fontFamily: FONT.h, fontSize: 15, fontWeight: 600, color: V2.text }}>{sub.name}</div>
                    <div style={{ fontSize: 10, fontFamily: FONT.m, color: V2.textMuted, marginTop: 2, letterSpacing: "0.02em" }}>
                      {sub.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                    </div>
                  </div>
                  <div style={{ color: V2.gold, fontSize: 14 }}>↗</div>
                </a>
              ))}
            </>
          )}
        </div>
      </div>
    </>
  );
}


// ─── S6: Payment / Receipt + Receipts History ─────────────────────────────

function v2FormatMoney(amount) {
  const n = parseFloat(amount || 0);
  return "$" + n.toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function v2FormatReceiptMeta(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short" });
    const time = d.toLocaleTimeString("en-SG", { hour: "numeric", minute: "2-digit" });
    return date + ", " + time;
  } catch (e) { return iso; }
}

// Group receipts by year-month, newest first, with total per month.
function v2GroupReceiptsByMonth(receipts) {
  const groups = {};
  for (const r of (receipts || [])) {
    if (!r.charged_at) continue;
    const d = new Date(r.charged_at);
    const key = d.getFullYear() + "-" + String(d.getMonth()).padStart(2, "0");
    if (!groups[key]) {
      groups[key] = {
        key,
        label: d.toLocaleDateString("en-SG", { month: "long", year: "numeric" }),
        items: [],
        total: 0,
      };
    }
    groups[key].items.push(r);
    groups[key].total += parseFloat(r.total_paid || 0);
  }
  return Object.values(groups).sort((a, b) => b.key.localeCompare(a.key));
}

function V2AccordionSection({ title, totalLabel, children, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen !== false);
  return (
    <div style={{ borderBottom: "1px solid " + V2.divider, marginBottom: 4 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          width: "100%", padding: "18px 2px",
          background: "transparent", border: "none", cursor: "pointer",
          color: V2.text, textAlign: "left", fontFamily: FONT.b,
        }}
      >
        <span style={{ fontFamily: FONT.h, fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em" }}>
          {title}
        </span>
        <span style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {totalLabel && (
            <span style={{ fontSize: 13, color: V2.textSecondary }}>
              {totalLabel}
            </span>
          )}
          <span
            style={{
              color: V2.textMuted, fontSize: 14,
              display: "inline-block",
              transform: open ? "rotate(180deg)" : "rotate(0)",
              transition: "transform 200ms ease-out",
            }}
          >⌄</span>
        </span>
      </button>
      {open && (
        <div style={{ paddingBottom: 12, animation: "v2-fade-in 300ms ease-out" }}>
          {children}
        </div>
      )}
    </div>
  );
}

function V2ReceiptHistoryRow({ receipt, onOpen, index }) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onClick={() => onOpen(receipt)}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        width: "100%", padding: "14px 12px",
        background: V2.card,
        border: "1px solid " + V2.divider,
        borderRadius: 10,
        cursor: "pointer",
        textAlign: "left",
        marginBottom: 8,
        fontFamily: FONT.b,
        color: V2.text,
        transform: pressed ? "scale(0.99)" : "scale(1)",
        transition: "transform 120ms ease-out",
        animation: "v2-fade-in 400ms ease-out " + (index * 30) + "ms both",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: V2.text, marginBottom: 3 }}>
          {receipt.venue_name}
        </div>
        <div style={{ fontSize: 11, color: V2.textMuted }}>
          {v2FormatReceiptMeta(receipt.charged_at)}
          {receipt.points_earned > 0 && <span style={{ color: V2.gold, marginLeft: 8 }}>+{receipt.points_earned} pts</span>}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontFamily: FONT.h, fontSize: 16, fontWeight: 600, color: V2.text }}>
          {v2FormatMoney(receipt.total_paid)}
        </div>
        <div style={{ fontSize: 10, color: V2.textMuted, marginTop: 2 }}>View ›</div>
      </div>
    </button>
  );
}

// Full-screen itemised receipt view (slides up over the history).
function V2ReceiptDetail({ receipt, onClose }) {
  const items = (receipt.receipt_items || []).slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const subtotal = receipt.subtotal || items.reduce((a, i) => a + parseFloat(i.line_total || 0), 0);
  const discount = parseFloat(receipt.discount_amount || 0);
  const tip = parseFloat(receipt.tip_amount || 0);
  const total = parseFloat(receipt.total_paid || 0);

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: V2.bg,
        color: V2.text,
        fontFamily: FONT.b,
        zIndex: 300,
        animation: "v2-slide-up 420ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        overflowY: "auto",
      }}
    >
      <V2Styles />

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 20px 12px", position: "sticky", top: 0, background: V2.bg, zIndex: 2 }}>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            width: 36, height: 36, borderRadius: "50%",
            background: V2.card,
            border: "1px solid " + V2.divider,
            color: V2.text, fontSize: 18, cursor: "pointer", fontFamily: FONT.b,
          }}
        >×</button>
        <div style={{ fontFamily: FONT.h, fontSize: 16, fontWeight: 600, color: V2.text }}>
          Your receipt
        </div>
        <div style={{ width: 36 }} />
      </div>

      {/* Body */}
      <div style={{ padding: "12px 24px 40px", maxWidth: 480, margin: "0 auto" }}>
        {/* Meta block */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: V2.gold, marginBottom: 6 }}>
            ✦ 1-Insider Pay
          </div>
          <div style={{ fontFamily: FONT.h, fontSize: 22, fontWeight: 600, color: V2.text, letterSpacing: "-0.01em", marginBottom: 4 }}>
            {receipt.venue_name}
          </div>
          <div style={{ fontSize: 12, color: V2.textSecondary }}>
            {v2FormatReceiptMeta(receipt.charged_at)}
          </div>
        </div>

        {/* Line items */}
        <div style={{ marginBottom: 20 }}>
          {items.length === 0 ? (
            <div style={{ padding: 16, textAlign: "center", color: V2.textMuted, fontSize: 12 }}>
              No itemised breakdown available for this receipt.
            </div>
          ) : items.map((item, i) => (
            <div
              key={i}
              style={{
                display: "flex", alignItems: "baseline", gap: 12,
                padding: "11px 0",
                borderBottom: "1px solid " + V2.divider,
                animation: "v2-fade-in 400ms ease-out " + (i * 40) + "ms both",
              }}
            >
              <div style={{ width: 28, fontFamily: FONT.m, fontSize: 12, color: V2.textMuted }}>
                {item.qty}×
              </div>
              <div style={{ flex: 1, fontSize: 14, color: V2.text }}>
                {item.name}
                {item.is_promotional && (
                  <div style={{ fontSize: 10, color: V2.textMuted, marginTop: 2, letterSpacing: "0.05em" }}>
                    — Promotional item, no points (Eber L04)
                  </div>
                )}
              </div>
              <div style={{ fontFamily: FONT.h, fontSize: 15, fontWeight: 600, color: V2.text, fontVariantNumeric: "tabular-nums" }}>
                {v2FormatMoney(item.line_total)}
              </div>
            </div>
          ))}
        </div>

        {/* Gold hairline */}
        <div style={{ height: 1, background: "linear-gradient(90deg, transparent 0%, " + V2.gold + " 50%, transparent 100%)", margin: "8px 0 20px" }} />

        {/* Subtotal / discount / tip caption */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, color: V2.textSecondary }}>
            <span>Subtotal</span>
            <span style={{ fontFamily: FONT.h, color: V2.text, fontVariantNumeric: "tabular-nums" }}>
              {v2FormatMoney(subtotal)}
            </span>
          </div>
          {discount > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, color: "#A5D6A7" }}>
              <span>
                Discount
                {receipt.discount_label && <div style={{ fontSize: 10, color: V2.textMuted, marginTop: 2 }}>{receipt.discount_label}</div>}
              </span>
              <span style={{ fontFamily: FONT.h, fontVariantNumeric: "tabular-nums" }}>
                −{v2FormatMoney(discount)}
              </span>
            </div>
          )}
          {tip > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, color: V2.textSecondary }}>
              <span>Tip</span>
              <span style={{ fontFamily: FONT.h, color: V2.text, fontVariantNumeric: "tabular-nums" }}>
                {v2FormatMoney(tip)}
              </span>
            </div>
          )}
          {tip > 0 && (
            <div style={{ fontSize: 10, color: V2.textMuted, marginTop: 8, fontStyle: "italic" }}>
              All tips are distributed to our teams.
            </div>
          )}
        </div>

        {/* Total paid */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "18px 0 20px", borderTop: "1px solid " + V2.dividerStrong }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: V2.textSecondary, marginBottom: 4 }}>
              Total amount paid
            </div>
            {receipt.points_earned > 0 && (
              <div style={{ fontSize: 12, color: V2.gold, fontWeight: 600 }}>
                +{receipt.points_earned.toLocaleString()} points earned
              </div>
            )}
            {receipt.points_redeemed > 0 && (
              <div style={{ fontSize: 12, color: V2.textSecondary }}>
                −{receipt.points_redeemed.toLocaleString()} points redeemed
              </div>
            )}
          </div>
          <div style={{ fontFamily: FONT.h, fontSize: 34, fontWeight: 700, letterSpacing: "-0.01em", color: V2.text, fontVariantNumeric: "tabular-nums" }}>
            {v2FormatMoney(total)}
          </div>
        </div>

        {/* Tab ID + payment method */}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 14px", background: V2.card, borderRadius: 10, border: "1px solid " + V2.divider, marginBottom: 16, fontSize: 12 }}>
          <div>
            <div style={{ color: V2.textMuted, marginBottom: 2, fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase" }}>
              Tab ID
            </div>
            <div style={{ fontFamily: FONT.m, color: V2.gold, fontSize: 13, letterSpacing: "0.05em" }}>
              {receipt.tab_id || "—"}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: V2.textMuted, marginBottom: 2, fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase" }}>
              Paid via
            </div>
            <div style={{ color: V2.text, fontSize: 13 }}>
              {receipt.payment_method || "—"}
            </div>
          </div>
        </div>

        {/* FAQ link */}
        <div style={{ textAlign: "center" }}>
          <span style={{ fontSize: 11, color: V2.gold, cursor: "pointer", fontWeight: 600, letterSpacing: "0.02em" }}>
            1-Insider Pay FAQs →
          </span>
        </div>
      </div>
    </div>
  );
}

// Receipts history — month-grouped accordion. Drops into VIEW.HISTORY.
// When a row is tapped, V2ReceiptDetail slides up as a full-screen overlay.
function ReceiptsHistoryV2({ member, receipts, setView }) {
  const [detail, setDetail] = useState(null);
  const groups = v2GroupReceiptsByMonth(receipts);
  const lifetime = (receipts || []).reduce((a, r) => a + parseFloat(r.total_paid || 0), 0);
  const lifetimeVisits = (receipts || []).length;

  return (
    <div
      style={{
        background: V2.bg,
        color: V2.text,
        fontFamily: FONT.b,
        minHeight: "100vh",
        padding: "24px 20px 100px",
        animation: "v2-fade-in 400ms ease-out",
      }}
    >
      <V2Styles />

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: V2.textMuted, marginBottom: 6 }}>
          ✦ Receipts
        </div>
        <div style={{ fontFamily: FONT.h, fontSize: 28, fontWeight: 600, letterSpacing: "-0.01em", color: V2.text, marginBottom: 6, lineHeight: 1.1 }}>
          Your receipts
        </div>
        <div style={{ fontSize: 13, color: V2.textSecondary, lineHeight: 1.5 }}>
          Every bill you've paid with the app — with itemised breakdown and the points earned on each.
        </div>
      </div>

      {/* Lifetime stat strip */}
      {lifetimeVisits > 0 && (
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <div style={{ flex: 1, padding: "12px 14px", background: V2.card, border: "1px solid " + V2.divider, borderRadius: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: V2.textSecondary, marginBottom: 4 }}>
              Lifetime spend
            </div>
            <div style={{ fontFamily: FONT.h, fontSize: 20, fontWeight: 700, color: V2.text, fontVariantNumeric: "tabular-nums" }}>
              {v2FormatMoney(lifetime)}
            </div>
          </div>
          <div style={{ flex: 1, padding: "12px 14px", background: V2.card, border: "1px solid " + V2.divider, borderRadius: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: V2.textSecondary, marginBottom: 4 }}>
              Visits tracked
            </div>
            <div style={{ fontFamily: FONT.h, fontSize: 20, fontWeight: 700, color: V2.text }}>
              {lifetimeVisits}
            </div>
          </div>
        </div>
      )}

      {/* Month accordion */}
      {groups.length === 0 ? (
        <div
          style={{
            padding: "24px 18px",
            background: V2.card,
            border: "1px dashed " + V2.dividerStrong,
            borderRadius: 14,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 13, color: V2.text, marginBottom: 6 }}>
            No receipts yet
          </div>
          <div style={{ fontSize: 12, color: V2.textMuted, lineHeight: 1.5, marginBottom: 16 }}>
            Pay with the app at any 1-Group venue to see your itemised receipts here.
          </div>
          <div
            onClick={() => setView(VIEW.HOME)}
            style={{
              display: "inline-block",
              padding: "8px 16px", borderRadius: 9999,
              border: "1px solid " + V2.goldBorder,
              color: V2.gold, fontSize: 12, fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Back to Home →
          </div>
        </div>
      ) : (
        groups.map((grp, gi) => (
          <V2AccordionSection
            key={grp.key}
            title={grp.label}
            totalLabel={v2FormatMoney(grp.total)}
            defaultOpen={gi === 0}
          >
            {grp.items.map((r, i) => (
              <V2ReceiptHistoryRow
                key={r.id}
                index={i}
                receipt={r}
                onOpen={setDetail}
              />
            ))}
          </V2AccordionSection>
        ))
      )}

      {/* Detail overlay */}
      {detail && <V2ReceiptDetail receipt={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}


// ─── S7: QR Scan-to-Pay ───────────────────────────────────────────────────

// Faux QR code — visually convincing pattern with corner position markers,
// timing stripes, and pseudo-random data cells seeded by the payload string.
// Not a real scannable QR (that would need qrcode.js). Swap for a real
// library when POS integration is ready; component interface stays the same.
function V2QRCode({ payload, size }) {
  const s = size || 240;
  const cells = 29;
  const cellSize = s / cells;

  const grid = useMemo(() => {
    const seedBase = (payload || "M0001").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    let rng = seedBase * 31 + 7;
    const next = () => { rng = (rng * 1103515245 + 12345) >>> 0; return (rng & 0x7fffffff) / 0x7fffffff; };

    const g = Array.from({ length: cells }, () => Array(cells).fill(false));

    // Fill data area pseudo-random
    for (let y = 0; y < cells; y++) {
      for (let x = 0; x < cells; x++) {
        g[y][x] = next() > 0.5;
      }
    }

    // Three corner position markers (top-left, top-right, bottom-left)
    const corners = [[0, 0], [cells - 7, 0], [0, cells - 7]];
    for (let ci = 0; ci < corners.length; ci++) {
      const cx = corners[ci][0], cy = corners[ci][1];
      // 9x9 clear separator around, then the 7x7 marker
      for (let dy = -1; dy <= 7; dy++) {
        for (let dx = -1; dx <= 7; dx++) {
          const y = cy + dy, x = cx + dx;
          if (y < 0 || y >= cells || x < 0 || x >= cells) continue;
          g[y][x] = false;
        }
      }
      for (let dy = 0; dy < 7; dy++) {
        for (let dx = 0; dx < 7; dx++) {
          const isRing = dx === 0 || dx === 6 || dy === 0 || dy === 6;
          const isCentre = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
          g[cy + dy][cx + dx] = isRing || isCentre;
        }
      }
    }

    // Timing stripes along row 6 and col 6 between the corner markers
    for (let i = 8; i < cells - 8; i++) {
      g[6][i] = i % 2 === 0;
      g[i][6] = i % 2 === 0;
    }

    // Clear a 7x7 area in the centre for the logo overlay
    const mid = Math.floor(cells / 2);
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        g[mid + dy][mid + dx] = false;
      }
    }

    return g;
  }, [payload]);

  const rects = [];
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      if (grid[y][x]) {
        rects.push(<rect key={x + "_" + y} x={x * cellSize} y={y * cellSize} width={cellSize} height={cellSize} fill="#0F111A" />);
      }
    }
  }

  return (
    <svg
      width={s} height={s}
      viewBox={"0 0 " + s + " " + s}
      style={{ background: "#F2F3F5", borderRadius: 14, display: "block" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x={0} y={0} width={s} height={s} fill="#F2F3F5" />
      {rects}
      {/* Centre logo overlay — dark square with gold ✦ */}
      <rect x={s / 2 - 20} y={s / 2 - 20} width={40} height={40} fill="#0F111A" rx={8} />
      <text x={s / 2} y={s / 2 + 7} textAnchor="middle" fill="#F5D7A6" fontSize={22} fontWeight={700}>✦</text>
    </svg>
  );
}

// S7 — QR Scan-to-Pay overlay.
// Opens as a full-screen fixed overlay from the Scan FAB in V2BottomNav.
// Display-only at the tab/POS level (real POS validation requires Agilysys-
// Eber integration per Phase 2 U10). The Pay-with-points toggle is a preview
// of what will apply when the cashier closes the tab.
function QrScanPayV2({ member, vouchers, venueName, tabAmount, onClose }) {
  const pointsBalance = (member && member.points) || 0;
  const tierId = (member && member.tier) || "silver";
  const tierInfo = TIER_INFO[tierId] || TIER_INFO.silver;

  // Earn-rate multiplier per Phase 1 base-rate table
  const earnMultiplier = { silver: 1, gold: 1.5, platinum: 2, corporate: 1.5, staff: 1 }[tierId] || 1;

  // Demo tab: use a passed-in amount or fall back to a plausible bill
  const total = tabAmount != null ? tabAmount : 128.00;

  // Redemption tiers from Phase 1 base rate (points-rules.json)
  const redeemTiers = [
    { pts: 100, value: 10 },
    { pts: 150, value: 15 },
    { pts: 250, value: 25 },
  ];

  // Preselect the largest redemption the member can afford (or null if <100)
  const defaultPointsOffset = redeemTiers
    .filter(t => t.pts <= pointsBalance)
    .sort((a, b) => b.value - a.value)[0] || null;

  const [payWithPoints, setPayWithPoints] = useState(false);
  const [selectedRedeem, setSelectedRedeem] = useState(defaultPointsOffset);

  const canPayWithPoints = pointsBalance >= 100;

  const pointsOffset = payWithPoints && selectedRedeem ? selectedRedeem.value : 0;
  const amountDue = Math.max(0, total - pointsOffset);
  const pointsEarned = Math.round(amountDue * earnMultiplier);

  // Active cash voucher (first applicable, illustrative only — Phase 1 stacking
  // rules allow exactly 1 cash + 1 points voucher per check).
  const activeCashVoucher = (vouchers || []).find(v => v.status === "active" && v.type !== "points");
  const showStackingOk = activeCashVoucher && payWithPoints;

  // QR payload encodes what a real POS scanner would need.
  const qrPayload = "1INSIDER:" + (member.id || "") + ":" + Date.now().toString(36);

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: V2.bg,
        color: V2.text,
        fontFamily: FONT.b,
        zIndex: 400,
        animation: "v2-slide-up 420ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        overflowY: "auto",
      }}
    >
      <V2Styles />
      <style>{
        "@keyframes v2-glow-pulse { 0%, 100% { box-shadow: 0 0 32px rgba(245, 215, 166, 0.25); } 50% { box-shadow: 0 0 56px rgba(245, 215, 166, 0.5); } }"
      }</style>

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 20px 12px" }}>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            width: 36, height: 36, borderRadius: "50%",
            background: V2.card,
            border: "1px solid " + V2.divider,
            color: V2.text, fontSize: 18, cursor: "pointer", fontFamily: FONT.b,
          }}
        >×</button>
        <div style={{ fontFamily: FONT.h, fontSize: 18, fontWeight: 600, color: V2.text, letterSpacing: "-0.01em" }}>
          {venueName || "FLNT"}
        </div>
        <div style={{ width: 36 }} />
      </div>

      <div style={{ padding: "8px 24px 40px", maxWidth: 480, margin: "0 auto" }}>
        {/* QR block */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
          <div
            style={{
              padding: 18,
              background: "#F2F3F5",
              borderRadius: 20,
              boxShadow: "0 0 32px rgba(245, 215, 166, 0.25)",
              animation: "v2-glow-pulse 2.4s ease-in-out infinite",
              marginBottom: 16,
            }}
          >
            <V2QRCode payload={qrPayload} size={220} />
          </div>
          <div style={{ fontSize: 13, color: V2.textSecondary, textAlign: "center", lineHeight: 1.5 }}>
            Show this code to the counter to open your tab.
          </div>
          <div style={{ fontFamily: FONT.m, fontSize: 10, color: V2.textMuted, marginTop: 6, letterSpacing: "0.05em" }}>
            {qrPayload}
          </div>
        </div>

        {/* Context pills — Party / Tip (display only in this flow) */}
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 24 }}>
          {[
            { label: "Party of 2", icon: "◐" },
            { label: "Tip 10%", icon: "◆" },
          ].map((p, i) => (
            <div
              key={i}
              style={{
                padding: "7px 14px",
                borderRadius: 9999,
                background: V2.card,
                border: "1px solid " + V2.divider,
                fontSize: 11, color: V2.textSecondary,
                fontFamily: FONT.b, fontWeight: 600,
                letterSpacing: "0.02em",
              }}
            >
              <span style={{ marginRight: 6, color: V2.gold }}>{p.icon}</span>{p.label}
            </div>
          ))}
        </div>

        {/* 1-INSIDER PAY summary card */}
        <div
          style={{
            padding: 22,
            background: V2.card,
            border: "1px solid " + V2.goldBorder,
            borderRadius: 16,
            marginBottom: 14,
            boxShadow: "inset 0 1px 0 rgba(245, 215, 166, 0.15), 0 8px 24px rgba(0, 0, 0, 0.25)",
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", color: V2.gold, marginBottom: 16 }}>
            ✦ 1-Insider Pay
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "6px 0", fontSize: 13, color: V2.textSecondary }}>
            <span>Your total</span>
            <span style={{ fontFamily: FONT.h, color: V2.text, fontSize: 16, fontVariantNumeric: "tabular-nums" }}>
              {v2FormatMoney(total)}
            </span>
          </div>

          {pointsOffset > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "6px 0", fontSize: 13, color: "#A5D6A7" }}>
              <span>
                Points voucher
                <div style={{ fontSize: 10, color: V2.textMuted, marginTop: 2 }}>{selectedRedeem.pts} pts = ${selectedRedeem.value}</div>
              </span>
              <span style={{ fontFamily: FONT.h, fontVariantNumeric: "tabular-nums" }}>
                −{v2FormatMoney(pointsOffset)}
              </span>
            </div>
          )}

          <div style={{ height: 1, background: V2.divider, margin: "10px 0" }} />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "6px 0" }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: V2.textSecondary }}>
                Amount due
              </div>
              <div style={{ fontSize: 12, color: V2.gold, marginTop: 4, fontWeight: 600 }}>
                +{pointsEarned.toLocaleString()} points earned
              </div>
            </div>
            <div style={{ fontFamily: FONT.h, fontSize: 28, fontWeight: 700, letterSpacing: "-0.01em", color: V2.text, fontVariantNumeric: "tabular-nums" }}>
              {v2FormatMoney(amountDue)}
            </div>
          </div>
        </div>

        {/* Pay with points toggle */}
        <div
          style={{
            padding: "16px 18px",
            background: V2.card,
            border: "1px solid " + V2.divider,
            borderRadius: 12,
            marginBottom: 10,
            display: "flex", justifyContent: "space-between", alignItems: "center",
            opacity: canPayWithPoints ? 1 : 0.5,
          }}
        >
          <div style={{ flex: 1, paddingRight: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: V2.text, marginBottom: 3 }}>
              Pay with points
            </div>
            <div style={{ fontSize: 11, color: V2.textMuted }}>
              {pointsBalance.toLocaleString()} available
              {payWithPoints && selectedRedeem && " · using " + selectedRedeem.pts + " pts for $" + selectedRedeem.value}
            </div>
          </div>
          <button
            onClick={() => canPayWithPoints && setPayWithPoints(p => !p)}
            disabled={!canPayWithPoints}
            aria-label="Pay with points toggle"
            style={{
              width: 48, height: 28, borderRadius: 9999,
              background: payWithPoints ? V2.gold : V2.elevated,
              border: "none",
              cursor: canPayWithPoints ? "pointer" : "not-allowed",
              position: "relative",
              transition: "background 200ms ease-out",
            }}
          >
            <span
              style={{
                position: "absolute", top: 2, left: payWithPoints ? 22 : 2,
                width: 24, height: 24, borderRadius: "50%",
                background: payWithPoints ? V2.textOnGold : V2.text,
                transition: "left 200ms cubic-bezier(0.2, 0.8, 0.2, 1)",
              }}
            />
          </button>
        </div>

        {/* Points-tier picker — shown when toggle is on */}
        {payWithPoints && canPayWithPoints && (
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {redeemTiers.map(t => {
              const affordable = pointsBalance >= t.pts;
              const selected = selectedRedeem && selectedRedeem.pts === t.pts;
              return (
                <button
                  key={t.pts}
                  onClick={() => affordable && setSelectedRedeem(t)}
                  disabled={!affordable}
                  style={{
                    flex: 1,
                    padding: "10px 8px",
                    background: selected ? "rgba(245, 215, 166, 0.12)" : V2.card,
                    border: "1px solid " + (selected ? V2.goldBorder : V2.divider),
                    borderRadius: 10,
                    color: affordable ? V2.text : V2.textMuted,
                    cursor: affordable ? "pointer" : "not-allowed",
                    fontFamily: FONT.b,
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 600, color: selected ? V2.gold : V2.textSecondary, letterSpacing: "0.05em" }}>
                    {t.pts} pts
                  </div>
                  <div style={{ fontSize: 13, fontFamily: FONT.h, fontWeight: 600, color: affordable ? V2.text : V2.textMuted, marginTop: 2 }}>
                    ${t.value}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Low-balance warning */}
        {!canPayWithPoints && (
          <div
            style={{
              background: "rgba(255, 152, 0, 0.12)",
              border: "1px solid rgba(255, 152, 0, 0.4)",
              color: "#FFD180",
              borderRadius: 10,
              padding: "12px 16px",
              fontSize: 11,
              lineHeight: 1.5,
              marginBottom: 10,
              display: "flex", gap: 8, alignItems: "flex-start",
            }}
          >
            <span aria-hidden>⚠️</span>
            <span>
              You need at least <strong>100 pts</strong> to redeem a points voucher.
              Earn {(100 - pointsBalance).toLocaleString()} more points to unlock $10 off your next tab.
            </span>
          </div>
        )}

        {/* Stacking confirmation — 1 cash + 1 points is allowed per Phase 1 rules */}
        {showStackingOk && (
          <div
            style={{
              background: "rgba(74, 141, 255, 0.12)",
              border: "1px solid rgba(74, 141, 255, 0.4)",
              color: "#B3CEFF",
              borderRadius: 10,
              padding: "12px 16px",
              fontSize: 11,
              lineHeight: 1.5,
              marginBottom: 10,
              display: "flex", gap: 8, alignItems: "flex-start",
            }}
          >
            <span aria-hidden>✦</span>
            <span>
              Your ${activeCashVoucher.value || tierInfo.vValue} dining voucher and points redemption will both apply —
              1-Insider allows 1 cash voucher + 1 points voucher per check.
            </span>
          </div>
        )}

        {/* Payment method row */}
        <div
          style={{
            padding: "14px 16px",
            background: V2.card,
            border: "1px solid " + V2.divider,
            borderRadius: 12,
            marginBottom: 18,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 40, height: 28,
                borderRadius: 5,
                background: "linear-gradient(135deg, #F5D7A6 0%, #C79A5A 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 9, fontWeight: 700, color: V2.textOnGold, letterSpacing: "0.05em",
              }}
            >
              VISA
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: V2.text }}>Visa ••••&nbsp;4821</div>
              <div style={{ fontSize: 11, color: V2.textMuted }}>Primary card</div>
            </div>
          </div>
          <div
            style={{
              padding: "4px 10px",
              borderRadius: 9999,
              background: "rgba(245, 215, 166, 0.12)",
              color: V2.gold,
              fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
              border: "1px solid " + V2.goldBorder,
            }}
          >
            {earnMultiplier}× points
          </div>
        </div>

        {/* Footer note */}
        <div style={{ textAlign: "center", fontSize: 11, color: V2.textMuted, lineHeight: 1.5 }}>
          The counter will close the tab and apply your selections automatically.
          <br />
          <span style={{ color: V2.gold, cursor: "pointer", fontWeight: 600 }}>1-Insider Pay FAQs →</span>
        </div>
      </div>
    </div>
  );
}


// ─── S8: Activations / Events Feed ────────────────────────────────────────

function V2HeroEventCard({ event, onRsvp }) {
  const [pressed, setPressed] = useState(false);
  const isExclusive = Array.isArray(event.tier_exclusive) && event.tier_exclusive.length > 0;
  const statusText =
    event.status === "open" ? "Booking open" :
    event.status === "waitlist" ? "Waitlist" :
    event.status === "soldout" ? "Sold out" :
    event.status;
  const statusColor = event.status === "open" ? V2.gold : event.status === "waitlist" ? V2.info : V2.textMuted;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16/21",
        minHeight: 360,
        borderRadius: 20,
        overflow: "hidden",
        background: V2.elevated,
        marginBottom: 24,
        boxShadow: "0 12px 40px rgba(0, 0, 0, 0.35)",
      }}
    >
      {event.hero_image_url && (
        <img
          src={event.hero_image_url}
          alt=""
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "saturate(0.9)" }}
        />
      )}
      <div
        aria-hidden
        style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(180deg, rgba(15,17,26,0.2) 0%, rgba(15,17,26,0.35) 50%, rgba(15,17,26,0.95) 100%)",
        }}
      />

      {/* Top row: featured tag + members-only badge */}
      <div style={{ position: "absolute", top: 16, left: 16, right: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div
          style={{
            fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase",
            color: V2.gold,
            padding: "5px 11px",
            borderRadius: 9999,
            background: "rgba(15, 17, 26, 0.7)",
            border: "1px solid " + V2.goldBorder,
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
        >
          ✦ Featured
        </div>
        {isExclusive && (
          <div
            style={{
              fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase",
              color: V2.gold,
              padding: "5px 11px",
              borderRadius: 9999,
              background: "rgba(15, 17, 26, 0.7)",
              border: "1px solid " + V2.goldBorder,
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
          >
            ✦ Members only
          </div>
        )}
      </div>

      {/* Bottom content */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 24, color: V2.text }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: statusColor }} />
          <span style={{ color: statusColor }}>{statusText}</span>
        </div>
        <div style={{ fontFamily: FONT.h, fontSize: 26, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.15, marginBottom: 8 }}>
          {event.title}
        </div>
        <div style={{ fontSize: 13, color: V2.textSecondary, marginBottom: 14, lineHeight: 1.5 }}>
          {event.venue_name} · {v2FormatDateTime(event.starts_at)}
        </div>
        {event.description && (
          <div
            style={{
              fontSize: 12, color: V2.textSecondary, marginBottom: 16, lineHeight: 1.55,
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
            }}
          >
            {event.description}
          </div>
        )}

        <button
          onClick={() => onRsvp(event)}
          onMouseDown={() => setPressed(true)}
          onMouseUp={() => setPressed(false)}
          onMouseLeave={() => setPressed(false)}
          style={{
            display: "inline-block",
            padding: "12px 22px",
            background: V2.gold,
            color: V2.textOnGold,
            border: "none",
            borderRadius: 9999,
            fontSize: 13, fontWeight: 700, letterSpacing: "0.05em",
            cursor: "pointer",
            fontFamily: FONT.b,
            transform: pressed ? "scale(0.98)" : "scale(1)",
            transition: "transform 120ms ease-out",
            boxShadow: "0 4px 14px rgba(245, 215, 166, 0.25)",
          }}
        >
          {event.status === "waitlist" ? "Join the waitlist →" : "Reserve your seat →"}
        </button>
      </div>
    </div>
  );
}

function V2EventRow({ event, onRsvp, index }) {
  const [pressed, setPressed] = useState(false);
  const isExclusive = Array.isArray(event.tier_exclusive) && event.tier_exclusive.length > 0;
  const statusText =
    event.status === "open" ? "Open" :
    event.status === "waitlist" ? "Waitlist" :
    event.status === "soldout" ? "Sold out" :
    event.status;
  const statusColor = event.status === "open" ? V2.gold : event.status === "waitlist" ? V2.info : V2.textMuted;

  return (
    <button
      onClick={() => onRsvp(event)}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        display: "flex", alignItems: "center", gap: 14,
        width: "100%", padding: 10,
        background: V2.card,
        border: "1px solid " + V2.divider,
        borderRadius: 14,
        cursor: "pointer",
        textAlign: "left",
        marginBottom: 10,
        transform: pressed ? "scale(0.99)" : "scale(1)",
        transition: "transform 120ms ease-out",
        animation: "v2-fade-in 400ms ease-out " + (index * 40) + "ms both",
      }}
    >
      <div style={{ position: "relative", width: 96, height: 96, borderRadius: 10, overflow: "hidden", flexShrink: 0, background: V2.elevated }}>
        {event.hero_image_url && (
          <img src={event.hero_image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", filter: "saturate(0.9)" }} />
        )}
        <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.4) 100%)" }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor }} />
          <span style={{ color: statusColor }}>{statusText}</span>
          {isExclusive && <span style={{ color: V2.gold, marginLeft: 4 }}>· ✦ Members only</span>}
        </div>
        <div style={{ fontFamily: FONT.h, fontSize: 15, fontWeight: 600, color: V2.text, marginBottom: 3, lineHeight: 1.2 }}>
          {event.title}
        </div>
        <div style={{ fontSize: 11, color: V2.textMuted, lineHeight: 1.4 }}>
          {event.venue_name} · {v2FormatDateTime(event.starts_at)}
        </div>
      </div>
      <div style={{ color: V2.textMuted, fontSize: 18, paddingRight: 6 }}>›</div>
    </button>
  );
}

function V2ComingSoonPanel({ title, description, eta }) {
  return (
    <div
      style={{
        padding: "40px 24px",
        background: V2.card,
        border: "1px dashed " + V2.dividerStrong,
        borderRadius: 16,
        textAlign: "center",
        marginTop: 12,
      }}
    >
      <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.6 }}>◐</div>
      <div style={{ fontFamily: FONT.h, fontSize: 20, fontWeight: 600, color: V2.text, marginBottom: 8, letterSpacing: "-0.01em" }}>
        {title}
      </div>
      <div style={{ fontSize: 12, color: V2.textSecondary, lineHeight: 1.6, maxWidth: 320, margin: "0 auto 12px" }}>
        {description}
      </div>
      {eta && (
        <div
          style={{
            display: "inline-block",
            padding: "5px 12px",
            borderRadius: 9999,
            border: "1px solid " + V2.goldBorder,
            color: V2.gold,
            fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase",
          }}
        >
          {eta}
        </div>
      )}
    </div>
  );
}

function ActivationsV2({ member, events, setView }) {
  const [tab, setTab] = useState("events");
  const [rsvp, setRsvp] = useState(null);
  const tierId = (member && member.tier) || "silver";

  const visibleEvents = (events || [])
    .filter(e => v2EventVisibleToTier(e, tierId))
    .filter(e => e.status === "open" || e.status === "waitlist" || e.status === "soldout");

  const featured = visibleEvents[0];
  const rest = visibleEvents.slice(1);

  const handleRsvp = (event) => {
    if (event.booking_url) {
      window.open(event.booking_url, "_blank", "noopener,noreferrer");
      return;
    }
    setRsvp(event);
  };

  return (
    <div
      style={{
        background: V2.bg,
        color: V2.text,
        fontFamily: FONT.b,
        minHeight: "100vh",
        padding: "24px 20px 100px",
        animation: "v2-fade-in 400ms ease-out",
      }}
    >
      <V2Styles />

      {/* Header with back */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <button
          onClick={() => setView(VIEW.HOME)}
          aria-label="Back"
          style={{
            width: 36, height: 36, borderRadius: "50%",
            background: V2.card, border: "1px solid " + V2.divider,
            color: V2.text, fontSize: 18, cursor: "pointer", fontFamily: FONT.b,
          }}
        >‹</button>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: V2.textMuted, marginBottom: 6 }}>
          ✦ Activations
        </div>
        <div style={{ fontFamily: FONT.h, fontSize: 28, fontWeight: 600, letterSpacing: "-0.01em", color: V2.text, marginBottom: 6, lineHeight: 1.1 }}>
          What's on at 1-Group
        </div>
        <div style={{ fontSize: 13, color: V2.textSecondary, lineHeight: 1.5 }}>
          Tastings, chef's tables, screenings, and private room takeovers — across all 11 venues.
        </div>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 4 }}>
        {[
          { key: "events",      label: "Events" },
          { key: "tables",      label: "Tables" },
          { key: "private",     label: "Private rooms" },
          { key: "screenings",  label: "Screenings" },
        ].map(t => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                flexShrink: 0,
                padding: "8px 15px",
                borderRadius: 9999,
                border: "1px solid " + (active ? V2.goldBorder : V2.divider),
                background: active ? "rgba(245, 215, 166, 0.12)" : "transparent",
                color: active ? V2.gold : V2.textSecondary,
                fontFamily: FONT.b, fontSize: 12, fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "border-color 200ms, background 200ms, color 200ms",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* EVENTS tab */}
      {tab === "events" && (
        <>
          {featured && <V2HeroEventCard event={featured} onRsvp={handleRsvp} />}

          {rest.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: FONT.h, fontSize: 18, fontWeight: 600, color: V2.text, marginBottom: 12, padding: "0 4px", letterSpacing: "-0.01em" }}>
                This week
              </div>
              {rest.map((e, i) => (
                <V2EventRow key={e.id} index={i} event={e} onRsvp={handleRsvp} />
              ))}
            </div>
          )}

          {!featured && (
            <V2ComingSoonPanel
              title="No activations right now"
              description="We're curating something special — check back soon for members-only sessions, tastings, and chef's table nights."
            />
          )}
        </>
      )}

      {/* TABLES tab */}
      {tab === "tables" && (
        <V2ComingSoonPanel
          title="Table reservations"
          description="Book any 1-Group restaurant without leaving the app. SevenRooms integration will unlock live availability, party-size selection, and confirmations straight to your inbox."
          eta="Q2 2026"
        />
      )}

      {/* PRIVATE ROOMS tab */}
      {tab === "private" && (
        <V2ComingSoonPanel
          title="Private rooms"
          description="Fourteen private dining rooms across our venues — from intimate 6-seat tables to 50-guest takeovers. Submit enquiries straight through the app once live."
          eta="Coming soon"
        />
      )}

      {/* SCREENINGS tab */}
      {tab === "screenings" && (
        <V2ComingSoonPanel
          title="Screenings"
          description="Members-only film nights and curated tastings in partnership with independent cinemas. First event at The Summer House in late 2026."
          eta="Late 2026"
        />
      )}

      {/* RSVP confirmation placeholder (when booking_url is null) */}
      {rsvp && (
        <div
          onClick={() => setRsvp(null)}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(15, 17, 26, 0.7)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            zIndex: 300,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24,
            animation: "v2-fade-in 220ms ease-out",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 360,
              background: V2.card,
              border: "1px solid " + V2.goldBorder,
              borderRadius: 18,
              padding: 24,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 10 }}>✦</div>
            <div style={{ fontFamily: FONT.h, fontSize: 18, fontWeight: 600, color: V2.text, marginBottom: 8 }}>
              RSVP registered
            </div>
            <div style={{ fontSize: 12, color: V2.textSecondary, lineHeight: 1.5, marginBottom: 18 }}>
              We've logged your interest for <strong>{rsvp.title}</strong>. Our team will confirm your seat by email shortly.
            </div>
            <button
              onClick={() => setRsvp(null)}
              style={{
                width: "100%",
                padding: "12px 20px",
                background: V2.gold,
                color: V2.textOnGold,
                border: "none",
                borderRadius: 10,
                fontSize: 13, fontWeight: 700, letterSpacing: "0.05em",
                fontFamily: FONT.b,
                cursor: "pointer",
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


export default function App() {
  const classic = useClassicMode();
  const [view, setView] = useState(VIEW.LANDING);
  const [member, setMember] = useState(null);
  const [showPay, setShowPay] = useState(false);
  const [signupEmail, setSignupEmail] = useState(""); // SignUpV2 prefill
  const [peeling, setPeeling] = useState(false); // Landing → SignIn envelope reveal

  // Envelope-reveal orchestrator: cinematic dims, premium invitation envelope
  // appears and opens, then settles into the SignInV2 panel beneath. The
  // V2EnvelopeReveal component manages its own ~2.9s choreography (arrive →
  // hold → open → emerge) and signals onComplete; we then unmount it.
  const goToSignIn = useCallback(() => {
    if (peeling) return;
    setPeeling(true);
    setView(VIEW.SIGNIN); // mount SignInV2 underneath immediately
  }, [peeling]);
  const handleEnvelopeComplete = useCallback(() => {
    setPeeling(false);
  }, []);
  const [rewards, setRewards] = useState([]);
  const [transactions, setTxns] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [giftCards, setGiftCards] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [stores, setStores] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [events, setEvents] = useState([]);
  const [receipts, setReceipts] = useState([]);

  const loadMemberData = useCallback(async (memberId) => {
    const [m, r, t, v, g, tiersList, storesList, bookingsList, eventsList, receiptsList] = await Promise.all([
      supaFetch("members?id=eq." + memberId),
      supaFetch("rewards?active=eq.true&order=id.asc"),
      supaFetch("transactions?member_id=eq." + memberId + "&order=created_at.desc&limit=20"),
      supaFetch("vouchers?member_id=eq." + memberId + "&order=issued_at.desc"),
      supaFetch("gift_cards?purchaser_id=eq." + memberId + "&order=created_at.desc"),
      supaFetch("tiers?select=*&order=annual_fee.asc"),
      supaFetch("stores?status=eq.active&order=category.asc,name.asc"),
      supaFetch("bookings?member_id=eq." + memberId + "&order=starts_at.asc&limit=20"),
      supaFetch("events?status=eq.open&order=starts_at.asc&limit=20"),
      supaFetch("receipts?member_id=eq." + memberId + "&select=*,receipt_items(*)&order=charged_at.desc&limit=50"),
    ]);
    if (Array.isArray(m) && m[0]) setMember(m[0]);
    if (Array.isArray(r)) setRewards(r);
    if (Array.isArray(t)) setTxns(t);
    if (Array.isArray(v)) setVouchers(v);
    if (Array.isArray(g)) setGiftCards(g);
    if (Array.isArray(tiersList)) setTiers(tiersList);
    if (Array.isArray(storesList)) setStores(storesList);
    if (Array.isArray(bookingsList)) setBookings(bookingsList);
    if (Array.isArray(eventsList)) setEvents(eventsList);
    if (Array.isArray(receiptsList)) setReceipts(receiptsList);
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

      {view !== VIEW.LANDING && view !== VIEW.SIGNIN && view !== VIEW.SIGNUP && !(view === VIEW.HOME && !classic) && !(view === VIEW.EXPLORE && !classic) && !(view === VIEW.HISTORY && !classic) && !(view === VIEW.EVENTS && !classic) && (
        <div style={s.header}>
          <div style={s.logo}>✦ 1-INSIDER</div>
          {member && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 11, color: "#888" }}>{member.name}</div>
              <button
                onClick={signOut}
                style={{
                  background: "transparent",
                  border: "1px solid #333",
                  color: "#ccc",
                  fontSize: 10.5,
                  fontWeight: 600,
                  letterSpacing: 0.5,
                  padding: "5px 10px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontFamily: FONT.b,
                  transition: "all .15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#D32F2F"; e.currentTarget.style.color = "#fff"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#333"; e.currentTarget.style.color = "#ccc"; }}
                title="Sign out"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      )}

      {/* V2 LANDING → SIGNIN ENVELOPE-REVEAL ORCHESTRATION:
          - Landing renders normally when view is LANDING; dims (filter
            brightness 0.45) when peeling so the envelope on top reads.
          - SignInV2 mounts as soon as goToSignIn fires — it sits beneath
            the envelope layer (z=101 vs envelope z=200), ready to be
            revealed once the envelope dissolves into the card-expand.
          - V2EnvelopeReveal handles its own ~2.9s choreography and signals
            handleEnvelopeComplete which flips peeling=false. After that,
            LandingV2 unmounts and SignInV2 is the sole layer. */}
      {view === VIEW.LANDING && classic && <Landing onSignIn={() => setView(VIEW.SIGNIN)} />}
      {view === VIEW.LANDING && !classic && (
        <LandingV2 onSignIn={goToSignIn} peeling={peeling} />
      )}
      {view === VIEW.SIGNIN && classic && (
        <SignIn onSuccess={(m) => { setMember(m); loadMemberData(m.id); setView(VIEW.HOME); }} onBack={() => setView(VIEW.LANDING)} />
      )}
      {view === VIEW.SIGNIN && !classic && (
        <SignInV2
          onSuccess={(m) => { setMember(m); loadMemberData(m.id); setView(VIEW.HOME); }}
          onNewUser={(email) => { setSignupEmail(email || ""); setView(VIEW.SIGNUP); }}
          onBack={() => setView(VIEW.LANDING)}
          revealing={peeling}
        />
      )}
      {view === VIEW.SIGNUP && (
        <SignUpV2
          prefillEmail={signupEmail}
          tiers={tiers}
          onSuccess={(m) => { setMember(m); loadMemberData(m.id); setView(VIEW.HOME); setSignupEmail(""); }}
          onBack={() => { setSignupEmail(""); setView(VIEW.SIGNIN); }}
        />
      )}
      {/* Premium envelope reveal layer — covers viewport during the transition,
          dismisses itself via onComplete callback. Renders Landing dimmed
          beneath while envelope is active. */}
      {peeling && !classic && (
        <>
          {/* Keep Landing visible (dimmed via its own filter while peeling) */}
          <LandingV2 onSignIn={() => {}} peeling={true} />
          <V2EnvelopeReveal onComplete={handleEnvelopeComplete} />
        </>
      )}
      {view === VIEW.HOME && member && (classic
        ? <Home member={member} transactions={transactions} vouchers={vouchers} giftCards={giftCards} setView={setView} reload={() => loadMemberData(member.id)} />
        : <HomeV2 member={member} transactions={transactions} vouchers={vouchers} giftCards={giftCards} bookings={bookings} events={events} tiers={tiers} rewards={rewards} setView={setView} reload={() => loadMemberData(member.id)} onPay={() => setShowPay(true)} />
      )}
      {view === VIEW.REWARDS && member && <RewardsView member={member} rewards={rewards} reload={() => loadMemberData(member.id)} />}
      {view === VIEW.STAMPS && member && <StampsView member={member} reload={() => loadMemberData(member.id)} />}
      {view === VIEW.PROFILE && member && <Profile member={member} tiers={tiers} signOut={signOut} reload={() => loadMemberData(member.id)} />}
      {view === VIEW.WALLET && member && <Wallet member={member} vouchers={vouchers} setView={setView} reload={() => loadMemberData(member.id)} />}
      {view === VIEW.GIFTCARDS && member && <GiftCards member={member} giftCards={giftCards} setView={setView} reload={() => loadMemberData(member.id)} />}
      {view === VIEW.EXPLORE && member && (classic
        ? <ExploreOutlets member={member} stores={stores} setView={setView} />
        : <ExploreOutletsV2 member={member} setView={setView} />
      )}
      {view === VIEW.HISTORY && member && (classic
        ? <HistoryView member={member} setView={setView} />
        : <ReceiptsHistoryV2 member={member} receipts={receipts} setView={setView} />
      )}
      {view === VIEW.EVENTS && member && !classic && (
        <ActivationsV2 member={member} events={events} setView={setView} />
      )}

      {member && view >= VIEW.HOME && (classic ? (
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
      ) : (
        <V2BottomNav
          view={view}
          setView={setView}
          classic={classic}
          hasUnscannedVoucher={(vouchers || []).some(v => v.status === "pending_scan")}
          onScan={() => setShowPay(true)}
        />
      ))}

      {/* S7: QR Scan-to-Pay overlay — V2 only, triggered from Scan FAB */}
      {!classic && showPay && member && (
        <QrScanPayV2
          member={member}
          vouchers={vouchers}
          venueName="FLNT"
          tabAmount={128.00}
          onClose={() => setShowPay(false)}
        />
      )}

      {/* V2 floating Sign-out chip — top-right corner of all signed-in V2
          views (Home, Explore, Receipts, Events, Profile). The classic
          header is suppressed on V2 full-screen views by the conditional
          above, so V2 has no built-in chrome for sign-out — this chip
          fills the gap. Hidden on Landing/SignIn (no member yet) and in
          classic mode (which uses the inline header sign-out). Hidden
          during the envelope reveal (peeling=true) so it doesn't interrupt
          the cinematic. */}
      {!classic && member && view !== VIEW.LANDING && view !== VIEW.SIGNIN && view !== VIEW.SIGNUP && !peeling && (
        <button
          onClick={signOut}
          aria-label="Sign out"
          title="Sign out"
          style={{
            position: "fixed",
            top: 16,
            right: 16,
            zIndex: 150,
            background: "rgba(15, 17, 26, 0.65)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            color: "#FFFFFF",
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            padding: "8px 14px",
            borderRadius: 999,
            cursor: "pointer",
            fontFamily: FONT.b,
            display: "flex",
            alignItems: "center",
            gap: 6,
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
            transition: "border-color .15s, background .15s",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = "rgba(218, 165, 32, 0.55)";
            e.currentTarget.style.background = "rgba(15, 17, 26, 0.85)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.12)";
            e.currentTarget.style.background = "rgba(15, 17, 26, 0.65)";
          }}
        >
          <span style={{ fontSize: 11, opacity: 0.9 }}>↗</span>
          Sign out
        </button>
      )}
    </div>
  );
}

function Landing({ onSignIn }) {
  // Rich tier data — used for the Choose Your Tier expandable cards on Landing.
  const landingTiers = [
    {
      id: "silver",
      name: "Silver",
      sub: "Free — start earning today",
      icon: "✧",
      fee: "Free",
      highlight: "Base rate, no commitment",
      cta: "join",
      benefits: [
        { icon: "✦", label: "Earn rate",           value: "$1 = 1 point on every dining bill" },
        { icon: "🎂", label: "Birthday discount",   value: "10% off your total bill, entire birthday month" },
        { icon: "🎟️", label: "Welcome voucher",     value: "1 × $10 voucher on signup (min $20 spend)" },
        { icon: "☕", label: "Cafe Stamp Card",     value: "Earn stamps at all 4 Wildseed Café locations" },
        { icon: "💳", label: "Gift card access",    value: "Buy and gift 1-Group gift cards" },
        { icon: "✨", label: "Signup bonus",        value: "100 pts (Jan), 150 pts (Feb), 200 pts + yusheng (Mar)" },
      ],
    },
    {
      id: "gold",
      name: "Gold",
      sub: "$40/year — enhanced rewards",
      icon: "★",
      fee: "$40/year",
      highlight: "Best value for regulars",
      cta: "join",
      benefits: [
        { icon: "✦", label: "Earn rate",            value: "$1 = 1.5 points — 50% more than Silver" },
        { icon: "🎂", label: "Birthday discount",    value: "15% off your total bill, entire birthday month" },
        { icon: "🎟️", label: "Dining vouchers",      value: "10 × $20 ($200 total value) issued annually" },
        { icon: "🔄", label: "Non-Stop Hits",         value: "Unlimited voucher refill — new set available once you've used all 10" },
        { icon: "📅", label: "Priority reservations", value: "Skip-the-queue booking at all 1-Group venues" },
        { icon: "🎉", label: "Exclusive events",      value: "Member-only tasting events and chef dinners" },
        { icon: "🥂", label: "Welcome drink",         value: "Complimentary welcome drink on every visit" },
        { icon: "☕", label: "Cafe Stamp Card",       value: "All Silver stamp benefits included" },
      ],
    },
    {
      id: "platinum",
      name: "Platinum",
      sub: "$80/year — premium experience",
      icon: "♦",
      fee: "$80/year",
      highlight: "For regulars who want the best",
      cta: "join",
      benefits: [
        { icon: "✦",  label: "Earn rate",             value: "$1 = 2 points — double the Silver rate" },
        { icon: "🎂", label: "Birthday discount",      value: "20% off your total bill, entire birthday month" },
        { icon: "🎟️", label: "Dining vouchers",        value: "10 × $25 ($250 total value) issued annually" },
        { icon: "🔄", label: "Non-Stop Hits",           value: "Unlimited voucher refill — higher denomination" },
        { icon: "🌟", label: "VIP reservations",        value: "Guaranteed tables and best seating on request" },
        { icon: "👤", label: "Concierge service",       value: "Dedicated concierge for special occasions" },
        { icon: "🤝", label: "Partner benefits",        value: "Exclusive perks with 1-Group partners" },
        { icon: "👨‍🍳", label: "Chef's table access",      value: "Priority booking for chef's table experiences" },
        { icon: "☕", label: "Cafe Stamp Card",         value: "All Silver stamp benefits included" },
      ],
    },
    {
      id: "corporate",
      name: "Corporate",
      sub: "By invitation — contact us to learn more",
      icon: "◈",
      fee: "Bespoke",
      highlight: "For teams, offices, and corporate clients",
      cta: "enquire",
      benefits: [
        { icon: "✦",  label: "Earn rate",             value: "$1 = 1.5 points across the entire organisation" },
        { icon: "💼", label: "Bulk gift cards",         value: "Branded, denominated gift cards for staff rewards and client gifting" },
        { icon: "🎉", label: "Event coordination",      value: "Dedicated planner for corporate dinners, product launches, D&D" },
        { icon: "👤", label: "Account manager",         value: "A single point of contact across all 1-Group venues" },
        { icon: "📅", label: "Priority reservations",   value: "Same-day availability at any venue, any tier" },
        { icon: "🎟️", label: "Voucher allocation",      value: "10 × $20 vouchers per qualifying team member" },
        { icon: "🏢", label: "Multi-venue billing",     value: "Consolidated monthly statements across your team's dining" },
        { icon: "✉️", label: "Custom packages",         value: "Tailored programmes for teams of any size — from 10 to 10,000" },
      ],
    },
  ];

  // Single-expand behaviour — one tier open at a time
  const [expandedTier, setExpandedTier] = useState(null);
  const [showCorporateEnquiry, setShowCorporateEnquiry] = useState(false);

  const toggleTier = (id) => setExpandedTier(v => (v === id ? null : id));

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
        {/* ═══ Choose Your Tier — now expandable cards with full benefits ═══ */}
        <h2 style={{ ...s.h2, textAlign: "center" }}>Choose Your Tier</h2>
        <div style={{ fontSize: 12, color: C.muted, textAlign: "center", marginBottom: 18 }}>Tap any tier to explore full benefits</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {landingTiers.map(t => {
            const isExpanded = expandedTier === t.id;
            const isDark = ["platinum", "corporate"].includes(t.id);
            const tierTheme = TIER[t.id] || TIER.silver;
            return (
              <div
                key={t.id}
                style={{
                  background: tierTheme.grad,
                  borderRadius: 16,
                  color: isDark ? "#fff" : C.text,
                  overflow: "hidden",
                  boxShadow: isExpanded ? "0 8px 24px rgba(0,0,0,.1)" : "0 1px 8px rgba(0,0,0,.04)",
                  transition: "box-shadow .2s",
                }}
              >
                {/* Summary row — always visible, tap to expand */}
                <div
                  onClick={() => toggleTier(t.id)}
                  style={{
                    padding: 20, display: "flex", justifyContent: "space-between", alignItems: "center",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: FONT.h, fontSize: 22, fontWeight: 700 }}>{t.icon} {t.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>{t.sub}</div>
                    <div style={{ fontSize: 10.5, opacity: 0.7, marginTop: 6, letterSpacing: 0.5, textTransform: "uppercase", fontWeight: 600 }}>{t.highlight}</div>
                  </div>
                  <div style={{ textAlign: "right", marginLeft: 10 }}>
                    <div style={{ fontFamily: FONT.h, fontSize: 18, fontWeight: 700 }}>{t.fee}</div>
                    <div style={{
                      fontSize: 18, marginTop: 6, opacity: 0.8,
                      transition: "transform .25s",
                      transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                    }}>▾</div>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div style={{
                    padding: "0 20px 20px 20px",
                    borderTop: "1px solid " + (isDark ? "rgba(255,255,255,.15)" : "rgba(0,0,0,.08)"),
                  }}>
                    <div style={{
                      fontSize: 10.5, textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 600,
                      opacity: 0.75, marginTop: 14, marginBottom: 10,
                    }}>
                      {t.cta === "enquire" ? "Full entitlements" : "Your benefits"}
                    </div>

                    {/* Benefits list */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {t.benefits.map((b, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: 8,
                            background: isDark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.06)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 14, flexShrink: 0,
                          }}>{b.icon}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.9, textTransform: "uppercase", letterSpacing: 0.6 }}>
                              {b.label}
                            </div>
                            <div style={{ fontSize: 12.5, lineHeight: 1.5, marginTop: 2, opacity: 0.95 }}>
                              {b.value}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* CTA */}
                    <div style={{ marginTop: 18 }}>
                      {t.cta === "enquire" ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowCorporateEnquiry(true); }}
                          style={{
                            width: "100%", background: isDark ? "#fff" : "rgba(255,255,255,.9)",
                            color: tierTheme.txt || C.text,
                            border: "none", padding: "12px 20px", borderRadius: 8,
                            fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT.b,
                          }}
                        >
                          ✉️ Write in about Corporate Membership
                        </button>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); onSignIn(); }}
                          style={{
                            width: "100%", background: isDark ? "#fff" : "rgba(255,255,255,.9)",
                            color: tierTheme.txt || C.text,
                            border: "none", padding: "12px 20px", borderRadius: 8,
                            fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT.b,
                          }}
                        >
                          Sign in to join {t.name} →
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ═══ Our Venues — replaced 4-panel grid with the VenueDirectory accordion ═══ */}
        <h2 style={{ ...s.h2, textAlign: "center", marginTop: 32 }}>Our Venues</h2>
        <div style={{ fontSize: 12, color: C.muted, textAlign: "center", marginBottom: 18 }}>
          11 locations across Singapore & Malaysia · tap a venue to discover its restaurants and bars
        </div>
        <VenueDirectory />

        {/* Bottom CTA — second sign-in entry after users scan the tiers */}
        <div style={{ marginTop: 28, padding: 20, background: "#FAF8F5", borderRadius: 12, textAlign: "center" }}>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 10 }}>Already a member?</div>
          <button onClick={onSignIn} style={{ ...s.btn, maxWidth: 260, margin: "0 auto", display: "block" }}>Sign in to your account</button>
        </div>
      </div>

      {/* Corporate enquiry modal */}
      {showCorporateEnquiry && (
        <CorporateEnquiryModal onClose={() => setShowCorporateEnquiry(false)} />
      )}
    </div>
  );
}

// ─── Corporate Membership enquiry modal ───
function CorporateEnquiryModal({ onClose }) {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    teamSize: "",
    message: "",
  });

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const isValid = form.name.trim() && form.company.trim() && form.email.includes("@");

  const submit = () => {
    if (!isValid) return;
    // Demo-only: log the enquiry locally. Real integration would POST to a corporate-enquiries table or Gmail MCP.
    console.log("Corporate enquiry submitted:", form);
    setSubmitted(true);
  };

  return (
    <div style={s.modal} onClick={onClose}>
      <div style={{ ...s.modalInner, maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        {!submitted ? (
          <>
            <div style={{ fontSize: 10, color: "#1A3A5C", textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 600, marginBottom: 4 }}>◈ Corporate Membership</div>
            <h3 style={{ fontFamily: FONT.h, fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Let&rsquo;s build a programme for your team</h3>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.5 }}>
              Share a few details and our Corporate team will be in touch within 2 business days.
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label style={{ fontSize: 10.5, color: C.lmuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Your name *</label>
                <input style={{ ...s.input, marginTop: 4 }} value={form.name} onChange={e => update("name", e.target.value)} placeholder="Jane Tan" />
              </div>
              <div>
                <label style={{ fontSize: 10.5, color: C.lmuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Company *</label>
                <input style={{ ...s.input, marginTop: 4 }} value={form.company} onChange={e => update("company", e.target.value)} placeholder="Acme Pte Ltd" />
              </div>
              <div>
                <label style={{ fontSize: 10.5, color: C.lmuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Work email *</label>
                <input style={{ ...s.input, marginTop: 4 }} type="email" value={form.email} onChange={e => update("email", e.target.value)} placeholder="jane.tan@acme.sg" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 10.5, color: C.lmuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Phone</label>
                  <input style={{ ...s.input, marginTop: 4 }} value={form.phone} onChange={e => update("phone", e.target.value)} placeholder="+65…" />
                </div>
                <div>
                  <label style={{ fontSize: 10.5, color: C.lmuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Team size</label>
                  <select style={{ ...s.input, marginTop: 4 }} value={form.teamSize} onChange={e => update("teamSize", e.target.value)}>
                    <option value="">Choose…</option>
                    <option>10–25</option>
                    <option>26–50</option>
                    <option>51–100</option>
                    <option>101–500</option>
                    <option>500+</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 10.5, color: C.lmuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>What are you looking for?</label>
                <textarea
                  style={{ ...s.input, marginTop: 4, resize: "vertical", fontFamily: FONT.b }}
                  rows={3}
                  value={form.message}
                  onChange={e => update("message", e.target.value)}
                  placeholder="E.g. client gifting programme, team dining benefits, event venue access…"
                />
              </div>
            </div>

            <div style={{ background: "#E8EFF5", border: "1px solid #B5CADC", borderRadius: 8, padding: 10, fontSize: 10.5, color: "#1A3A5C", marginTop: 14, lineHeight: 1.5 }}>
              ℹ️ Corporate tiers are bespoke — our team will share a tailored benefits package after a short discovery call.
            </div>

            <button onClick={submit} disabled={!isValid} style={{ ...s.btn, background: "#1A3A5C", marginTop: 14, marginBottom: 8, opacity: isValid ? 1 : 0.4 }}>
              Submit enquiry
            </button>
            <button onClick={onClose} style={s.btnOutline}>Cancel</button>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✉️</div>
            <h3 style={{ fontFamily: FONT.h, fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Enquiry received</h3>
            <div style={{ fontSize: 13, color: C.text, marginBottom: 4 }}>Thank you, {form.name.split(" ")[0]}.</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 20, lineHeight: 1.5 }}>
              Our Corporate team will reach out to <strong>{form.email}</strong> within 2 business days to schedule a discovery call.
            </div>
            <button onClick={onClose} style={{ ...s.btn, background: "#1A3A5C" }}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

function SignIn({ onSuccess, onBack }) {
  const [method, setMethod] = useState("mobile"); // U14: 'mobile' | 'email'
  const [step, setStep] = useState(1);
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showEberBlocker, setShowEberBlocker] = useState(false);

  const sendOtp = () => {
    setError("");
    if (!mobile || mobile.length < 4) { setError("Enter a valid mobile number"); return; }
    setStep(2);
  };

  // U14: Email path — blocked by Eber L03 (mobile OTP only). Show informative modal.
  const attemptEmailSignIn = () => {
    setError("");
    if (!email || !email.includes("@")) { setError("Enter a valid email address"); return; }
    setShowEberBlocker(true);
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
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontFamily: FONT.h, fontSize: 12, color: C.gold, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>✦ 1-INSIDER</div>
        <h2 style={{ fontFamily: FONT.h, fontSize: 24, fontWeight: 700 }}>Sign in to continue</h2>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>
          {method === "mobile" ? "Enter your mobile number to receive a one-time passcode" : "Enter your registered email"}
        </div>
      </div>

      {/* U14: Method selector — appears on step 1 only */}
      {step === 1 && (
        <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "#f5f5f5", borderRadius: 10, padding: 3 }}>
          {[
            { id: "mobile", label: "📱 Mobile", sub: "OTP" },
            { id: "email", label: "✉️ Email", sub: "Coming soon" },
          ].map(m => (
            <div key={m.id} onClick={() => { setMethod(m.id); setError(""); }} style={{
              flex: 1, padding: "10px 8px", borderRadius: 8, textAlign: "center", cursor: "pointer",
              background: method === m.id ? "#fff" : "transparent",
              color: method === m.id ? C.text : C.muted,
              fontWeight: method === m.id ? 600 : 400,
              boxShadow: method === m.id ? "0 1px 4px rgba(0,0,0,.06)" : "none",
              transition: "all .2s",
            }}>
              <div style={{ fontSize: 13 }}>{m.label}</div>
              <div style={{ fontSize: 9, color: C.lmuted, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.5 }}>{m.sub}</div>
            </div>
          ))}
        </div>
      )}

      {step === 1 && method === "mobile" && (
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
      )}

      {step === 1 && method === "email" && (
        <div>
          {/* Eber L03 always-on red banner */}
          <div style={{ background: "#FFEBEE", border: "1px solid #EF9A9A", borderRadius: 10, padding: "12px 14px", fontSize: 11, color: "#B71C1C", marginBottom: 14, lineHeight: 1.5 }}>
            🚫 <strong>Eber Limitation L03:</strong> email OTP is not currently supported. The Eber platform supports mobile OTP only. Email login is tracked as a platform development request — this preview lets you see the intended experience.
          </div>
          <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 6 }}>Email Address</label>
          <input
            style={{ ...s.input, marginBottom: 16 }}
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          {error && <div style={{ color: "#D32F2F", fontSize: 12, marginBottom: 12 }}>{error}</div>}
          <button onClick={attemptEmailSignIn} style={s.btn}>Send email OTP (preview)</button>
          <div style={{ textAlign: "center", marginTop: 12, fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
            This is a UX preview. Pressing &ldquo;Send&rdquo; will show the planned experience without actually signing you in.
          </div>
        </div>
      )}

      {step === 2 && method === "mobile" && (
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

      {/* U14: Eber L03 blocker modal — shown when user attempts email send */}
      {showEberBlocker && (
        <div style={s.modal} onClick={() => setShowEberBlocker(false)}>
          <div style={{ ...s.modalInner, maxWidth: 400, textAlign: "center" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🚫</div>
            <h3 style={{ fontFamily: FONT.h, fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Email sign-in coming soon</h3>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
              We&rsquo;ve captured the UX here so you can see how it will work, but the Eber loyalty platform (our backend) currently only supports mobile-number OTP verification.
            </div>
            <div style={{ background: "#FFF8E1", border: "1px solid #FFE082", borderRadius: 8, padding: 12, fontSize: 11, color: "#5D4037", marginBottom: 16, lineHeight: 1.5, textAlign: "left" }}>
              <strong>What happens next:</strong>
              <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
                <li style={{ marginBottom: 3 }}>1-Group has raised email OTP as a platform development request with Eber.</li>
                <li style={{ marginBottom: 3 }}>Eber is reviewing the technical change.</li>
                <li>Once live, your registered email on file can receive the 6-digit passcode.</li>
              </ul>
            </div>
            <button onClick={() => { setShowEberBlocker(false); setMethod("mobile"); setError(""); }} style={{ ...s.btn, marginBottom: 8 }}>
              Use mobile OTP instead
            </button>
            <button onClick={() => setShowEberBlocker(false)} style={s.btnOutline}>Close</button>
          </div>
        </div>
      )}
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

      {/* U13: Bookings slideshow — rotates through upcoming/past reservations */}
      <BookingsSlideshow transactions={transactions} setView={setView} />

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

      {/* U04: Explore Outlets entry card — discover all 24 1-Group venues */}
      <div onClick={() => setView(VIEW.EXPLORE)} style={{
        background: "linear-gradient(135deg,#fff,#F0F4F8)",
        border: "1.5px solid #4A7A9555",
        borderRadius: 12, padding: 14, marginBottom: 14,
        display: "flex", alignItems: "center", gap: 14,
        cursor: "pointer", boxShadow: "0 1px 8px rgba(0,0,0,.04)",
      }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: "#4A7A9522", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🗺️</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: FONT.h, fontSize: 15, fontWeight: 600 }}>Explore Outlets</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>24 venues across Restaurants, Bars, Cafés · book a table</div>
        </div>
        <div style={{ color: "#4A7A95", fontSize: 18, fontWeight: 600 }}>→</div>
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
      <RecentActivity transactions={transactions} setView={setView} />

      <button onClick={reload} style={{ ...s.btnOutline, marginTop: 16, fontSize: 12 }}>↻ Refresh Data</button>
    </div>
  );
}

// ─── U13: BOOKINGS SLIDESHOW ───
// Parses U12's reservation transactions and rotates a hero slot through
// the member's upcoming (and most-recent past) bookings.

// Parse a reservation transaction's note field ("2026-04-20 at 19:30 · party of 4 · notes: …")
function parseBookingNote(note) {
  if (!note) return null;
  const m = note.match(/(\d{4}-\d{2}-\d{2})\s+at\s+(\d{1,2}:\d{2})\s*·\s*party of\s*(\d+)/i);
  if (!m) return null;
  const date = new Date(`${m[1]}T${m[2]}:00`);
  return { date, dateStr: m[1], timeStr: m[2], party: parseInt(m[3], 10) };
}

function BookingsSlideshow({ transactions, setView }) {
  // Extract reservations with parseable dates
  const bookings = (transactions || [])
    .filter(t => t.type === "adjust" && (t.reward_name || "").startsWith("Reservation request:"))
    .map(t => {
      const parsed = parseBookingNote(t.note);
      if (!parsed) return null;
      return {
        venue: (t.reward_name || "").replace(/^Reservation request:\s*/, "").trim(),
        date: parsed.date,
        dateStr: parsed.dateStr,
        timeStr: parsed.timeStr,
        party: parsed.party,
        transactionId: t.id,
      };
    })
    .filter(Boolean);

  const now = Date.now();
  const upcoming = bookings.filter(b => b.date.getTime() >= now).sort((a, b) => a.date - b.date);
  const past = bookings.filter(b => b.date.getTime() < now).sort((a, b) => b.date - a.date);

  // Prioritise upcoming; if none, show the most recent past booking as a memory
  const slides = upcoming.length > 0 ? upcoming.slice(0, 5) : past.slice(0, 3);

  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || slides.length < 2) return;
    const t = setInterval(() => setIdx(i => (i + 1) % slides.length), 4500);
    return () => clearInterval(t);
  }, [paused, slides.length]);

  // If idx drifts beyond slides length after reload, clamp it
  useEffect(() => { if (idx >= slides.length && slides.length > 0) setIdx(0); }, [slides.length, idx]);

  // Empty state — route to Explore
  if (slides.length === 0) {
    return (
      <div onClick={() => setView(VIEW.EXPLORE)} style={{
        background: "linear-gradient(135deg,#F0F4F8,#E4ECF4)",
        border: "1.5px dashed #4A7A9566",
        borderRadius: 12, padding: 18,
        marginBottom: 14,
        cursor: "pointer",
        display: "flex", alignItems: "center", gap: 14,
      }}>
        <div style={{ width: 46, height: 46, borderRadius: 10, background: "#4A7A9522", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>📅</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: FONT.h, fontSize: 14, fontWeight: 600 }}>Plan your next visit</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>No upcoming bookings. Browse all 24 venues &rarr;</div>
        </div>
      </div>
    );
  }

  const current = slides[idx];
  const isUpcoming = current.date.getTime() >= now;

  // Relative time formatter
  const dayMs = 86400000;
  const diffDays = Math.round((current.date.getTime() - now) / dayMs);
  let when;
  if (isUpcoming) {
    if (diffDays === 0) when = "Today";
    else if (diffDays === 1) when = "Tomorrow";
    else if (diffDays < 7) when = `In ${diffDays} days`;
    else when = current.date.toLocaleDateString("en-SG", { day: "numeric", month: "short" });
  } else {
    const daysAgo = Math.abs(diffDays);
    if (daysAgo === 0) when = "Earlier today";
    else if (daysAgo === 1) when = "Yesterday";
    else if (daysAgo < 7) when = `${daysAgo} days ago`;
    else when = current.date.toLocaleDateString("en-SG", { day: "numeric", month: "short" });
  }

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{
        background: isUpcoming
          ? "linear-gradient(135deg,#4A7A95,#6E9FB5)"
          : "linear-gradient(135deg,#888,#aaa)",
        borderRadius: 14, padding: 18, marginBottom: 14,
        color: "#fff", position: "relative",
        boxShadow: "0 2px 12px rgba(0,0,0,.08)",
        overflow: "hidden",
        minHeight: 104,
      }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, opacity: 0.85, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 600, marginBottom: 4 }}>
            📅 {isUpcoming ? "Upcoming booking" : "Last visit"} {slides.length > 1 && <span style={{ opacity: 0.6, marginLeft: 6 }}>{idx + 1} / {slides.length}</span>}
          </div>
          <div style={{ fontFamily: FONT.h, fontSize: 18, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{current.venue}</div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 10 }}>
          <div style={{ fontFamily: FONT.h, fontSize: 16, fontWeight: 700 }}>{when}</div>
          <div style={{ fontSize: 10.5, opacity: 0.85, marginTop: 1 }}>{current.timeStr}</div>
        </div>
      </div>
      <div style={{ fontSize: 11.5, opacity: 0.9, marginTop: 2 }}>
        {current.date.toLocaleDateString("en-SG", { weekday: "long", day: "numeric", month: "short" })} · Party of {current.party}
      </div>

      {/* Dot indicators */}
      {slides.length > 1 && (
        <div style={{ display: "flex", gap: 5, marginTop: 12, justifyContent: "center" }}>
          {slides.map((_, i) => (
            <div
              key={i}
              onClick={(e) => { e.stopPropagation(); setIdx(i); setPaused(true); }}
              style={{
                width: i === idx ? 20 : 6, height: 6, borderRadius: 3,
                background: i === idx ? "#fff" : "rgba(255,255,255,.4)",
                transition: "width .25s, background .25s",
                cursor: "pointer",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// U05: describe a raw transaction row as a human-readable activity entry
// U07: every return includes a `category` ('dining' | 'points' | 'rewards' | 'account')
//      used by the History timeline view to filter.
function describeTransaction(t) {
  const venue = t.venue || "";
  const name = t.reward_name || "";
  const pts = t.points || 0;
  const amt = parseFloat(t.amount || 0);

  // U12: Reservation request
  if (t.type === "adjust" && name.startsWith("Reservation request:")) {
    const venueName = name.replace(/^Reservation request:\s*/, "").trim();
    return {
      icon: "📅",
      iconBg: "#F0F4F8",
      title: `Reservation requested`,
      subtitle: `${venueName}${t.note ? ` · ${t.note}` : ""}`,
      delta: null,
      deltaColor: "#4A7A95",
      category: "dining",
    };
  }

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
      category: "account",
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
      category: "rewards",
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
      category: "dining",
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
        category: "dining",
      };
    }
    return {
      icon: "🎟️",
      iconBg: "#FDF8EE",
      title: `Used $${amt.toFixed(2)} dining voucher`,
      subtitle: name.includes("Non-Stop") ? "Non-Stop Hits" : "Dining voucher",
      delta: `−$${amt.toFixed(0)}`,
      deltaColor: "#D32F2F",
      category: "dining",
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
      category: "rewards",
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
      category: "points",
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
      category: "rewards",
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
      category: "rewards",
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
      category: "points",
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
      category: "points",
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
      category: "account",
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
    category: "account",
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

// ─── SHARED: Venue directory (panels with hero thumbnails) — used on Landing ───
function VenueDirectory() {
  const [expandedVenue, setExpandedVenue] = useState(null); // single-expand parent

  const toggleVenue = (name) => setExpandedVenue(v => (v === name ? null : name));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {VENUE_DIRECTORY.map((venue) => {
        const hasSubs = venue.subs && venue.subs.length > 0;
        const isExpanded = expandedVenue === venue.name;
        return (
          <div
            key={venue.name}
            style={{
              background: "#fff",
              borderRadius: 14,
              overflow: "hidden",
              boxShadow: isExpanded ? "0 8px 24px rgba(0,0,0,.08)" : "0 1px 8px rgba(0,0,0,.04)",
              transition: "box-shadow .2s",
              border: "1px solid #eee",
            }}
          >
            {/* Hero image with venue name overlay */}
            <div
              onClick={() => hasSubs ? toggleVenue(venue.name) : window.open(venue.url, "_blank", "noopener,noreferrer")}
              style={{
                position: "relative",
                width: "100%",
                aspectRatio: "16 / 10",
                backgroundImage: `url("${venue.thumbnail}")`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundColor: C.dark, // fallback if image fails
                cursor: "pointer",
                overflow: "hidden",
              }}
            >
              {/* Dark gradient overlay for text contrast */}
              <div style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(to bottom, rgba(0,0,0,0) 40%, rgba(0,0,0,.65) 100%)",
              }} />

              {/* Venue name + tagline */}
              <div style={{
                position: "absolute", left: 16, right: 16, bottom: 14,
                color: "#fff",
              }}>
                <div style={{ fontFamily: FONT.h, fontSize: 22, fontWeight: 700, letterSpacing: 0.3, lineHeight: 1.15 }}>
                  {venue.name}
                </div>
                {hasSubs ? (
                  <div style={{ fontSize: 11.5, opacity: 0.9, marginTop: 4, letterSpacing: 0.3 }}>
                    Discover {venue.subs.length} venue{venue.subs.length === 1 ? "" : "s"}
                  </div>
                ) : (
                  <div style={{ fontSize: 11.5, opacity: 0.9, marginTop: 4, letterSpacing: 0.3 }}>
                    Tap to visit website ↗
                  </div>
                )}
              </div>

              {/* Chevron / Visit badge — top right */}
              <div style={{
                position: "absolute", top: 12, right: 12,
                background: "rgba(255,255,255,.92)",
                borderRadius: 20,
                padding: hasSubs ? "6px 10px" : "6px 12px",
                fontSize: 11, fontWeight: 600, color: C.gold,
                display: "flex", alignItems: "center", gap: 4,
                boxShadow: "0 2px 6px rgba(0,0,0,.12)",
                transition: "transform .25s",
                transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
              }}>
                {hasSubs ? "▾" : "Visit ↗"}
              </div>
            </div>

            {/* Sub-brand drawer (only when expanded) */}
            {hasSubs && isExpanded && (
              <div style={{ padding: "4px 0" }}>
                {venue.subs.map((sub, j) => (
                  <a
                    key={j}
                    href={sub.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "13px 16px",
                      textDecoration: "none", color: C.text,
                      borderTop: j > 0 ? "1px solid #f3efe9" : "1px solid #eee",
                      transition: "background .12s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "#FAF8F5"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <span style={{ fontSize: 11, color: C.muted, flexShrink: 0, width: 14 }}>↳</span>
                    <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500 }}>{sub.name}</span>
                    <span style={{ fontSize: 11, color: C.gold, fontWeight: 600, whiteSpace: "nowrap" }}>
                      Visit ↗
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// U05: Recent Activity component
// U07: accepts setView to route into the full HistoryView
function RecentActivity({ transactions, setView }) {
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
            <div style={{ textAlign: "center", marginTop: 10, display: "flex", gap: 12, justifyContent: "center" }}>
              <button onClick={() => setExpanded(!expanded)} style={{ background: "none", border: "none", color: C.gold, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 6 }}>
                {expanded ? "Show less" : `Show more (${Math.min(transactions.length, 15) - 5} more)`}
              </button>
              {setView && (
                <button onClick={() => setView(VIEW.HISTORY)} style={{ background: "none", border: "none", color: C.gold, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 6 }}>
                  View full history →
                </button>
              )}
            </div>
          )}
          {!hasMore && transactions.length > 0 && setView && (
            <div style={{ textAlign: "center", marginTop: 10 }}>
              <button onClick={() => setView(VIEW.HISTORY)} style={{ background: "none", border: "none", color: C.gold, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 6 }}>
                View full history →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── U07: HISTORY VIEW — full transaction timeline with filters + date grouping ───
function HistoryView({ member, setView }) {
  const [filter, setFilter] = useState("all"); // all | dining | points | rewards
  const [txns, setTxns] = useState(null); // null = loading, [] = loaded empty
  const [error, setError] = useState(null);

  // Full history fetch (up to 500 rows — far more than Home's 20)
  useEffect(() => {
    (async () => {
      try {
        const data = await supaFetch(`transactions?member_id=eq.${member.id}&order=created_at.desc&limit=500`);
        if (Array.isArray(data)) setTxns(data);
        else { setError("Unable to load history"); setTxns([]); }
      } catch (e) {
        console.error(e);
        setError(e.message || "Unable to load history");
        setTxns([]);
      }
    })();
  }, [member.id]);

  // Apply filter
  const enriched = (txns || []).map(t => ({ ...t, _desc: describeTransaction(t) }));
  const filtered = filter === "all" ? enriched : enriched.filter(t => t._desc.category === filter);

  // Stats card: computed from filtered set
  const stats = {
    count: filtered.length,
    pointsEarned: filtered.reduce((a, t) => a + (t.points > 0 ? t.points : 0), 0),
    pointsSpent: filtered.reduce((a, t) => a + (t.points < 0 ? -t.points : 0), 0),
    dollarSpent: filtered.reduce((a, t) => {
      // only count actual negative cash flows (redemptions, purchases) — ignore tier-upgrade-style adjusts
      if (t._desc.category === "dining" && t.type === "redeem") return a + parseFloat(t.amount || 0);
      return a;
    }, 0),
  };

  // Group by date bucket: "Today", "Yesterday", "This week", "This month", "MMMM YYYY" for older
  const buckets = groupByBucket(filtered);

  return (
    <div style={{ ...s.page, animation: "fadeIn .3s ease" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <button onClick={() => setView(VIEW.HOME)} style={{ background: "none", border: "none", color: C.gold, fontSize: 14, cursor: "pointer", padding: 0 }}>← Home</button>
      </div>
      <h2 style={s.h2}>Activity Timeline</h2>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>
        {txns === null ? "Loading…" : `Your full activity history — all visits, points, vouchers, and rewards.`}
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto", paddingBottom: 2 }}>
        {[
          { id: "all",     label: "All",     icon: "∞" },
          { id: "dining",  label: "Dining",  icon: "🍽️" },
          { id: "points",  label: "Points",  icon: "✦" },
          { id: "rewards", label: "Rewards", icon: "🎁" },
        ].map(f => {
          const active = filter === f.id;
          const n = f.id === "all" ? enriched.length : enriched.filter(t => t._desc.category === f.id).length;
          return (
            <div key={f.id} onClick={() => setFilter(f.id)} style={{
              padding: "8px 14px", borderRadius: 20, fontSize: 12, fontWeight: active ? 600 : 400,
              background: active ? C.gold : "#fff", color: active ? "#fff" : C.muted,
              cursor: "pointer", whiteSpace: "nowrap", border: "1px solid #eee", flexShrink: 0,
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <span style={{ fontSize: 13 }}>{f.icon}</span>
              <span>{f.label} · {n}</span>
            </div>
          );
        })}
      </div>

      {/* Stats summary card */}
      {txns !== null && filtered.length > 0 && (
        <div style={{ background: "linear-gradient(135deg,#fff,#FAF6ED)", border: "1px solid " + C.gold + "33", borderRadius: 12, padding: 14, marginBottom: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, color: C.lmuted, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>Total entries</div>
            <div style={{ fontFamily: FONT.h, fontSize: 22, fontWeight: 700, marginTop: 2 }}>{stats.count}</div>
          </div>
          {filter === "points" || filter === "all" ? (
            <div>
              <div style={{ fontSize: 10, color: C.lmuted, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>Points earned</div>
              <div style={{ fontFamily: FONT.h, fontSize: 22, fontWeight: 700, color: "#2E7D32", marginTop: 2 }}>+{stats.pointsEarned.toLocaleString()}</div>
            </div>
          ) : null}
          {filter === "dining" && (
            <div>
              <div style={{ fontSize: 10, color: C.lmuted, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>Voucher value redeemed</div>
              <div style={{ fontFamily: FONT.h, fontSize: 22, fontWeight: 700, color: C.gold, marginTop: 2 }}>${stats.dollarSpent.toFixed(0)}</div>
            </div>
          )}
          {filter === "rewards" && (
            <div>
              <div style={{ fontSize: 10, color: C.lmuted, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>Points spent on rewards</div>
              <div style={{ fontFamily: FONT.h, fontSize: 22, fontWeight: 700, color: "#D32F2F", marginTop: 2 }}>−{stats.pointsSpent.toLocaleString()}</div>
            </div>
          )}
        </div>
      )}

      {/* Loading / empty / error */}
      {error && (
        <div style={{ ...s.card, padding: 20, textAlign: "center", color: "#D32F2F", fontSize: 13 }}>
          ❌ {error}
        </div>
      )}
      {txns === null && !error && (
        <div style={{ ...s.card, padding: 40, textAlign: "center", color: C.muted }}>
          <div style={{ display: "inline-block", width: 24, height: 24, border: "3px solid #eee", borderTopColor: C.gold, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <div style={{ fontSize: 12, marginTop: 10 }}>Loading your history…</div>
        </div>
      )}
      {txns !== null && filtered.length === 0 && !error && (
        <div style={{ ...s.card, padding: 24, textAlign: "center", color: C.muted, fontSize: 13 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🔍</div>
          <div style={{ fontWeight: 500, color: C.text, marginBottom: 4 }}>
            {enriched.length === 0 ? "No activity yet" : `No ${filter} activity`}
          </div>
          <div style={{ fontSize: 11 }}>
            {enriched.length === 0 ? "Your history will appear here as you visit, earn, and redeem." : "Try a different filter."}
          </div>
        </div>
      )}

      {/* Timeline with date buckets */}
      {txns !== null && filtered.length > 0 && buckets.map(bucket => (
        <div key={bucket.label} style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: C.lmuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.2 }}>{bucket.label}</div>
            <div style={{ flex: 1, height: 1, background: "#eee" }} />
            <div style={{ fontSize: 10, color: C.lmuted }}>{bucket.entries.length} {bucket.entries.length === 1 ? "entry" : "entries"}</div>
          </div>
          <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 8px rgba(0,0,0,.04)", overflow: "hidden" }}>
            {bucket.entries.map((t, i) => {
              const desc = t._desc;
              const timeLabel = new Date(t.created_at).toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit", hour12: true });
              return (
                <div key={t.id || i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px", borderBottom: i < bucket.entries.length - 1 ? "1px solid #f5f5f5" : "none" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: desc.iconBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{desc.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: C.text, lineHeight: 1.35 }}>
                      {desc.title}
                    </div>
                    <div style={{ fontSize: 10.5, color: C.muted, marginTop: 3 }}>
                      {desc.subtitle ? <>{desc.subtitle} · </> : null}{timeLabel}
                    </div>
                  </div>
                  {desc.delta && (
                    <div style={{ fontSize: 12, fontWeight: 600, color: desc.deltaColor, flexShrink: 0, whiteSpace: "nowrap", textAlign: "right" }}>
                      {desc.delta}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// U07: Group enriched transactions by human-friendly date bucket.
// Buckets: Today → Yesterday → This week → This month → "MMMM YYYY" for older
function groupByBucket(enriched) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayMs = 86400000;
  const startOfYesterday = startOfToday - dayMs;
  const startOfThisWeek = startOfToday - (6 * dayMs);       // last 7 days window
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const buckets = {};
  const order = [];

  for (const t of enriched) {
    const ts = new Date(t.created_at).getTime();
    let label;
    if (ts >= startOfToday) label = "Today";
    else if (ts >= startOfYesterday) label = "Yesterday";
    else if (ts >= startOfThisWeek) label = "This week";
    else if (ts >= startOfThisMonth) label = "This month";
    else label = new Date(t.created_at).toLocaleDateString("en-SG", { month: "long", year: "numeric" });

    if (!buckets[label]) {
      buckets[label] = [];
      order.push(label);
    }
    buckets[label].push(t);
  }

  return order.map(label => ({ label, entries: buckets[label] }));
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

// ─── U04 + U12: EXPLORE OUTLETS + VENUE RESERVATIONS ───

const CATEGORY_META = {
  "Restaurants": { icon: "🍽️", color: "#B85C38", bg: "#FDF4EF" },
  "Bars":        { icon: "🍸", color: "#6B4E8B", bg: "#F3EEF9" },
  "Cafés":       { icon: "☕", color: "#7B9E6B", bg: "#F1F6EE" },
  "Wines":       { icon: "🍷", color: "#8B2252", bg: "#FBEEF3" },
};

function ExploreOutlets({ member, stores, setView }) {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [selectedStore, setSelectedStore] = useState(null);

  const cats = ["all", ...Array.from(new Set(stores.map(s => s.category)))];
  const countBy = (cat) => cat === "all" ? stores.length : stores.filter(s => s.category === cat).length;

  const searchLower = search.toLowerCase();
  const filtered = stores.filter(s => {
    if (catFilter !== "all" && s.category !== catFilter) return false;
    if (!searchLower) return true;
    return (
      (s.name || "").toLowerCase().includes(searchLower) ||
      (s.location || "").toLowerCase().includes(searchLower) ||
      (s.cuisine || "").toLowerCase().includes(searchLower)
    );
  });

  if (selectedStore) {
    return <VenueDetail store={selectedStore} member={member} onBack={() => setSelectedStore(null)} />;
  }

  return (
    <div style={{ ...s.page, animation: "fadeIn .3s ease" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <button onClick={() => setView(VIEW.HOME)} style={{ background: "none", border: "none", color: C.gold, fontSize: 14, cursor: "pointer", padding: 0 }}>← Home</button>
      </div>
      <h2 style={s.h2}>Explore Outlets</h2>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>{stores.length} venues across Singapore · earn points or stamps on every visit</div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 12 }}>
        <input
          type="text"
          placeholder="Search by name, location, or cuisine…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...s.input, paddingLeft: 36, fontSize: 13 }}
        />
        <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: C.muted, pointerEvents: "none" }}>🔍</div>
        {search && (
          <div onClick={() => setSearch("")} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: C.muted, cursor: "pointer", padding: 4 }}>×</div>
        )}
      </div>

      {/* Category filter chips */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto", paddingBottom: 4 }}>
        {cats.map(c => {
          const meta = CATEGORY_META[c] || {};
          const label = c === "all" ? "All" : `${meta.icon || ""} ${c}`.trim();
          const active = catFilter === c;
          return (
            <div key={c} onClick={() => setCatFilter(c)} style={{
              padding: "7px 14px", borderRadius: 20, fontSize: 12, fontWeight: active ? 600 : 400,
              background: active ? (c === "all" ? C.gold : meta.color || C.gold) : "#fff",
              color: active ? "#fff" : C.muted,
              cursor: "pointer", whiteSpace: "nowrap", border: "1px solid #eee",
              flexShrink: 0,
            }}>{label} · {countBy(c)}</div>
          );
        })}
      </div>

      {/* Results count */}
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>
        {filtered.length === stores.length ? `Showing all ${filtered.length}` : `Showing ${filtered.length} of ${stores.length}`}
      </div>

      {/* Venue list */}
      {filtered.length === 0 ? (
        <div style={{ ...s.card, padding: 24, textAlign: "center", color: C.muted, fontSize: 13 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🔎</div>
          <div style={{ fontWeight: 500, color: C.text, marginBottom: 4 }}>No venues match your search</div>
          <div style={{ fontSize: 11 }}>Try a different category or clear the search.</div>
        </div>
      ) : (
        filtered.map(store => <VenueCard key={store.id} store={store} onClick={() => setSelectedStore(store)} />)
      )}
    </div>
  );
}

// ─── Single venue card in the list ───
function VenueCard({ store, onClick }) {
  const meta = CATEGORY_META[store.category] || { icon: "📍", color: "#888", bg: "#fafafa" };
  return (
    <div onClick={onClick} style={{
      ...s.card,
      display: "flex", alignItems: "center", gap: 14,
      cursor: "pointer",
      transition: "transform .15s, box-shadow .15s",
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,.06)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 1px 8px rgba(0,0,0,.04)"; }}
    >
      <div style={{ width: 46, height: 46, borderRadius: 10, background: meta.bg, color: meta.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{meta.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
          <div style={{ fontFamily: FONT.h, fontSize: 15, fontWeight: 600 }}>{store.name}</div>
          {store.featured && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 5, background: "#FDF8EE", color: "#8B6914", fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>Featured</span>}
        </div>
        <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>
          {store.cuisine && <>{store.cuisine} · </>}
          {store.location || "Singapore"}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
          {store.points_eligible && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 5, background: "#FDF8EE", color: "#8B6914", fontWeight: 600 }}>✦ Points</span>}
          {store.stamps_eligible && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 5, background: "#F1F6EE", color: "#5D7B4E", fontWeight: 600 }}>☕ Stamps</span>}
        </div>
      </div>
      <div style={{ color: C.muted, fontSize: 18 }}>›</div>
    </div>
  );
}

// ─── U12: Venue detail view + booking entry ───
function VenueDetail({ store, member, onBack }) {
  const [booking, setBooking] = useState(false);
  const meta = CATEGORY_META[store.category] || { icon: "📍", color: "#888", bg: "#fafafa" };

  return (
    <div style={{ ...s.page, animation: "fadeIn .3s ease" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.gold, fontSize: 14, cursor: "pointer", padding: 0 }}>← Outlets</button>
      </div>

      {/* Hero */}
      <div style={{
        background: `linear-gradient(135deg,${meta.color},${meta.color}CC)`,
        borderRadius: 16, padding: 24, color: "#fff", marginBottom: 16,
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ fontSize: 56, marginBottom: 8 }}>{meta.icon}</div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,.8)", textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 600, marginBottom: 4 }}>{store.category}</div>
        <div style={{ fontFamily: FONT.h, fontSize: 26, fontWeight: 700 }}>{store.name}</div>
        {store.cuisine && <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>{store.cuisine}</div>}
        {store.featured && (
          <div style={{ position: "absolute", top: 16, right: 16, fontSize: 10, padding: "4px 10px", borderRadius: 8, background: "rgba(255,255,255,.25)", color: "#fff", fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase" }}>
            ✦ Featured
          </div>
        )}
      </div>

      {/* Book a table CTA */}
      <button onClick={() => setBooking(true)} style={{ ...s.btn, background: meta.color, marginBottom: 20 }}>
        📅 Book a Table
      </button>

      {/* Details */}
      <h3 style={s.h3}>Details</h3>
      <div style={s.card}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f5f5f5", fontSize: 12.5 }}>
          <span style={{ color: C.muted }}>Location</span>
          <span style={{ fontWeight: 500, textAlign: "right" }}>{store.location || "—"}</span>
        </div>
        {store.address && (
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f5f5f5", fontSize: 12.5 }}>
            <span style={{ color: C.muted }}>Address</span>
            <span style={{ fontWeight: 500, textAlign: "right", maxWidth: "60%" }}>{store.address}</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f5f5f5", fontSize: 12.5 }}>
          <span style={{ color: C.muted }}>Category</span>
          <span style={{ fontWeight: 500 }}>{store.category}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 12.5 }}>
          <span style={{ color: C.muted }}>Store ID</span>
          <span style={{ ...s.mono, fontSize: 11, color: C.lmuted }}>{store.id}</span>
        </div>
      </div>

      {/* Loyalty eligibility */}
      <h3 style={s.h3}>Loyalty benefits here</h3>
      <div style={s.card}>
        {store.points_eligible ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 0" }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "#FDF8EE", color: "#8B6914", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>✦</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Earn points</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>Points accrue on every bill at your tier&apos;s rate</div>
            </div>
          </div>
        ) : null}
        {store.stamps_eligible ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 0", borderTop: store.points_eligible ? "1px solid #f5f5f5" : "none", marginTop: store.points_eligible ? 8 : 0, paddingTop: store.points_eligible ? 14 : 6 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "#F1F6EE", color: "#5D7B4E", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>☕</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Earn café stamps</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>$10 = 1 stamp toward your café card</div>
            </div>
          </div>
        ) : null}
        {!store.points_eligible && !store.stamps_eligible && (
          <div style={{ fontSize: 12, color: C.muted, textAlign: "center", padding: "8px 0" }}>
            Loyalty rewards not active at this venue yet.
          </div>
        )}
      </div>

      {/* Booking modal */}
      {booking && (
        <BookingModal store={store} member={member} onClose={() => setBooking(false)} />
      )}
    </div>
  );
}

// ─── U12: Booking modal — SevenRooms style with demo fallback ───
function BookingModal({ store, member, onClose }) {
  const meta = CATEGORY_META[store.category] || { color: "#C5A258" };
  const [phase, setPhase] = useState("picking"); // picking | confirming | success

  // Default to tomorrow at 19:00
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = tomorrow.toISOString().slice(0, 10);

  const [bookingDate, setBookingDate] = useState(defaultDate);
  const [bookingTime, setBookingTime] = useState("19:00");
  const [partySize, setPartySize] = useState(2);
  const [specialRequests, setSpecialRequests] = useState("");

  const timeSlots = ["11:30", "12:00", "12:30", "13:00", "13:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00"];

  const submitBooking = async () => {
    setPhase("confirming");
    try {
      // If the venue has a booking_url, we'd redirect to SevenRooms. Without it, we log a
      // reservation as a transaction (for demo acceptance) and show confirmation.
      if (store.booking_url) {
        // Real path: open SevenRooms in a new tab with query params
        const params = new URLSearchParams({ date: bookingDate, time: bookingTime, party: String(partySize) });
        window.open(`${store.booking_url}?${params.toString()}`, "_blank", "noopener,noreferrer");
      }
      // Log the booking intent regardless — useful for demo + for real integration echo
      await supaFetch("transactions", {
        method: "POST",
        body: {
          member_id: member.id,
          venue: store.name,
          venue_id: store.id,
          amount: 0,
          points: 0,
          type: "adjust",
          reward_name: `Reservation request: ${store.name}`,
          note: `${bookingDate} at ${bookingTime} · party of ${partySize}${specialRequests ? ` · notes: ${specialRequests}` : ""}`,
        },
      });
      setPhase("success");
    } catch (e) {
      console.error("Booking log failed:", e);
      setPhase("success"); // don't block the user on demo log failure
    }
  };

  return (
    <div style={s.modal} onClick={() => phase !== "confirming" && onClose()}>
      <div style={{ ...s.modalInner, maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        {phase === "picking" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <div style={{ fontSize: 10, color: meta.color, textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 600 }}>{store.category}</div>
            </div>
            <h3 style={{ fontFamily: FONT.h, fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Book {store.name}</h3>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>{store.location || "Singapore"}</div>

            {/* Date */}
            <label style={{ fontSize: 10.5, color: C.lmuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>Date</label>
            <input type="date" value={bookingDate} onChange={e => setBookingDate(e.target.value)} min={new Date().toISOString().slice(0, 10)} style={{ ...s.input, marginBottom: 12 }} />

            {/* Time slots */}
            <label style={{ fontSize: 10.5, color: C.lmuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 6 }}>Time</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 12 }}>
              {timeSlots.map(t => (
                <div key={t} onClick={() => setBookingTime(t)} style={{
                  padding: "8px 4px", borderRadius: 6, fontSize: 11.5, textAlign: "center",
                  border: "1px solid " + (bookingTime === t ? meta.color : "#ddd"),
                  background: bookingTime === t ? meta.color : "#fff",
                  color: bookingTime === t ? "#fff" : C.text,
                  fontWeight: bookingTime === t ? 600 : 400,
                  cursor: "pointer",
                }}>{t}</div>
              ))}
            </div>

            {/* Party size */}
            <label style={{ fontSize: 10.5, color: C.lmuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 6 }}>Party size</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 4, marginBottom: 12 }}>
              {[1,2,3,4,5,6,7,8].map(n => (
                <div key={n} onClick={() => setPartySize(n)} style={{
                  padding: "8px 2px", borderRadius: 6, fontSize: 12, textAlign: "center",
                  border: "1px solid " + (partySize === n ? meta.color : "#ddd"),
                  background: partySize === n ? meta.color : "#fff",
                  color: partySize === n ? "#fff" : C.text,
                  fontWeight: partySize === n ? 600 : 400,
                  cursor: "pointer",
                }}>{n}</div>
              ))}
            </div>

            {/* Special requests */}
            <label style={{ fontSize: 10.5, color: C.lmuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>Special requests (optional)</label>
            <textarea value={specialRequests} onChange={e => setSpecialRequests(e.target.value)} rows={2} placeholder="Dietary, occasion, seating preference…" style={{ ...s.input, marginBottom: 14, resize: "vertical", fontFamily: FONT.b }} />

            {/* Demo mode notice */}
            {!store.booking_url && (
              <div style={{ background: "#FFF8E1", border: "1px solid #FFE082", borderRadius: 8, padding: 10, fontSize: 10.5, color: "#5D4037", marginBottom: 14, lineHeight: 1.5 }}>
                ⚠️ Demo mode: this venue is not yet wired into SevenRooms. Your request will be logged and reviewed by the venue team. When live, bookings will confirm instantly.
              </div>
            )}

            <button onClick={submitBooking} style={{ ...s.btn, background: meta.color, marginBottom: 8 }}>
              {store.booking_url ? "Continue to SevenRooms →" : "Request Reservation"}
            </button>
            <button onClick={onClose} style={s.btnOutline}>Cancel</button>
          </>
        )}

        {phase === "confirming" && (
          <div style={{ textAlign: "center", padding: "30px 0" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <div style={{ fontSize: 14, color: C.muted }}>Sending your request…</div>
          </div>
        )}

        {phase === "success" && (
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📅</div>
            <h3 style={{ fontFamily: FONT.h, fontSize: 22, fontWeight: 700, marginBottom: 6 }}>{store.booking_url ? "Opened in SevenRooms" : "Request received"}</h3>
            <div style={{ fontSize: 13, color: C.text, marginBottom: 6 }}>
              <strong>{store.name}</strong>
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 4 }}>
              {new Date(bookingDate).toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short" })} at {bookingTime}
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 20 }}>
              Party of {partySize}
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 20, lineHeight: 1.5 }}>
              {store.booking_url
                ? "Complete your reservation in the SevenRooms tab that just opened. You'll receive confirmation via email."
                : "The venue team will confirm your reservation within 2 hours via your registered mobile. Check Recent Activity on Home."}
            </div>
            <button onClick={onClose} style={{ ...s.btn, background: meta.color }}>Done</button>
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

  // U17-member: profile edit mode — toggleable form for self-service edits.
  // Mobile + Member ID stay read-only (Eber: one mobile = one account).
  // Tier sits in its own card with its own upgrade flow (U11).
  const [editing, setEditing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaveStatus, setProfileSaveStatus] = useState(null); // null | "saved" | "error"
  const [profileSaveError, setProfileSaveError] = useState("");
  const [editName, setEditName] = useState(member.name || "");
  const [editEmail, setEditEmail] = useState(member.email || "");
  const [editBirthdayMonth, setEditBirthdayMonth] = useState(member.birthday_month || "");
  const [editCategoryPref, setEditCategoryPref] = useState(member.category_pref || "");
  const [editMarketingConsent, setEditMarketingConsent] = useState(!!member.marketing_consent);

  // Re-sync form state when the underlying member changes (e.g. after reload).
  useEffect(() => {
    setEditName(member.name || "");
    setEditEmail(member.email || "");
    setEditBirthdayMonth(member.birthday_month || "");
    setEditCategoryPref(member.category_pref || "");
    setEditMarketingConsent(!!member.marketing_consent);
  }, [member.id, member.name, member.email, member.birthday_month, member.category_pref, member.marketing_consent]);

  const monthOptions = [
    { v: 1, n: "January" }, { v: 2, n: "February" }, { v: 3, n: "March" },
    { v: 4, n: "April" }, { v: 5, n: "May" }, { v: 6, n: "June" },
    { v: 7, n: "July" }, { v: 8, n: "August" }, { v: 9, n: "September" },
    { v: 10, n: "October" }, { v: 11, n: "November" }, { v: 12, n: "December" },
  ];
  const categoryOptions = [
    { id: "", label: "No preference" },
    { id: "cafes", label: "Cafés" },
    { id: "restaurants", label: "Restaurants" },
    { id: "bars", label: "Bars" },
    { id: "wines", label: "Wines" },
  ];

  const cancelEdit = () => {
    setEditing(false);
    setProfileSaveStatus(null);
    setProfileSaveError("");
    // Reset form to current values
    setEditName(member.name || "");
    setEditEmail(member.email || "");
    setEditBirthdayMonth(member.birthday_month || "");
    setEditCategoryPref(member.category_pref || "");
    setEditMarketingConsent(!!member.marketing_consent);
  };

  const saveProfile = async () => {
    setProfileSaveError("");
    if (!editName.trim() || editName.trim().length < 2) { setProfileSaveError("Please enter your full name"); return; }
    if (!editEmail.includes("@")) { setProfileSaveError("Please enter a valid email"); return; }
    if (!editBirthdayMonth) { setProfileSaveError("Please select your birthday month"); return; }
    setSavingProfile(true);
    try {
      const patch = {
        name: editName.trim(),
        email: editEmail.trim().toLowerCase(),
        birthday_month: parseInt(editBirthdayMonth, 10),
        category_pref: editCategoryPref || null,
        marketing_consent: !!editMarketingConsent,
      };
      await supaFetch("members?id=eq." + member.id, { method: "PATCH", body: patch });
      setProfileSaveStatus("saved");
      setEditing(false);
      if (reload) reload();
      setTimeout(() => setProfileSaveStatus(null), 2400);
    } catch (e) {
      console.error("Profile save failed:", e);
      const msg = (e && e.message) || "Could not save changes. Please try again.";
      const friendly = /marketing_consent/.test(msg)
        ? "Database not yet updated. Please run the marketing_consent migration in Supabase."
        : msg;
      setProfileSaveError(friendly);
      setProfileSaveStatus("error");
    }
    setSavingProfile(false);
  };

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

      {/* Save toast (success or error) */}
      {profileSaveStatus === "saved" && (
        <div style={{ background: "#E8F5E9", border: "1px solid #A5D6A7", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#1B5E20", marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}>
          <span>✅</span><span>Profile updated.</span>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h3 style={{ ...s.h3, marginBottom: 0 }}>Account Details</h3>
        {!editing && (
          <span
            onClick={() => { setEditing(true); setProfileSaveStatus(null); setProfileSaveError(""); }}
            style={{ fontSize: 12, color: C.gold, cursor: "pointer", fontWeight: 600, display: "flex", gap: 6, alignItems: "center" }}
          >
            <span style={{ fontSize: 13 }}>✎</span> Edit
          </span>
        )}
      </div>

      {!editing && (
        <div style={s.card}>
          {[
            { l: "Mobile", v: member.mobile || "—", note: "Contact us to change" },
            { l: "Email", v: member.email || "—" },
            { l: "Birthday Month", v: member.birthday_month ? (monthOptions.find(mo => mo.v === member.birthday_month) || {}).n || ("Month " + member.birthday_month) : "—" },
            { l: "Favourite Category", v: member.category_pref ? (categoryOptions.find(co => co.id === member.category_pref) || {}).label || member.category_pref : "—" },
            { l: "Marketing Comms", v: member.marketing_consent ? "On" : "Off" },
            { l: "Member Since", v: member.signup_date ? new Date(member.signup_date).toLocaleDateString() : "—" },
            { l: "Last Visit", v: member.last_visit ? new Date(member.last_visit).toLocaleDateString() : "—" },
          ].map((d, i, arr) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: i < arr.length - 1 ? "1px solid #f5f5f5" : "none", fontSize: 12.5, alignItems: "baseline", gap: 8 }}>
              <span style={{ color: C.muted, flexShrink: 0 }}>{d.l}</span>
              <span style={{ fontWeight: 500, textAlign: "right" }}>
                {d.v}
                {d.note && (
                  <span style={{ display: "block", fontSize: 10, color: C.lmuted, fontWeight: 400, marginTop: 2 }}>{d.note}</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div style={s.card}>
          {/* Mobile + Member ID — read-only with explanation */}
          <div style={{ background: "#FAFAFA", borderRadius: 8, padding: "10px 12px", marginBottom: 14, fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
            <strong>Mobile:</strong> {member.mobile || "—"} · <strong>ID:</strong> {member.id}<br/>
            Mobile and Member ID can't be changed here — one mobile = one account in our loyalty platform. Contact us if you've changed numbers.
          </div>

          <label style={{ display: "block", marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.6 }}>Full name</div>
            <input
              type="text"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              style={s.input}
              placeholder="Jane Tan"
            />
          </label>

          <label style={{ display: "block", marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.6 }}>Email</div>
            <input
              type="email"
              value={editEmail}
              onChange={e => setEditEmail(e.target.value)}
              style={s.input}
              placeholder="you@example.com"
            />
          </label>

          <label style={{ display: "block", marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.6 }}>Birthday month</div>
            <select
              value={editBirthdayMonth}
              onChange={e => setEditBirthdayMonth(e.target.value)}
              style={{ ...s.input, appearance: "none" }}
            >
              <option value="">Select month…</option>
              {monthOptions.map(m => (
                <option key={m.v} value={m.v}>{m.n}</option>
              ))}
            </select>
          </label>

          <label style={{ display: "block", marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.6 }}>Favourite category</div>
            <select
              value={editCategoryPref}
              onChange={e => setEditCategoryPref(e.target.value)}
              style={{ ...s.input, appearance: "none" }}
            >
              {categoryOptions.map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </label>

          {/* Marketing consent toggle — granular, separate from terms (PDPA) */}
          <div style={{ background: "#FAFAFA", borderRadius: 10, padding: 14, marginBottom: 16 }}>
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={editMarketingConsent}
                onChange={e => setEditMarketingConsent(e.target.checked)}
                style={{ width: 16, height: 16, marginTop: 2, accentColor: C.gold, cursor: "pointer", flexShrink: 0 }}
              />
              <div style={{ fontSize: 12, color: C.text, lineHeight: 1.5 }}>
                <strong>Marketing communications</strong><br/>
                <span style={{ color: C.muted }}>Receive 1-Insider news, special offers, and event invitations by email and SMS. Change anytime.</span>
              </div>
            </label>
          </div>

          {profileSaveError && (
            <div style={{ color: "#D32F2F", fontSize: 12, marginBottom: 10 }}>{profileSaveError}</div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={cancelEdit} disabled={savingProfile} style={{ ...s.btnOutline, flex: 1, color: C.muted, borderColor: "#ddd" }}>Cancel</button>
            <button onClick={saveProfile} disabled={savingProfile} style={{ ...s.btn, flex: 1, opacity: savingProfile ? 0.6 : 1 }}>
              {savingProfile ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      )}

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
