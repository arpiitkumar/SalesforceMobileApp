// categoryPriorityService.js
// Usage: const ordered = await getOrderedCategories(dynamicCategories);
import UniversalUpdateInsert from "../../database/dbService/UniversalUpdateInsert";

async function fetchPriorityData() {
  // Use the existing helper in your repo
  // Ensure UniversalUpdateInsert is in scope where you import/require this file,
  // or pass a function in (see getOrderedCategories signature).
  return await UniversalUpdateInsert({
    ObjectName: "Priority__c",
    Type: "get"
  });
}

/**
 * Normalize a category label for comparison (trim + lower-case).
 * Keeps display names separate so we can preserve original casing when returning.
 */
function normalizeLabel(label) {
  if (label === null || label === undefined) return "";
  return String(label).trim().toLowerCase();
}

/**
 * Build ordered categories array using priority data and dynamic categories
 *
 * @param {string[]} dynamicCategories - array of category names from products (order preserved)
 * @param {Object} options
 *   - fetcher: optional async function that returns the priority data (falls back to fetchPriorityData)
 *   - priorityFieldName: field name for category in priority rows (default: "Category__c")
 *   - rankingFieldName: field name for ranking in priority rows (default: "Ranking__c")
 *
 * @returns {Promise<string[]>} ordered category display names
 */
// async function getOrderedCategories(dynamicCategories = [], options = {}) {
//   const {
//     fetcher = fetchPriorityData,
//     priorityFieldName = "Category__c",
//     rankingFieldName = "Ranking__c",
//   } = options;

//   // Defensive: ensure arrays
//   const dynamic = Array.isArray(dynamicCategories) ? dynamicCategories : [];

//   // 1) fetch priority rows
//   let priorityRows = [];
//   try {
//     const res = await fetcher();
//     // `UniversalUpdateInsert` often returns an array directly; but the caller might return { data: ... }
//     // Normalize to array
//     if (Array.isArray(res)) {
//       priorityRows = res;
//     } else if (res && Array.isArray(res.data)) {
//       priorityRows = res.data;
//     } else if (res && Array.isArray(res.responseBody)) {
//       priorityRows = res.responseBody;
//     } else if (res && Array.isArray(res?.data?.responseBody)) {
//       priorityRows = res.data.responseBody;
//     } else {
//       // try to use res as-is if it looks like rows
//       priorityRows = Array.isArray(res) ? res : [];
//     }
//   } catch (err) {
//     console.warn("Failed to fetch priority data:", err);
//     priorityRows = [];
//   }

//   // 2) map and sort priority rows by numeric ranking (ascending). Keep rows without numeric ranking after numeric ones.
//   const withRank = [];
//   const withoutRank = [];

//   for (const row of priorityRows) {
//     const rawRank = row?.[rankingFieldName];
//     // Coerce to number if possible
//     const n = (rawRank === null || rawRank === undefined) ? NaN : Number(rawRank);
//     if (!Number.isFinite(n) || Number.isNaN(n)) {
//       withoutRank.push(row);
//     } else {
//       withRank.push({ row, rank: n });
//     }
//   }

//   withRank.sort((a, b) => a.rank - b.rank);

//   const sortedPriorityRows = [...withRank.map(x => x.row), ...withoutRank];

//   // 3) build ordered list from sorted priority rows, dedupe and keep display-case from priority
//   const ordered = [];
//   const seen = new Set();

//   for (const r of sortedPriorityRows) {
//     const rawCat = r?.[priorityFieldName];
//     if (rawCat === null || rawCat === undefined) continue;
//     const norm = normalizeLabel(rawCat);
//     if (!norm) continue;
//     if (!seen.has(norm)) {
//       seen.add(norm);
//       ordered.push(String(rawCat).trim());
//     }
//   }

//   // 4) append dynamic categories that are not in priority, preserving their order and original case
//   for (const dyn of dynamic) {
//     const norm = normalizeLabel(dyn);
//     if (!norm) continue;
//     if (!seen.has(norm)) {
//       seen.add(norm);
//       ordered.push(String(dyn).trim());
//     }
//   }

//   return ordered;
// }

async function getOrderedCategories(dynamicCategories = [], options = {}) {
  const {
    fetcher = fetchPriorityData,
    priorityFieldName = "Category__c",
    rankingFieldName = "Ranking__c",
  } = options;

  const dynamic = Array.isArray(dynamicCategories) ? dynamicCategories : [];

  // Normalize helper
  const normalize = (v) => String(v ?? "").trim().toLowerCase();

  // 1️⃣ Fetch priority data
  let priorityRows = [];
  try {
    const res = await fetcher();
    priorityRows =
      Array.isArray(res) ? res :
      Array.isArray(res?.data) ? res.data :
      Array.isArray(res?.responseBody) ? res.responseBody :
      Array.isArray(res?.data?.responseBody) ? res.data.responseBody :
      [];
  } catch (e) {
    priorityRows = [];
  }

  // 2️⃣ Build map: category → numeric rank
  const priorityMap = new Map();

  for (const row of priorityRows) {
    const cat = normalize(row?.[priorityFieldName]);
    const rank = Number(row?.[rankingFieldName]);

    if (cat && Number.isFinite(rank)) {
      // keep lowest rank if duplicates exist
      if (!priorityMap.has(cat) || rank < priorityMap.get(cat)) {
        priorityMap.set(cat, rank);
      }
    }
  }

  // 3️⃣ Attach rank info to dynamic categories
  const enriched = dynamic
    .map((cat, index) => ({
      original: String(cat).trim(),
      norm: normalize(cat),
      index,
      rank: priorityMap.has(normalize(cat))
        ? priorityMap.get(normalize(cat))
        : Infinity
    }))
    .filter(item => item.norm); // remove empty values

  // 4️⃣ Sort:
  //   - ranked first (lower rank wins)
  //   - unranked keep original order
  enriched.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return a.index - b.index;
  });

  // 5️⃣ Deduplicate (case-insensitive), preserve prop casing
  const seen = new Set();
  const result = [];

  for (const item of enriched) {
    if (!seen.has(item.norm)) {
      seen.add(item.norm);
      result.push(item.original);
    }
  }

  return result;
}


export { getOrderedCategories };
export default getOrderedCategories;
