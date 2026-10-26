// Single source of truth for the case/unit rule: 1 case = 12 units.
export const UNITS_PER_CASE = 12;

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** units -> cases (rounded to 2 decimals, e.g. 30 units -> 2.5 cases). */
export const unitsToCases = (units) =>
  Math.round((toNum(units) / UNITS_PER_CASE) * 100) / 100;

/** cases -> units. */
export const casesToUnits = (cases) => toNum(cases) * UNITS_PER_CASE;

/** "30 Units (2.5 Cases)" - used wherever a units quantity is displayed. */
export const formatUnitsWithCases = (units, unitLabel = "Units") => {
  const n = toNum(units);
  const display = Number.isInteger(n) ? n : Math.round(n * 100) / 100;
  return `${display} ${unitLabel} (${unitsToCases(n)} Cases)`;
};

/** "5 Box (60 Pcs)" - used where only cases/boxes are stored or aggregated. */
export const formatCasesWithUnits = (cases, caseLabel = "Box", unitLabel = "Pcs") => {
  const n = toNum(cases);
  const display = Number.isInteger(n) ? n : Math.round(n * 100) / 100;
  return `${display} ${caseLabel} (${casesToUnits(n)} ${unitLabel})`;
};
