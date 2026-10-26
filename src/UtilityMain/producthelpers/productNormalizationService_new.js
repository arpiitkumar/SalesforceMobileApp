/**
 * Normalize products with pricing and cart data

*/
import UniversalUpdateInsert from "../../database/dbService/UniversalUpdateInsert";

// make normalizeProducts async
export const normalizeProducts = async (
  rawProducts,
  uomDataMap,
  cartLookupMap,
  subCategoryFilter = [],
  distributorId = null,
  selectedBeatDay = {}
) => {
  let filtered = rawProducts;
  // COMMENTED OUT: Do not filter by subCategoryFilter
  // if (subCategoryFilter.length > 0) {
  //   filtered = rawProducts.filter(prod =>
  //     subCategoryFilter.includes((prod.SubCategory__c || "").trim())
  //   );
  // }

  // run map with async callbacks and wait for all
  const normalized = await Promise.all(
    filtered.map(async (product) => {
      const enrichedProduct = enrichProductWithUOMInline(product, uomDataMap);

      const { units: unitsFromCart, mode: unitMode } = getUnitsFromCartInline(
        cartLookupMap[enrichedProduct.Sf_Id || enrichedProduct.id],
        enrichedProduct.UnitperCase__c || 1
      );

      // const matchedPricing = pricingRecords.find(
      //   rec => rec.Fraction__c === (enrichedProduct.Sf_Id || enrichedProduct.id)
      // );

      // <--- await the async pricing extractor
      // const { PTR, PTD } = await extractPricingValuesInlineOld(matchedPricing, enrichedProduct);
      const { PTR, PTD } = await extractPricingValuesInline(distributorId, enrichedProduct);
      const { stockAvailable } = await getCgcloudInventoryRecord(distributorId, enrichedProduct.Sf_Id, selectedBeatDay);
      // console.log("stockAvailable for product ", enrichedProduct.Sf_Id, " is ", stockAvailable);
      const prodId = enrichedProduct.Sf_Id || enrichedProduct.id || String(Math.random());

      return {
        id: prodId,
        _id: prodId,
        ...enrichedProduct,
        quantityUnits: unitsFromCart,
        quantity: unitsFromCart,
        unitMode: unitsFromCart > 0 ? unitMode : (product.unitMode || "Unit"),
        PTR__c: PTR != null ? String(PTR) : "",
        PTD__c: PTD != null ? String(PTD) : "",
        UnitperCase__c: enrichedProduct.UnitperCase__c || 1,
        MaxCaseLimit: product.MaxCaseLimit != null ? product.MaxCaseLimit : 99,
        Stock: stockAvailable === undefined ? "N/A" : stockAvailable,
      };
    })
  );
  return normalized;
};


// Inline helper functions for normalization
const enrichProductWithUOMInline = (product, uomDataMap) => {
  const uom = uomDataMap[product.Sf_Id];
  return {
    ...product,
    UnitperCase__c: uom?.cgcloud__Pieces_per_parent_unit__c ?? product.UnitperCase__c,
    Weight_Per_Unit_in_KG__c: uom?.Weight_Per_Unit_in_KG__c ?? product.Weight_Per_Unit_in_KG__c,
  };
};

const getUnitsFromCartInline = (cartEntry, defaultPerCase = 1) => {
  if (!cartEntry) return { units: 0, mode: "Unit" };

  const savedQty = parseInt(String(cartEntry.Quantity || "0"), 10) || 0;
  const savedPerCase = cartEntry.UnitperCase__c
    ? parseInt(cartEntry.UnitperCase__c, 10)
    : defaultPerCase;

  const isCase = (cartEntry.UnitMode || "").toLowerCase() === "case";
  const units = isCase ? savedQty * (savedPerCase || defaultPerCase || 1) : savedQty;

  return {
    units,
    mode: isCase ? "Case" : "Unit"
  };
};
const extractPricingValuesInlineOld = async (pricingRecord, enrichedProduct, suggestedOrder = false) => {
  try {

    // console.log("extractPricingValuesInline called with:", pricingRecord, enrichedProduct);
    // Safe defaults
    let PTR = 0;
    let PTD = 0;

    // If there's no pricingRecord, return defaults early
    if (!pricingRecord) {
      return { PTR, PTD };
    }

    // Get logged in user (wrap in try/catch via outer try)
    const loggedInUser = await UniversalUpdateInsert({
      ObjectName: "User",
      Type: "get",
    });

    const devName = loggedInUser?.[0]?.DeveloperName || "";

    // If HT roles, apply custom ZPTD logic
    if (devName === "H_T_SR" || devName === "H_T_SO" || devName === "H_T_ASO") {

      //check for suggested order sub db

      if (suggestedOrder === true) {

        console.log("Suggested order true.....///////////////..");
        if (pricingRecord?.Condition_type__c === "ZPTR") {

          const PricingMarginMasterRecords = await UniversalUpdateInsert({
            ObjectName: "Pricing_Margin_Master__c",
            Type: "get",
            filters: [
              { field: "Category__c", value: enrichedProduct?.Category__c },
              { field: "Price_Group__c", value: pricingRecord?.Customer_Price_Group__c },
            ],
          });
          // let pricingMargin = 0;

          // if (pricingRecord?.Customer_Group__c === '03') {

          console.log('SUB DB>>>>>')
          pricingMargin = parseFloat(PricingMarginMasterRecords?.[0]?.Sub_DB__c) || 0;
          // }

          console.log("pricing margin::", pricingMargin)
          console.log('pricingRecord?.Amount__c::', pricingRecord?.Amount__c)
          const marginDecimal = pricingMargin / 100;
          const marginMultiplier = 1 - marginDecimal;
          console.log("marginMultiplier::", marginMultiplier)
          const ptdVal = parseFloat(pricingRecord?.Amount__c) || 0;
          PTR = ptdVal * marginMultiplier;
          PTD = ptdVal;
          console.log("PTR and PTD::", PTR, PTD)
          return { PTR, PTD };
        } else if (pricingRecord?.Condition_type__c === "ZPTD") {

          const PricingMarginMasterRecords = await UniversalUpdateInsert({
            ObjectName: "Pricing_Margin_Master__c",
            Type: "get",
            filters: [
              { field: "Category__c", value: enrichedProduct?.Category__c },
              { field: "Price_Group__c", value: pricingRecord?.Customer_Price_Group__c },
            ],
          });
          // let pricingMargin = 0;

          // if (pricingRecord?.Customer_Group__c === '03') {

          console.log('SUB DB>>>>>')
          pricingMargin = parseFloat(PricingMarginMasterRecords?.[0]?.Sub_DB__c) || 0;
          // }

          console.log("pricing margin::", pricingMargin)

          const marginDecimal = pricingMargin / 100;
          const marginMultiplier = 1 + marginDecimal;
          console.log("marginMultiplier::", marginMultiplier)
          const ptdVal = parseFloat(pricingRecord?.Amount__c) || 0;
          PTR = ptdVal * marginMultiplier;
          PTD = ptdVal;
          console.log("PTR and PTD::", PTR, PTD)
          return { PTR, PTD };
        }


      }



      console.log("pricingRecord Condition_type__c::.....................", pricingRecord)
      if (pricingRecord?.Condition_type__c === "ZPTD") {

        console.log("Applying ZPTD logic for HT role.......");
        const PricingMarginMasterRecords = await UniversalUpdateInsert({
          ObjectName: "Pricing_Margin_Master__c",
          Type: "get",
          filters: [
            { field: "Category__c", value: enrichedProduct?.Category__c },
            { field: "Price_Group__c", value: pricingRecord?.Customer_Price_Group__c },
          ],
        });
        let pricingMargin = 0;

        // if (pricingRecord?.Customer_Group__c === '04') {

        console.log('DIRECT>>>>>')
        pricingMargin = parseFloat(PricingMarginMasterRecords?.[0]?.Direct__c) || 0;
        // } else if (pricingRecord?.Customer_Group__c === '05') {
        //   console.log('SUPER STOCKIST>>>>')
        //   pricingMargin = parseFloat(PricingMarginMasterRecords?.[0]?.Super__c) || 0;
        // }

        console.log("pricing margin::", pricingMargin)

        const marginDecimal = pricingMargin / 100;
        const marginMultiplier = 1 + marginDecimal;

        const ptdVal = parseFloat(pricingRecord?.Amount__c) || 0;
        PTR = ptdVal * marginMultiplier;
        PTD = ptdVal;
        console.log("PTR and PTD::", PTR, PTD)
        return { PTR, PTD };
      }

      // Fallback for HT roles: use PTR__c or PTD_PTSS__c
      PTR = parseFloat(pricingRecord?.Amount__c) || 0;
      PTD = parseFloat(pricingRecord?.Amount__c) || 0;
      return { PTR, PTD };
    }
    console.log("pricing record............", pricingRecord);
    // For non-HT roles: return PTR/PTD from pricingRecord (fallbacks to PTD if PTR missing)
    PTR = parseFloat(pricingRecord?.Amount__c);
    PTD = parseFloat(pricingRecord?.Amount__c);
    if (Number.isNaN(PTR) || PTR == null) PTR = Number.isFinite(PTD) ? PTD : 0;
    if (Number.isNaN(PTD) || PTD == null) PTD = 0;

    return { PTR, PTD };
  } catch (err) {
    console.error("extractPricingValuesInline error:", err);
    // Always return a safe object to avoid destructuring errors
    return { PTR: 0, PTD: 0 };
  }
};

const extractPricingValuesInline = async (
  distributorId,
  enrichedProduct,
  suggestedOrder = false
) => {
  try {
    let PTR = 0;
    let PTD = 0;

    const loggedInUser = await UniversalUpdateInsert({
      ObjectName: "User",
      Type: "get",
    });

    const devName = loggedInUser?.[0]?.DeveloperName || "";
    let newdistributorId = distributorId;

    if (devName === "H_T_ASO") {
      const AccountRecordFromBeat = await UniversalUpdateInsert({
        ObjectName: "Account",
        Type: "get",
        filters: [
          {
            field: "Sf_Id",
            value: distributorId
          }
        ]
      });
      const parentId = AccountRecordFromBeat[0].ParentId;
      newdistributorId = parentId;
    }

    const ProductPricing = await UniversalUpdateInsert({
      ObjectName: "Product_Pricing___c",
      Type: "get",
      filters: [
        { field: "ProductId", value: enrichedProduct?.Sf_Id },
        { field: "AccountId", value: newdistributorId },
      ],
    });


    if (!Array.isArray(ProductPricing) || ProductPricing.length === 0) {
      return { PTR: 0, PTD: 0 };
    }

    const pricing = ProductPricing[0];

    PTR = suggestedOrder === true ? Number(pricing?.SubDbPrice) : Number(pricing?.Ptr);
    PTD = Number(pricing?.Ptd);

    if (!Number.isFinite(PTR)) PTR = Number.isFinite(PTD) ? PTD : 0;
    if (!Number.isFinite(PTD)) PTD = 0;

    return { PTR, PTD };
  } catch (err) {
    console.error("extractPricingValuesInline error:", err);
    return { PTR: 0, PTD: 0 };
  }
};



/**
 * Extract unique categories from normalized products
 */
export const extractCategories = (normalizedProducts) => {
  const categorySet = new Set();
  normalizedProducts.forEach(prod => {
    categorySet.add((prod.Category__c || "Undefined").trim());
  });
  return Array.from(categorySet);
};

const getCgcloudInventoryRecord = async (distributorId, productId, selectedBeatDay) => {

  const loggedInUser = await UniversalUpdateInsert({
    ObjectName: "User",
    Type: "get",
  });
  const devName = loggedInUser?.[0]?.DeveloperName || "";
  let newdistributorId = distributorId;

  if (devName === "H_T_ASO") {
    // const AccountRecordFromBeat = await UniversalUpdateInsert({
    //   ObjectName: "Account",
    //   Type: "get",
    //   filters: [
    //     {
    //       field: "Sf_Id",
    //       value: distributorId
    //     }
    //   ]
    // });
    // const parentId = AccountRecordFromBeat[0]?.ParentId;
    // newdistributorId = parentId || distributorId;
    const result = await UniversalUpdateInsert({
      ObjectName: 'Stock_Check__c',
      Type: 'get',
      filters: [
        { field: "SKU__c", value: productId },
        { field: "Beat_Day__c", value: selectedBeatDay.Sf_Id },
        // { field: "Stock_Check_Date__c", value:new Date().toISOString().split('T')[0]}
      ],
    });
    const getLatestTodayRecord = (data) => {
      if (!Array.isArray(data) || data.length === 0) return null;
      const today = new Date().toISOString().split('T')[0];
      const cleanDate = (val) =>
        typeof val === 'string' ? val.replace(/^"|"$/g, '') : val;
      const todayRecords = data.filter(item => {
        if (!item.Stock_Check_Date__c) return false;
        const raw = cleanDate(item.Stock_Check_Date__c);
        const d = new Date(raw);
        if (isNaN(d)) return false;
        return d.toISOString().split('T')[0] === today;
      });
      if (todayRecords.length === 0) return null;
      // 🔥 latest record by time
      return todayRecords.reduce((latest, item) => {
        const currTime = new Date(cleanDate(item.Stock_Check_Date__c)).getTime();
        const prevTime = new Date(cleanDate(latest.Stock_Check_Date__c)).getTime();
        return currTime > prevTime ? item : latest;
      });
    };
    const latestRecord = getLatestTodayRecord(result);
    // console.log('Latest Today Record 👉', latestRecord);
    return {
      stockAvailable: latestRecord?.Closing_Stock_Qty__c ?? 'Stock Record Not Get',
    };
  } else {
    // console.log('distributorId and productId::::::', newdistributorId, productId);
    const cgcloudInventoryData = await UniversalUpdateInsert({
      ObjectName: "cgcloud__Inventory__c",
      Type: "get",
      filters: [
        { field: "cgcloud__Account__c", value: newdistributorId },
        { field: "cgcloud__Product__c", value: productId },
      ],
    });
    if (cgcloudInventoryData.length === 0) {
      return {
        stockAvailable: 'Stock Record Not Get',
      };
    }

    return {
      stockAvailable: parseInt(cgcloudInventoryData?.[0]?.Saleable_Stock_Pcs__c) || 0,
    }
  }
}


export { extractPricingValuesInline };