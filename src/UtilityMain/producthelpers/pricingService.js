
import UniversalUpdateInsert from "../../database/dbService/UniversalUpdateInsert";

/**
 * Get beat account information with pricing channel details
 */
export const getBeatAccountPricingInfo = async (beatId, selectedVisitBeatId, loggedInUser, distributorId) => {
  try {
    const beatRecord = await UniversalUpdateInsert({
      ObjectName: "Beat__c",
      Type: "get",
      filters: [
        {
          field: "Sf_Id",
          value: selectedVisitBeatId || beatId
        }
      ]
    });
    console.log("beat record.....", beatRecord)

    if (!beatRecord || beatRecord.length === 0) {
      throw new Error('Beat record not found');
    }

    console.log("hello",loggedInUser[0])
    let incoternRecord = null
    if (loggedInUser[0].DeveloperName === 'H_T_ASO') {
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

      
      console.log("AccountRecordFromBeat................", AccountRecordFromBeat)

      if (AccountRecordFromBeat && AccountRecordFromBeat.length > 0) {
        const parentId = AccountRecordFromBeat[0].ParentId;
        console.log("parentId................", parentId)
        incoternRecord = await UniversalUpdateInsert({
          ObjectName: "IncotermAssignment__c",
          Type: "get",
          filters: [
            {
              field: "Account__c",
              value: parentId
            }
          ]
        });
        console.log("incoternRecord................", incoternRecord) 
      }
    } else {

      incoternRecord = await UniversalUpdateInsert({
        ObjectName: "IncotermAssignment__c",
        Type: "get",
        filters: [
          {
            field: "Account__c",
            value:distributorId
          }
        ]
      });
    }


    // const incoternRecord = await UniversalUpdateInsert({
    //   ObjectName: "IncotermAssignment__c",
    //   Type: "get",
    //   filters: [
    //     {
    //       field: "Account__c",
    //       value: beatRecord[0].DirectDBSubDB__c
    //     }
    //   ]
    // });

    if (!incoternRecord || incoternRecord.length === 0) {
      throw new Error('Incoterm assignment not found');
    }

    return {
      beatRecord: beatRecord[0],
      incoternRecord: incoternRecord[0],
    };
  } catch (err) {
    console.error('Error fetching beat pricing info:', err);
    throw err;
  }
};

/**
 * Extract vertical array from incoterm assignment
 */
export const getVerticalsFromIncoterm = (incoternRecord) => {
  return (incoternRecord?.Vertical__c || "")
    .split(";")
    .map(v => v.trim())
    .filter(v => v.length > 0);
};

/**
 * Fetch and filter pricing history records based on current date
 */
export const getValidPricingRecords = async (incoternRecord, verticalArray) => {

 console.log("incoternRecord and verticalArray....", incoternRecord, verticalArray )
  try {
    const pricingRecords = await UniversalUpdateInsert({
      ObjectName: "Product_Pricing_History__c",
      Type: "get",
      filters: [
        {
          field: "Distribution_Channel__c",
          value: incoternRecord.DistributorChannel__c
        },
        {
          field: "Customer_Group__c",
          value: incoternRecord.Customer_Group__c
        },
        {
          field: "Customer_Price_Group__c",
          value: incoternRecord.Zone__c
        }
      ]
    });

    console.log("pricingRecords....", pricingRecords )

    // Filter by vertical
    const verticalFiltered = pricingRecords.filter(item =>
      verticalArray.includes(String(item.Division__c))
    );

    // Filter by valid date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const validPricingRecords = verticalFiltered.filter(item => {
      const validFrom = item.Valid_From__c ? new Date(item.Valid_From__c) : null;
      const validTo = item.Valid_To__c ? new Date(item.Valid_To__c) : null;

      if (!validFrom || !validTo) return false;

      const from = new Date(validFrom.setHours(0, 0, 0, 0));
      const to = new Date(validTo.setHours(0, 0, 0, 0));

      return today >= from && today <= to;
    });

    console.log('Valid pricing records count:', validPricingRecords);
    return validPricingRecords;
  } catch (err) {
    console.error('Error fetching pricing records:', err);
    return [];
  }
};

/**
 * Find matching pricing record for a product
 */
export const findProductPricing = (productId, pricingRecords) => {
  return pricingRecords.find(rec => rec.Fraction__c === productId);
};

/**
 * Extract PTR and PTD values from pricing record
 */
export const extractPricingValues = async (pricingRecord) => {

   console.log("pricingRecord.::::::::::::....", pricingRecord)

  // const PricingMarginMasterRecords = await UniversalUpdateInsert({
  //   ObjectName: "Pricing_Margin_Master__c",
  //   Type: "get",
  //   filters: [
  //     {
  //       field: "Distribution_Channel__c",
  //       value: incoternRecord.DistributorChannel__c
  //     },
  //     {
  //       field: "Customer_Group__c",
  //       value: incoternRecord.Customer_Group__c
  //     },
  //     {
  //       field: "Customer_Price_Group__c",
  //       value: incoternRecord.Zone__c
  //     }
  //   ]
  // });


  return {
    PTR: pricingRecord?.PTR__c || 0,
    PTD: pricingRecord?.PTD_PTSS__c || 0,
  };
};
