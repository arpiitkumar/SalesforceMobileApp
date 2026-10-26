import { UNITS_PER_CASE } from "./helper/caseUnits";
const NORMAL_BUCKET = "normal";
const ADDITIONAL_BUCKET = "additional";
const GST_DIVISOR = 1.05;

const safeArray = (value) => (Array.isArray(value) ? value : []);
const toArray = (value) => (Array.isArray(value) ? value : value !== undefined && value !== null && value !== "" ? [value] : []);

const normalizeText = (value) => String(value || "").trim();
const normalizeLower = (value) => normalizeText(value).toLowerCase();
const normalizeId = (value) => normalizeText(value);

const firstDefined = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
};

const toOptionalNumber = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const cleaned = typeof value === "string" ? value.replace(/,/g, "").trim() : value;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
};

const toNumber = (value, fallback = 0) => {
  const num = toOptionalNumber(value);
  return num == null ? fallback : num;
};

const round2 = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? Number(num.toFixed(2)) : 0;
};

const truthy = (value) => value === true || value === "true" || value === 1 || value === "1";

const uniqueStrings = (values = []) => {
  const seen = new Set();
  const out = [];
  values.forEach((value) => {
    const normalized = normalizeId(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  });
  return out;
};

const dedupeDefinitions = (definitions = []) => {
  const seen = new Set();
  const out = [];
  definitions.forEach((definition) => {
    const productId = normalizeId(definition?.productId);
    if (!productId || seen.has(productId)) return;
    seen.add(productId);
    out.push({
      productId,
      variantGroupValue: firstDefined(
        definition?.variantGroupValue,
        definition?.variantGroup,
        definition?.Variant_Group_Value__c,
        null
      ),
    });
  });
  return out;
};

const normalizeSlabType = (value) =>
  normalizeLower(value).includes("additional") ? ADDITIONAL_BUCKET : NORMAL_BUCKET;

const normalizeGroupLogic = (value, fallback = "OR") => {
  const text = normalizeLower(value);
  if (!text) return fallback;
  if (text.includes("and")) return "AND";
  if (text.includes("or")) return "OR";
  return fallback;
};

const normalizeVariantMode = (value) => {
  const text = normalizeLower(value);
  if (!text) return "ALL_SPECIFIED";
  if (text.includes("any")) return "ANY_N";
  return "ALL_SPECIFIED";
};

const normalizeQtyAggregationMode = (value) => {
  const text = normalizeLower(value);
  if (text.includes("per") && text.includes("variant")) return "PER_VARIANT";
  return "TOTAL_ACROSS";
};

const getMeasureKind = (buyUOMRaw, buyTypeRaw) => {
  const buyUOM = normalizeLower(buyUOMRaw);
  const buyType = normalizeLower(buyTypeRaw);

  if (buyType === "value" || buyUOM === "value" || buyUOM.includes("rupee") || buyUOM.includes("value")) {
    return "value";
  }
  if (buyUOM.includes("kg") || buyUOM.includes("kilogram")) {
    return "kg";
  }
  if (buyUOM.includes("case") || buyUOM.includes("box") || buyUOM.includes("ctn") || buyUOM.includes("carton")) {
    return "case";
  }
  if (buyType.includes("quantity") || buyType.includes("volume")) {
    return "unit";
  }
  return "unit";
};

const computeLineMeasures = (line) => {
  const units = toNumber(line?.units, 0);
  const unitPerCase = UNITS_PER_CASE;
  const weightPerUnitKg = toNumber(line?.weightPerUnitKg, 0);
  const unitPrice = toNumber(line?.unitPrice, 0);
  const grossAmount = round2(unitPrice * units);

  return {
    units,
    cases: units / unitPerCase,
    weightKg: units * weightPerUnitKg,
    unitPerCase,
    weightPerUnitKg,
    unitPrice,
    grossAmount,
    taxableGross: round2(grossAmount / GST_DIVISOR),
  };
};

const getLineMeasureValue = (line, buyUOM, buyType) => {
  const kind = getMeasureKind(buyUOM, buyType);
  if (kind === "value") return line.grossAmount;
  if (kind === "kg") return line.weightKg;
  if (kind === "case") return line.cases;
  return line.units;
};

const hasReward = (wrapper) => {
  if (!wrapper) return false;
  if (truthy(wrapper.isFreeProduct)) return true;
  if (normalizeLower(wrapper.rewardType).includes("free")) return true;
  return (
    toOptionalNumber(firstDefined(wrapper.rewardDiscountValue, wrapper.rewardValue, wrapper.discountValue)) != null ||
    toOptionalNumber(firstDefined(wrapper.rewardDiscountPercentage, wrapper.rewardDiscountPct, wrapper.discountPercentage)) != null
  );
};

const getBucketLogicFromSource = (source, bucketType) => {
  if (!source) return null;
  if (bucketType === ADDITIONAL_BUCKET) {
    return firstDefined(
      source.additionalGroupLogic,
      source.additionalGroupingLogic,
      source.additionalGroupLogic__c,
      source.Additional_Group_Logic__c,
      source.additional_group_logic
    );
  }
  return firstDefined(
    source.groupLogic,
    source.groupingLogic,
    source.Group_Logic__c,
    source.group_logic
  );
};

const extractBuyDefinitionFromWrapper = (wrapper) => {
  if (!wrapper) return null;
  const definitionType = normalizeLower(firstDefined(wrapper.definitionType, wrapper.Definition_Type__c));
  if (definitionType && !definitionType.includes("buy")) return null;

  const productId = normalizeId(wrapper.inputProductId);
  if (!productId) return null;

  return {
    productId,
    variantGroupValue: firstDefined(
      wrapper.variantGroupValue,
      wrapper.variantGroup,
      wrapper.variantGroupName,
      wrapper.Variant_Group_Value__c
    ),
  };
};

const extractBuyDefinitionsFromPhase = (phase) => {
  const explicitDefinitions = safeArray(
    firstDefined(
      phase?.buyConditionProducts,
      phase?.productDefinitions,
      phase?.products,
      phase?.buyProducts,
      phase?.schemeWrappers
    )
  )
    .map((entry) => ({
      productId: normalizeId(firstDefined(entry?.inputProductId, entry?.productId, entry?.productSfId, entry?.Sf_Id)),
      variantGroupValue: firstDefined(
        entry?.variantGroupValue,
        entry?.variantGroup,
        entry?.variantGroupName,
        entry?.Variant_Group_Value__c
      ),
    }))
    .filter((entry) => entry.productId);

  if (explicitDefinitions.length) return dedupeDefinitions(explicitDefinitions);

  const ids = firstDefined(phase?.inputProductIds, phase?.productIds, phase?.buyProductIds, phase?.schemeProductIds);
  return dedupeDefinitions(toArray(ids).map((productId) => ({ productId })));
};

const createBucket = () => ({
  logic: null,
  slabs: [],
  slabMap: new Map(),
});

const ensureSchemeRecord = (schemeMap, schemeId, schemeName) => {
  if (!schemeMap.has(schemeId)) {
    schemeMap.set(schemeId, {
      schemeId,
      schemeName: schemeName || "Scheme",
      buckets: {
        [NORMAL_BUCKET]: createBucket(),
        [ADDITIONAL_BUCKET]: createBucket(),
      },
    });
  }

  const record = schemeMap.get(schemeId);
  if (!record.schemeName && schemeName) record.schemeName = schemeName;
  return record;
};

const buildSchemeMetaMap = (schemesResp) => {
  const metaMap = new Map();
  const candidateLists = [
    schemesResp?.schemes,
    schemesResp?.schemeList,
    schemesResp?.schemeData,
    schemesResp?.schemeMetadata,
  ];

  candidateLists.forEach((list) => {
    safeArray(list).forEach((entry) => {
      const schemeId = normalizeId(
        firstDefined(entry?.schemeId, entry?.Sf_Id, entry?.sfId, entry?.id, entry?.scheme__c)
      );
      if (!schemeId) return;
      metaMap.set(schemeId, entry);
    });
  });

  return metaMap;
};

const hydrateSlabMeta = (slab, source) => {
  if (!source) return slab;
  if (slab.minBuy == null) slab.minBuy = toOptionalNumber(firstDefined(source.minBuy, source.MinBuy__c));
  if (slab.maxBuy == null) slab.maxBuy = toOptionalNumber(firstDefined(source.maxBuy, source.MaxBuy__c));
  if (!slab.buyUOM) slab.buyUOM = firstDefined(source.buyUOM, source.buyUoM, source.Buy_UoM__c);
  if (!slab.buyType) slab.buyType = firstDefined(source.buyType, source.Buy_Type__c);
  if (!slab.variantSelectionMode) {
    slab.variantSelectionMode = firstDefined(
      source.variantSelectionMode,
      source.variantSelectionMode__c,
      source.Variant_Selection_Mode__c
    );
  }
  if (slab.minVariantCount == null) {
    slab.minVariantCount = toOptionalNumber(
      firstDefined(source.minVariantCount, source.minVariantCount__c, source.Min_Variant_Count__c)
    );
  }
  if (!slab.qtyAggregationMode) {
    slab.qtyAggregationMode = firstDefined(
      source.qtyAggregationMode,
      source.qtyAggregationMode__c,
      source.Qty_Aggregation_Mode__c
    );
  }
  if (slab.phaseNumber == null) slab.phaseNumber = firstDefined(source.phaseNumber, source.phase, source.schemeSlabPhase);
  return slab;
};

const addFlatWrappers = (schemesResp, schemeMap, schemeMetaMap) => {
  safeArray(schemesResp?.productsWithSchemes).forEach((productEntry, entryIndex) => {
    safeArray(productEntry?.schemeWrappers).forEach((wrapper, wrapperIndex) => {
      const schemeId = normalizeId(
        firstDefined(wrapper?.schemeId, productEntry?.schemeId, wrapper?.scheme__c, productEntry?.scheme__c)
      );
      if (!schemeId) return;

      const schemeMeta = schemeMetaMap.get(schemeId);
      const schemeName = firstDefined(wrapper?.schemeName, productEntry?.schemeName, schemeMeta?.schemeName, schemeMeta?.Name, "Scheme");
      const bucketType = normalizeSlabType(firstDefined(wrapper?.slabType, wrapper?.Slab_Type__c, productEntry?.slabType));
      const schemeRecord = ensureSchemeRecord(schemeMap, schemeId, schemeName);
      const bucket = schemeRecord.buckets[bucketType];

      if (!bucket.logic) {
        bucket.logic = normalizeGroupLogic(
          getBucketLogicFromSource(wrapper, bucketType) ||
            getBucketLogicFromSource(productEntry, bucketType) ||
            getBucketLogicFromSource(schemeMeta, bucketType),
          "OR"
        );
      }

      const slabId =
        normalizeId(
          firstDefined(
            wrapper?.schemeSlabId,
            wrapper?.schemeSlabPhase,
            wrapper?.schemeSlabPhaseId,
            wrapper?.Scheme_Slab_Phase__c
          )
        ) ||
        `${schemeId}::${bucketType}::flat::${entryIndex}::${wrapperIndex}`;

      if (!bucket.slabMap.has(slabId)) {
        bucket.slabMap.set(slabId, {
          id: slabId,
          source: "flat",
          schemeId,
          schemeName,
          bucketType,
          wrappers: [],
          buyDefinitions: [],
          rewardWrapper: null,
          minBuy: null,
          maxBuy: null,
          buyUOM: null,
          buyType: null,
          variantSelectionMode: null,
          minVariantCount: null,
          qtyAggregationMode: null,
          phaseNumber: null,
        });
        bucket.slabs.push(bucket.slabMap.get(slabId));
      }

      const slab = bucket.slabMap.get(slabId);
      slab.wrappers.push(wrapper);
      hydrateSlabMeta(slab, wrapper);

      const definition = extractBuyDefinitionFromWrapper(wrapper);
      if (definition) slab.buyDefinitions.push(definition);

      if (!slab.rewardWrapper && hasReward(wrapper)) {
        slab.rewardWrapper = wrapper;
      }
    });
  });
};

const addCompoundSchemes = (schemesResp, schemeMap, schemeMetaMap) => {
  safeArray(schemesResp?.andSchemes).forEach((scheme, index) => {
    const rewardWrapper = scheme?.rewardWrapper || {};
    const schemeId = normalizeId(
      firstDefined(scheme?.schemeId, rewardWrapper?.schemeId, scheme?.scheme__c, rewardWrapper?.scheme__c)
    );
    if (!schemeId) return;

    const schemeMeta = schemeMetaMap.get(schemeId);
    const schemeName = firstDefined(scheme?.schemeName, rewardWrapper?.schemeName, schemeMeta?.schemeName, schemeMeta?.Name, "Scheme");
    const bucketType = normalizeSlabType(firstDefined(scheme?.slabType, rewardWrapper?.slabType));
    const schemeRecord = ensureSchemeRecord(schemeMap, schemeId, schemeName);
    const bucket = schemeRecord.buckets[bucketType];

    if (!bucket.logic) {
      bucket.logic = normalizeGroupLogic(
        getBucketLogicFromSource(scheme, bucketType) ||
          getBucketLogicFromSource(rewardWrapper, bucketType) ||
          getBucketLogicFromSource(schemeMeta, bucketType),
        "AND"
      );
    }

    const slabId =
      normalizeId(firstDefined(scheme?.schemeSlabId, rewardWrapper?.schemeSlabId, rewardWrapper?.schemeSlabPhase)) ||
      `${schemeId}::${bucketType}::compound::${index}`;

    const phases = safeArray(scheme?.phases)
      .map((phase, phaseIndex) => {
        const buyDefinitions = extractBuyDefinitionsFromPhase(phase);
        return {
          id: `${slabId}::phase::${phaseIndex}`,
          minBuy: toOptionalNumber(firstDefined(phase?.minBuy, phase?.MinBuy__c)),
          maxBuy: toOptionalNumber(firstDefined(phase?.maxBuy, phase?.MaxBuy__c)),
          buyUOM: firstDefined(phase?.buyUOM, phase?.buyUoM, phase?.Buy_UoM__c),
          buyType: firstDefined(phase?.buyType, phase?.Buy_Type__c),
          variantSelectionMode: firstDefined(
            phase?.variantSelectionMode,
            phase?.variantSelectionMode__c,
            phase?.Variant_Selection_Mode__c
          ),
          minVariantCount: toOptionalNumber(
            firstDefined(phase?.minVariantCount, phase?.minVariantCount__c, phase?.Min_Variant_Count__c)
          ),
          qtyAggregationMode: firstDefined(
            phase?.qtyAggregationMode,
            phase?.qtyAggregationMode__c,
            phase?.Qty_Aggregation_Mode__c
          ),
          buyDefinitions,
        };
      })
      .filter((phase) => phase.buyDefinitions.length > 0);

    if (!phases.length) return;

    bucket.slabs.push({
      id: slabId,
      source: "compound",
      schemeId,
      schemeName,
      bucketType,
      rewardWrapper,
      phases,
      phaseNumber: firstDefined(scheme?.phaseNumber, rewardWrapper?.phaseNumber),
    });
  });
};

const buildSchemeMap = (schemesResp) => {
  const schemeMap = new Map();
  const schemeMetaMap = buildSchemeMetaMap(schemesResp);
  addFlatWrappers(schemesResp, schemeMap, schemeMetaMap);
  addCompoundSchemes(schemesResp, schemeMap, schemeMetaMap);
  return schemeMap;
};

const buildLookup = (items = []) => {
  const linesByProductId = new Map();
  const lineMap = new Map();

  safeArray(items).forEach((item) => {
    const line = {
      ...item,
      key: normalizeId(item?.key),
      productId: normalizeId(item?.productId),
      isFree: truthy(item?.isFree),
      ...computeLineMeasures(item),
    };

    if (!line.key || !line.productId) return;
    lineMap.set(line.key, line);

    if (line.isFree) return;

    if (!linesByProductId.has(line.productId)) {
      linesByProductId.set(line.productId, []);
    }
    linesByProductId.get(line.productId).push(line);
  });

  return { linesByProductId, lineMap };
};

const evaluateRequirement = (requirement, lookup) => {
  const buyDefinitions = dedupeDefinitions(requirement?.buyDefinitions || []);
  const lineInfoMap = new Map();
  const measureKind = getMeasureKind(requirement?.buyUOM, requirement?.buyType);

  buyDefinitions.forEach((definition) => {
    safeArray(lookup.linesByProductId.get(definition.productId)).forEach((line) => {
      if (!lineInfoMap.has(line.key)) {
        lineInfoMap.set(line.key, { line, definition });
      }
    });
  });

  const lineInfos = Array.from(lineInfoMap.values()).filter(({ line }) => toNumber(line?.units, 0) > 0);
  const actualTotal = lineInfos.reduce(
    (sum, info) => sum + getLineMeasureValue(info.line, requirement?.buyUOM, requirement?.buyType),
    0
  );

  const minBuy = toNumber(requirement?.minBuy, 0);
  const maxBuy = toOptionalNumber(requirement?.maxBuy);
  const variantMode = normalizeVariantMode(requirement?.variantSelectionMode);
  const minVariantCount = toNumber(requirement?.minVariantCount, 0);
  const qtyAggregationMode = normalizeQtyAggregationMode(requirement?.qtyAggregationMode);

  let qualified = actualTotal >= minBuy && (maxBuy == null || actualTotal <= maxBuy);
  const groupStats = {};

  if (variantMode === "ANY_N") {
    lineInfos.forEach(({ line, definition }) => {
      const groupKey =
        normalizeText(
          firstDefined(
            definition?.variantGroupValue,
            definition?.variantGroup,
            definition?.variantGroupName,
            definition?.productId
          )
        ) || definition?.productId;

      if (!groupStats[groupKey]) {
        groupStats[groupKey] = {
          actual: 0,
          lineKeys: new Set(),
        };
      }

      groupStats[groupKey].actual += getLineMeasureValue(line, requirement?.buyUOM, requirement?.buyType);
      groupStats[groupKey].lineKeys.add(line.key);
    });

    const distinctGroups = Object.keys(groupStats).filter((groupKey) => groupStats[groupKey].lineKeys.size > 0);
    if (distinctGroups.length < minVariantCount) {
      qualified = false;
    } else if (qtyAggregationMode === "PER_VARIANT") {
      qualified = distinctGroups.every((groupKey) => {
        const actual = groupStats[groupKey].actual;
        const meetsMin = actual >= minBuy;
        const meetsMax = maxBuy == null || actual <= maxBuy;
        return meetsMin && meetsMax;
      });
    } else {
      qualified = actualTotal >= minBuy && (maxBuy == null || actualTotal <= maxBuy);
    }
  }

  return {
    qualified,
    actual: actualTotal,
    minBuy,
    maxBuy,
    measureKind,
    buyDefinitions,
    lineInfos,
    lineItems: lineInfos.map((entry) => entry.line),
    lineKeys: lineInfos.map((entry) => entry.line.key),
    groupStats,
  };
};

const compareEvaluations = (left, right) => {
  const leftRank = toNumber(left?.rankValue, 0);
  const rightRank = toNumber(right?.rankValue, 0);
  if (rightRank !== leftRank) return rightRank - leftRank;

  const leftActual = toNumber(left?.actual, 0);
  const rightActual = toNumber(right?.actual, 0);
  if (rightActual !== leftActual) return rightActual - leftActual;

  const leftPhase = toNumber(left?.phaseNumber, 0);
  const rightPhase = toNumber(right?.phaseNumber, 0);
  return rightPhase - leftPhase;
};

const evaluateFlatSlab = (slab, lookup) => {
  const requirement = {
    minBuy: slab.minBuy,
    maxBuy: slab.maxBuy,
    buyUOM: slab.buyUOM,
    buyType: slab.buyType,
    variantSelectionMode: slab.variantSelectionMode,
    minVariantCount: slab.minVariantCount,
    qtyAggregationMode: slab.qtyAggregationMode,
    buyDefinitions: dedupeDefinitions(slab.buyDefinitions),
  };

  const result = evaluateRequirement(requirement, lookup);

  return {
    qualified: result.qualified,
    schemeId: slab.schemeId,
    schemeName: slab.schemeName,
    slabId: slab.id,
    bucketType: slab.bucketType,
    phaseNumber: slab.phaseNumber,
    rewardWrapper: slab.rewardWrapper || slab.wrappers?.[0] || {},
    lineItems: result.lineItems,
    actual: result.actual,
    minBuy: result.minBuy,
    measureKind: result.measureKind,
    requirement,
    rewardProgress: result,
    rankValue: result.minBuy,
  };
};

const resolveCompoundRewardProgress = (slab, phaseResults, lookup) => {
  const primaryPhase =
    phaseResults
      .slice()
      .sort((left, right) => compareEvaluations({ rankValue: left.minBuy }, { rankValue: right.minBuy }))[0] ||
    phaseResults[0];

  if (!primaryPhase) {
    return {
      qualified: false,
      actual: 0,
      minBuy: 0,
      measureKind: "unit",
      lineItems: [],
    };
  }

  const unionDefinitions = dedupeDefinitions(phaseResults.flatMap((phaseResult) => phaseResult.buyDefinitions || []));
  const rewardWrapper = slab.rewardWrapper || {};

  const rewardRequirement = {
    minBuy: firstDefined(rewardWrapper.minBuy, rewardWrapper.MinBuy__c, primaryPhase.minBuy),
    maxBuy: firstDefined(rewardWrapper.maxBuy, rewardWrapper.MaxBuy__c, primaryPhase.maxBuy),
    buyUOM: firstDefined(rewardWrapper.buyUOM, rewardWrapper.buyUoM, primaryPhase.requirement?.buyUOM),
    buyType: firstDefined(rewardWrapper.buyType, primaryPhase.requirement?.buyType),
    variantSelectionMode: firstDefined(
      rewardWrapper.variantSelectionMode,
      rewardWrapper.variantSelectionMode__c,
      primaryPhase.requirement?.variantSelectionMode
    ),
    minVariantCount: firstDefined(
      rewardWrapper.minVariantCount,
      rewardWrapper.minVariantCount__c,
      primaryPhase.requirement?.minVariantCount
    ),
    qtyAggregationMode: firstDefined(
      rewardWrapper.qtyAggregationMode,
      rewardWrapper.qtyAggregationMode__c,
      primaryPhase.requirement?.qtyAggregationMode
    ),
    buyDefinitions: unionDefinitions.length ? unionDefinitions : primaryPhase.buyDefinitions,
  };

  const rewardProgress = evaluateRequirement(rewardRequirement, lookup);
  if (rewardProgress.lineItems.length) return rewardProgress;

  return {
    ...primaryPhase,
    lineItems: Array.from(
      new Map(phaseResults.flatMap((phaseResult) => phaseResult.lineItems.map((line) => [line.key, line]))).values()
    ),
  };
};

const evaluateCompoundSlab = (slab, lookup) => {
  const phaseResults = safeArray(slab.phases).map((phase) => {
    const requirement = {
      minBuy: phase.minBuy,
      maxBuy: phase.maxBuy,
      buyUOM: phase.buyUOM,
      buyType: phase.buyType,
      variantSelectionMode: phase.variantSelectionMode,
      minVariantCount: phase.minVariantCount,
      qtyAggregationMode: phase.qtyAggregationMode,
      buyDefinitions: phase.buyDefinitions,
    };
    const result = evaluateRequirement(requirement, lookup);
    return { ...result, requirement };
  });

  const qualified = phaseResults.length > 0 && phaseResults.every((phaseResult) => phaseResult.qualified);
  const rewardProgress = resolveCompoundRewardProgress(slab, phaseResults, lookup);
  const lineItems = Array.from(
    new Map(phaseResults.flatMap((phaseResult) => phaseResult.lineItems.map((line) => [line.key, line]))).values()
  );

  return {
    qualified,
    schemeId: slab.schemeId,
    schemeName: slab.schemeName,
    slabId: slab.id,
    bucketType: slab.bucketType,
    phaseNumber: slab.phaseNumber,
    rewardWrapper: slab.rewardWrapper || {},
    lineItems,
    actual: rewardProgress.actual,
    minBuy: rewardProgress.minBuy,
    measureKind: rewardProgress.measureKind,
    rewardProgress,
    rankValue: rewardProgress.minBuy,
  };
};

const evaluateSlab = (slab, lookup) =>
  slab?.source === "compound" ? evaluateCompoundSlab(slab, lookup) : evaluateFlatSlab(slab, lookup);

const evaluateBucket = (bucket, lookup) => {
  const logic = normalizeGroupLogic(bucket?.logic, "OR");
  const evaluations = safeArray(bucket?.slabs).map((slab) => evaluateSlab(slab, lookup));

  if (!evaluations.length) {
    return { qualified: false, logic, evaluations, applied: [] };
  }

  if (logic === "AND") {
    const qualified = evaluations.every((evaluation) => evaluation.qualified);
    return {
      qualified,
      logic,
      evaluations,
      applied: qualified ? evaluations : [],
    };
  }

  const qualifying = evaluations.filter((evaluation) => evaluation.qualified).sort(compareEvaluations);
  return {
    qualified: qualifying.length > 0,
    logic,
    evaluations,
    applied: qualifying.length ? [qualifying[0]] : [],
  };
};

const computeRewardMultiplier = (rewardWrapper, rewardProgress) => {
  const minBuy = toNumber(firstDefined(rewardWrapper?.minBuy, rewardWrapper?.MinBuy__c, rewardProgress?.minBuy), 0);
  const actual = toNumber(rewardProgress?.actual, 0);

  if (minBuy <= 0 || actual < minBuy) return 0;
  if (truthy(rewardWrapper?.isProRate)) return actual / minBuy;
  if (truthy(rewardWrapper?.isRepeatableSlab)) return Math.floor(actual / minBuy);
  return 1;
};

const computeLineDiscount = (rewardWrapper, rewardProgress, line, totalTaxableGross) => {
  const multiplier = computeRewardMultiplier(rewardWrapper, rewardProgress);
  if (multiplier <= 0) return 0;

  const rewardPct = toOptionalNumber(
    firstDefined(rewardWrapper?.rewardDiscountPercentage, rewardWrapper?.rewardDiscountPct, rewardWrapper?.discountPercentage)
  );
  const rewardValue = toOptionalNumber(
    firstDefined(rewardWrapper?.rewardDiscountValue, rewardWrapper?.rewardValue, rewardWrapper?.discountValue)
  );

  if (rewardPct != null) {
    return round2(((rewardPct * multiplier) / 100) * toNumber(line?.taxableGross, 0));
  }

  if (rewardValue != null) {
    const totalPool = round2(rewardValue * multiplier);
    const share = totalTaxableGross > 0 ? toNumber(line?.taxableGross, 0) / totalTaxableGross : 0;
    return round2(totalPool * share);
  }

  return 0;
};

const buildAppliedDetail = (evaluation, discountForWrapper = 0) => {
  const rewardWrapper = evaluation?.rewardWrapper || {};
  const rewardType = rewardWrapper?.rewardType || "";
  const detail = {
    schemeId: evaluation?.schemeId,
    schemeSlabId: evaluation?.slabId,
    schemeName: evaluation?.schemeName || rewardWrapper?.schemeName || "Scheme",
    rewardType,
    rewardDiscountValue: firstDefined(rewardWrapper?.rewardDiscountValue, rewardWrapper?.rewardValue, rewardWrapper?.discountValue),
    rewardDiscountPercentage: firstDefined(
      rewardWrapper?.rewardDiscountPercentage,
      rewardWrapper?.rewardDiscountPct,
      rewardWrapper?.discountPercentage
    ),
    minBuy: evaluation?.minBuy,
    qtyQualified: evaluation?.actual,
    qtyQualifiedKind: evaluation?.measureKind,
    slabType: evaluation?.bucketType === ADDITIONAL_BUCKET ? "Additional Discount" : "Normal",
    isFreeProduct: truthy(rewardWrapper?.isFreeProduct) || normalizeLower(rewardType).includes("free"),
  };

  if (discountForWrapper > 0) {
    detail.discountForWrapper = discountForWrapper;
  }

  return detail;
};

const applyEvaluation = (evaluation, lineResults, freeRewardsByProductId) => {
  const rewardWrapper = evaluation?.rewardWrapper || {};
  const rewardType = normalizeLower(rewardWrapper?.rewardType);
  const isFreeProduct = truthy(rewardWrapper?.isFreeProduct) || rewardType.includes("free");
  const lines = safeArray(evaluation?.lineItems).filter((line) => !line?.isFree);

  if (!lines.length) return;

  if (isFreeProduct) {
    const productId = normalizeId(firstDefined(rewardWrapper?.productId, rewardWrapper?.productSfId, rewardWrapper?.freeProductSfId));
    const baseQty = Math.max(1, toNumber(firstDefined(rewardWrapper?.quantity, rewardWrapper?.Quantity__c), 1));
    const multiplier = computeRewardMultiplier(rewardWrapper, evaluation?.rewardProgress || evaluation);
    const rewardQty = multiplier > 0 ? Math.max(baseQty, Math.floor(baseQty * multiplier)) : 0;

    if (productId && rewardQty > 0) {
      const existing = freeRewardsByProductId[productId] || {};
      freeRewardsByProductId[productId] = {
        ...existing,
        ...rewardWrapper,
        productId,
        quantity: round2(toNumber(existing?.quantity, 0) + rewardQty),
        schemeName: evaluation?.schemeName || rewardWrapper?.schemeName || existing?.schemeName || "Scheme",
      };
    }

    lines.forEach((line) => {
      if (!lineResults[line.key]) {
        lineResults[line.key] = { discount: 0, details: [] };
      }
      lineResults[line.key].details.push(buildAppliedDetail(evaluation, 0));
    });
    return;
  }

  const totalTaxableGross = lines.reduce((sum, line) => sum + toNumber(line?.taxableGross, 0), 0);
  lines.forEach((line) => {
    const discountForWrapper = computeLineDiscount(
      rewardWrapper,
      evaluation?.rewardProgress || evaluation,
      line,
      totalTaxableGross
    );

    if (!lineResults[line.key]) {
      lineResults[line.key] = { discount: 0, details: [] };
    }

    lineResults[line.key].discount = round2(toNumber(lineResults[line.key].discount, 0) + discountForWrapper);
    lineResults[line.key].details.push(buildAppliedDetail(evaluation, discountForWrapper));
  });
};

export const evaluateSchemeResponse = ({ items = [], schemesResp = null } = {}) => {
  const schemeMap = buildSchemeMap(schemesResp);
  const lookup = buildLookup(items);
  const lineResults = {};
  const freeRewardsByProductId = {};
  const schemeSummaries = [];

  lookup.lineMap.forEach((line) => {
    lineResults[line.key] = { discount: 0, details: [] };
  });

  Array.from(schemeMap.values()).forEach((schemeRecord) => {
    const normalBucket = schemeRecord?.buckets?.[NORMAL_BUCKET];
    const additionalBucket = schemeRecord?.buckets?.[ADDITIONAL_BUCKET];
    const hasNormalSlabs = safeArray(normalBucket?.slabs).length > 0;
    const hasAdditionalSlabs = safeArray(additionalBucket?.slabs).length > 0;

    const normalResult = hasNormalSlabs ? evaluateBucket(normalBucket, lookup) : { qualified: false, applied: [] };
    const additionalResult =
      hasAdditionalSlabs && normalResult.qualified ? evaluateBucket(additionalBucket, lookup) : { qualified: false, applied: [] };

    safeArray(normalResult?.applied).forEach((evaluation) => applyEvaluation(evaluation, lineResults, freeRewardsByProductId));
    safeArray(additionalResult?.applied).forEach((evaluation) => applyEvaluation(evaluation, lineResults, freeRewardsByProductId));

    schemeSummaries.push({
      schemeId: schemeRecord.schemeId,
      schemeName: schemeRecord.schemeName,
      normalQualified: !!normalResult.qualified,
      additionalQualified: !!additionalResult.qualified,
      appliedCount: safeArray(normalResult?.applied).length + safeArray(additionalResult?.applied).length,
    });
  });

  Object.keys(lineResults).forEach((lineKey) => {
    lineResults[lineKey].details = safeArray(lineResults[lineKey].details).map((detail, index, arr) => ({
      ...detail,
      active: index === arr.length - 1,
    }));
  });

  return {
    lineResults,
    freeRewardsByProductId,
    schemeSummaries,
  };
};
