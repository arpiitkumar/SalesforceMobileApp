// auth/dataSyncer.js
import axios from 'axios';
import UniversalUpdateInsert from '../database/dbService/UniversalUpdateInsert';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { showToast } from '../redux/slices/toastSlice';
import { store } from '../redux/store';
import { useApiFetch } from '../utils/apiFetchHooks/useApiFetch';
import fetchAttendance from '../utils/setDataApis/fetchAttendance.js';
import GetObjectData from '../utils/helper/GetObjectData.js'
import moment from 'moment';
import { Database } from '@nozbe/watermelondb';
import NetInfo from '@react-native-community/netinfo';
import { getCollectionHTSR } from './GetAndStoreData/getCollectionHTSR';
import { getSoUsersHTSO } from './GetAndStoreData/getSoUsersHTSO.js';
import { safeDatabaseOperation, showErrorToast, safeProgress } from './syncUtils';
import { getAccount } from './GetAndStoreData/getAccount';
import { getAttendance } from './GetAndStoreData/getAttendance';
import { getRoutePlan } from './GetAndStoreData/getRoutePlan.js';
import { getProduct2 } from './GetAndStoreData/getProduct2';
import { getOrder } from './GetAndStoreData/getOrder';
import { getInvoice } from './GetAndStoreData/getInvoice';
import { getOrderItem } from './GetAndStoreData/getOrderItem';
import { getSurveyTemplate } from './GetAndStoreData/getSurveyTemplate';
import { getSurveyAssignment } from './GetAndStoreData/getSurveyAssignment';
import { getSurveyAssignmentTarget } from './GetAndStoreData/getSurveyAssignmentTarget';
import { getSurveyQuestion } from './GetAndStoreData/getSurveyQuestion';
import { getSurveyQuestionOption } from './GetAndStoreData/getSurveyQuestionOption';
import { getSurveyResponse } from './GetAndStoreData/getSurveyResponse';
import { getIncotermAssignmentHNT } from './GetAndStoreData/getIncotermAssignmentHNT';
import { getPicklist } from './GetAndStoreData/getPicklist';
import { getProductPricingHistoryHNT } from './GetAndStoreData/getProductPricingHistoryHNT';
import { getProductPrice } from './GetAndStoreData/getProductPrice';
import { getLineSRDistributorMappingHNT } from './GetAndStoreData/getLineSRDistributorMappingHNT';
import { getLineProductMappingHNT } from './GetAndStoreData/getLineProductMappingHNT';
import { getPricingMarginMasterHNT } from './GetAndStoreData/getPricingMarginMasterHNT';
import { getSRBeatAssignmentHNT } from './GetAndStoreData/getSRBeatAssignmentHNT';
import { getInvoiceItemsHNT } from './GetAndStoreData/getInvoiceItemsHNT';
import { getPriorityHNT } from './GetAndStoreData/getPriorityHNT';
import { getRecommendedProductsHNT } from './GetAndStoreData/getRecommendedProductsHNT';
import { getMTExceptionMT } from './GetAndStoreData/getMTExceptionMT';
import { getCompetitorLineItemMT } from './GetAndStoreData/getCompetitorLineItemMT';
import { getCompetitorMasterMT } from './GetAndStoreData/getCompetitorMasterMT';
import { getGrowthMappingEntryMT } from './GetAndStoreData/getGrowthMappingEntryMT';
import { getBeatMaster } from './GetAndStoreData/getBeatMaster';
import { getBeatMapping } from './GetAndStoreData/getBeatMapping';
import { getCompetitorLineItemHTSO } from './GetAndStoreData/getCompetitorLineItemHTSO';
import { getCompetitorMasterHTSO } from './GetAndStoreData/getCompetitorMasterHTSO';
import { getPlantDepotRakeHTSO } from './GetAndStoreData/getPlantDepotRakeHTSO';
import { getCompetitorProductHTSO } from './GetAndStoreData/getCompetitorProductHTSO';
import { getGeographyHTSO } from './GetAndStoreData/getGeographyHTSO';
import { getCgcloudInventoryHNT } from './GetAndStoreData/getCgcloudInventoryHNT.js';
import { getAttendanceRules } from './GetAndStoreData/getAttendanceRules';
import { getSalaryAcknowledgementSR } from './GetAndStoreData/getSalaryAcknowledgementSR';
import { getGamificationMasterFromAPI } from './GetAndStoreData/getGamificationMaster.js';
import { getGamificationTransactionHNT } from './GetAndStoreData/getGamificationTransaction.js'
import { getGamificationRewardHNT } from './GetAndStoreData/getGamificationReward.js'
import { getGamificationRankFromAPI } from './GetAndStoreData/getGamificationRank.js'
import { getHNTCompetitorPrice } from './GetAndStoreData/getHNTCompetitorPrice.js'
import { getNonDmsRegions } from './GetAndStoreData/getNonDmsRegions.js';
import { getUserBaMapping } from './GetAndStoreData/getUserBaMapping.js';
import { CLEAR_TABLES } from '../../config'
import { syncAttendanceRecords, syncMTExceptionRecord, syncGrowthMappingEntryRecord, syncBeatDayRecord, syncVisitRecord, syncOrderRecord, syncOrderItemRecord, syncCollectionRecord, syncCollectionAllocationRecord, syncInvoiceRecord, syncInvoiceItemRecord, syncAccountRecord, syncFormJsonecord, syncCompetitorRecord, syncStockCheckRecord, syncSalaryAcknowledgementRecord, syncHNTCompetitorPriceRecord, syncGamificationTransactionRecord, syncSurveyResponseRecord } from '../database/dbService/AllDataSync';
import { InsertNSyncLog } from '../utils/InsertNSyncLog';



export const createSyncAbortController = () => {
  syncAbortController = new AbortController();
  return syncAbortController;
};

/**
* Cancel the ongoing sync operation
*/
export const cancelDataSync = () => {
  if (syncAbortController) {
    console.log('🛑 Cancelling data sync...');
    syncAbortController.abort();
  }
};

/**
* Check if sync has been aborted
*/
const checkAborted = () => {
  if (syncAbortController?.signal?.aborted) {
    console.log('⚠️ Sync was cancelled by user');
    throw new Error('DATA_SYNC_CANCELLED');
  }
};

/**
* Safely show toast notifications
*/
// const showErrorToast = (message, error = null) => {
//   try {
//     console.error(`🔴 ${message}`, error);
//     store.dispatch(
//       showToast({
//         type: 'error',
//         message: message,
//       })
//     );
//   } catch (e) {
//     console.warn('Failed to dispatch toast:', e);
//   }
// };


// /**
//  * Safely handle progress callbacks
//  */
// const safeProgress = (msg, onProgress) => {
//   try {
//     if (typeof onProgress === 'function') onProgress(msg);
//   } catch (e) {
//     console.warn('Progress callback failed', e);
//   }
// };

// /**
//  * Wrapper for database operations with error handling
//  */
// const safeDatabaseOperation = async (operation, operationName) => {
//   try {
//     const result = await operation();
//     console.log(`${operationName} completed`);
//     return { success: true, data: result };
//   } catch (err) {
//     const errorMsg = ` ${operationName} failed: ${err.message}`;
//     showErrorToast(errorMsg, err);
//     return { success: false, error: err };
//   }
// };

export const dataSyncer = async (creds, fetchRecords, apiFetch = null, apiComposite = null, onProgress = () => { }) => {
  try {
    const netState = await NetInfo.fetch();
    const isOnline = Boolean(netState.isConnected && netState.isInternetReachable !== false);
    if (!isOnline) {
      console.log('⚠️ dataSyncer aborted: Device is offline');
      return { status: 'offline', message: 'You are offline. Connect to internet to sync' };
    }

    const { accessToken, instanceUrl } = creds;

    // ========== INITIAL VALIDATION ==========
    if (!creds || !accessToken) {
      const msg = 'Missing credentials - NO ACCESS TOKEN FOUND';
      showErrorToast(msg);
      return { status: 'error', message: msg };
    }

    if (!instanceUrl) {
      const msg = 'Missing instance URL';
      showErrorToast(msg);
      return { status: 'error', message: msg };
    }

    safeProgress('Initializing data sync...', onProgress);

    try {
      console.log('🔍 Diagnostic: Describing Survey_Template__c fields...');
      const descTemplate = await axios.get(`${instanceUrl}/services/data/v61.0/sobjects/Survey_Template__c/describe`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      console.log('🔍 Survey_Template__c Fields:', descTemplate.data.fields.map(f => f.name));

      console.log('🔍 Diagnostic: Describing Survey_Assignment_Target__c fields...');
      const descTarget = await axios.get(`${instanceUrl}/services/data/v61.0/sobjects/Survey_Assignment_Target__c/describe`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      console.log('🔍 Survey_Assignment_Target__c Fields:', descTarget.data.fields.map(f => f.name));

      console.log('🔍 Diagnostic: Describing Survey_Assignment__c fields...');
      const descAssignment = await axios.get(`${instanceUrl}/services/data/v61.0/sobjects/Survey_Assignment__c/describe`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      console.log('🔍 Survey_Assignment__c Fields:', descAssignment.data.fields.map(f => f.name));
    } catch (err) {
      console.log('🔍 Describe call failed:', err.response?.data || err.message);
    }


    safeProgress('Syncing offline data in salesforce.', onProgress);


    await AsyncStorage.setItem('instanceUrl_for_datasyncer', instanceUrl);
    await AsyncStorage.setItem('accessToken_for_datasyncer', accessToken);
    const handleSyncData = async () => {
      await syncAttendanceRecords(apiFetch);
      await syncSurveyResponseRecord(apiFetch, apiComposite);
      await syncAccountRecord(apiFetch);
      await syncBeatDayRecord(apiFetch, apiComposite);
      await syncVisitRecord(apiFetch, apiComposite);
      await syncOrderRecord(apiFetch);
      await syncOrderItemRecord(apiFetch);
      await syncCollectionRecord(apiFetch);
      await syncCollectionAllocationRecord(apiFetch);
      await syncInvoiceRecord(apiFetch)
      await syncInvoiceItemRecord(apiFetch)
      await syncFormJsonecord(apiFetch);
      await syncCompetitorRecord(apiFetch);
      await syncStockCheckRecord(apiFetch);
      await syncSalaryAcknowledgementRecord(apiFetch);
      await syncGamificationTransactionRecord(apiFetch);
      await syncMTExceptionRecord(apiFetch);
      await syncGrowthMappingEntryRecord(apiFetch);
      await syncHNTCompetitorPriceRecord(apiFetch);
    };
    await handleSyncData()


    // ========== STEP 1: CLEAR LOCAL DATABASE ==========
    safeProgress('Clearing local database...', onProgress);

    const objectsToClear = CLEAR_TABLES;
    for (const objectName of objectsToClear) {
      const clearResult = await safeDatabaseOperation(
        () => UniversalUpdateInsert({ ObjectName: objectName, Type: 'delete_synced_only' }),
        // () => UniversalUpdateInsert({ ObjectName: objectName, Type: 'delete_all' }),
        `Clear ${objectName}`
      );
      if (!clearResult.success) {
        const msg = `Failed to clear ${objectName}`;
        showErrorToast(msg);
        return { status: 'error', message: msg };
      }
    }
    // return;

    // ========== STEP 2: GET LOGGED IN USER ==========
    safeProgress('Fetching logged in user...', onProgress);

    const userResult = await safeDatabaseOperation(
      () => UniversalUpdateInsert({ ObjectName: 'User', Type: 'get' }),
      'Fetch logged in user'
    );

    if (!userResult.success) {
      const msg = 'Failed to fetch logged in user from local DB';
      showErrorToast(msg);
      return { status: 'error', message: msg };
    }

    console.log('userresult ', userResult);

    const loggedInUser = userResult.data;
    if (!loggedInUser || loggedInUser.length === 0) {
      const msg = 'No logged in user found in local database';
      showErrorToast(msg);
      return { status: 'error', message: msg };
    }
    console.log('User fetched:', loggedInUser[0].Name);





    if (loggedInUser[0].DeveloperName === 'H_T_SO') {

      // ========== STEP 3: FETCH SALES/TEAM USERS ==========
      // safeProgress('Fetching Sales/Team users...', onProgress);


      // if (loggedInUser[0].DeveloperName === 'H_T_SO') {
      //   const soResult = await getSoUsersHTSO({
      //     loggedInUser: loggedInUser[0],
      //     fetchRecords,
      //     accessToken,
      //     instanceUrl,
      //   });
      //
      //   if (!soResult.success) return soResult;
      // }

      // Fetch PlantDepotRakeHTSO
      // const PlantDepotRakeHTSOResult = await getPlantDepotRakeHTSO({
      //   fetchRecords,
      //   accessToken,
      //   instanceUrl,
      // });
      // if (!PlantDepotRakeHTSOResult.success) return PlantDepotRakeHTSOResult;

      // Fetch HNTCompetitorPrice
      // const HNTCompetitorPriceResult = await getHNTCompetitorPrice({
      //   fetchRecords,
      //   accessToken,
      //   instanceUrl,
      // });
      // if (!HNTCompetitorPriceResult.success) return HNTCompetitorPriceResult;

      // Fetch competitorProduct
      //   const competitorProductResult = await getCompetitorProductHTSO({
      //   fetchRecords,
      //   accessToken,
      //   instanceUrl, 
      // });
      // if (!competitorProductResult.success) return competitorProductResult;



      // Fetch Competitor Line Item
      // const competitorLineItemHTSOResult = await getCompetitorLineItemHTSO({
      //   fetchRecords,
      //   accessToken,
      //   instanceUrl,
      // });

      // if (!competitorLineItemHTSOResult.success) return competitorLineItemHTSOResult;
      // Fetch Competitor Master
      // const competitorMasterHTSOResult = await getCompetitorMasterHTSO({
      //   fetchRecords,
      //   accessToken,
      //   instanceUrl,
      // });

      // if (!competitorMasterHTSOResult.success) return competitorMasterHTSOResult;



      // const geographyResult = await getGeographyHTSO({
      //   fetchRecords,
      //   accessToken,
      //   instanceUrl,
      // });

      // if (!geographyResult.success) return geographyResult;

    }

    // if (loggedInUser[0].DeveloperName === 'H_T_SR') {

    //   const getGamificationMasterResult = await getGamificationMasterFromAPI({
    //     creds,
    //     apiFetch,
    //     loggedInUser: loggedInUser[0],
    //   });

    //   if (!getGamificationMasterResult.success) return getGamificationMasterResult;
    //   //  return
    //   const GamificationTransactionResult = await getGamificationTransactionHNT({
    //     fetchRecords,
    //     accessToken,
    //     instanceUrl,
    //     loggedInUser: loggedInUser[0],
    //   });
    //   if (!GamificationTransactionResult.success) return GamificationTransactionResult;
    //   // return;
    //   const GamificationRewardResult = await getGamificationRewardHNT({
    //     fetchRecords,
    //     accessToken,
    //     instanceUrl,
    //     loggedInUser: loggedInUser[0],
    //   });
    //   if (!GamificationRewardResult.success) return GamificationRewardResult;
    //   // return;
    //   const GamificationRankResult = await getGamificationRankFromAPI({
    //     creds,
    //     apiFetch,
    //     loggedInUser: loggedInUser[0],
    //   });
    //   if (!GamificationRankResult.success) return GamificationRankResult;
    //   // return;
    //   // ========== STEP: FETCH COLLECTIONS ==========
    //   safeProgress('Fetching Collections...', onProgress);

    //   const collectionResult = await getCollectionHTSR({
    //     accessToken,
    //     instanceUrl,
    //     fetchRecords,
    //   });

    //   if (!collectionResult.success) return collectionResult;

    //   const salaryAckResult = await getSalaryAcknowledgementSR({
    //     fetchRecords,
    //     accessToken,
    //     instanceUrl,
    //     loggedInUser: loggedInUser[0],
    //   });

    //   if (!salaryAckResult.success) return salaryAckResult;


    // }

    // if (loggedInUser[0].DeveloperName === 'H_T_ASO') {
    //   const salaryAckResult = await getSalaryAcknowledgementSR({
    //     fetchRecords,
    //     accessToken,
    //     instanceUrl,
    //     loggedInUser: loggedInUser[0],
    //   });
    //   if (!salaryAckResult.success) return salaryAckResult;
    // }

    const accountResult = await getAccount({
      fetchRecords,
      accessToken,
      instanceUrl,
      loggedInUser: loggedInUser,
      GetObjectData,
      onProgress,
    });
    if (!accountResult.success) return accountResult;

    // return
    // ========== STEP 5: FETCH ATTENDANCE DATA ==========
    safeProgress('Fetching attendance...', onProgress);

    const attendanceResult = await getAttendance({
      creds,
      fetchRecords,
      accessToken,
      instanceUrl,
    });

    if (!attendanceResult.success) return attendanceResult;

    //get attendance rules
    // const attendanceRulesResult = await getAttendanceRules({
    //   creds,
    //   apiFetch,
    //   loggedInUser: loggedInUser[0],
    // });

    // if (!attendanceRulesResult.success) return attendanceRulesResult;

    // return
    // ========== STEP 7: FETCH BEAT DATA ==========
    safeProgress('Fetching Beat master data...', onProgress);

    const beatResult = await getBeatMaster({
      fetchRecords,
      accessToken,
      instanceUrl,
      loggedInUser: loggedInUser[0],
    });

    if (!beatResult.success) return beatResult;


    console.log('Fetching route plan data...');
    const routePlanResult = await getRoutePlan({
      loggedInUser: loggedInUser[0],
      fetchRecords,
      accessToken,
      instanceUrl,
      onProgress,
    });

    if (!routePlanResult.success) return routePlanResult;

    safeProgress('Fetching Beat Mapping data...', onProgress);
    const beatMappingResult = await getBeatMapping({
      fetchRecords,
      accessToken,
      instanceUrl,
      loggedInUser: loggedInUser[0],
      onProgress,
    });
    if (!beatMappingResult.success) return beatMappingResult;

    safeProgress('Fetching User BA Mapping...', onProgress);
    await getUserBaMapping({
      fetchRecords,
      accessToken,
      instanceUrl,
      loggedInUser: loggedInUser[0],
      onProgress,
    });

    safeProgress('Fetching Non-DMS Regions...', onProgress);
    await getNonDmsRegions({
      fetchRecords,
      accessToken,
      instanceUrl,
      onProgress,
    });


  //  return;
    safeProgress('Fetching Products...', onProgress);

    const productResult = await getProduct2({
      fetchRecords,
      apiFetch,
      accessToken,
      instanceUrl,
    });

    if (!productResult.success) return productResult;



    // ========== FETCH ORDERS & ORDER ITEMS ==========
    safeProgress('Fetching Spot Sales...', onProgress);
    const orderResult = await getOrder({
      fetchRecords,
      accessToken,
      instanceUrl,
    });

    if (!orderResult.success) return orderResult;

    const orderItemResult = await getOrderItem({
      fetchRecords,
      accessToken,
      instanceUrl,
      onProgress,
    });

    if (!orderItemResult.success) return orderItemResult;



    // ========== STEP 15: FETCH SURVEYS ==========
    const surveyTemplateResult = await getSurveyTemplate({
      fetchRecords,
      accessToken,
      instanceUrl,
    });
    if (!surveyTemplateResult.success) return surveyTemplateResult;

    const surveyAssignmentResult = await getSurveyAssignment({
      fetchRecords,
      accessToken,
      instanceUrl,
    });
    if (!surveyAssignmentResult.success) return surveyAssignmentResult;

    const surveyAssignmentTargetResult = await getSurveyAssignmentTarget({
      fetchRecords,
      accessToken,
      instanceUrl,
    });
    if (!surveyAssignmentTargetResult.success) return surveyAssignmentTargetResult;

    const surveyQuestionResult = await getSurveyQuestion({
      fetchRecords,
      accessToken,
      instanceUrl,
    });
    if (!surveyQuestionResult.success) return surveyQuestionResult;

    const surveyQuestionOptionResult = await getSurveyQuestionOption({
      fetchRecords,
      accessToken,
      instanceUrl,
    });
    if (!surveyQuestionOptionResult.success) return surveyQuestionOptionResult;

    const surveyResponseResult = await getSurveyResponse({
      fetchRecords,
      accessToken,
      instanceUrl,
    });
    if (!surveyResponseResult.success) return surveyResponseResult;




    // ========== STEP 16: FETCH STOCK CHECK ==========
    // currentStep = 16;
    // safeProgress(`Fetching Stock Check...`, onProgress);

   

    // if (!stockCheckResult.success) return stockCheckResult;
    // // return;

    // // ========== STEP 17: FETCH UNIT OF MEASURE ==========
    // currentStep = 17;
    // safeProgress(`Fetching Unit of Measure...`, onProgress);

    // const uomResult = await getUnitOfMeasure({
    //   fetchRecords,
    //   accessToken,
    //   instanceUrl,
    // });

    // if (!uomResult.success) return uomResult;


    // // ========== STEP 18: FETCH TARGET RECORDS ==========
    // currentStep = 18;
    // safeProgress(`Fetching Targets...`, onProgress);
    // const targetResult = await getTarget({
    //   fetchRecords,
    //   accessToken,
    //   instanceUrl,
    //   loggedInUser: loggedInUser[0],
    // });

    // if (!targetResult.success) return targetResult;

    // ========== STEP 19: FETCH PICKLIST OPTIONS DATA ==========
    currentStep = 19;
    safeProgress(`Fetching Picklist Options...`, onProgress);

    const picklistResult = await getPicklist({
      creds,
      apiFetch,
      fetchRecords,
      accessToken,
      instanceUrl,
    });

    if (!picklistResult.success) return picklistResult;

    // ========== STEP 20: DEVELOPER ROLE-BASED SYNC (H&T USERS) ==========
    // currentStep = 20;
    // safeProgress(`Syncing role-based data (H&T)...`, onProgress);

    // if (loggedInUser[0].DeveloperName === 'H_T_SR' ||
    //   loggedInUser[0].DeveloperName === 'H_T_ASO' ||
    //   loggedInUser[0].DeveloperName === 'H_T_SO') {

    //   console.log('[SYNC] Processing H&T role-specific data...');

      // Fetch Incoterm Assignment
      // const incotermResult = await getIncotermAssignmentHNT({
      //   fetchRecords,
      //   accessToken,
      //   instanceUrl,
      // });
      // if (!incotermResult.success) return incotermResult;
      // const pricingHistoryResult = await getProductPricingHistoryHNT({
      //   creds,
      //   apiFetch,
      // });
      // if (!pricingHistoryResult.success) return pricingHistoryResult;
      //       // const query_pricing = `SELECT Id, Category__c, Price_Group__c, Direct__c, Super__c, Sub_DB__c FROM Pricing_Margin_Master__c`;
      // const pricingMarginResult = await getPricingMarginMasterHNT({
      //   creds,
      //   apiFetch,
      // });
      // if (!pricingMarginResult.success) return pricingMarginResult;

      //get pricing

      // ========== STEP 11: FETCH ORDERS ==========
     
      // if (!orderResult.success) return orderResult;

      // const orderItemResult = await getOrderItem({
      //   fetchRecords,
      //   accessToken,
      //   instanceUrl,
      //   onProgress,
      // });
      // if (!orderItemResult.success) return orderItemResult;



      // if (loggedInUser[0].DeveloperName === 'H_T_SR' || loggedInUser[0].DeveloperName === 'H_T_ASO') {
      //   safeProgress('Fetching Invoices...', onProgress);
      //   const invoiceResult = await getInvoice({
      //     fetchRecords,
      //     accessToken,
      //     instanceUrl,
      //   });
      //   if (!invoiceResult.success) return invoiceResult;
      //   safeProgress(` Fetching Invoice Items...`, onProgress);
      //   const invoiceItemsResult = await getInvoiceItemsHNT({
      //     fetchRecords,
      //     accessToken,
      //     instanceUrl,
      //   });
      //   if (!invoiceItemsResult.success) return invoiceItemsResult;
      // }

      // Fetch Line SR Distributor Mapping
      // const lineSRResult = await getLineSRDistributorMappingHNT({
      //   fetchRecords,
      //   accessToken,
      //   instanceUrl,
      //   loggedInUser: loggedInUser[0],
      // });

      // if (!lineSRResult.success) return lineSRResult;

      // // return

      // // Fetch Line Product Mapping
      // const lineProductResult = await getLineProductMappingHNT({
      //   fetchRecords,
      //   accessToken,
      //   instanceUrl,
      // });

      // if (!lineProductResult.success) return lineProductResult;


      // const pricingResult = await getProductPrice({
      //   creds,
      //   apiFetch,
      //   loggedInUser: loggedInUser[0],
      //   fetchRecords,
      //   accessToken,
      //   instanceUrl,
      // });
      // if (!pricingResult.success) return pricingResult;

      // // ========== STEP: FETCH PRICING MARGIN MASTER ==========
      // safeProgress(`Fetching Pricing...`, onProgress);

      // //  return;


      // // ========== STEP: FETCH SR BEAT ASSIGNMENTS ==========
      // safeProgress(`Fetching SR Beat Assignment...`, onProgress);

      // const beatAssignmentResult = await getSRBeatAssignmentHNT({
      //   fetchRecords,
      //   accessToken,
      //   instanceUrl,
      //   loggedInUser: loggedInUser[0],
      // });

      // if (!beatAssignmentResult.success) return beatAssignmentResult;

      // return;
      // continue to next step...





      // ========== STEP: FETCH PRIORITY ==========
      // safeProgress('Fetching Priority...', onProgress);

      // const priorityResult = await getPriorityHNT({
      //   fetchRecords,
      //   accessToken,
      //   instanceUrl,
      //   loggedInUser: loggedInUser[0],
      // });

      // if (!priorityResult.success) return priorityResult;


      // ========== STEP: FETCH RECOMMENDED PRODUCTS ==========
      // safeProgress('Fetching Recommended Products...', onProgress);

      // const recommendedResult = await getRecommendedProductsHNT({
      //   fetchRecords,
      //   accessToken,
      //   instanceUrl,
      //   loggedInUser: loggedInUser[0],
      // });

      // if (!recommendedResult.success) return recommendedResult;

      // const cgcloudInventoryResult = await getCgcloudInventoryHNT({
      //   fetchRecords,
      //   accessToken,
      //   instanceUrl,
      //   loggedInUser: loggedInUser[0],
      //   creds,
      //   apiFetch,

      // });

      // if (!cgcloudInventoryResult.success) return cgcloudInventoryResult;

      {
        const surveyTemplateResult = await getSurveyTemplate({
          fetchRecords,
          accessToken,
          instanceUrl,
        });
        if (!surveyTemplateResult.success) return surveyTemplateResult;

        const surveyAssignmentResult = await getSurveyAssignment({
          fetchRecords,
          accessToken,
          instanceUrl,
        });
        if (!surveyAssignmentResult.success) return surveyAssignmentResult;

        const surveyAssignmentTargetResult = await getSurveyAssignmentTarget({
          fetchRecords,
          accessToken,
          instanceUrl,
        });
        if (!surveyAssignmentTargetResult.success) return surveyAssignmentTargetResult;

        const surveyQuestionResult = await getSurveyQuestion({
          fetchRecords,
          accessToken,
          instanceUrl,
        });
        if (!surveyQuestionResult.success) return surveyQuestionResult;

        const surveyQuestionOptionResult = await getSurveyQuestionOption({
          fetchRecords,
          accessToken,
          instanceUrl,
        });
        if (!surveyQuestionOptionResult.success) return surveyQuestionOptionResult;

        const surveyResponseResult = await getSurveyResponse({
          fetchRecords,
          accessToken,
          instanceUrl,
        });
        if (!surveyResponseResult.success) return surveyResponseResult;
      }


    // }
    // return
    // ========== STEP 21: DEVELOPER ROLE-BASED SYNC (MT USERS) ==========
    // if (loggedInUser[0].DeveloperName === 'MT_SO' || loggedInUser[0].DeveloperName === 'MT_Merchandiser') {


    //   safeProgress(`Fetching SR Beat Assignment...`, onProgress);

    //   const beatAssignmentResult = await getSRBeatAssignmentHNT({
    //     fetchRecords,
    //     accessToken,
    //     instanceUrl,
    //     loggedInUser: loggedInUser[0],
    //   });

    //   if (!beatAssignmentResult.success) return beatAssignmentResult;
    //   console.log('[SYNC] Processing MT role-specific data...');

    //   const mtExceptionResult = await getMTExceptionMT({
    //     fetchRecords,
    //     accessToken,
    //     instanceUrl,
    //   });

    //   if (!mtExceptionResult.success) return mtExceptionResult;

    //   // Fetch Competitor Line Item
    //   const competitorLineItemResult = await getCompetitorLineItemMT({
    //     fetchRecords,
    //     accessToken,
    //     instanceUrl,
    //   });

    //   if (!competitorLineItemResult.success) return competitorLineItemResult;


    //   // Fetch Competitor Master
    //   const competitorMasterResult = await getCompetitorMasterMT({
    //     fetchRecords,
    //     accessToken,
    //     instanceUrl,
    //   });

    //   if (!competitorMasterResult.success) return competitorMasterResult;


    //   const growthMappingResult = await getGrowthMappingEntryMT({
    //     fetchRecords,
    //     accessToken,
    //     instanceUrl,
    //   });

    //   if (!growthMappingResult.success) return growthMappingResult;

    // }

     const generateSYNC = () => {
       const timestamp = Date.now();
       return `Sync-${timestamp}`;
     };
     const date = moment().format('YYYY-MM-DD');
     const LastSyncPayload = {
       Sf_Id: generateSYNC(),
       DateTime: date,
       is_synced: true,
     };
     await UniversalUpdateInsert({
       ObjectName: 'LastSync',
       Type: 'insert',
       data: LastSyncPayload,
     });

    // ========== ALL SYNCS COMPLETE ==========
    console.log('ALL DATA SYNCS COMPLETED SUCCESSFULLY');
    return { status: 'success' };

  } catch (err) {
    const errorMsg = ` Unexpected error during data sync: ${err.message}`;
    showErrorToast(errorMsg, err);
    console.error(errorMsg, err);
    InsertNSyncLog({ endpoint: '/services/apexrest/dataSyncer', requestBody: {}, responseBody: { message: err.message }, statusCode: 0, loggingType: 'Error' }).catch(() => { });
    return { status: 'error', message: err.message };
  }
};
