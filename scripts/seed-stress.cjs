/* eslint-disable */
/**
 * TwoGets — STRESS TEST data seeder (HTTPS-only; runs against Supabase with the
 * service-role key). Builds a large, deliberately uneven dataset for exercising
 * every screen: 8 homeowners (1-2 listings each) and 30 tenants spread across
 * three profile-completion tiers, plus the full activity layer (viewing slots,
 * bookings in every status, two-way reviews, shortlists and swipes).
 *
 *   node scripts/seed-stress.cjs
 *
 * Re-runnable: every account it owns lives on @demo.twogets.in and is deleted
 * (cascading to listings, bookings, reviews…) before rebuilding. The admin
 * account and any non-@demo.twogets.in user are never touched.
 */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// ---- env -------------------------------------------------------------------
function loadEnv() {
  const txt = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
  const out = {};
  for (const line of txt.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}
const env = loadEnv();
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE) throw new Error("Missing Supabase env vars");

const db = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });

const PASSWORD = "Demo@1234";
const TEST_DOMAIN = "@demo.twogets.in"; // every account this script owns
const PIC_DIR = "/tmp/seedpics";
const AV_DIR = path.join(PIC_DIR, "av");

// ---- assets ----------------------------------------------------------------
const PHOTOS = [
  "1522708323590-d24dbb6b0267","1502672260266-1c1ef2d93688","1560448204-e02f11c3d0e2","1493809842364-78817add7ffb",
  "1554995207-c18c203602cb","1555041469-a586c61ea9bc","1586023492125-27b2c045efd7","1598928506311-c55ded91a20c",
  "1567496898669-ee935f5f647a","1493663284031-b7e3aefcae8e","1583847268964-b28dc8f51f92","1615873968403-89e068629265",
  "1616486338812-3dadae4b4ace","1616137466211-f939a420be84","1600210492486-724fe5c67fb0","1600121848594-d8644e57abab",
  "1600566753086-00f18fb6b3ea","1600607687939-ce8a6c25118c","1600607687920-4e2a09cf159d","1524758631624-e2822e304c36",
  "1560185127-6ed189bf02f4","1505691938895-1758d7feb511","1505693416388-ac5ce068fe85","1540518614846-7eded433c457",
  "1616594039964-ae9021a400a0","1513584684374-8bab748fbf90","1556909114-f6e7ad7d3136","1556912172-45b7abe8b7e1",
  "1484154218962-a197022b5858","1552321554-5fefe8c9ef14","1584622650111-993a426fbf0a","1556020685-ae41abfc9365",
  "1512917774080-9991f1c4c750","1568605114967-8130f3a36994","1570129477492-45c003edd2be","1564013799919-ab600027ffc6",
  "1600596542815-ffad4c1539a9","1600585154340-be6161a56a0c","1613490493576-7fde63acd811","1613977257363-707ba9348227",
  "1576941089067-2de3c901e126","1518780664697-55e3ad937233","1523217582562-09d0def993a6","1494526585095-c41746248156",
  "1605146769289-440113cc3d00","1545324418-cc1a3fa10c00","1460317442991-0ec209397118","1486406146926-c627a92ad1ab",
  "1536376072261-38c75010e6c9","1502005229762-cf1b2da7c5d6","1507089947368-19c1da9775ae","1560185007-cde436f6a4d0",
  "1560184897-ae75f418493e","1574362848149-11496d93a7c7","1605276374104-dee2a0ed3cd6",
];

/** Avatar filename helper: "m32" -> men/32.jpg, "w44" -> women/44.jpg. */
function avatarUrlFor(file) {
  const [, sex, n] = file.match(/^([mw])(\d+)$/);
  return `https://randomuser.me/api/portraits/${sex === "m" ? "men" : "women"}/${n}.jpg`;
}

async function ensureAssets(avatarKeys) {
  fs.mkdirSync(AV_DIR, { recursive: true });
  const jobs = [];
  for (const id of PHOTOS) {
    const dest = path.join(PIC_DIR, `${id}.img`);
    if (!fs.existsSync(dest) || fs.statSync(dest).size < 2000) {
      jobs.push({ url: `https://images.unsplash.com/photo-${id}?w=1280&q=70&fit=crop`, dest });
    }
  }
  for (const key of avatarKeys) {
    const dest = path.join(AV_DIR, `${key}.jpg`);
    if (!fs.existsSync(dest) || fs.statSync(dest).size < 1000) {
      jobs.push({ url: avatarUrlFor(key), dest });
    }
  }
  if (!jobs.length) return;
  console.log(`→ Downloading ${jobs.length} image assets`);
  for (let i = 0; i < jobs.length; i += 8) {
    await Promise.all(jobs.slice(i, i + 8).map(async ({ url, dest }) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`download ${url}: HTTP ${res.status}`);
      fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    }));
  }
}

let photoCursor = 0;
function nextPhotos(n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(PHOTOS[photoCursor++ % PHOTOS.length]);
  return out;
}
const photoBuffer = (id) => fs.readFileSync(path.join(PIC_DIR, `${id}.img`));
const avatarBuffer = (key) => fs.readFileSync(path.join(AV_DIR, `${key}.jpg`));

const today = new Date();
function isoDate(daysFromNow) {
  const d = new Date(today);
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}
function isoTimestamp(daysAgo) {
  const d = new Date(today);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString();
}
const rid = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ===========================================================================
// HOMEOWNERS — 8 total, each with 1-2 listings, at different setup stages.
// stage: "established" (verified + full profile) | "growing" | "new" (bare)
// ===========================================================================
const OWNERS = [
  { key: "demo",   email: `owner${TEST_DOMAIN}`,        name: "Demo Homeowner", phone: "+91 98000 00000", avatar: "m32", verified: true,  trust: 72, stage: "established",
    city: "Bengaluru", about: "Demo homeowner account — the quickest way to explore the TwoGets owner experience.", linkedin: "https://linkedin.com/in/demo-homeowner" },
  { key: "rajesh", email: `rajesh.kumar${TEST_DOMAIN}`, name: "Rajesh Kumar",   phone: "+91 98450 11001", avatar: "m45", verified: true,  trust: 88, stage: "established",
    city: "Bengaluru", about: "Second-generation landlord in Bengaluru. I keep my flats spotless and respond within the hour.", linkedin: "https://linkedin.com/in/rajeshkumar-blr" },
  { key: "priya",  email: `priya.sharma${TEST_DOMAIN}`, name: "Priya Sharma",   phone: "+91 98450 11002", avatar: "w33", verified: true,  trust: 81, stage: "established",
    city: "Bengaluru", about: "I rent out two family-owned apartments and prefer long-term, respectful tenants.", linkedin: "https://linkedin.com/in/priyasharma-homes" },
  { key: "arjun",  email: `arjun.mehta${TEST_DOMAIN}`,  name: "Arjun Mehta",    phone: "+91 98200 11003", avatar: "m67", verified: true,  trust: 91, stage: "established",
    city: "Mumbai", about: "Mumbai-based property manager. All my listings are broker-free and move-in ready.", linkedin: "https://linkedin.com/in/arjunmehta-mum" },
  { key: "sneha",  email: `sneha.reddy${TEST_DOMAIN}`,  name: "Sneha Reddy",    phone: "+91 90000 11004", avatar: "w44", verified: true,  trust: 76, stage: "growing",
    city: "Hyderabad", about: "I manage premium homes across Hyderabad's IT corridor. Transparency first.", linkedin: null },
  { key: "ananya", email: `ananya.iyer${TEST_DOMAIN}`,  name: "Ananya Iyer",    phone: "+91 99000 11006", avatar: "w58", verified: true,  trust: 64, stage: "growing",
    city: "Pune", about: "Pune homeowner. I love matching my homes with tenants who'll treat them well.", linkedin: null },
  // Unverified / partially set up — exercises the "get verified" nudges.
  { key: "vikram", email: `vikram.singh${TEST_DOMAIN}`, name: "Vikram Singh",   phone: "+91 98100 11005", avatar: "m75", verified: false, trust: 28, stage: "growing",
    city: "Gurugram", about: "New to TwoGets — listing my Gurugram flats directly, no middlemen.", linkedin: null },
  // Brand new: no homeowner_profile row at all, no phone, no avatar, one draft.
  { key: "farhan", email: `farhan.qureshi${TEST_DOMAIN}`, name: "Farhan Qureshi", phone: null, avatar: null, verified: false, trust: 20, stage: "new",
    city: null, about: null, linkedin: null },
];

// ---- properties: 13 across the 8 owners (1-2 each) -------------------------
const PROPS = [
  // demo (2)
  { o: "demo", title: "Premium 3 BHK villa in Jayanagar", type: "villa", bhk: 3, furn: "fully_furnished", rent: 75000, dep: 300000, loc: "Jayanagar", city: "Bengaluru", state: "Karnataka", pin: "560011", lat: 12.9250, lng: 77.5938, pet: true, pref: "family", status: "active", verified: true, views: 421, am: ["parking","power_backup","water_supply","security","wifi","ac","modular_kitchen","balcony","cctv","intercom"], desc: "An elegant independent villa on a tree-lined Jayanagar avenue. Three large bedrooms, a private garden, and a fully-equipped kitchen. One of Bengaluru's most loved old neighbourhoods." },
  { o: "demo", title: "Cosy 1 BHK in Bellandur, walk to tech parks", type: "apartment", bhk: 1, furn: "unfurnished", rent: 19000, dep: 70000, loc: "Bellandur", city: "Bengaluru", state: "Karnataka", pin: "560103", lat: 12.9255, lng: 77.6762, pet: false, pref: "any", status: "active", verified: false, views: 87, am: ["parking","lift","power_backup","water_supply","security"], desc: "Practical unfurnished 1 BHK minutes from Ecospace and Outer Ring Road offices. Great value for someone who wants to bring their own furniture and stay close to work." },
  // rajesh (2)
  { o: "rajesh", title: "Sunlit 2 BHK with balcony in Indiranagar", type: "apartment", bhk: 2, furn: "fully_furnished", rent: 38000, dep: 150000, loc: "Indiranagar", city: "Bengaluru", state: "Karnataka", pin: "560038", lat: 12.9719, lng: 77.6412, pet: true, pref: "any", status: "active", verified: true, views: 312, am: ["parking","lift","power_backup","water_supply","security","wifi","ac","modular_kitchen","balcony"], desc: "A bright, fully-furnished 2 BHK on a quiet leafy street in the heart of Indiranagar. Walkable to 100 Feet Road cafes, metro, and parks. Includes premium modular kitchen, two ACs, and covered parking." },
  { o: "rajesh", title: "Spacious 3 BHK near Koramangala 5th Block", type: "apartment", bhk: 3, furn: "semi_furnished", rent: 55000, dep: 220000, loc: "Koramangala", city: "Bengaluru", state: "Karnataka", pin: "560095", lat: 12.9352, lng: 77.6245, pet: false, pref: "family", status: "active", verified: true, views: 198, am: ["parking","lift","power_backup","water_supply","security","gym","clubhouse","balcony","cctv"], desc: "Generous 3 BHK in a gated community moments from Koramangala's startup hub. Semi-furnished with wardrobes and kitchen cabinetry. Clubhouse, gym, and children's play area on site." },
  // priya (2) — one active, one draft (lifecycle variety)
  { o: "priya", title: "Modern studio in HSR Layout, ideal for bachelors", type: "studio", bhk: 1, furn: "fully_furnished", rent: 22000, dep: 80000, loc: "HSR Layout", city: "Bengaluru", state: "Karnataka", pin: "560102", lat: 12.9116, lng: 77.6473, pet: false, pref: "bachelor", status: "active", verified: true, views: 256, am: ["lift","power_backup","water_supply","security","wifi","ac","modular_kitchen"], desc: "Compact, design-forward studio perfect for a working professional. Fully furnished down to the cutlery — just bring a suitcase. High-speed-fibre ready and steps from HSR's cafe scene." },
  { o: "priya", title: "Upcoming 2 BHK listing in Koramangala", type: "apartment", bhk: 2, furn: "semi_furnished", rent: 47000, dep: 180000, loc: "Koramangala", city: "Bengaluru", state: "Karnataka", pin: "560034", lat: 12.9279, lng: 77.6271, pet: false, pref: "any", status: "draft", verified: false, views: 3, am: ["parking","lift","power_backup","water_supply","security","balcony"], desc: "Preparing this one for listing — photos and details being finalised. A bright 2 BHK in central Koramangala." },
  // arjun (2) — premium Mumbai, one rented
  { o: "arjun", title: "Luxury 3 BHK penthouse with skyline views in Powai", type: "penthouse", bhk: 3, furn: "fully_furnished", rent: 150000, dep: 600000, loc: "Powai", city: "Mumbai", state: "Maharashtra", pin: "400076", lat: 19.1176, lng: 72.9060, pet: true, pref: "any", status: "active", verified: true, views: 612, am: ["parking","lift","power_backup","water_supply","security","gym","swimming_pool","clubhouse","wifi","ac","modular_kitchen","balcony","cctv","intercom"], desc: "A spectacular top-floor penthouse overlooking Powai Lake. Floor-to-ceiling windows, private terrace, and full club amenities. Turn-key luxury for executives or families." },
  { o: "arjun", title: "Recently rented 1 BHK in Andheri", type: "apartment", bhk: 1, furn: "fully_furnished", rent: 39000, dep: 230000, loc: "Andheri West", city: "Mumbai", state: "Maharashtra", pin: "400053", lat: 19.1351, lng: 72.8266, pet: false, pref: "bachelor", status: "rented", verified: true, views: 356, am: ["lift","power_backup","water_supply","security","wifi","ac"], desc: "This well-loved 1 BHK in Andheri West found its tenant through TwoGets. Kept here as an example of a completed match." },
  // sneha (2)
  { o: "sneha", title: "Grand 4 BHK villa in Banjara Hills", type: "villa", bhk: 4, furn: "fully_furnished", rent: 120000, dep: 480000, loc: "Banjara Hills", city: "Hyderabad", state: "Telangana", pin: "500034", lat: 17.4156, lng: 78.4347, pet: true, pref: "family", status: "active", verified: true, views: 388, am: ["parking","power_backup","water_supply","security","gym","swimming_pool","wifi","ac","modular_kitchen","balcony","cctv","intercom"], desc: "An expansive four-bedroom villa in prestigious Banjara Hills. Private lawn, home office, and a chef's kitchen. Walking distance to the city's finest dining and boutiques." },
  { o: "sneha", title: "Bright 2 BHK in Gachibowli IT corridor", type: "apartment", bhk: 2, furn: "semi_furnished", rent: 28000, dep: 100000, loc: "Gachibowli", city: "Hyderabad", state: "Telangana", pin: "500032", lat: 17.4401, lng: 78.3489, pet: false, pref: "any", status: "active", verified: true, views: 219, am: ["parking","lift","power_backup","water_supply","security","gym","clubhouse","balcony"], desc: "Well-laid-out 2 BHK in a sought-after Gachibowli tower, surrounded by tech campuses. Semi-furnished with wardrobes; gym and clubhouse included. Quick access to ORR." },
  // ananya (1)
  { o: "ananya", title: "Charming 2 BHK row house in Koregaon Park", type: "row_house", bhk: 2, furn: "semi_furnished", rent: 36000, dep: 140000, loc: "Koregaon Park", city: "Pune", state: "Maharashtra", pin: "411001", lat: 18.5362, lng: 73.8939, pet: true, pref: "any", status: "active", verified: true, views: 203, am: ["parking","power_backup","water_supply","security","wifi","balcony","park"], desc: "A character-filled row house on a quiet Koregaon Park lane, surrounded by greenery and cafes. Private entrance and a little garden. Pets very welcome." },
  // vikram (1) — unverified owner, unverified listing
  { o: "vikram", title: "3 BHK with park view in Sector 54", type: "apartment", bhk: 3, furn: "semi_furnished", rent: 65000, dep: 200000, loc: "Sector 54", city: "Gurugram", state: "Haryana", pin: "122002", lat: 28.4334, lng: 77.1100, pet: false, pref: "family", status: "active", verified: false, views: 164, am: ["parking","lift","power_backup","water_supply","security","gym","swimming_pool","clubhouse","park"], desc: "Roomy 3 BHK overlooking a central green in Sector 54, on the rapid-metro line. Semi-furnished, in a well-managed condominium with pool, gym, and 24x7 security." },
  // farhan (1) — brand-new owner, draft only (empty-state testing)
  { o: "farhan", title: "Draft: 2 BHK in Adyar, Chennai", type: "apartment", bhk: 2, furn: "unfurnished", rent: 26000, dep: 100000, loc: "Adyar", city: "Chennai", state: "Tamil Nadu", pin: "600020", lat: 13.0067, lng: 80.2570, pet: false, pref: "any", status: "draft", verified: false, views: 0, am: ["water_supply","security"], desc: "Just started setting this up. Photos and full details coming soon." },
];

// ===========================================================================
// TENANTS — 30 across three completion tiers.
//   tier "full"    → every profile field set (100% completion)
//   tier "partial" → profile row with gaps (≈40-80%)
//   tier "new"     → NO tenant_profiles row at all (10%, fresh signup)
// ===========================================================================
const P = (o) => o; // readability helper
const TENANTS = [
  // ---------- TIER A: complete profiles (10) ----------
  { key: "demoT", email: `tenant${TEST_DOMAIN}`, name: "Demo Tenant", phone: "+91 90000 22000", avatar: "w9", verified: true, trust: 70, tier: "full", plan: "free",
    profile: P({ occupation: "Software Engineer", employer: "Google", income_range: "12l_24l", occupancy_type: "bachelor", has_pets: false, food_preference: "no_preference", preferred_locations: ["Indiranagar","Koramangala"], budget_min: 25000, budget_max: 50000, linkedin_url: "https://linkedin.com/in/demo-tenant", about: "Demo tenant account — looking for a comfortable 2 BHK in central Bengaluru." }) },
  { key: "karthik", email: `karthik.nair${TEST_DOMAIN}`, name: "Karthik Nair", phone: "+91 99860 22001", avatar: "m12", verified: true, trust: 85, tier: "full", plan: "plus",
    profile: P({ occupation: "Senior Software Engineer", employer: "Razorpay", income_range: "12l_24l", occupancy_type: "bachelor", has_pets: false, food_preference: "non_vegetarian", preferred_locations: ["Indiranagar","Koramangala","HSR Layout"], budget_min: 25000, budget_max: 45000, linkedin_url: "https://linkedin.com/in/karthiknair", about: "Relocating to Bengaluru for work. Quiet, tidy, and reliable with rent." }) },
  { key: "meera", email: `meera.joshi${TEST_DOMAIN}`, name: "Meera Joshi", phone: "+91 99860 22002", avatar: "w65", verified: true, trust: 82, tier: "full", plan: "free",
    profile: P({ occupation: "Product Designer", employer: "Swiggy", income_range: "6l_12l", occupancy_type: "family", has_pets: true, food_preference: "vegetarian", preferred_locations: ["Whitefield","Bellandur"], budget_min: 28000, budget_max: 40000, linkedin_url: "https://linkedin.com/in/meerajoshi", about: "Moving with my partner and a friendly labrador. Looking for a pet-friendly home." }) },
  { key: "aditya", email: `aditya.verma${TEST_DOMAIN}`, name: "Aditya Verma", phone: "+91 99300 22003", avatar: "m23", verified: true, trust: 78, tier: "full", plan: "plus",
    profile: P({ occupation: "Investment Analyst", employer: "HDFC Bank", income_range: "12l_24l", occupancy_type: "bachelor", has_pets: false, food_preference: "no_preference", preferred_locations: ["Bandra West","Powai"], budget_min: 40000, budget_max: 90000, linkedin_url: "https://linkedin.com/in/adityaverma", about: "Finance professional in Mumbai. Prefer fully-furnished places near work." }) },
  { key: "riya", email: `riya.kapoor${TEST_DOMAIN}`, name: "Riya Kapoor", phone: "+91 99100 22004", avatar: "w21", verified: true, trust: 80, tier: "full", plan: "free",
    profile: P({ occupation: "Marketing Manager", employer: "Zomato", income_range: "6l_12l", occupancy_type: "family", has_pets: false, food_preference: "eggetarian", preferred_locations: ["Sector 54","DLF Phase 3"], budget_min: 35000, budget_max: 70000, linkedin_url: "https://linkedin.com/in/riyakapoor", about: "Looking for a calm, well-connected home in Gurugram for my small family." }) },
  { key: "sanjay", email: `sanjay.rao${TEST_DOMAIN}`, name: "Dr. Sanjay Rao", phone: "+91 98490 22006", avatar: "m52", verified: true, trust: 90, tier: "full", plan: "plus",
    profile: P({ occupation: "Cardiologist", employer: "Apollo Hospitals", income_range: "above_24l", occupancy_type: "family", has_pets: false, food_preference: "vegetarian", preferred_locations: ["Banjara Hills","Jubilee Hills"], budget_min: 80000, budget_max: 150000, linkedin_url: "https://linkedin.com/in/drsanjayrao", about: "Consultant cardiologist relocating with family. Need space near the hospital." }) },
  { key: "neha", email: `neha.gupta${TEST_DOMAIN}`, name: "Neha Gupta", phone: "+91 99220 22007", avatar: "w28", verified: true, trust: 74, tier: "full", plan: "free",
    profile: P({ occupation: "Startup Founder", employer: "Fintech (stealth)", income_range: "12l_24l", occupancy_type: "bachelor", has_pets: true, food_preference: "vegetarian", preferred_locations: ["Koregaon Park","Baner"], budget_min: 30000, budget_max: 55000, linkedin_url: "https://linkedin.com/in/nehagupta", about: "Building a startup out of Pune. Work from home most days, so light matters." }) },
  { key: "vivek", email: `vivek.menon${TEST_DOMAIN}`, name: "Vivek Menon", phone: "+91 98451 22008", avatar: "m41", verified: true, trust: 87, tier: "full", plan: "plus",
    profile: P({ occupation: "Engineering Manager", employer: "Google", income_range: "above_24l", occupancy_type: "family", has_pets: true, food_preference: "non_vegetarian", preferred_locations: ["Jayanagar","JP Nagar","Koramangala"], budget_min: 60000, budget_max: 110000, linkedin_url: "https://linkedin.com/in/vivekmenon", about: "Family of four plus a beagle. Looking for a villa or large 3 BHK with a garden." }) },
  { key: "divya", email: `divya.krishnan${TEST_DOMAIN}`, name: "Divya Krishnan", phone: "+91 98400 22009", avatar: "w35", verified: true, trust: 76, tier: "full", plan: "free",
    profile: P({ occupation: "Corporate Lawyer", employer: "Trilegal", income_range: "12l_24l", occupancy_type: "bachelor", has_pets: false, food_preference: "vegetarian", preferred_locations: ["Adyar","Besant Nagar"], budget_min: 30000, budget_max: 55000, linkedin_url: "https://linkedin.com/in/divyakrishnan", about: "Lawyer moving to Chennai. Prefer quiet buildings with good security." }) },
  { key: "rahul", email: `rahul.bose${TEST_DOMAIN}`, name: "Rahul Bose", phone: "+91 98201 22010", avatar: "m88", verified: true, trust: 79, tier: "full", plan: "free",
    profile: P({ occupation: "Sales Director", employer: "Salesforce", income_range: "above_24l", occupancy_type: "family", has_pets: true, food_preference: "non_vegetarian", preferred_locations: ["Powai","Andheri East"], budget_min: 70000, budget_max: 160000, linkedin_url: "https://linkedin.com/in/rahulbose", about: "Travel a lot for work. Need a secure, serviced building with parking for two cars." }) },

  // ---------- TIER B: partial profiles (12) ----------
  { key: "rohan", email: `rohan.das${TEST_DOMAIN}`, name: "Rohan Das", phone: "+91 90040 22005", avatar: "m75", verified: false, trust: 42, tier: "partial", plan: "free",
    profile: P({ occupation: "UX Researcher", employer: "Microsoft", income_range: "6l_12l", occupancy_type: "bachelor", has_pets: false, food_preference: "non_vegetarian", preferred_locations: ["Gachibowli","Madhapur"], budget_min: 15000, budget_max: 30000, linkedin_url: null, about: null }) },
  { key: "ananyaP", email: `ananya.pillai${TEST_DOMAIN}`, name: "Ananya Pillai", phone: "+91 94440 22011", avatar: "w12", verified: false, trust: 38, tier: "partial", plan: "free",
    profile: P({ occupation: "School Teacher", employer: null, income_range: "3l_6l", occupancy_type: "family", has_pets: false, food_preference: "vegetarian", preferred_locations: ["Jayanagar"], budget_min: 15000, budget_max: 25000, linkedin_url: null, about: "Looking for something close to my school." }) },
  { key: "sidd", email: `siddharth.jain${TEST_DOMAIN}`, name: "Siddharth Jain", phone: "+91 98110 22012", avatar: "m14", verified: true, trust: 55, tier: "partial", plan: "free",
    profile: P({ occupation: "Management Consultant", employer: "McKinsey", income_range: "above_24l", occupancy_type: "bachelor", has_pets: false, food_preference: "vegetarian", preferred_locations: ["DLF Phase 3","Sector 54"], budget_min: null, budget_max: null, linkedin_url: "https://linkedin.com/in/siddharthjain", about: null }) },
  { key: "tara", email: `tara.malhotra${TEST_DOMAIN}`, name: "Tara Malhotra", phone: "+91 99990 22013", avatar: "w48", verified: false, trust: 30, tier: "partial", plan: "free",
    profile: P({ occupation: "Content Creator", employer: null, income_range: null, occupancy_type: "bachelor", has_pets: true, food_preference: "eggetarian", preferred_locations: ["Bandra West"], budget_min: 25000, budget_max: 60000, linkedin_url: null, about: "Cat parent. Need a place that's genuinely pet-friendly." }) },
  { key: "arun", email: `arun.kumar${TEST_DOMAIN}`, name: "Arun Kumar", phone: "+91 90030 22014", avatar: "m63", verified: false, trust: 34, tier: "partial", plan: "free",
    profile: P({ occupation: "Civil Engineer", employer: "L&T", income_range: "6l_12l", occupancy_type: "family", has_pets: false, food_preference: "non_vegetarian", preferred_locations: ["Whitefield"], budget_min: 20000, budget_max: 32000, linkedin_url: null, about: null, noMoveIn: true }) },
  { key: "pooja", email: `pooja.shetty${TEST_DOMAIN}`, name: "Pooja Shetty", phone: "+91 98860 22015", avatar: "w56", verified: true, trust: 61, tier: "partial", plan: "free",
    profile: P({ occupation: "HR Manager", employer: "Infosys", income_range: "6l_12l", occupancy_type: "family", has_pets: false, food_preference: "vegetarian", preferred_locations: ["Hinjewadi","Baner"], budget_min: 22000, budget_max: 38000, linkedin_url: null, about: "Relocating from Bengaluru to Pune with my husband." }) },
  { key: "nikhil", email: `nikhil.agarwal${TEST_DOMAIN}`, name: "Nikhil Agarwal", phone: "+91 98310 22016", avatar: "m71", verified: false, trust: 26, tier: "partial", plan: "free",
    profile: P({ occupation: "Chef", employer: null, income_range: "3l_6l", occupancy_type: "bachelor", has_pets: false, food_preference: "non_vegetarian", preferred_locations: ["Koregaon Park"], budget_min: 12000, budget_max: 22000, linkedin_url: null, about: null }) },
  { key: "kavya", email: `kavya.reddy${TEST_DOMAIN}`, name: "Kavya Reddy", phone: null, avatar: "w73", verified: false, trust: 22, tier: "partial", plan: "free",
    profile: P({ occupation: "Staff Nurse", employer: null, income_range: null, occupancy_type: "bachelor", has_pets: false, food_preference: "no_preference", preferred_locations: ["Madhapur"], budget_min: null, budget_max: null, linkedin_url: null, about: null, noMoveIn: true }) },
  { key: "manish", email: `manish.tiwari${TEST_DOMAIN}`, name: "Manish Tiwari", phone: "+91 97170 22017", avatar: "m29", verified: true, trust: 58, tier: "partial", plan: "free",
    profile: P({ occupation: "Bank Officer", employer: "SBI", income_range: "6l_12l", occupancy_type: "family", has_pets: false, food_preference: "vegetarian", preferred_locations: ["Sector 54"], budget_min: 25000, budget_max: 45000, linkedin_url: null, about: null }) },
  { key: "sara", email: `sara.thomas${TEST_DOMAIN}`, name: "Sara Thomas", phone: "+91 98950 22018", avatar: "w62", verified: false, trust: 36, tier: "partial", plan: "free",
    profile: P({ occupation: "Architect", employer: null, income_range: "6l_12l", occupancy_type: "bachelor", has_pets: false, food_preference: "no_preference", preferred_locations: ["Indiranagar","HSR Layout"], budget_min: 25000, budget_max: 42000, linkedin_url: "https://linkedin.com/in/sarathomas", about: null }) },
  { key: "gaurav", email: `gaurav.chauhan${TEST_DOMAIN}`, name: "Gaurav Chauhan", phone: "+91 98730 22019", avatar: "m37", verified: false, trust: 24, tier: "partial", plan: "free",
    profile: P({ occupation: "Fitness Trainer", employer: null, income_range: "3l_6l", occupancy_type: "bachelor", has_pets: false, food_preference: "non_vegetarian", preferred_locations: ["Andheri East"], budget_min: null, budget_max: 30000, linkedin_url: null, about: null, noMoveIn: true }) },
  { key: "lakshmi", email: `lakshmi.iyer${TEST_DOMAIN}`, name: "Lakshmi Iyer", phone: "+91 94450 22020", avatar: "w79", verified: true, trust: 63, tier: "partial", plan: "free",
    profile: P({ occupation: "Retired Teacher", employer: null, income_range: "below_3l", occupancy_type: "family", has_pets: false, food_preference: "vegetarian", preferred_locations: ["Adyar","Besant Nagar"], budget_min: 15000, budget_max: 28000, linkedin_url: null, about: "Retired and looking for a quiet ground-floor home near my daughter." }) },

  // ---------- TIER C: brand-new signups, no profile row (8) ----------
  { key: "amit", email: `amit.sharma${TEST_DOMAIN}`, name: "Amit Sharma", phone: "+91 99710 22021", avatar: "m19", verified: false, trust: 20, tier: "new", plan: "free" },
  { key: "priyanka", email: `priyanka.roy${TEST_DOMAIN}`, name: "Priyanka Roy", phone: null, avatar: "w40", verified: false, trust: 20, tier: "new", plan: "free" },
  { key: "faizan", email: `faizan.ahmed${TEST_DOMAIN}`, name: "Faizan Ahmed", phone: "+91 98670 22022", avatar: null, verified: false, trust: 20, tier: "new", plan: "free" },
  { key: "snehaK", email: `sneha.kulkarni${TEST_DOMAIN}`, name: "Sneha Kulkarni", phone: null, avatar: "w83", verified: false, trust: 20, tier: "new", plan: "free" },
  { key: "varun", email: `varun.nair${TEST_DOMAIN}`, name: "Varun Nair", phone: "+91 90350 22023", avatar: "m55", verified: false, trust: 20, tier: "new", plan: "free" },
  { key: "ritu", email: `ritu.singh${TEST_DOMAIN}`, name: "Ritu Singh", phone: null, avatar: null, verified: false, trust: 20, tier: "new", plan: "free" },
  { key: "deepak", email: `deepak.yadav${TEST_DOMAIN}`, name: "Deepak Yadav", phone: "+91 97180 22024", avatar: "m94", verified: false, trust: 20, tier: "new", plan: "free" },
  { key: "anjali", email: `anjali.desai${TEST_DOMAIN}`, name: "Anjali Desai", phone: null, avatar: "w17", verified: false, trust: 20, tier: "new", plan: "free" },
];

// ---- helpers ---------------------------------------------------------------
async function listAllAuthUsers() {
  const all = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const list = data.users || [];
    all.push(...list);
    if (list.length < 1000) break;
  }
  return all;
}

async function createAuthUser(email, name, role) {
  const { data, error } = await db.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: name, role },
  });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  return data.user.id;
}

async function uploadAvatar(userId, key) {
  const p = `${userId}/avatar.jpg`;
  const { error } = await db.storage.from("avatars").upload(p, avatarBuffer(key), {
    contentType: "image/jpeg", upsert: true,
  });
  if (error) throw new Error(`avatar ${key}: ${error.message}`);
  return p;
}

async function uploadPropertyPhoto(ownerId, propId, idx, photoId) {
  const p = `${ownerId}/${propId}-${idx}.jpg`;
  const { error } = await db.storage.from("property-media").upload(p, photoBuffer(photoId), {
    contentType: "image/jpeg", upsert: true,
  });
  if (error) throw new Error(`photo ${photoId}: ${error.message}`);
  return p;
}

// ---- main ------------------------------------------------------------------
async function main() {
  const avatarKeys = [...OWNERS, ...TENANTS].map((p) => p.avatar).filter(Boolean);
  await ensureAssets(avatarKeys);

  console.log("→ Loading amenity lookup");
  const { data: amenities, error: amErr } = await db.from("amenities").select("id, slug");
  if (amErr) throw amErr;
  const amenityId = Object.fromEntries(amenities.map((a) => [a.slug, a.id]));

  // ---- WIPE: delete every @demo.twogets.in auth user (cascades everything) --
  console.log(`→ Wiping previously seeded accounts (${TEST_DOMAIN})`);
  const existing = await listAllAuthUsers();
  const doomed = existing.filter((u) => (u.email || "").endsWith(TEST_DOMAIN));
  for (const u of doomed) {
    const { error } = await db.auth.admin.deleteUser(u.id);
    if (error) throw new Error(`deleteUser ${u.email}: ${error.message}`);
  }
  console.log(`  ✓ removed ${doomed.length} accounts (and all their data)`);
  const preserved = existing.filter((u) => !(u.email || "").endsWith(TEST_DOMAIN));
  console.log(`  ✓ preserved ${preserved.length} non-test account(s): ${preserved.map((u) => u.email).join(", ") || "none"}`);

  // ---- accounts ------------------------------------------------------------
  console.log("→ Creating 8 homeowners");
  const ownerId = {};
  for (const o of OWNERS) ownerId[o.key] = await createAuthUser(o.email, o.name, "homeowner");

  console.log("→ Creating 30 tenants");
  const tenantId = {};
  for (const t of TENANTS) tenantId[t.key] = await createAuthUser(t.email, t.name, "tenant");

  // ---- owner profiles ------------------------------------------------------
  console.log("→ Writing owner profiles");
  for (const o of OWNERS) {
    const avatarPath = o.avatar ? await uploadAvatar(ownerId[o.key], o.avatar) : null;
    await db.from("users").update({
      role: "homeowner", full_name: o.name, phone: o.phone, avatar_url: avatarPath,
      is_verified: o.verified, trust_score: o.trust,
    }).eq("id", ownerId[o.key]);
    // "new" stage owners deliberately have no homeowner_profiles row.
    if (o.stage !== "new") {
      const { error } = await db.from("homeowner_profiles").upsert({
        user_id: ownerId[o.key], about: o.about, city: o.city, linkedin_url: o.linkedin,
      }, { onConflict: "user_id" });
      if (error) throw new Error(`homeowner_profile ${o.key}: ${error.message}`);
    }
  }

  // ---- tenant profiles -----------------------------------------------------
  console.log("→ Writing tenant profiles (3 completion tiers)");
  for (const t of TENANTS) {
    const avatarPath = t.avatar ? await uploadAvatar(tenantId[t.key], t.avatar) : null;
    await db.from("users").update({
      role: "tenant", full_name: t.name, phone: t.phone, avatar_url: avatarPath,
      is_verified: t.verified, trust_score: t.trust, plan: t.plan,
    }).eq("id", tenantId[t.key]);
    if (t.tier === "new") continue; // no profile row at all → 10% completion
    const { noMoveIn, ...profile } = t.profile;
    const { error } = await db.from("tenant_profiles").upsert({
      user_id: tenantId[t.key], ...profile,
      move_in_date: noMoveIn ? null : isoDate(rid([10, 20, 30, 45, 60])),
    }, { onConflict: "user_id" });
    if (error) throw new Error(`tenant_profile ${t.key}: ${error.message}`);
  }

  // ---- properties ----------------------------------------------------------
  console.log("→ Inserting 13 properties + images + amenities");
  const propIds = [];
  for (let i = 0; i < PROPS.length; i++) {
    const p = PROPS[i];
    const owner = ownerId[p.o];
    const createdAt = isoTimestamp(2 + i * 3);
    const { data: inserted, error: pErr } = await db.from("properties").insert({
      owner_id: owner, title: p.title, description: p.desc, property_type: p.type, bhk: p.bhk,
      furnished_status: p.furn, address_line: `${p.loc}, ${p.city}`, locality: p.loc, city: p.city,
      state: p.state, pincode: p.pin, latitude: p.lat, longitude: p.lng, rent: p.rent, deposit: p.dep,
      available_from: isoDate(rid([3, 7, 10, 14, 20])), pet_friendly: p.pet, preferred_tenants: p.pref,
      status: p.status, is_verified: p.verified, view_count: p.views, created_at: createdAt, updated_at: createdAt,
    }).select("id").single();
    if (pErr) throw new Error(`property "${p.title}": ${pErr.message}`);
    const pid = inserted.id;
    propIds.push(pid);

    const photoIds = nextPhotos(p.bhk >= 3 ? 4 : 3);
    const imageRows = [];
    for (let j = 0; j < photoIds.length; j++) {
      const storagePath = await uploadPropertyPhoto(owner, pid, j, photoIds[j]);
      imageRows.push({ property_id: pid, storage_path: storagePath, alt_text: p.title, sort_order: j, is_cover: j === 0 });
    }
    await db.from("property_images").insert(imageRows);
    const amRows = p.am.map((slug) => ({ property_id: pid, amenity_id: amenityId[slug] })).filter((r) => r.amenity_id);
    if (amRows.length) await db.from("property_amenities").insert(amRows);
    process.stdout.write(`  ✓ ${i + 1}/${PROPS.length} ${p.title}\n`);
  }

  const activeIdx = PROPS.map((p, i) => (p.status === "active" ? i : -1)).filter((i) => i >= 0);
  const propOwner = (pi) => ownerId[PROPS[pi].o];
  const tid = (k) => tenantId[k];
  const slotISO = (daysFromNow, hhmm) => new Date(`${isoDate(daysFromNow)}T${hhmm}:00+05:30`).toISOString();

  async function addSlot({ pi, start, end, capacity = null, source = "manual", status = "open" }) {
    const { data, error } = await db.from("viewing_slots")
      .insert({ listing_id: propIds[pi], owner_id: propOwner(pi), starts_at: start, ends_at: end, capacity, source, status })
      .select("id").single();
    if (error) throw new Error(`slot p${pi}: ${error.message}`);
    return data.id;
  }
  async function addBooking({ slotId, pi, tenantKey, status = "confirmed", party = 1, note = null }) {
    const { data, error } = await db.from("viewing_bookings")
      .insert({ slot_id: slotId, listing_id: propIds[pi], tenant_id: tid(tenantKey), status, party_size: party, note })
      .select("id").single();
    if (error) throw new Error(`booking p${pi}/${tenantKey}: ${error.message}`);
    return data.id;
  }

  // ---- recurring availability ---------------------------------------------
  // Rule windows (11:00-13:00, 10:00-12:00, 16:00-18:00) deliberately avoid the
  // one-off slot times below, so generated slots can't collide on the
  // unique(listing_id, starts_at, ends_at) constraint.
  console.log("→ Publishing recurring availability rules");
  const RULES = [
    { pi: 2, days: [6, 0], start: "11:00", end: "13:00", dur: 30, cap: 4 },
    { pi: 6, days: [6], start: "10:00", end: "12:00", dur: 30, cap: 5 },
    { pi: 8, days: [0], start: "16:00", end: "18:00", dur: null, cap: 8 },
  ];
  for (const rule of RULES) {
    for (const dow of rule.days) {
      const { data: r, error } = await db.from("viewing_availability_rules").insert({
        listing_id: propIds[rule.pi], owner_id: propOwner(rule.pi), day_of_week: dow,
        start_time: rule.start, end_time: rule.end, slot_duration_min: rule.dur, capacity: rule.cap,
      }).select("id").single();
      if (error) throw new Error(`rule p${rule.pi}: ${error.message}`);
      const { error: gErr } = await db.rpc("generate_slots_for_rule", { p_rule_id: r.id });
      if (gErr) throw new Error(`generate p${rule.pi}: ${gErr.message}`);
    }
  }

  // ---- one-off future slots on every active listing ------------------------
  console.log("→ Publishing one-off future slots");
  const futureSlot = {};
  for (const pi of activeIdx) {
    futureSlot[pi] = [
      await addSlot({ pi, start: slotISO(2, "09:15"), end: slotISO(2, "09:45"), capacity: 3 }),
      await addSlot({ pi, start: slotISO(4, "14:30"), end: slotISO(4, "15:15"), capacity: 2 }),
      await addSlot({ pi, start: slotISO(6, "19:00"), end: slotISO(6, "20:00"), capacity: null }),
      await addSlot({ pi, start: slotISO(9, "18:00"), end: slotISO(9, "18:30"), capacity: 1 }),
    ];
  }

  // ---- upcoming bookings (incl. deliberately FULL slots) -------------------
  console.log("→ Booking upcoming viewings");
  const UPCOMING = [
    // p0 Jayanagar villa — slot 1 (cap 2) filled to capacity → "Full" state
    { pi: 0, s: 1, t: "vivek" }, { pi: 0, s: 1, t: "sanjay" },
    { pi: 0, s: 0, t: "demoT" }, { pi: 0, s: 2, t: "meera" },
    // p2 Indiranagar
    { pi: 2, s: 0, t: "karthik" }, { pi: 2, s: 0, t: "sara" }, { pi: 2, s: 2, t: "demoT" },
    // p3 Koramangala 3BHK — slot 3 (cap 1) full
    { pi: 3, s: 3, t: "vivek" }, { pi: 3, s: 0, t: "pooja" },
    // p4 HSR studio
    { pi: 4, s: 0, t: "karthik" }, { pi: 4, s: 1, t: "gaurav" },
    // p6 Powai penthouse
    { pi: 6, s: 0, t: "rahul" }, { pi: 6, s: 1, t: "aditya" }, { pi: 6, s: 1, t: "tara" },
    // p8 Banjara villa
    { pi: 8, s: 0, t: "sanjay" }, { pi: 8, s: 2, t: "kavya" },
    // p9 Gachibowli
    { pi: 9, s: 0, t: "rohan" }, { pi: 9, s: 2, t: "kavya" }, { pi: 9, s: 1, t: "manish" },
    // p10 Koregaon Park
    { pi: 10, s: 0, t: "neha" }, { pi: 10, s: 1, t: "nikhil" }, { pi: 10, s: 2, t: "pooja" },
    // p11 Gurugram
    { pi: 11, s: 0, t: "riya" }, { pi: 11, s: 1, t: "sidd" }, { pi: 11, s: 2, t: "manish" },
    // p1 Bellandur
    { pi: 1, s: 0, t: "arun" }, { pi: 1, s: 2, t: "amit" },
  ];
  for (const b of UPCOMING) await addBooking({ slotId: futureSlot[b.pi][b.s], pi: b.pi, tenantKey: b.t });

  // A couple of cancelled bookings so that status badge is exercised too.
  await addBooking({ slotId: futureSlot[2][1], pi: 2, tenantKey: "lakshmi", status: "cancelled" });
  await addBooking({ slotId: futureSlot[9][1], pi: 9, tenantKey: "divya", status: "cancelled" });

  // ---- past viewings → reviews --------------------------------------------
  console.log("→ Building viewing history + two-way reviews");
  // Unique past-slot time per listing keeps the unique(listing, start, end) index happy.
  const pastSeq = {};
  const bookingByPair = {};
  async function ensureAttendedBooking(pi, tenantKey, daysAgo, status = "attended") {
    const key = `${pi}:${tenantKey}`;
    if (bookingByPair[key]) return bookingByPair[key];
    const n = (pastSeq[pi] = (pastSeq[pi] ?? 0) + 1);
    const mins = 9 * 60 + n * 37; // 09:37, 10:14, 10:51 … unique within the listing
    const hhmm = `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
    const endMins = mins + 30;
    const endHHMM = `${String(Math.floor(endMins / 60)).padStart(2, "0")}:${String(endMins % 60).padStart(2, "0")}`;
    const slotId = await addSlot({ pi, start: slotISO(-daysAgo, hhmm), end: slotISO(-daysAgo, endHHMM), capacity: 4 });
    const bookingId = await addBooking({ slotId, pi, tenantKey, status });
    bookingByPair[key] = bookingId;
    return bookingId;
  }

  // Tenant → owner reviews
  const OWNER_REVIEWS = [
    { t: "karthik", p: 2, comm: 5, dep: 5, acc: 5, days: 40, c: "Rajesh was incredibly responsive and the flat was exactly as pictured. Smooth move-in, deposit terms were fair." },
    { t: "meera", p: 2, comm: 4, dep: 5, acc: 4, days: 22, c: "Lovely apartment and a very reasonable landlord. Minor delay getting the second key, otherwise perfect." },
    { t: "demoT", p: 0, comm: 5, dep: 5, acc: 5, days: 30, c: "The villa is stunning and the owner handled everything professionally. Highly recommend." },
    { t: "vivek", p: 0, comm: 5, dep: 4, acc: 5, days: 16, c: "Great space for a family, and the garden sold it for us. Owner was flexible on the move-in date." },
    { t: "riya", p: 6, comm: 5, dep: 4, acc: 5, days: 18, c: "Penthouse views are unreal. Arjun is transparent and easy to deal with. Deposit was on the higher side but justified." },
    { t: "aditya", p: 6, comm: 5, dep: 5, acc: 5, days: 12, c: "Best rental experience I've had in Mumbai. No broker, no nonsense, exactly as advertised." },
    { t: "rahul", p: 6, comm: 4, dep: 4, acc: 5, days: 7, c: "Excellent building and security. Paperwork took a couple of days longer than I expected." },
    { t: "rohan", p: 9, comm: 4, dep: 4, acc: 4, days: 27, c: "Good value 2 BHK near work. Sneha was helpful throughout the process." },
    { t: "sanjay", p: 8, comm: 5, dep: 5, acc: 5, days: 9, c: "The Banjara Hills villa exceeded expectations. Spotless, spacious, and the owner is a gem." },
    { t: "neha", p: 10, comm: 5, dep: 5, acc: 5, days: 15, c: "Koregaon Park row house is full of charm and totally pet-friendly. Ananya is wonderful." },
    { t: "pooja", p: 10, comm: 4, dep: 5, acc: 4, days: 11, c: "Quiet lane, lovely little garden. Would have liked a second parking spot." },
    { t: "karthik", p: 4, comm: 4, dep: 4, acc: 5, days: 35, c: "Great little studio, fully loaded. Perfect for a solo professional in HSR." },
    { t: "sidd", p: 11, comm: 3, dep: 3, acc: 4, days: 20, c: "Decent flat and a good location, but it took a while to get responses from the owner." },
    { t: "manish", p: 11, comm: 4, dep: 4, acc: 4, days: 13, c: "Park view is genuinely nice. Society maintenance is well handled." },
    { t: "aditya", p: 3, comm: 5, dep: 5, acc: 4, days: 25, c: "Spacious 3 BHK, great community. Rajesh made the whole thing painless." },
    { t: "divya", p: 4, comm: 4, dep: 4, acc: 4, days: 31, c: "Compact but very well maintained. Suited my needs while I was between homes." },
    { t: "gaurav", p: 1, comm: 3, dep: 4, acc: 3, days: 19, c: "Unfurnished as described, though a few fittings needed fixing before move-in." },
    { t: "tara", p: 6, comm: 5, dep: 4, acc: 5, days: 5, c: "Genuinely pet-friendly, which is rare in this part of town. Thank you!" },
  ];
  // Owner → tenant reviews (reuse the same attended booking)
  const TENANT_REVIEWS = [
    { p: 2, t: "karthik", comm: 5, rel: 5, care: 5, days: 39, c: "Karthik is the ideal tenant — punctual with rent and takes great care of the place." },
    { p: 0, t: "demoT", comm: 5, rel: 5, care: 4, days: 29, c: "Respectful and communicative. Would happily rent to again." },
    { p: 0, t: "vivek", comm: 5, rel: 5, care: 5, days: 15, c: "Wonderful family, looked after the garden beautifully." },
    { p: 6, t: "riya", comm: 4, rel: 5, care: 5, days: 17, c: "Riya kept the penthouse immaculate and was always easy to reach." },
    { p: 10, t: "neha", comm: 5, rel: 5, care: 5, days: 14, c: "Neha and her cat were perfect residents. Spotless handover." },
    { p: 8, t: "sanjay", comm: 5, rel: 5, care: 5, days: 8, c: "A pleasure to host. Everything handled professionally." },
    { p: 11, t: "sidd", comm: 3, rel: 4, care: 4, days: 19, c: "Fine tenant overall, though communication could have been quicker." },
    { p: 9, t: "rohan", comm: 4, rel: 4, care: 4, days: 26, c: "Looked after the flat well. No complaints." },
  ];

  for (const r of OWNER_REVIEWS) {
    const bookingId = await ensureAttendedBooking(r.p, r.t, r.days);
    const overall = Number(((r.comm + r.dep + r.acc) / 3).toFixed(2));
    const { error } = await db.from("reviews").insert({
      review_type: "owner_review", booking_id: bookingId, property_id: propIds[r.p],
      reviewer_id: tid(r.t), reviewee_id: propOwner(r.p), rating_communication: r.comm,
      rating_deposit_fairness: r.dep, rating_property_accuracy: r.acc, overall_rating: overall,
      comment: r.c, created_at: isoTimestamp(r.days),
    });
    if (error) throw new Error(`owner_review p${r.p}/${r.t}: ${error.message}`);
  }
  for (const r of TENANT_REVIEWS) {
    const bookingId = await ensureAttendedBooking(r.p, r.t, r.days);
    const overall = Number(((r.comm + r.rel + r.care) / 3).toFixed(2));
    const { error } = await db.from("reviews").insert({
      review_type: "tenant_review", booking_id: bookingId, property_id: null,
      reviewer_id: propOwner(r.p), reviewee_id: tid(r.t), rating_communication: r.comm,
      rating_reliability: r.rel, rating_property_care: r.care, overall_rating: overall,
      comment: r.c, created_at: isoTimestamp(r.days),
    });
    if (error) throw new Error(`tenant_review p${r.p}/${r.t}: ${error.message}`);
  }

  // Attended-but-unreviewed + no-shows, so owners have pending review actions.
  console.log("→ Adding attended-unreviewed and no-show bookings");
  await ensureAttendedBooking(3, "pooja", 6);
  await ensureAttendedBooking(9, "manish", 4);
  await ensureAttendedBooking(2, "sara", 3);
  await ensureAttendedBooking(4, "nikhil", 10, "no_show");
  await ensureAttendedBooking(11, "arun", 8, "no_show");

  // ---- shortlists + swipe demand ------------------------------------------
  console.log("→ Seeding shortlists and swipe demand");
  const SHORTLISTS = {
    demoT: [0, 2, 4, 6, 8], karthik: [2, 4, 3, 0], meera: [2, 10, 0], aditya: [6, 7, 3],
    riya: [11, 6], sanjay: [8, 0], neha: [10, 4], vivek: [0, 3, 8], divya: [4, 10],
    rahul: [6, 8], rohan: [9, 4], sidd: [11, 6], tara: [6, 10], pooja: [10, 9],
    manish: [11, 9], sara: [2, 4], lakshmi: [10], amit: [0, 2], varun: [4], deepak: [9],
  };
  const saveRows = [];
  for (const [k, list] of Object.entries(SHORTLISTS)) {
    for (const pi of list) saveRows.push({ tenant_id: tid(k), property_id: propIds[pi] });
  }
  const { error: saveErr } = await db.from("saved_properties").upsert(saveRows, { onConflict: "tenant_id,property_id" });
  if (saveErr) throw new Error(`saved_properties: ${saveErr.message}`);

  const { error: swipeProbe } = await db.from("swipes").select("id").limit(1);
  if (swipeProbe) {
    console.log("  ! swipes table missing — skipping (apply migration 00005)");
  } else {
    const swipeRows = [];
    let d = 1;
    // Right swipes mirror the shortlists above (that's how the app creates them).
    for (const [k, list] of Object.entries(SHORTLISTS)) {
      for (const pi of list) {
        swipeRows.push({ tenant_id: tid(k), property_id: propIds[pi], direction: "right", swiped_at: isoTimestamp((d++ % 21) + 1) });
      }
    }
    // Left swipes so decks have history and "already seen" exclusion is exercised.
    const LEFTS = {
      karthik: [11, 9], meera: [6, 11], aditya: [4, 10], riya: [1, 4], rohan: [0, 6],
      sidd: [1, 10], tara: [9, 11], pooja: [0, 6], manish: [4, 10], sara: [11, 8],
      neha: [1, 11], vivek: [4, 9], amit: [6], varun: [0], deepak: [2],
    };
    for (const [k, list] of Object.entries(LEFTS)) {
      for (const pi of list) {
        swipeRows.push({ tenant_id: tid(k), property_id: propIds[pi], direction: "left", swiped_at: isoTimestamp((d++ % 21) + 1) });
      }
    }
    const { error: sErr } = await db.from("swipes").upsert(swipeRows, { onConflict: "tenant_id,property_id" });
    if (sErr) throw new Error(`swipes: ${sErr.message}`);
  }

  // ---- summary -------------------------------------------------------------
  console.log("\n========== STRESS SEED COMPLETE ==========");
  const counts = {};
  for (const tbl of ["users", "properties", "property_images", "tenant_profiles", "homeowner_profiles",
                     "viewing_slots", "viewing_bookings", "reviews", "saved_properties", "swipes"]) {
    const { count, error } = await db.from(tbl).select("*", { count: "exact", head: true });
    counts[tbl] = error ? "n/a" : count;
  }
  console.table(counts);
  const tiers = TENANTS.reduce((acc, t) => ({ ...acc, [t.tier]: (acc[t.tier] || 0) + 1 }), {});
  console.log(`Owners: ${OWNERS.length}   Tenants: ${TENANTS.length}   Listings: ${PROPS.length} (${activeIdx.length} active)`);
  console.log(`Tenant profile tiers:`, tiers);
  console.log(`\nAll test accounts use password: ${PASSWORD}`);
  console.log(`Every seeded account lives on ${TEST_DOMAIN} — delete them all with:`);
  console.log(`  delete from auth.users where email like '%${TEST_DOMAIN}';`);
}

main().then(() => { console.log("Done."); process.exit(0); })
  .catch((e) => { console.error("\nSEED FAILED:", e.message); console.error(e); process.exit(1); });
