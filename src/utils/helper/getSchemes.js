import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import SchemeProduct from '../../database/models/SchemeProduct';

export const fetchSchemeData = async () => {
  try {
    console.log('Fetching local Scheme-related data...');


    const schemes = await UniversalUpdateInsert({
      ObjectName: 'Scheme__c',
      Type: 'get',
    });

    const sfIdSet = new Set(schemes.map(scheme => scheme.Sf_Id));



    const schemeIdArray = [...sfIdSet];
    console.log('SCHEME ARRAY;;;;;', schemeIdArray);

    


    const schemeParticipantFilters = await UniversalUpdateInsert({
      ObjectName: 'Scheme_Participant_Filters__c',
      Type: 'get',
       filters: [
        {
          field: 'Scheme__c',
          operator: 'in',
          value: schemeIdArray
        }
      ]
    });

    console.log('Scheme Participant Filters fetched successfully......', schemeParticipantFilters);

    const schemeSlabPhases = await UniversalUpdateInsert({
      ObjectName: 'Scheme_Slab_Phase__c',
      Type: 'get',
      filters: [
        {
          field: 'Scheme__c',
          operator: 'in',
          value: schemeIdArray
        }
      ]
    });

        // console.log('Scheme Participant Filters fetched successfully......', schemeParticipantFilters.length);
    console.log('Scheme Slab Phases fetched successfully......', schemeSlabPhases);


    // Fetch data from all 4 local WatermelonDB objects
    const schemeProducts = await UniversalUpdateInsert({
      ObjectName: 'Scheme_Product__c',
      Type: 'get',
      filters: [
        {
          field: 'Scheme__c',
          operator: 'in',
          value: schemeIdArray
        }
      ]

    });

    console.log('Scheme Products fetched successfully......', schemeProducts);
    
    // Log the results
    console.log('Scheme_Product__c:', schemeProducts?.length || 0, 'records');
    console.log('Scheme_Slab_Phase__c:', schemeSlabPhases?.length || 0, 'records');
    console.log('Scheme_Participant_Filters__c:', schemeParticipantFilters?.length || 0, 'records');
    console.log('Scheme__c:', schemes?.length || 0, 'records');

    // console.log('Sample data preview:', {
    //   Scheme_Product__c: schemeProducts?.[0],
    //   Scheme_Slab_Phase__c: schemeSlabPhases?.[0],
    //   Scheme_Participant_Filters__c: schemeParticipantFilters?.[0],
    //   Scheme__c: schemes?.[0],
    // });

    //console.log('Scheme products fetched successfully......', schemeProducts);

    return 'hello';
  } catch (error) {
    console.error('Error fetching scheme data:', error);
    return 'hello';
  }
};
