import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import { showErrorToast, safeDatabaseOperation, safeProgress } from '../syncUtils';
import moment from 'moment';

const BATCH_SIZE = 200; // for visits batching

/**
 * Build the sales rep condition based on logged-in user role
 * If SO: include their assigned SRs; if SR: just them
 */
const buildSalesRepCondition = async ({
  loggedInUser,
  fetchRecords,
  accessToken,
  instanceUrl,
}) => {
  let salesRepCondition = `Assigned_To__c = '${loggedInUser.Sf_Id}'`;

  if (loggedInUser.DeveloperName === 'H_T_SO') {
    try {
      const QuerySR_Beat_as = `SELECT Id, Beat__c, Distributor__c, Assigned_To__c 
        FROM SR_Beat_Assignment__c 
        WHERE Sales_Person_ManagerId__c = '${loggedInUser.Sf_Id}'`;

      const resultforSR_Beat_as = await fetchRecords(
        'SR_Beat_Assignment__c',
        QuerySR_Beat_as,
        accessToken,
        instanceUrl
      );

      if (Array.isArray(resultforSR_Beat_as) && resultforSR_Beat_as.length > 0) {
        const srValues = resultforSR_Beat_as.map(item => item.Assigned_To__c);
        const uniquesrValues = [...new Set(srValues)];
        const soqlInFormat = uniquesrValues.map(b => `'${b}'`).join(',');

        if (soqlInFormat.length) {
          salesRepCondition = `
            (Assigned_To__c IN (${soqlInFormat})
             OR Assigned_To__c = '${loggedInUser.Sf_Id}')
          `;
        }
      }
    } catch (err) {
      console.warn('⚠️ Failed to fetch SR_Beat_Assignment__c, using default condition:', err.message);
    }
  }

  return salesRepCondition;
};

/**
 * Build the complex Route Plan query with nested Beat_Day and Visit data
 */
const buildRoutePlanOnlyQuery = (firstDay, lastDay, salesRepCondition) => `
  SELECT
    Id,
    Name,
    Assigned_To__c,
    Approved_By__c,
    Status__c,
    Start_Date__c,
    End_Date__c,
    Reject_Reason__c,
    Assigned_To__r.UserRole.Name
  FROM Route_Plans__c
  WHERE Start_Date__c = ${firstDay}
    AND End_Date__c = ${lastDay}
    AND Status__c = 'approved'
    AND ${salesRepCondition}
`;

const buildBeatDayQuery = routePlanIds => `
  SELECT
    Id,
    BeatDate__c,
    OwnerId,
    Beat__c,
    Beat__r.Name,
    Productivity__c,
    FirstScaTime__c,
    LastScaTime__c,
    First_Call_Time__c,
    Last_Call_Time__c,
    PlannedOutlets__c,
    Planned_Beat__c,
    Pjp_BeatOutlets__c,
    NotVisitedOutlets__c,
    TimeSpentOnField__c,
    Total_Time_in_Outlet__c,
    AvgTimeSpentinOlforCalls__c,
    EndOfDayTime__c,
    PjpOutletVisited__c,
    NonPjpOutletVisited__c,
    NonPjpProductiveCall__c,
    TotalDistanceTravelledKm__c,
    NonPjpTc__c,
    ProductiveCalls__c,
    NonProductiveCalls__c,
    TotalProductiveCallsDuration__c,
    AvgTimeSpentinOlforPc__c,
    TcTill12Noon__c,
    TcTill3PM__c,
    TcTill6PM__c,
    TcAfter6PM__c,
    NoofScaDonethroughOtherBeat__c,
    NoofScaDoneinScheduleBeat__c,
    EodComment__c,
    SecOrderValue__c,
    SecOrderQuantityPcs__c,
    SecondaryOrderQuantityInKG__c,
    SecondaryOrderQuantityInValue__c,
    Planned_Outlets_Coverage__c,
    Change_Beat_Reason__c,
    Postman_Call_Less_than_1_min__c,
    Inappropriate_Call_Less_than_3_min__c,
    Appropriate_Call_Greater_than_3_min__c,
    Total_Call__c,
    Route_Plan__c,
    Attendance__c,
    ISC__c
  FROM BeatDay__c
  WHERE Route_Plan__c IN (${routePlanIds.map(id => `'${id}'`).join(',')})
`;


const buildVisitQuery = beatDayIds => `
  SELECT
    Id,
    Name,
    Beat__c,
    BeatDay__c,
    VisitDate__c,
    AccountId__c,
    AccountId__r.Name,  
    PJPOutlet__c,
    NonPjpOutlet__c,
    ChangedBeatOutlet__c,
    FirstCallVisit__c,
    LastCallVisit__c,
    VisitStatus__c,
    VisitNotes__c,
    CheckInTime__c,
    CheckOutTime__c,
    ProductiveCall__c,
    TimeSpentOnOutlet__c,
    CheckInComment__c,
    CheckInLocation__c,
    CheckInLocation__Longitude__s,
    CheckInLocation__Latitude__s,
    CheckOutLocation__Longitude__s,
    CheckOutLocation__Latitude__s,
    CheckOutLocation__c,
    DistanceTravelledKm__c,
    Before12Noon__c,
    Before3PM__c,
    Before6PM__c,
    After6PM__c,
    VisitType__c,
    AdHocVisit__c,
    CheckInPhotoCaptured__c,
    IsOrderPlaced__c,
    OriginalMTPType__c,
    OriginalDBName__c,
    OriginalRepName__c,
    RevisedMTPType__c,
    RevisedDBName__c,
    RevisedRepName__c,
    SR_TSI_ASO_Name__c,
    MTPEditDate__c,
    MTPEditTime__c,
    ApprovedBy__c,
    ApprovalDate__c,
    Status__c,
    SRTransactionTime__c,
    SRTransactionLocation__c,
    LocationVarianceOLtoSCA__c,
    LocationVarianceOrdertoSCA__c,
    AdHocReason__c,
    NonProductiveCallReason__c,
    DB_SUB_DB_Super_Name__c,
    WorkingWith__c,
    Add_New_Retailer_Visit__c,
    Postman_Call__c,
    Appropriate_Call__c,
    Inappropriate_Call__c,
    MTP_Admin_Approval_Status__c,
    MTP_Approval_Comment__c,
    MTP_ApprovalSubmitedDate__c,
    MTP_Approved_Date__c,
    Device_Id__c
  FROM Visit__c
  WHERE BeatDay__c IN (${beatDayIds.map(id => `'${id}'`).join(',')})
`;


/**
 * Fetch route plan data with nested beat days and visits
 */
const fetchRoutePlanData = async ({
  loggedInUser,
  fetchRecords,
  accessToken,
  instanceUrl,
  onProgress,
}) => {
  try {
    const firstDay = moment().startOf('month').format('YYYY-MM-DD');
    const lastDay = moment().endOf('month').format('YYYY-MM-DD');

    safeProgress('Building sales rep condition...', onProgress);

    const salesRepCondition = await buildSalesRepCondition({
      loggedInUser,
      fetchRecords,
      accessToken,
      instanceUrl,
    });

    // 1️⃣ Route Plans
    const routePlanQuery = buildRoutePlanOnlyQuery(firstDay, lastDay, salesRepCondition);
    console.log('routePlanQuery', routePlanQuery)
    const routePlans = await fetchRecords('Route_Plans__c', routePlanQuery, accessToken, instanceUrl);

    if (!routePlans.length) return { success: true, data: [] };

    const routePlanIds = routePlans.map(r => r.Id);

    // 2️⃣ Beat Days
    const beatDayQuery = buildBeatDayQuery(routePlanIds);
    console.log('beatDayQuery', beatDayQuery)
    const beatDays = await fetchRecords('BeatDay__c', beatDayQuery, accessToken, instanceUrl);

    const beatDayMap = {};
    beatDays.forEach(bd => {
      if (!beatDayMap[bd.Route_Plan__c]) {
        beatDayMap[bd.Route_Plan__c] = [];
      }
      beatDayMap[bd.Route_Plan__c].push({
        ...bd,
        Visits__r: { records: [] }
      });
    });


    const beatDayIds = beatDays.map(b => b.Id);

    // 3️⃣ Visits
    if (beatDayIds.length) {
      const visitQuery = buildVisitQuery(beatDayIds);
      console.log(visitQuery)
      const visits = await fetchRecords(
        'Visit',
        visitQuery,
        accessToken,
        instanceUrl
      );

      if (!Array.isArray(visits)) {
        console.warn(
          '⚠️ Visit object not accessible for user:',
          loggedInUser.DeveloperName,
          visits
        );
        return { success: true, data: finalDataWithoutVisits };
      }

      const visitMap = {};
      visits.forEach(v => {
        if (!visitMap[v.BeatDay__c]) visitMap[v.BeatDay__c] = [];
        visitMap[v.BeatDay__c].push(v);
      });

      Object.values(beatDayMap).flat().forEach(bd => {
        bd.Visits__r.records = visitMap[bd.Id] || [];
      });
    }

    // 🔁 Rebuild EXACT nested structure
    const finalData = routePlans.map(rp => ({
      ...rp,
      Beat_Day__r: {
        records: beatDayMap[rp.Id] || [],
      },
    }));

    return { success: true, data: finalData };
  } catch (err) {
    return { success: false, message: err.message };
  }
};

/**
 * Map Route Plan records to local schema
 */
const mapRoutePlansToLocalSchema = (apiData = []) =>
  apiData.map(item => ({
    Sf_Id: item.Id,
    Name: item.Name,
    Assigned_To__c: item.Assigned_To__c,
    Approved_By__c: item.Approved_By__c,
    Status__c: item.Status__c,
    Start_Date__c: item.Start_Date__c,
    End_Date__c: item.End_Date__c,
    Reject_Reason__c: item.Reject_Reason__c,
    Salesperson_Role__c: item.Assigned_To__r?.UserRole?.Name,

    is_locally_changed: false,
    is_synced: true,
    last_modified: Date.now(),
    operation_type: 'insert',
  }));

/**
 * Extract and map Beat Day records from nested Route Plans
 */
const extractAndMapBeatDays = (apiData = []) =>
  apiData.flatMap(routePlan => {
    const tourPlanId = routePlan.Id;
    const beatDayRecords = routePlan.Beat_Day__r?.records || [];

    return beatDayRecords.map(beatDay => ({
      Sf_Id: beatDay.Id,
      OwnerId: beatDay.OwnerId,
      Productivity__c: beatDay.Productivity__c,
      Beat__Name: beatDay?.Beat__r?.Name || '',
      Beat__c: beatDay?.Beat__c || '',
      First_SCA_Time__c: beatDay.FirstScaTime__c,
      Last_SCA_Time__c: beatDay.LastScaTime__c,
      First_Call_Time__c: beatDay.First_Call_Time__c,
      Last_Call_Time__c: beatDay.Last_Call_Time__c,
      PlannedOutlets__c: beatDay.PlannedOutlets__c,
      Planned_Beat__c: beatDay.Planned_Beat__c,
      Pjp_BeatOutlets__c: beatDay.Pjp_BeatOutlets__c,
      NotVisitedOutlets__c: beatDay.NotVisitedOutlets__c,
      TimeSpentOnField__c: beatDay.TimeSpentOnField__c,
      Total_Time_in_Outlet__c: beatDay.Total_Time_in_Outlet__c,
      AvgTimeSpentinOlforCalls__c: beatDay.AvgTimeSpentinOlforCalls__c,
      EndOfDayTime__c: beatDay.EndOfDayTime__c,
      PJP_Outlet_Visited__c: beatDay.PjpOutletVisited__c,
      NonPjpOutletVisited__c: beatDay.NonPjpOutletVisited__c,
      NonPjpProductiveCall__c: beatDay.NonPjpProductiveCall__c,
      TotalDistanceTravelledKm__c: beatDay.TotalDistanceTravelledKm__c,
      NonPjpTc__c: beatDay.NonPjpTc__c,
      ProductiveCalls__c: beatDay.ProductiveCalls__c,
      NonProductiveCalls__c: beatDay.NonProductiveCalls__c,
      Productive_Calls_Duration__c: beatDay.TotalProductiveCallsDuration__c,
      AvgTimeSpentinOlforPc__c: beatDay.AvgTimeSpentinOlforPc__c,
      TcTill12Noon__c: beatDay.TcTill12Noon__c,
      TcTill3PM__c: beatDay.TcTill3PM__c,
      TcTill6PM__c: beatDay.TcTill6PM__c,
      TcAfter6PM__c: beatDay.TcAfter6PM__c,
      No_of_SCA_Done_through_Other_Beat__c: beatDay.NoofScaDonethroughOtherBeat__c,
      No_of_SCA_Done_in_Schedule_Beat__c: beatDay.NoofScaDoneinScheduleBeat__c,
      BeatDate__c: beatDay.BeatDate__c,
      EodComment__c: beatDay.EodComment__c,
      Tour_Plan__c: tourPlanId,
      Sec_Order_Value__c: beatDay.SecOrderValue__c,
      SecOrderQuantityPcs__c: beatDay.SecOrderQuantityPcs__c,
      PjpBeatOutlets__c: beatDay.PjpBeatOutlets__c,
      Secondary_Order_Qty_in_KG: beatDay.SecondaryOrderQuantityInKG__c,
      Secondary_Order_Qty_in_Value: beatDay.SecondaryOrderQuantityInValue__c,
      Planned_Outlets_Coverage__c: beatDay.Planned_Outlets_Coverage__c,
      Change_Beat_Reason__c: beatDay.Change_Beat_Reason__c,
      ISC__c: beatDay.ISC__c,
      Attendance__c: beatDay.Attendance__c,
      Postman_Call_Less_than_1_min__c: beatDay.Postman_Call_Less_than_1_min__c || 0,
      Inappropriate_Call_Less_than_3_min__c: beatDay.Inappropriate_Call_Less_than_3_min__c || 0,
      Appropriate_Call_Greater_than_3_min__c: beatDay.Appropriate_Call_Greater_than_3_min__c || 0,
      Total_Call__c: beatDay.Total_Call__c || 0,

      is_locally_changed: false,
      is_synced: true,
      last_modified: Date.now(),
      operation_type: 'insert',
    }));
  });

/**
 * Extract and map Visit records from nested Beat Days
 */
const extractAndMapVisits = (apiData = []) => {
  const now = Date.now();

  return apiData.flatMap(routePlan =>
    (routePlan.Beat_Day__r?.records || []).flatMap(beatDay => {
      const beatDayId = beatDay.Id;
      const visitRecords = beatDay.Visits__r?.records || [];

      return visitRecords.map(visit => ({
        Sf_Id: visit.Id,
        Name: visit.Name,
        Beat__c: visit.Beat__c,
        BeatDay__c: beatDayId,
        VisitDate__c: visit.VisitDate__c,
        AccountId__c: visit.AccountId__c,
        PJPOutlet__c: visit.PJPOutlet__c,
        NonPjpOutlet__c: visit.NonPjpOutlet__c,
        FirstCallVisit__c: visit.FirstCallVisit__c,
        LastCallVisit__c: visit.LastCallVisit__c,
        ChangedBeatOutlet__c: visit.ChangedBeatOutlet__c,
        VisitStatus__c: visit.VisitStatus__c,
        VisitNotes__c: visit.VisitNotes__c,
        CheckInTime__c: visit.CheckInTime__c,
        CheckOutTime__c: visit.CheckOutTime__c,
        ProductiveCall__c: visit.ProductiveCall__c,
        TimeSpentOnOutlet__c: visit.TimeSpentOnOutlet__c,
        CheckInComment__c: visit.CheckInComment__c,

        CheckInLocation__c: visit.CheckInLocation__c,
        CheckInLocation__Longitude__s: visit.CheckInLocation__Longitude__s,
        CheckInLocation__Latitude__s: visit.CheckInLocation__Latitude__s,
        CheckOutLocation__Longitude__s: visit.CheckOutLocation__Longitude__s,
        CheckOutLocation__Latitude__s: visit.CheckOutLocation__Latitude__s,
        CheckOutLocation__c: visit.CheckOutLocation__c,

        DistanceTravelledKm__c: visit.DistanceTravelledKm__c,
        Before12Noon__c: visit.Before12Noon__c,
        Before3PM__c: visit.Before3PM__c,
        Before6PM__c: visit.Before6PM__c,
        After6PM__c: visit.After6PM__c,

        VisitType__c: visit.VisitType__c,
        AdHocVisit__c: visit.AdHocVisit__c,

        // Convert booleans to 1/0 for storage
        CheckInPhotoCaptured__c: visit.CheckInPhotoCaptured__c ? 1 : 0,
        IsOrderPlaced__c: visit.IsOrderPlaced__c ? 1 : 0,

        MTPEditDate__c: visit.MTPEditDate__c,
        MTPEditTime__c: visit.MTPEditTime__c,
        ApprovedBy__c: visit.ApprovedBy__c,
        ApprovalDate__c: visit.ApprovalDate__c,
        Status__c: visit.Status__c,
        SRTransactionTime__c: visit.SRTransactionTime__c,
        NonProductiveCallReason__c: visit.NonProductiveCallReason__c,
        AdHocReason__c: visit.AdHocReason__c,
        RevisedDBName__c: visit.RevisedDBName__c,
        // RevisedRepName__c: visit.RevisedRepName__c || visit.SR_TSI_ASO_Name__c,
        // RevisedRepName__c: visit.SR_TSI_ASO_Name__c,
        RevisedRepName__c: visit.SR_TSI_ASO_Name__c || visit.RevisedRepName__c,
        DB_SUB_DB_Super_Name__c: visit.DB_SUB_DB_Super_Name__c,
        WorkingWith__c: visit.WorkingWith__c,
        Add_New_Retailer_Visit__c: visit.Add_New_Retailer_Visit__c,
        Postman_Call__c: visit.Postman_Call__c,
        Appropriate_Call__c: visit.Appropriate_Call__c,
        Inappropriate_Call__c: visit.Inappropriate_Call__c,
        MTP_Admin_Approval_Status__c: visit.MTP_Admin_Approval_Status__c,
        MTP_Approval_Comment__c: visit.MTP_Approval_Comment__c,
        MTP_ApprovalSubmitedDate__c: visit.MTP_ApprovalSubmitedDate__c,
        MTP_Approved_Date__c: visit.MTP_Approved_Date__c,
        is_locally_changed: false,
        is_synced: true,
        SoftDelete: false,
        last_modified: now,
        operation_type: 'insert',
      }));
    })
  );
};

/**
 * Insert Route Plans into local DB
 */
const insertRoutePlans = async (payload, onProgress) => {
  if (!Array.isArray(payload) || payload.length === 0) {
    safeProgress && safeProgress('No Route Plans to insert.', onProgress);
    return { success: true };
  }

  const result = await safeDatabaseOperation(
    () =>
      UniversalUpdateInsert({
        ObjectName: 'Route_Plans__c',
        Type: 'insert',
        data: payload,
      }),
    `Insert ${payload.length} Route Plans`
  );

  if (!result.success) {
    const msg = 'Failed to insert Route Plans into local database';
    showErrorToast(msg);
    return { success: false, message: msg };
  }

  safeProgress && safeProgress(`Inserted ${payload.length} Route Plans`, onProgress);
  return { success: true };
};

/**
 * Insert Beat Days into local DB
 */
const insertBeatDays = async (payload, onProgress) => {
  if (!Array.isArray(payload) || payload.length === 0) {
    safeProgress && safeProgress('No Beat Days to insert.', onProgress);
    return { success: true };
  }

  const result = await safeDatabaseOperation(
    () =>
      UniversalUpdateInsert({
        ObjectName: 'BeatDay__c',
        Type: 'insert',
        data: payload,
      }),
    `Insert ${payload.length} Beat Days`
  );

  if (!result.success) {
    const msg = 'Failed to insert Beat Days into local database';
    showErrorToast(msg);
    return { success: false, message: msg };
  }

  safeProgress && safeProgress(`Inserted ${payload.length} Beat Days`, onProgress);
  return { success: true };
};

/**
 * Insert Visits into local DB with batching
 */
const insertVisits = async (payload, onProgress) => {
  if (!Array.isArray(payload) || payload.length === 0) {
    safeProgress && safeProgress('No Visits to insert.', onProgress);
    return { success: true };
  }

  const total = payload.length;
  safeProgress && safeProgress(`Inserting ${total} Visits in batches of ${BATCH_SIZE}...`, onProgress);

  try {
    for (let i = 0; i < total; i += BATCH_SIZE) {
      const batch = payload.slice(i, Math.min(i + BATCH_SIZE, total));
      const batchStart = i + 1;
      const batchEnd = Math.min(i + BATCH_SIZE, total);

      const result = await safeDatabaseOperation(
        () =>
          UniversalUpdateInsert({
            ObjectName: 'Visit',
            Type: 'insert',
            data: batch,
          }),
        `Insert Visits ${batchStart}-${batchEnd} of ${total}`
      );

      if (!result.success) {
        const msg = `Failed to insert Visits batch at ${batchStart}-${batchEnd}`;
        showErrorToast(msg);
        return { success: false, message: msg };
      }

      const percent = Math.round((batchEnd / total) * 100);
      safeProgress && safeProgress(`Inserted ${batchEnd} / ${total} Visits (${percent}%)`, onProgress);
    }

    safeProgress && safeProgress(`Inserted ${total} Visits`, onProgress);
    return { success: true };
  } catch (err) {
    const msg = `Visits batch insert failed: ${err.message}`;
    showErrorToast(msg);
    return { success: false, message: msg };
  }
};

/**
 * Main exported function
 */
export const getRoutePlan = async ({
  loggedInUser,
  fetchRecords,
  accessToken,
  instanceUrl,
  onProgress,
}) => {
  try {
    // Step 1: Fetch nested route plan data
    safeProgress && safeProgress('Step 6/15: Fetching Route Plans, Beat Data...', onProgress);
    const fetchResult = await fetchRoutePlanData({
      loggedInUser,
      fetchRecords,
      accessToken,
      instanceUrl,
      onProgress,
    });

    if (!fetchResult.success) {
      showErrorToast(fetchResult.message);
      return { success: false, status: 'error', message: fetchResult.message };
    }

    const apiData = fetchResult.data;

    // Step 2: Map and insert Route Plans
    safeProgress && safeProgress(' Processing Route Plans...', onProgress);
    const routePlansPayload = mapRoutePlansToLocalSchema(apiData);
    const routePlanResult = await insertRoutePlans(routePlansPayload, onProgress);
    if (!routePlanResult.success) {
      return { success: false, status: 'error', message: routePlanResult.message };
    }

    // Step 3: Extract, map and insert Beat Days
    safeProgress && safeProgress('Processing Beat Days...', onProgress);
    const beatDaysPayload = extractAndMapBeatDays(apiData);
    const beatDayResult = await insertBeatDays(beatDaysPayload, onProgress);
    if (!beatDayResult.success) {
      return { success: false, status: 'error', message: beatDayResult.message };
    }

    // Step 4: Extract, map and insert Visits
    safeProgress && safeProgress('Step 9/15: Processing Visits...', onProgress);
    const visitsPayload = extractAndMapVisits(apiData);
    const visitResult = await insertVisits(visitsPayload, onProgress);
    if (!visitResult.success) {
      return { success: false, status: 'error', message: visitResult.message };
    }

    // All done
    const summary = `Route Plan sync complete:
      - ${routePlansPayload.length} Route Plans
      - ${beatDaysPayload.length} Beat Days
      - ${visitsPayload.length} Visits`;

    console.log(summary);
    safeProgress && safeProgress(summary, onProgress);

    return {
      success: true,
      status: 'ok',
      message: summary,
      data: {
        routePlans: routePlansPayload.length,
        beatDays: beatDaysPayload.length,
        visits: visitsPayload.length,
      },
    };
  } catch (err) {
    const msg = `Unexpected error in getRoutePlan: ${err.message}`;
    showErrorToast(msg);
    return { success: false, status: 'error', message: msg };
  }
};
