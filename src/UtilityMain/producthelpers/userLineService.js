import UniversalUpdateInsert from "../../database/dbService/UniversalUpdateInsert";

/**
 
Get all accessible sub-categories for the logged-in user
 
Handles both regular users and SO (Sales Organization) users
*/
export const getUserAccessibleSubCategories = async (loggedInUser, distributorId) => {
    const userSfId = Array.isArray(loggedInUser)
        ? loggedInUser?.[0]?.Sf_Id
        : loggedInUser?.Sf_Id;
    if (!userSfId) {
        console.warn(
            'Current user Sf_Id not found; no line mapping filter applied.'
        );
        return [];
    }
    try {
        let lineSrMappings = [];
        const filters = [
            {
                field: 'SR__c',
                value: userSfId
            }
        ];
        console.log('filters', filters)
        if (distributorId) {
            filters.push({
                field: 'Distributor__c',
                value: distributorId
            });
        }

        lineSrMappings = await UniversalUpdateInsert({
            ObjectName: 'Line_SR_Distributor_Mapping__c',
            Type: 'get',
            filters
        });
        console.log("lineSrMappings................................", lineSrMappings)
        const mappings = Array.isArray(lineSrMappings) ? lineSrMappings : [];
        const linesSet = new Set(
            mappings
                .map(m => (m.Line__c || '').toString().trim())
                .filter(l => l && l.length > 0)
        );

        if (linesSet.size > 0) {
            // Get all line-product mappings
            const allLineProducts = await UniversalUpdateInsert({
                ObjectName: 'Line_Product_Mapping__c',
                Type: 'get'
            });

            const lpArray = Array.isArray(allLineProducts) ? allLineProducts : [];
            const allowedLineProducts = lpArray.filter(lp =>
                linesSet.has((lp.Line__c || '').toString().trim())
            );

            // Extract unique sub-categories
            const uniqueSubCategories = [
                ...new Set(
                    allowedLineProducts
                        .map(item => (item.Sub_Category__c || '').toString().trim())
                        .filter(Boolean)
                )
            ];

            if (uniqueSubCategories.length > 0) {
                return uniqueSubCategories;
            }
        }

        // Fallback: If no line mappings are assigned or found, fetch all unique categories/subcategories from local Product2 table
        const allProducts = await UniversalUpdateInsert({
            ObjectName: 'Product2',
            Type: 'get'
        });
        const productArray = Array.isArray(allProducts) ? allProducts : [];
        const fallbackSubCategories = [
            ...new Set(
                productArray
                    .map(p => (p.SubCategory__c || p.Category__c || 'General').toString().trim())
                    .filter(Boolean)
            )
        ];
        console.log("No line mappings found. Falling back to Product2 categories:", fallbackSubCategories);
        return fallbackSubCategories.length > 0 ? fallbackSubCategories : ['General'];
    } catch (err) {
        console.error('Error loading user line mappings:', err);
        return [];
    }
};