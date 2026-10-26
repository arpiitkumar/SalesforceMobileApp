// auth/GetAndStoreData/getProductPrice.js

import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation } from '../syncUtils';
import { getUserAccessibleSubCategories } from '../../UtilityMain/producthelpers/userLineService.js';

export const getProductPrice = async ({ creds, apiFetch, loggedInUser, fetchRecords, accessToken, instanceUrl }) => {
    try {
        let uniqueDistributorArray = [];
        /* ================= API CALL ================= */
        if (loggedInUser?.DeveloperName === 'H_T_ASO') {
            const QuerySR_Beat_as = `select Id,Distributor__c,Distributor__r.ParentId from SR_Beat_Assignment__c Where Assigned_To__c='${loggedInUser?.Sf_Id}'`;
            // console.log('QuerySR_Beat_as', QuerySR_Beat_as)
            const resultforSR_Beat_as = await fetchRecords(QuerySR_Beat_as, QuerySR_Beat_as, accessToken, instanceUrl);
            const Distributor = resultforSR_Beat_as.map(item => item.Distributor__r?.ParentId);
            const uniqueDistributor = [...new Set(Distributor)];
            uniqueDistributorArray = uniqueDistributor.filter(Boolean);
        } else if (loggedInUser?.DeveloperName === 'H_T_SO') {
            const QuerySR_Beat_as = `select Id,Distributor__c,Distributor__r.ParentId from SR_Beat_Assignment__c Where Sales_Person_ManagerId__c='${loggedInUser?.Sf_Id}'`;
            console.log('QuerySR_Beat_as', QuerySR_Beat_as)
            const resultforSR_Beat_as = await fetchRecords(QuerySR_Beat_as, QuerySR_Beat_as, accessToken, instanceUrl);
            const Distributor = resultforSR_Beat_as.map(item => item.Distributor__c);
            const uniqueDistributor = [...new Set(Distributor)];
            // uniqueDistributorArray = uniqueDistributor.map(b => `'${b}'`).join(",");
            uniqueDistributorArray = uniqueDistributor.filter(Boolean);
        } else {
            const QuerySR_Beat_as = `select Id,Distributor__c,Distributor__r.ParentId from SR_Beat_Assignment__c Where Assigned_To__c='${loggedInUser?.Sf_Id}'`;
            // console.log('QuerySR_Beat_as', QuerySR_Beat_as)
            const resultforSR_Beat_as = await fetchRecords(QuerySR_Beat_as, QuerySR_Beat_as, accessToken, instanceUrl);
            const Distributor = resultforSR_Beat_as.map(item => item.Distributor__c);
            const uniqueDistributor = [...new Set(Distributor)];
            uniqueDistributorArray = uniqueDistributor.filter(Boolean);
        }
        const accessibleSubCategories = await getUserAccessibleSubCategories(loggedInUser, null);
        // console.log('accessibleSubCategories',accessibleSubCategories)
        const product = await UniversalUpdateInsert({
            ObjectName: 'Product2',
            Type: 'get',
            filters: [
                { field: "SubCategory__c", value: accessibleSubCategories, operator: 'in', },
            ]
        });
        const sfIdArray = product
            .map(item => item?.Sf_Id)
            .filter(Boolean);
        const distributorArrayMain = Array.isArray(uniqueDistributorArray)
            ? uniqueDistributorArray
            : uniqueDistributorArray
                ? [uniqueDistributorArray]
                : [];
        const normalizeToArray = value =>
            Array.isArray(value) ? value : value ? [value] : [];
        const cleanDistributorArray = normalizeToArray(distributorArrayMain).map(
            id => id.replace(/^'+|'+$/g, '')
        );

        // console.log('uniqueDistributorArray', cleanDistributorArray)
        // console.log('product', sfIdArray.length)
        // return;
        const payload = {
            AccountIds: cleanDistributorArray,
            ProductIds: sfIdArray
        };
        const response = await apiFetch(
            'POST',
            'productPricing',
            payload,
            'Custom',
            creds.accessToken,
            creds.instanceUrl
        );

        const pricingList = response.data?.responseBody;
        //   console.log('pricingList',pricingList.length)
        if (!Array.isArray(pricingList)) {
            throw new Error('Invalid data type for Product_Pricing___c');
        }

        console.log(
            `Fetched ${pricingList.length} Product_Pricing___c records`
        );

        const generateRandomId = () => {
            const ts = Date.now();
            const rnd = Math.floor(1000 + Math.random() * 9000);
            return `ProductPrice-${ts}-${rnd}`;
        };

        /* ================= DATA MAPPING ================= */
        const cleanedPricingPayload = pricingList.map(item => ({
            Sf_Id: generateRandomId(),
            ProductId: item.productId ?? '',
            AccountId: item.accountId ?? '',
            Ptd: item.ptd ?? '',
            Ptr: item.ptr ?? '',
            SubDbPrice: item.subDbPrice ?? '',
            is_locally_changed: false,
            is_synced: true,
            last_modified: Date.now(),
            operation_type: 'insert',
        }));

        /* ================= DB INSERT ================= */
        const insertResult = await safeDatabaseOperation(
            () =>
                UniversalUpdateInsert({
                    ObjectName: 'Product_Pricing___c',
                    Type: 'insert',
                    data: cleanedPricingPayload,
                }),
            `Insert ${cleanedPricingPayload.length} Product_Pricing___c records`
        );

        if (!insertResult.success) {
            throw new Error(
                'Failed to insert Product_Pricing___c records into local database'
            );
        }

        /* ================= SUCCESS ================= */
        return {
            success: true,
            status: 'ok',
            message: `Synced ${cleanedPricingPayload.length} Product_Pricing___c records`,
            data: { count: cleanedPricingPayload.length },
        };
    } catch (err) {
        const msg = `Error in getProductPrice: ${err.message}`;
        showErrorToast(msg);
        return { success: false, status: 'error', message: msg };
    }
};
