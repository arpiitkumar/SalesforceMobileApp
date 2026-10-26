const GetObjectData = async (fieldNames, ObjectName, fetchRecords, accessToken, instanceUrl, loggedInUser) => {
    const now = new Date();

    // console.log('=====================================================', loggedInUser)
    let soql;
    //     if (loggedInUser[0]?.DeveloperName === 'H_T_SO') {
    //         const QuerySR_Beat_as = `select Id, Beat__c,Distributor__c from SR_Beat_Assignment__c Where Sales_Person_ManagerId__c='${loggedInUser[0]?.Sf_Id}'`;
    //         // console.log('query for QuerySR_Beat_as.....', QuerySR_Beat_as);
    //         const resultforSR_Beat_as = await fetchRecords(QuerySR_Beat_as, QuerySR_Beat_as, accessToken, instanceUrl);
    //         // console.log('QuerySR_Beat_as', resultforSR_Beat_as)
    //         const beatValues = resultforSR_Beat_as.map(item => item.Beat__c);
    //         // console.log("Beat Values:", beatValues);
    //         const uniqueBeatValues = [...new Set(beatValues)];
    //         // console.log("Unique Beat Values:", uniqueBeatValues);
    //         const soqlInFormat = uniqueBeatValues.map(b => `'${b}'`).join(",");
    //         // console.log("SOQL IN Format:", soqlInFormat);
    //         const Distributor__cValues = resultforSR_Beat_as.map(item => item.Distributor__c);
    //         // console.log("Beat Values:", Distributor__cValues);
    //         const uniqueDistributor__cValues = [...new Set(Distributor__cValues)];
    //         // console.log("Unique Beat Values:", uniqueDistributor__cValues);
    //         const soqlInFormatuniqueDistributor__cValues = uniqueDistributor__cValues.map(b => `'${b}'`).join(",");
    //         // console.log("SOQL IN Format:", soqlInFormatuniqueDistributor__cValues);


    //         const QueryLine_SR_Distributor_Mapping__c = `select Id,Distributor__c from Line_SR_Distributor_Mapping__c Where SR__c='${loggedInUser[0]?.Sf_Id}'`;
    //         // console.log('query for QueryLine_SR_Distributor_Mapping__c.....', QueryLine_SR_Distributor_Mapping__c);
    //         const resultforQueryLine_SR_Distributor_Mapping__c = await fetchRecords(QueryLine_SR_Distributor_Mapping__c, QueryLine_SR_Distributor_Mapping__c, accessToken, instanceUrl);
    //         // console.log('resultforQueryLine_SR_Distributor_Mapping__c', resultforQueryLine_SR_Distributor_Mapping__c)
    //         const DistributoValuesLine_SR = resultforQueryLine_SR_Distributor_Mapping__c.map(item => item.Distributor__c);
    //         // console.log("DistributoValuesLine_SR Values:", DistributoValuesLine_SR);
    //         const uniqueDistributoValuesLine_SR = [...new Set(DistributoValuesLine_SR)];


    //         const allDistributorIds = [
    //             ...uniqueDistributor__cValues,
    //             ...uniqueDistributoValuesLine_SR
    //         ];
    //         const uniqueAllDistributorIds = [...new Set(allDistributorIds)];
    //         const soqlInFormatAllDistributors = uniqueAllDistributorIds
    //             .filter(id => id) 
    //             .map(id => `'${id}'`)
    //             .join(",");



    //         soql = `SELECT ${fieldNames} FROM ${ObjectName} WHERE Beat__c IN (${soqlInFormat})OR Id IN (${soqlInFormatAllDistributors})
    // `;
    //     } else {
    //         soql = `SELECT ${fieldNames}  FROM ${ObjectName}`;
    //     }
    soql = `SELECT ${fieldNames}  FROM ${ObjectName}`;
    console.log('query for accounts.....', soql);

    try {
        const result = await fetchRecords(ObjectName, soql, accessToken, instanceUrl);
        // console.log('result ', result);
        return result;
    } catch (err) {
        console.error(' Error in fetchUserProfile:', err);
        throw err;
    }
};

export default GetObjectData;