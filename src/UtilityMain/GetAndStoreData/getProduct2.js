// auth/GetAndStoreData/getProduct2.js

import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation } from '../syncUtils';
import { convertSharePointUrl } from '../../utils/imageHelper';
import { UNITS_PER_CASE } from "../../utils/helper/caseUnits";

/**
 * Main exported function - fetches Product2 records from Custom Apex REST endpoint and saves them
 */
export const getProduct2 = async ({ fetchRecords, apiFetch, accessToken, instanceUrl }) => {
  try {
    if (!apiFetch) {
      throw new Error('apiFetch utility is required but not provided');
    }

    console.log("Fetching products from custom Apex REST endpoint: /services/apexrest/products");

    // Fetch products list from Apex REST API endpoint
    const response = await apiFetch(
      'GET',
      'products',
      {},
      'Custom',
      accessToken,
      instanceUrl
    );

    if (response?.status !== 'success') {
      throw new Error(response?.message || 'Failed to fetch products from custom API');
    }

    let productsList = [];
    if (Array.isArray(response?.data)) {
      productsList = response.data;
    } else if (response?.data && Array.isArray(response.data.data)) {
      productsList = response.data.data;
    } else if (Array.isArray(response?.data?.responseBody)) {
      productsList = response.data.responseBody;
    } else if (response?.data?.products && Array.isArray(response.data.products)) {
      productsList = response.data.products;
    } else {
      throw new Error(`Unexpected product API response format: ${JSON.stringify(response?.data)}`);
    }

    console.log(`Fetched ${productsList.length} products from Salesforce Apex REST API`);

    // Transform products to the schema of Product2 local table
    const transformed = productsList.map(item => {
      // Handle potential type mismatches/nulls defensively
      const rawPrice = item.productPrice ?? item.Product_Price__c ?? item.mrp ?? item.MRP__c ?? 0;
      const price = parseFloat(rawPrice);
      const rawMrp = item.mrp ?? item.MRP__c ?? item.productPrice ?? item.Product_Price__c ?? 0;
      const mrp = parseFloat(rawMrp);
      const rawUbc = item.unitsPerBox ?? item.Units_Per_Box__c ?? 1;
      const ubc = rawUbc != null ? parseInt(rawUbc, 10) : 1;

      const pId = item.id || item.Id || item.productCode || item.Product_Code__c || '';
      const pName = item.productName ?? item.Name ?? '';
      const pBrand = item.brand ?? item.Brand__c ?? item.productDivision ?? 'General';
      const pCategory = item.category ?? item.Category__c ?? (item.productDivision ? `Division ${item.productDivision}` : 'General');
      const pCode = item.productCode ?? item.Product_Code__c ?? '';
      const pIsActive = item.isActive ?? item.IsActive__c ?? false;
      const pImage = item.productImage ?? item.Product_Image__c ?? '';

      return {
        Sf_Id: pId,
        PTR__c: price,
        PTD__c: price,
        PriceBookId: item.PricebookEntryId || pId,
        PriceBookMainId: '',
        MRP__c: mrp,
        Name: pName,
        SGST__c: 0,
        CGST__c: 0,
        Brand__c: pBrand,
        Category__c: pCategory,
        SubCategory__c: pCategory, // Fallback/map Category to SubCategory
        SKUCodeinDMS__c: '',
        ProductCode__c: pCode,
        Name__c: pName,
        Variant__c: '',
        GSTPercentage__c: 0,
        UnitperCase__c: UNITS_PER_CASE,
        WeightKG__c: null,
        WeightMT__c: null,
        IsActive: pIsActive,
        ProductImageURL__c: convertSharePointUrl(pImage),
        Active_in_SFA__c: pIsActive,

        // sync metadata
        operation_type: 'insert',
        is_synced: true,
        is_locally_changed: false,
        last_modified: Date.now(),
      };
    });

    console.log(`📦 Transformed ${transformed.length} product records for Product2 table`);

    if (transformed.length === 0) {
      console.warn("No product records were fetched and transformed.");
      return {
        success: true,
        status: 'ok',
        message: 'No products to sync',
        data: { count: 0 }
      };
    }

    // Insert transformed products into local database (Product2 table)
    const productInsertResult = await safeDatabaseOperation(
      () =>
        UniversalUpdateInsert({
          ObjectName: 'Product2',
          Type: 'insert',
          data: transformed,
        }),
      `Insert ${transformed.length} Products`
    );

    if (!productInsertResult.success) {
      const msg = 'Failed to insert Products into local database';
      showErrorToast(msg);
      return { success: false, status: 'error', message: msg };
    }

    return {
      success: true,
      status: 'ok',
      message: `Synced ${transformed.length} Products`,
      data: { count: transformed.length },
    };
  } catch (err) {
    const msg = `Unexpected error in getProduct2: ${err.message}`;
    showErrorToast(msg);
    console.error(msg, err);
    return { success: false, status: 'error', message: msg };
  }
};
