import UniversalUpdateInsert from "../../database/dbService/UniversalUpdateInsert";

/**

Get all accessible sub-categories for the logged-in user

Handles both regular users and SO (Sales Organization) users
*/
export const getUserAccessibleCategories = async (loggedInUser, distributorId=null) => {
    if (!loggedInUser[0]?.Sf_Id) {
        console.warn('Current user Sf_Id not found; no line mapping filter applied.');
        return [];
    }
    // console.log(distributorId, "...................distributorId in userLineService.js")
    // console.log(loggedInUser[0].Sf_Id, "........................distributorId in userLineService.js")


    try {
        let lineSrMappings = [];


        // If user is a Head Territory SO, get all SO users
        // if (loggedInUser[0].DeveloperName === 'H_T_SO') {
        //     const soUsers = await UniversalUpdateInsert({
        //         ObjectName: "so_users",
        //         Type: "get",
        //     });

        //     const allSfIds = soUsers.map(user => user.Sf_Id);
        //     lineSrMappings = await UniversalUpdateInsert({
        //         ObjectName: 'Line_SR_Distributor_Mapping__c',
        //         Type: 'get',
        //         filters: [
        //             {
        //                 field: 'SR__c',
        //                 operator: 'in',
        //                 value: [...allSfIds, loggedInUser[0].Sf_Id]
        //             }
        //         ]
        //     });
        // } else {
        // Regular user - get their own mappings


        const filters = [
            {
                field: 'SR__c',
                value: loggedInUser[0].Sf_Id
            }
        ];

        // Add distributor filter ONLY if distributorId exists
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
        // console.log("lineSrMappings................................", lineSrMappings)
        // }

        const mappings = Array.isArray(lineSrMappings) ? lineSrMappings : [];
        const linesSet = new Set(
            mappings
                .map(m => (m.Line__c || '').toString().trim())
                .filter(l => l && l.length > 0)
        );

        if (linesSet.size === 0) {
            return [];
        }

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
        const uniqueCategories = [
            ...new Set(
                allowedLineProducts
                    .map(item => (item.Category__c || '').toString().trim())
                    .filter(Boolean)
            )
        ];

        return uniqueCategories;
    } catch (err) {
        console.error('Error loading user line mappings:', err);
        return [];
    }
};