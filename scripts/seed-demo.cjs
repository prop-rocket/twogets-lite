/* eslint-disable */
/**
 * TwoGets — demo data seeder (HTTPS-only; runs against the live Supabase project
 * using the service-role key). Safe to re-run: it removes previously seeded
 * owners' properties (cascades) and re-uploads media with upsert.
 *
 *   node scripts/seed-demo.cjs
 *
 * Requires /tmp/seedpics to contain the downloaded photos (<id>.img) and avatars.
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

const PIC_DIR = "/tmp/seedpics";
const AV_DIR = path.join(PIC_DIR, "av");

// Ordered list of downloaded Unsplash photo ids (files at /tmp/seedpics/<id>.img)
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
// Avatar files (randomuser.me) used for owner/tenant profile pictures.
const AVATARS = [
  "m32.jpg","w33.jpg","m45.jpg","w44.jpg","m67.jpg","w58.jpg",
  "m75.jpg","w65.jpg","m12.jpg","w9.jpg","m23.jpg",
];

/** Download every photo/avatar that isn't already on disk (fresh containers). */
async function ensureAssets() {
  fs.mkdirSync(AV_DIR, { recursive: true });
  const jobs = [];
  for (const id of PHOTOS) {
    const dest = path.join(PIC_DIR, `${id}.img`);
    if (!fs.existsSync(dest) || fs.statSync(dest).size < 2000) {
      jobs.push({ url: `https://images.unsplash.com/photo-${id}?w=1280&q=70&fit=crop`, dest });
    }
  }
  for (const f of AVATARS) {
    const dest = path.join(AV_DIR, f);
    if (!fs.existsSync(dest) || fs.statSync(dest).size < 1000) {
      const [, sex, n] = f.match(/^([mw])(\d+)\.jpg$/);
      const dir = sex === "m" ? "men" : "women";
      jobs.push({ url: `https://randomuser.me/api/portraits/${dir}/${n}.jpg`, dest });
    }
  }
  if (!jobs.length) return;
  console.log(`→ Downloading ${jobs.length} missing image assets`);
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
function photoBuffer(id) {
  return fs.readFileSync(path.join(PIC_DIR, `${id}.img`));
}
function avatarBuffer(file) {
  return fs.readFileSync(path.join(AV_DIR, file));
}

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

// ---- people ----------------------------------------------------------------
const PASSWORD = "Demo@1234";

// Homeowners (the demo homeowner already exists; we look it up by email).
const OWNERS = [
  { key: "rajesh", email: "rajesh.kumar@demo.twogets.in", name: "Rajesh Kumar", phone: "+91 98450 11001", avatar: "m32.jpg", verified: true, city: "Bengaluru", about: "Second-generation landlord in Bengaluru. I keep my flats spotless and respond within the hour." },
  { key: "priya", email: "priya.sharma@demo.twogets.in", name: "Priya Sharma", phone: "+91 98450 11002", avatar: "w33.jpg", verified: true, city: "Bengaluru", about: "I rent out two family-owned apartments and prefer long-term, respectful tenants." },
  { key: "arjun", email: "arjun.mehta@demo.twogets.in", name: "Arjun Mehta", phone: "+91 98200 11003", avatar: "m45.jpg", verified: true, city: "Mumbai", about: "Mumbai-based property manager. All my listings are broker-free and move-in ready." },
  { key: "sneha", email: "sneha.reddy@demo.twogets.in", name: "Sneha Reddy", phone: "+91 90000 11004", avatar: "w44.jpg", verified: true, city: "Hyderabad", about: "I manage premium homes across Hyderabad's IT corridor. Transparency first." },
  { key: "vikram", email: "vikram.singh@demo.twogets.in", name: "Vikram Singh", phone: "+91 98100 11005", avatar: "m67.jpg", verified: false, city: "Gurugram", about: "New to TwoGets — listing my two Gurugram flats directly, no middlemen." },
  { key: "ananya", email: "ananya.iyer@demo.twogets.in", name: "Ananya Iyer", phone: "+91 99000 11006", avatar: "w58.jpg", verified: true, city: "Pune", about: "Pune homeowner. I love matching my homes with tenants who'll treat them well." },
];

// The pre-existing demo homeowner gets listings too.
const DEMO_OWNER_EMAIL = "owner@demo.twogets.in";

const TENANTS = [
  { key: "karthik", email: "karthik.nair@demo.twogets.in", name: "Karthik Nair", phone: "+91 99860 22001", avatar: "m75.jpg", verified: true,
    profile: { occupation: "Senior Software Engineer", employer: "Razorpay", income_range: "12l_24l", occupancy_type: "bachelor", has_pets: false, food_preference: "non_vegetarian", preferred_locations: ["Indiranagar", "Koramangala", "HSR Layout"], budget_min: 25000, budget_max: 45000, about: "Relocating to Bengaluru for work. Quiet, tidy, and reliable with rent." } },
  { key: "meera", email: "meera.joshi@demo.twogets.in", name: "Meera Joshi", phone: "+91 99860 22002", avatar: "w65.jpg", verified: true,
    profile: { occupation: "Product Designer", employer: "Swiggy", income_range: "6l_12l", occupancy_type: "family", has_pets: true, food_preference: "vegetarian", preferred_locations: ["Whitefield", "Bellandur"], budget_min: 28000, budget_max: 40000, about: "Moving with my partner and a friendly labrador. Looking for a pet-friendly home." } },
  { key: "aditya", email: "aditya.verma@demo.twogets.in", name: "Aditya Verma", phone: "+91 99300 22003", avatar: "m12.jpg", verified: false,
    profile: { occupation: "Investment Analyst", employer: "HDFC Bank", income_range: "12l_24l", occupancy_type: "bachelor", has_pets: false, food_preference: "no_preference", preferred_locations: ["Bandra West", "Powai"], budget_min: 40000, budget_max: 90000, about: "Finance professional in Mumbai. Prefer fully-furnished places near work." } },
  { key: "riya", email: "riya.kapoor@demo.twogets.in", name: "Riya Kapoor", phone: "+91 99100 22004", avatar: "w9.jpg", verified: true,
    profile: { occupation: "Marketing Manager", employer: "Zomato", income_range: "6l_12l", occupancy_type: "family", has_pets: false, food_preference: "eggetarian", preferred_locations: ["Sector 54", "DLF Phase 3"], budget_min: 35000, budget_max: 70000, about: "Looking for a calm, well-connected home in Gurugram for my small family." } },
  { key: "rohan", email: "rohan.das@demo.twogets.in", name: "Rohan Das", phone: "+91 90040 22005", avatar: "m23.jpg", verified: false,
    profile: { occupation: "UX Researcher", employer: "Microsoft", income_range: "6l_12l", occupancy_type: "bachelor", has_pets: false, food_preference: "non_vegetarian", preferred_locations: ["Gachibowli", "Madhapur"], budget_min: 15000, budget_max: 30000, about: "First job, first apartment. Excited and easy-going." } },
];

// Demo tenant (pre-existing) profile
const DEMO_TENANT_EMAIL = "tenant@demo.twogets.in";
const DEMO_TENANT_PROFILE = {
  occupation: "Software Engineer", employer: "Google", income_range: "12l_24l", occupancy_type: "bachelor",
  has_pets: false, food_preference: "no_preference", preferred_locations: ["Indiranagar", "Koramangala"],
  budget_min: 25000, budget_max: 50000, about: "Trying out TwoGets — looking for a comfortable 2 BHK in central Bengaluru.",
};

// ---- properties ------------------------------------------------------------
// ownerKey "demo" => the pre-existing owner@demo.twogets.in
const PROPS = [
  { o: "rajesh", title: "Sunlit 2 BHK with balcony in Indiranagar", type: "apartment", bhk: 2, furn: "fully_furnished", rent: 38000, dep: 150000, loc: "Indiranagar", city: "Bengaluru", state: "Karnataka", pin: "560038", lat: 12.9719, lng: 77.6412, pet: true, pref: "any", status: "active", verified: true, views: 312, am: ["parking","lift","power_backup","water_supply","security","wifi","ac","modular_kitchen","balcony"], desc: "A bright, fully-furnished 2 BHK on a quiet leafy street in the heart of Indiranagar. Walkable to 100 Feet Road cafes, metro, and parks. Includes premium modular kitchen, two ACs, and covered parking." },
  { o: "rajesh", title: "Spacious 3 BHK near Koramangala 5th Block", type: "apartment", bhk: 3, furn: "semi_furnished", rent: 55000, dep: 220000, loc: "Koramangala", city: "Bengaluru", state: "Karnataka", pin: "560095", lat: 12.9352, lng: 77.6245, pet: false, pref: "family", status: "active", verified: true, views: 198, am: ["parking","lift","power_backup","water_supply","security","gym","clubhouse","balcony","cctv"], desc: "Generous 3 BHK in a gated community moments from Koramangala's startup hub. Semi-furnished with wardrobes and kitchen cabinetry. Clubhouse, gym, and children's play area on site." },
  { o: "priya", title: "Modern studio in HSR Layout, ideal for bachelors", type: "studio", bhk: 1, furn: "fully_furnished", rent: 22000, dep: 80000, loc: "HSR Layout", city: "Bengaluru", state: "Karnataka", pin: "560102", lat: 12.9116, lng: 77.6473, pet: false, pref: "bachelor", status: "active", verified: true, views: 256, am: ["lift","power_backup","water_supply","security","wifi","ac","modular_kitchen"], desc: "Compact, design-forward studio perfect for a working professional. Fully furnished down to the cutlery — just bring a suitcase. High-speed-fibre ready and steps from HSR's cafe scene." },
  { o: "priya", title: "Family 2 BHK in Whitefield gated community", type: "apartment", bhk: 2, furn: "semi_furnished", rent: 32000, dep: 130000, loc: "Whitefield", city: "Bengaluru", state: "Karnataka", pin: "560066", lat: 12.9698, lng: 77.7500, pet: true, pref: "family", status: "active", verified: false, views: 141, am: ["parking","lift","power_backup","water_supply","security","gym","swimming_pool","clubhouse","park"], desc: "Comfortable family apartment in a large gated township close to ITPL and international schools. Resort-style amenities including pool and clubhouse. Pet-friendly community." },
  { o: "demo", title: "Premium 3 BHK villa in Jayanagar", type: "villa", bhk: 3, furn: "fully_furnished", rent: 75000, dep: 300000, loc: "Jayanagar", city: "Bengaluru", state: "Karnataka", pin: "560011", lat: 12.9250, lng: 77.5938, pet: true, pref: "family", status: "active", verified: true, views: 421, am: ["parking","power_backup","water_supply","security","wifi","ac","modular_kitchen","balcony","cctv","intercom"], desc: "An elegant independent villa on a tree-lined Jayanagar avenue. Three large bedrooms, a private garden, and a fully-equipped kitchen. One of Bengaluru's most loved old neighbourhoods." },
  { o: "demo", title: "Cosy 1 BHK in Bellandur, walk to tech parks", type: "apartment", bhk: 1, furn: "unfurnished", rent: 19000, dep: 70000, loc: "Bellandur", city: "Bengaluru", state: "Karnataka", pin: "560103", lat: 12.9255, lng: 77.6762, pet: false, pref: "any", status: "active", verified: false, views: 87, am: ["parking","lift","power_backup","water_supply","security"], desc: "Practical unfurnished 1 BHK minutes from Ecospace and Outer Ring Road offices. Great value for someone who wants to bring their own furniture and stay close to work." },
  { o: "arjun", title: "Sea-breeze 2 BHK in Bandra West", type: "apartment", bhk: 2, furn: "fully_furnished", rent: 85000, dep: 510000, loc: "Bandra West", city: "Mumbai", state: "Maharashtra", pin: "400050", lat: 19.0596, lng: 72.8295, pet: true, pref: "any", status: "active", verified: true, views: 503, am: ["lift","power_backup","water_supply","security","wifi","ac","modular_kitchen","balcony","intercom"], desc: "Stylish, fully-furnished 2 BHK in the lanes of Bandra West — cafes, the bandstand, and the sea-link at your doorstep. South-facing with a sit-out balcony and modern interiors." },
  { o: "arjun", title: "Smart 1 BHK near Andheri metro", type: "apartment", bhk: 1, furn: "semi_furnished", rent: 42000, dep: 250000, loc: "Andheri East", city: "Mumbai", state: "Maharashtra", pin: "400069", lat: 19.1136, lng: 72.8697, pet: false, pref: "bachelor", status: "active", verified: true, views: 274, am: ["lift","power_backup","water_supply","security","wifi","ac"], desc: "Efficient 1 BHK two minutes from Andheri metro and the international airport. Semi-furnished with wardrobes and AC — ideal for a frequent-flyer professional." },
  { o: "arjun", title: "Luxury 3 BHK penthouse with skyline views in Powai", type: "penthouse", bhk: 3, furn: "fully_furnished", rent: 150000, dep: 600000, loc: "Powai", city: "Mumbai", state: "Maharashtra", pin: "400076", lat: 19.1176, lng: 72.9060, pet: true, pref: "any", status: "active", verified: true, views: 612, am: ["parking","lift","power_backup","water_supply","security","gym","swimming_pool","clubhouse","wifi","ac","modular_kitchen","balcony","cctv","intercom"], desc: "A spectacular top-floor penthouse overlooking Powai Lake. Floor-to-ceiling windows, private terrace, and full club amenities. Turn-key luxury for executives or families." },
  { o: "sneha", title: "Bright 2 BHK in Gachibowli IT corridor", type: "apartment", bhk: 2, furn: "semi_furnished", rent: 28000, dep: 100000, loc: "Gachibowli", city: "Hyderabad", state: "Telangana", pin: "500032", lat: 17.4401, lng: 78.3489, pet: false, pref: "any", status: "active", verified: true, views: 219, am: ["parking","lift","power_backup","water_supply","security","gym","clubhouse","balcony"], desc: "Well-laid-out 2 BHK in a sought-after Gachibowli tower, surrounded by tech campuses. Semi-furnished with wardrobes; gym and clubhouse included. Quick access to ORR." },
  { o: "sneha", title: "Grand 4 BHK villa in Banjara Hills", type: "villa", bhk: 4, furn: "fully_furnished", rent: 120000, dep: 480000, loc: "Banjara Hills", city: "Hyderabad", state: "Telangana", pin: "500034", lat: 17.4156, lng: 78.4347, pet: true, pref: "family", status: "active", verified: true, views: 388, am: ["parking","power_backup","water_supply","security","gym","swimming_pool","wifi","ac","modular_kitchen","balcony","cctv","intercom"], desc: "An expansive four-bedroom villa in prestigious Banjara Hills. Private lawn, home office, and a chef's kitchen. Walking distance to the city's finest dining and boutiques." },
  { o: "sneha", title: "Compact furnished studio in Madhapur", type: "studio", bhk: 1, furn: "fully_furnished", rent: 16000, dep: 60000, loc: "Madhapur", city: "Hyderabad", state: "Telangana", pin: "500081", lat: 17.4486, lng: 78.3908, pet: false, pref: "bachelor", status: "active", verified: false, views: 132, am: ["lift","power_backup","water_supply","security","wifi","ac"], desc: "Neat furnished studio in the heart of HITEC City. Everything within reach — offices, food courts, and nightlife. Perfect first home for a young professional." },
  { o: "vikram", title: "3 BHK with park view in Sector 54", type: "apartment", bhk: 3, furn: "semi_furnished", rent: 65000, dep: 200000, loc: "Sector 54", city: "Gurugram", state: "Haryana", pin: "122002", lat: 28.4334, lng: 77.1100, pet: false, pref: "family", status: "active", verified: false, views: 164, am: ["parking","lift","power_backup","water_supply","security","gym","swimming_pool","clubhouse","park"], desc: "Roomy 3 BHK overlooking a central green in Sector 54, on the rapid-metro line. Semi-furnished, in a well-managed condominium with pool, gym, and 24x7 security." },
  { o: "vikram", title: "Furnished 2 BHK in DLF Phase 3", type: "apartment", bhk: 2, furn: "fully_furnished", rent: 48000, dep: 150000, loc: "DLF Phase 3", city: "Gurugram", state: "Haryana", pin: "122010", lat: 28.4940, lng: 77.0960, pet: true, pref: "any", status: "active", verified: false, views: 121, am: ["parking","lift","power_backup","water_supply","security","wifi","ac","modular_kitchen","balcony"], desc: "Move-in-ready 2 BHK in DLF Phase 3, steps from Cyber Hub and the metro. Fully furnished with modern appliances. Pet-friendly building with ample parking." },
  { o: "ananya", title: "Charming 2 BHK row house in Koregaon Park", type: "row_house", bhk: 2, furn: "semi_furnished", rent: 36000, dep: 140000, loc: "Koregaon Park", city: "Pune", state: "Maharashtra", pin: "411001", lat: 18.5362, lng: 73.8939, pet: true, pref: "any", status: "active", verified: true, views: 203, am: ["parking","power_backup","water_supply","security","wifi","balcony","park"], desc: "A character-filled row house on a quiet Koregaon Park lane, surrounded by greenery and cafes. Private entrance and a little garden. Pets very welcome." },
  { o: "ananya", title: "Furnished 1 BHK in Baner, close to IT hubs", type: "apartment", bhk: 1, furn: "fully_furnished", rent: 21000, dep: 80000, loc: "Baner", city: "Pune", state: "Maharashtra", pin: "411045", lat: 18.5590, lng: 73.7868, pet: false, pref: "bachelor", status: "active", verified: true, views: 176, am: ["lift","power_backup","water_supply","security","wifi","ac","modular_kitchen"], desc: "Bright furnished 1 BHK in Baner with quick access to Hinjewadi and Balewadi. Ready to move in with all essentials. Great fit for a young IT professional." },
  { o: "ananya", title: "Independent 3 BHK house in Hinjewadi", type: "independent_house", bhk: 3, furn: "unfurnished", rent: 44000, dep: 160000, loc: "Hinjewadi", city: "Pune", state: "Maharashtra", pin: "411057", lat: 18.5913, lng: 73.7389, pet: true, pref: "family", status: "active", verified: false, views: 98, am: ["parking","power_backup","water_supply","security","balcony"], desc: "A full independent house near Hinjewadi Phase 1 — three bedrooms, terrace, and parking for two cars. Unfurnished canvas for a family that wants space and privacy." },
  { o: "rajesh", title: "Designer 2 BHK in Indiranagar, pet-friendly", type: "apartment", bhk: 2, furn: "fully_furnished", rent: 41000, dep: 165000, loc: "Indiranagar", city: "Bengaluru", state: "Karnataka", pin: "560038", lat: 12.9784, lng: 77.6408, pet: true, pref: "any", status: "active", verified: true, views: 287, am: ["parking","lift","power_backup","water_supply","security","wifi","ac","modular_kitchen","balcony","cctv"], desc: "Tastefully done-up 2 BHK with warm wood interiors, a reading nook, and a planted balcony. Pet-friendly and close to the metro. Designed for comfortable city living." },
  // A draft + a rented listing so owner dashboards show real lifecycle states.
  { o: "priya", title: "Upcoming 2 BHK listing in Koramangala", type: "apartment", bhk: 2, furn: "semi_furnished", rent: 47000, dep: 180000, loc: "Koramangala", city: "Bengaluru", state: "Karnataka", pin: "560034", lat: 12.9279, lng: 77.6271, pet: false, pref: "any", status: "draft", verified: false, views: 3, am: ["parking","lift","power_backup","water_supply","security","balcony"], desc: "Preparing this one for listing — photos and details being finalised. A bright 2 BHK in central Koramangala." },
  { o: "arjun", title: "Recently rented 1 BHK in Andheri", type: "apartment", bhk: 1, furn: "fully_furnished", rent: 39000, dep: 230000, loc: "Andheri West", city: "Mumbai", state: "Maharashtra", pin: "400053", lat: 19.1351, lng: 72.8266, pet: false, pref: "bachelor", status: "rented", verified: true, views: 356, am: ["lift","power_backup","water_supply","security","wifi","ac"], desc: "This well-loved 1 BHK in Andheri West found its tenant through TwoGets. Kept here as an example of a completed match." },
];

// ---- helpers ---------------------------------------------------------------
async function upsertAuthUser(email, name, role) {
  // returns user id; creates if missing.
  const buildPage = async (page) => db.auth.admin.listUsers({ page, perPage: 1000 });
  let found = null;
  for (let page = 1; page <= 5 && !found; page++) {
    const { data, error } = await buildPage(page);
    if (error) throw error;
    const list = data.users || [];
    found = list.find((u) => u.email === email) || null;
    if (list.length < 1000) break;
  }
  if (found) return found.id;
  const { data, error } = await db.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: name, role },
  });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  return data.user.id;
}

async function uploadAvatar(userId, file) {
  const p = `${userId}/avatar.jpg`;
  const { error } = await db.storage.from("avatars").upload(p, avatarBuffer(file), {
    contentType: "image/jpeg", upsert: true,
  });
  if (error) throw new Error(`avatar ${file}: ${error.message}`);
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

function rid(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ---- main ------------------------------------------------------------------
async function main() {
  await ensureAssets();
  console.log("→ Loading amenity lookup");
  const { data: amenities, error: amErr } = await db.from("amenities").select("id, slug");
  if (amErr) throw amErr;
  const amenityId = Object.fromEntries(amenities.map((a) => [a.slug, a.id]));

  console.log("→ Creating / locating accounts");
  const ownerId = {};
  for (const o of OWNERS) {
    const id = await upsertAuthUser(o.email, o.name, "homeowner");
    ownerId[o.key] = id;
  }
  const demoOwnerId = await upsertAuthUser(DEMO_OWNER_EMAIL, "Demo Homeowner", "homeowner");
  ownerId["demo"] = demoOwnerId;

  const tenantId = {};
  for (const t of TENANTS) {
    tenantId[t.key] = await upsertAuthUser(t.email, t.name, "tenant");
  }
  const demoTenantId = await upsertAuthUser(DEMO_TENANT_EMAIL, "Demo Tenant", "tenant");

  console.log("→ Updating owner profiles + avatars");
  for (const o of OWNERS) {
    const avatarPath = await uploadAvatar(ownerId[o.key], o.avatar);
    await db.from("users").update({
      role: "homeowner", full_name: o.name, phone: o.phone, avatar_url: avatarPath,
      is_verified: o.verified, trust_score: o.verified ? 50 : 20,
    }).eq("id", ownerId[o.key]);
    await db.from("homeowner_profiles").upsert({
      user_id: ownerId[o.key], about: o.about, city: o.city,
    }, { onConflict: "user_id" });
  }
  // demo owner profile (verified)
  await db.from("users").update({ role: "homeowner", is_verified: true, trust_score: 50, phone: "+91 98000 00000" }).eq("id", demoOwnerId);
  await db.from("homeowner_profiles").upsert({ user_id: demoOwnerId, about: "Demo homeowner account for exploring the TwoGets owner experience.", city: "Bengaluru" }, { onConflict: "user_id" });

  console.log("→ Updating tenant profiles + avatars");
  for (const t of TENANTS) {
    const avatarPath = await uploadAvatar(tenantId[t.key], t.avatar);
    await db.from("users").update({
      role: "tenant", full_name: t.name, phone: t.phone, avatar_url: avatarPath,
      is_verified: t.verified, trust_score: t.verified ? 50 : 20,
    }).eq("id", tenantId[t.key]);
    await db.from("tenant_profiles").upsert({
      user_id: tenantId[t.key], ...t.profile, move_in_date: isoDate(rid([15, 25, 35, 45])),
    }, { onConflict: "user_id" });
  }
  // demo tenant profile
  await db.from("tenant_profiles").upsert({ user_id: demoTenantId, ...DEMO_TENANT_PROFILE, move_in_date: isoDate(30) }, { onConflict: "user_id" });

  console.log("→ Clearing previously seeded properties");
  const allOwnerIds = [...Object.values(ownerId)];
  await db.from("properties").delete().in("owner_id", allOwnerIds);
  // also clear demo tenant's saved list so re-runs stay clean
  await db.from("saved_properties").delete().eq("tenant_id", demoTenantId);

  console.log("→ Inserting properties + images + amenities");
  const propIds = []; // index-aligned with PROPS
  for (let i = 0; i < PROPS.length; i++) {
    const p = PROPS[i];
    const owner = ownerId[p.o];
    const createdAt = isoTimestamp(2 + i * 2); // spread listing dates
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

  // index of active properties only (for inquiries/reviews/saves)
  const activeIdx = PROPS.map((p, i) => (p.status === "active" ? i : -1)).filter((i) => i >= 0);

  console.log("→ Building review history (inquiry → appointment → review)");
  // owner_review chains: tenant reviews the owner of a property
  const REVIEW_CHAINS = [
    { t: "karthik", p: 0, comm: 5, dep: 5, acc: 5, days: 40, c: "Rajesh was incredibly responsive and the flat was exactly as pictured. Smooth move-in, deposit terms were fair." },
    { t: "meera", p: 0, comm: 4, dep: 5, acc: 4, days: 22, c: "Lovely apartment and a very reasonable landlord. Minor delay getting the second key, otherwise perfect." },
    { t: "demoT", p: 4, comm: 5, dep: 5, acc: 5, days: 30, c: "The villa is stunning and the owner handled everything professionally. Highly recommend." },
    { t: "riya", p: 8, comm: 5, dep: 4, acc: 5, days: 18, c: "Penthouse views are unreal. Arjun is transparent and easy to deal with. Deposit was on the higher side but justified." },
    { t: "aditya", p: 6, comm: 5, dep: 5, acc: 5, days: 12, c: "Best rental experience I've had in Mumbai. No broker, no nonsense, exactly as advertised." },
    { t: "rohan", p: 9, comm: 4, dep: 4, acc: 4, days: 27, c: "Good value 2 BHK near work. Sneha was helpful throughout the process." },
    { t: "karthik", p: 10, comm: 5, dep: 5, acc: 5, days: 9, c: "The Banjara Hills villa exceeded expectations. Spotless, spacious, and the owner is a gem." },
    { t: "meera", p: 14, comm: 5, dep: 5, acc: 5, days: 15, c: "Koregaon Park row house is full of charm and totally pet-friendly. Ananya is wonderful." },
    { t: "demoT", p: 2, comm: 4, dep: 4, acc: 5, days: 35, c: "Great little studio, fully loaded. Perfect for a solo professional in HSR." },
    { t: "riya", p: 7, comm: 4, dep: 4, acc: 4, days: 20, c: "Compact but very well located near Andheri metro. Owner was prompt with paperwork." },
    { t: "aditya", p: 1, comm: 5, dep: 5, acc: 4, days: 25, c: "Spacious 3 BHK, great community. Rajesh made the whole thing painless." },
    { t: "rohan", p: 15, comm: 5, dep: 5, acc: 5, days: 8, c: "Baner 1 BHK is move-in ready and exactly as listed. Ananya is super responsive." },
    { t: "karthik", p: 17, comm: 5, dep: 4, acc: 5, days: 6, c: "Beautiful designer 2 BHK in Indiranagar. The balcony sold me. Highly recommended." },
    { t: "meera", p: 9, comm: 5, dep: 5, acc: 5, days: 5, c: "Sneha's villa is the best home we've rented. Everything works, everything's clean." },
  ];
  // tenant_review chains: owner reviews the tenant (same appointment)
  const TENANT_REVIEWS = [
    { p: 0, t: "karthik", comm: 5, rel: 5, care: 5, days: 39, c: "Karthik is the ideal tenant — punctual with rent and takes great care of the place." },
    { p: 4, t: "demoT", comm: 5, rel: 5, care: 4, days: 29, c: "Respectful and communicative. Would happily rent to again." },
    { p: 8, t: "riya", comm: 4, rel: 5, care: 5, days: 17, c: "Riya kept the penthouse immaculate and was always easy to reach." },
    { p: 14, t: "meera", comm: 5, rel: 5, care: 5, days: 14, c: "Meera and her pup were perfect residents. Spotless handover." },
  ];

  const tid = (k) => (k === "demoT" ? demoTenantId : tenantId[k]);
  // map property index -> owner id
  const propOwner = (pi) => ownerId[PROPS[pi].o];

  // Create accepted inquiry + completed appointment for each reviewed (tenant,property) pair,
  // reused across both review directions.
  const apptByPair = {};
  async function ensureAppointment(pi, tenantKey, daysAgo) {
    const key = `${pi}:${tenantKey}`;
    if (apptByPair[key]) return apptByPair[key];
    const propertyId = propIds[pi];
    const owner = propOwner(pi);
    const tenant = tid(tenantKey);
    const dDate = isoDate(-daysAgo);
    const dTime = rid(["10:00", "11:30", "16:00", "17:30", "18:00"]);
    const { data: inq, error: iErr } = await db.from("inquiries").insert({
      property_id: propertyId, tenant_id: tenant, owner_id: owner,
      message: "Hi, I'd love to see this place — is it still available?",
      preferred_date: dDate, preferred_time: dTime, status: "accepted",
      responded_at: isoTimestamp(daysAgo + 1), created_at: isoTimestamp(daysAgo + 2),
    }).select("id").single();
    if (iErr) throw new Error(`inquiry ${key}: ${iErr.message}`);
    const { data: appt, error: aErr } = await db.from("appointments").insert({
      inquiry_id: inq.id, property_id: propertyId, tenant_id: tenant, owner_id: owner,
      scheduled_date: dDate, scheduled_time: dTime, status: "completed",
      notes: "Viewing completed.", created_at: isoTimestamp(daysAgo + 1),
    }).select("id").single();
    if (aErr) throw new Error(`appointment ${key}: ${aErr.message}`);
    apptByPair[key] = appt.id;
    return appt.id;
  }

  for (const r of REVIEW_CHAINS) {
    const apptId = await ensureAppointment(r.p, r.t, r.days);
    const overall = Number(((r.comm + r.dep + r.acc) / 3).toFixed(2));
    const { error } = await db.from("reviews").insert({
      review_type: "owner_review", appointment_id: apptId, property_id: propIds[r.p],
      reviewer_id: tid(r.t), reviewee_id: propOwner(r.p), rating_communication: r.comm,
      rating_deposit_fairness: r.dep, rating_property_accuracy: r.acc, overall_rating: overall,
      comment: r.c, created_at: isoTimestamp(r.days),
    });
    if (error) throw new Error(`owner_review p${r.p}/${r.t}: ${error.message}`);
  }
  for (const r of TENANT_REVIEWS) {
    const apptId = await ensureAppointment(r.p, r.t, r.days);
    const overall = Number(((r.comm + r.rel + r.care) / 3).toFixed(2));
    const { error } = await db.from("reviews").insert({
      review_type: "tenant_review", appointment_id: apptId, property_id: null,
      reviewer_id: propOwner(r.p), reviewee_id: tid(r.t), rating_communication: r.comm,
      rating_reliability: r.rel, rating_property_care: r.care, overall_rating: overall,
      comment: r.c, created_at: isoTimestamp(r.days),
    });
    if (error) throw new Error(`tenant_review p${r.p}/${r.t}: ${error.message}`);
  }

  console.log("→ Adding live pending inquiries");
  const PENDING = [
    { p: 1, t: "karthik", days: 1 }, { p: 5, t: "meera", days: 2 }, { p: 12, t: "riya", days: 1 },
    { p: 9, t: "rohan", days: 3 }, { p: 13, t: "riya", days: 2 }, { p: 16, t: "rohan", days: 1 },
    { p: 2, t: "demoT", days: 1 },
  ];
  for (const q of PENDING) {
    const dDate = isoDate(rid([3, 5, 7, 9]));
    const dTime = rid(["10:30", "12:00", "15:00", "17:00", "18:30"]);
    const { error } = await db.from("inquiries").insert({
      property_id: propIds[q.p], tenant_id: tid(q.t), owner_id: propOwner(q.p),
      message: rid([
        "Hi! Is this available from next month? I'd like to schedule a viewing.",
        "Interested in this place — could I visit this weekend?",
        "Looks great. Is the rent negotiable for a 12-month lease?",
        "Hello, I'm relocating soon and would love to see this home.",
      ]),
      preferred_date: dDate, preferred_time: dTime, status: "pending", created_at: isoTimestamp(q.days),
    });
    if (error && error.code !== "23505") throw new Error(`pending p${q.p}/${q.t}: ${error.message}`);
  }

  console.log("→ Adding upcoming (scheduled) viewings");
  const UPCOMING = [
    { p: 3, t: "meera", days: 4 }, { p: 6, t: "demoT", days: 2 }, { p: 11, t: "karthik", days: 5 },
  ];
  for (const u of UPCOMING) {
    const propertyId = propIds[u.p];
    const owner = propOwner(u.p);
    const tenant = tid(u.t);
    const dDate = isoDate(u.days);
    const dTime = rid(["11:00", "16:30", "18:00"]);
    const { data: inq, error: iErr } = await db.from("inquiries").insert({
      property_id: propertyId, tenant_id: tenant, owner_id: owner,
      message: "Confirmed — see you then!", preferred_date: dDate, preferred_time: dTime,
      status: "accepted", responded_at: isoTimestamp(1), created_at: isoTimestamp(2),
    }).select("id").single();
    if (iErr && iErr.code !== "23505") throw new Error(`upcoming inquiry p${u.p}: ${iErr.message}`);
    if (inq) {
      const { error: aErr } = await db.from("appointments").insert({
        inquiry_id: inq.id, property_id: propertyId, tenant_id: tenant, owner_id: owner,
        scheduled_date: dDate, scheduled_time: dTime, status: "scheduled",
      });
      if (aErr) throw new Error(`upcoming appt p${u.p}: ${aErr.message}`);
    }
  }

  console.log("→ Shortlisting properties for the demo tenant");
  const demoSaves = [0, 4, 8, 10, 17]; // a mix of Bengaluru / Mumbai / Hyderabad homes
  const saveRows = demoSaves.map((pi) => ({ tenant_id: demoTenantId, property_id: propIds[pi] }));
  await db.from("saved_properties").upsert(saveRows, { onConflict: "tenant_id,property_id" });

  // summary
  console.log("\n========== SEED COMPLETE ==========");
  const counts = {};
  for (const tbl of ["users", "properties", "property_images", "reviews", "inquiries", "appointments", "saved_properties"]) {
    const { count } = await db.from(tbl).select("*", { count: "exact", head: true });
    counts[tbl] = count;
  }
  console.table(counts);
  console.log("Owners:", OWNERS.length + 1, " Tenants:", TENANTS.length + 1, " Active listings:", activeIdx.length);
}

main().then(() => { console.log("Done."); process.exit(0); })
  .catch((e) => { console.error("\nSEED FAILED:", e.message); console.error(e); process.exit(1); });
