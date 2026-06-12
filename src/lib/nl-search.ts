import type { FurnishedStatus, PropertyType } from "@/types";

/**
 * Rule-based parser turning a free-text home requirement
 * ("2 or 3 BHK in HSR Layout under ₹35k, pet friendly, semi furnished")
 * into structured search filters. Deterministic, zero-latency, no API cost.
 *
 * Strategy: recognise and CONSUME patterns one class at a time (BHK → budget
 * → keywords), so later passes — especially location — work on a string that
 * no longer contains numbers or keywords that could be mistaken for places.
 */

export interface ParsedSearch {
  /** Acceptable BHK counts, e.g. [2, 3]. Empty = any. */
  bhk: number[];
  /** City or locality phrase, matched against both columns. */
  location: string | null;
  minRent: number | null;
  maxRent: number | null;
  petFriendly: boolean;
  furnished: FurnishedStatus | null;
  propertyType: PropertyType | null;
  occupancy: "bachelor" | "family" | null;
  verifiedOnly: boolean;
}

const CITY_ALIASES: Record<string, string> = {
  bangalore: "Bengaluru",
  bengaluru: "Bengaluru",
  blr: "Bengaluru",
  mumbai: "Mumbai",
  bombay: "Mumbai",
  delhi: "Delhi",
  "new delhi": "Delhi",
  gurgaon: "Gurugram",
  gurugram: "Gurugram",
  noida: "Noida",
  hyderabad: "Hyderabad",
  chennai: "Chennai",
  madras: "Chennai",
  pune: "Pune",
  kolkata: "Kolkata",
  calcutta: "Kolkata",
};

/** "30k" → 30000, "1.2 lakh" → 120000, "35,000" → 35000 */
function toAmount(num: string, unit: string | undefined): number {
  const n = parseFloat(num.replace(/,/g, ""));
  if (!Number.isFinite(n)) return 0;
  if (!unit) return Math.round(n);
  if (/^k|thousand/i.test(unit)) return Math.round(n * 1_000);
  return Math.round(n * 100_000); // lakh / lac / l
}

// A money token: optional ₹/rs/inr, digits (commas/decimal ok), optional unit.
const MONEY = String.raw`(?:₹|rs\.?\s*|inr\s*)?(\d{1,3}(?:,\d{2,3})+|\d+(?:\.\d+)?)\s*(k\b|thousand\b|lakhs?\b|lacs?\b|l\b)?`;

/** Plausible rent: explicit unit/symbol, or a bare number ≥ 1000. */
function isMoney(num: string, unit: string | undefined, raw: string): boolean {
  if (unit || /[₹]|rs|inr/i.test(raw)) return true;
  return parseFloat(num.replace(/,/g, "")) >= 1000;
}

export function parseSearchQuery(input: string): ParsedSearch {
  const parsed: ParsedSearch = {
    bhk: [],
    location: null,
    minRent: null,
    maxRent: null,
    petFriendly: false,
    furnished: null,
    propertyType: null,
    occupancy: null,
    verifiedOnly: false,
  };

  // Work on a lowercase copy; consume matches by replacing with a space.
  let s = ` ${input.toLowerCase().replace(/\s+/g, " ").trim()} `;
  const consume = (re: RegExp, fn?: (m: RegExpExecArray) => void) => {
    let m: RegExpExecArray | null;
    const global = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
    while ((m = global.exec(s)) !== null) {
      fn?.(m);
      s = s.slice(0, m.index) + " " + s.slice(m.index + m[0].length);
      global.lastIndex = m.index;
    }
  };

  // -- BHK: ranges first ("2-3 bhk", "2 or 3 bhk", "2/3bhk"), then singles --
  const bhkSet = new Set<number>();
  consume(/(\d)\s*(?:\/|-|–|to|or)\s*(\d)\s*(?:bhk|bed(?:room)?s?)\b/i, (m) => {
    const lo = Math.min(+m[1], +m[2]);
    const hi = Math.max(+m[1], +m[2]);
    for (let i = lo; i <= hi && i <= 10; i++) if (i >= 1) bhkSet.add(i);
  });
  consume(/(\d{1,2})\s*(?:bhk|bed(?:room)?s?)\b/i, (m) => {
    const n = +m[1];
    if (n >= 1 && n <= 10) bhkSet.add(n);
  });
  parsed.bhk = [...bhkSet].sort((a, b) => a - b);

  // -- Budget: range, then bounded ("under 30k"), then bare "budget 30k" -----
  consume(
    new RegExp(String.raw`(?:between\s+)?${MONEY}\s*(?:-|–|to|and)\s*${MONEY}`, "i"),
    (m) => {
      if (!isMoney(m[1], m[2], m[0]) || !isMoney(m[3], m[4], m[0])) return;
      const a = toAmount(m[1], m[2]);
      const b = toAmount(m[3], m[4]);
      parsed.minRent = Math.min(a, b);
      parsed.maxRent = Math.max(a, b);
    },
  );
  consume(
    new RegExp(
      String.raw`(?:under|below|upto|up\s+to|max(?:imum)?|within|less\s+than|not\s+more\s+than)\s+${MONEY}`,
      "i",
    ),
    (m) => {
      if (isMoney(m[1], m[2], m[0])) parsed.maxRent = parsed.maxRent ?? toAmount(m[1], m[2]);
    },
  );
  consume(
    new RegExp(String.raw`(?:above|over|min(?:imum)?|at\s+least|more\s+than)\s+${MONEY}`, "i"),
    (m) => {
      if (isMoney(m[1], m[2], m[0])) parsed.minRent = parsed.minRent ?? toAmount(m[1], m[2]);
    },
  );
  consume(new RegExp(String.raw`budget\s*(?:of|is|:)?\s*${MONEY}`, "i"), (m) => {
    if (isMoney(m[1], m[2], m[0])) parsed.maxRent = parsed.maxRent ?? toAmount(m[1], m[2]);
  });
  // Last resort: a lone money-looking token (≥ ₹1000 or has a unit) = ceiling.
  if (parsed.maxRent === null && parsed.minRent === null) {
    consume(new RegExp(MONEY, "i"), (m) => {
      if (parsed.maxRent === null && isMoney(m[1], m[2], m[0])) {
        parsed.maxRent = toAmount(m[1], m[2]);
      }
    });
  }

  // -- Keywords ---------------------------------------------------------------
  consume(/pet[\s-]*friendly|pets?\s+(?:allowed|ok(?:ay)?|welcome)|with\s+(?:a\s+)?(?:pet|dog|cat)s?\b/i, () => {
    parsed.petFriendly = true;
  });
  consume(/semi[\s-]*furnished/i, () => {
    parsed.furnished = "semi_furnished";
  });
  consume(/(?:fully|full)[\s-]*furnished/i, () => {
    parsed.furnished = parsed.furnished ?? "fully_furnished";
  });
  consume(/un[\s-]*furnished|not\s+furnished/i, () => {
    parsed.furnished = parsed.furnished ?? "unfurnished";
  });
  consume(/\bfurnished\b/i, () => {
    parsed.furnished = parsed.furnished ?? "fully_furnished";
  });
  consume(/\bverified\b/i, () => {
    parsed.verifiedOnly = true;
  });
  consume(/\bbachelors?\b/i, () => {
    parsed.occupancy = "bachelor";
  });
  consume(/\bfamil(?:y|ies)\b|\bcouples?\b/i, () => {
    parsed.occupancy = parsed.occupancy ?? "family";
  });

  // Property type — most specific first so "row house" beats "house".
  const TYPE_PATTERNS: [RegExp, PropertyType][] = [
    [/pent[\s-]*house/i, "penthouse"],
    [/row[\s-]*house/i, "row_house"],
    [/independent\s+house|\bhouse\b|\bbungalow\b/i, "independent_house"],
    [/\bvilla\b/i, "villa"],
    [/\bstudio\b|\b1\s*rk\b/i, "studio"],
    [/\bflat\b|\bapartment\b/i, "apartment"],
  ];
  for (const [re, type] of TYPE_PATTERNS) {
    consume(re, () => {
      parsed.propertyType = parsed.propertyType ?? type;
    });
  }

  // -- Location: "in/at/near <phrase>" on the consumed remainder ---------------
  const locMatch = /(?:\bin|\bat|\bnear|\baround)\s+([a-z][a-z0-9\s]{1,40}?)(?=\s*(?:$|[,.]|\bwith\b|\bfor\b|\band\b))/i.exec(s);
  if (locMatch) {
    const phrase = locMatch[1].trim().replace(/\s+/g, " ");
    if (phrase.length >= 2) {
      parsed.location = CITY_ALIASES[phrase] ?? titleCase(phrase);
    }
  }
  // Fallback: a known city named anywhere in the text.
  if (!parsed.location) {
    for (const [alias, city] of Object.entries(CITY_ALIASES)) {
      if (new RegExp(`\\b${alias}\\b`, "i").test(s)) {
        parsed.location = city;
        break;
      }
    }
  }

  return parsed;
}

function titleCase(s: string) {
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

/** Human-readable chips for the parsed filters, in display order. */
export function parsedToChips(p: ParsedSearch): { key: keyof ParsedSearch; label: string }[] {
  const chips: { key: keyof ParsedSearch; label: string }[] = [];
  if (p.bhk.length) chips.push({ key: "bhk", label: `${p.bhk.join(" / ")} BHK` });
  if (p.location) chips.push({ key: "location", label: p.location });
  if (p.maxRent && p.minRent) {
    chips.push({ key: "maxRent", label: `₹${p.minRent.toLocaleString("en-IN")} – ₹${p.maxRent.toLocaleString("en-IN")}` });
  } else if (p.maxRent) {
    chips.push({ key: "maxRent", label: `≤ ₹${p.maxRent.toLocaleString("en-IN")}` });
  } else if (p.minRent) {
    chips.push({ key: "minRent", label: `≥ ₹${p.minRent.toLocaleString("en-IN")}` });
  }
  if (p.furnished) {
    chips.push({
      key: "furnished",
      label: { unfurnished: "Unfurnished", semi_furnished: "Semi-furnished", fully_furnished: "Fully furnished" }[p.furnished],
    });
  }
  if (p.propertyType) {
    chips.push({
      key: "propertyType",
      label: {
        apartment: "Apartment", independent_house: "Independent house", villa: "Villa",
        studio: "Studio", row_house: "Row house", penthouse: "Penthouse",
      }[p.propertyType],
    });
  }
  if (p.petFriendly) chips.push({ key: "petFriendly", label: "Pet friendly" });
  if (p.occupancy) chips.push({ key: "occupancy", label: p.occupancy === "bachelor" ? "Bachelor" : "Family" });
  if (p.verifiedOnly) chips.push({ key: "verifiedOnly", label: "Verified only" });
  return chips;
}

/** Rebuild a canonical query string from parsed filters (used by chip removal). */
export function parsedToQuery(p: ParsedSearch): string {
  const parts: string[] = [];
  if (p.bhk.length) parts.push(`${p.bhk.join(" or ")} bhk`);
  if (p.propertyType) {
    parts.push(
      {
        apartment: "apartment", independent_house: "independent house", villa: "villa",
        studio: "studio", row_house: "row house", penthouse: "penthouse",
      }[p.propertyType],
    );
  }
  if (p.location) parts.push(`in ${p.location}`);
  if (p.minRent && p.maxRent) parts.push(`${p.minRent} to ${p.maxRent}`);
  else if (p.maxRent) parts.push(`under ${p.maxRent}`);
  else if (p.minRent) parts.push(`above ${p.minRent}`);
  if (p.furnished === "semi_furnished") parts.push("semi furnished");
  if (p.furnished === "fully_furnished") parts.push("fully furnished");
  if (p.furnished === "unfurnished") parts.push("unfurnished");
  if (p.petFriendly) parts.push("pet friendly");
  if (p.occupancy === "bachelor") parts.push("for bachelors");
  if (p.occupancy === "family") parts.push("for family");
  if (p.verifiedOnly) parts.push("verified");
  return parts.join(", ");
}
