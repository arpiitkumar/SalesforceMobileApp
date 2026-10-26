// auth/dataSyncer.js
import UniversalUpdateInsert from '../database/dbService/UniversalUpdateInsert';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { showToast } from '../redux/slices/toastSlice';
import { store } from '../redux/store';
import { useApiFetch } from '../utils/apiFetchHooks/useApiFetch';
import fetchAttendance from '../utils/setDataApis/fetchAttendance.js';
import GetObjectData from '../utils/helper/GetObjectData.js'
import moment from 'moment';
import { Database } from '@nozbe/watermelondb';
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
import { CLEAR_TABLES_GET_DATA } from '../../config'
import { syncAttendanceRecords, syncMTExceptionRecord, syncGrowthMappingEntryRecord, syncBeatDayRecord, syncVisitRecord, syncOrderRecord, syncOrderItemRecord, syncCollectionRecord, syncCollectionAllocationRecord, syncInvoiceRecord, syncInvoiceItemRecord, syncAccountRecord, syncFormJsonecord, syncCompetitorRecord, syncStockCheckRecord, syncSalaryAcknowledgementRecord, syncHNTCompetitorPriceRecord, syncGamificationTransactionRecord, syncSurveyResponseRecord } from '../database/dbService/AllDataSync';



export const createSyncAbortController = () => {
  syncAbortController = new AbortController();
  return syncAbortController;
};

export const cancelDataSync = () => {
  if (syncAbortController) {
    console.log('🛑 Cancelling data sync...');
    syncAbortController.abort();
  }
};

const checkAborted = () => {
  if (syncAbortController?.signal?.aborted) {
    console.log('⚠️ Sync was cancelled by user');
    throw new Error('DATA_SYNC_CANCELLED');
  }
};


export const dataSyncer_getData = async (creds, fetchRecords, apiFetch = null, apiComposite = null, onProgress = () => { }) => {
  try {
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

    // console.log('Credentials validated');
    safeProgress('Initializing data sync...', onProgress);


    safeProgress('Syncing offline data in salesforce.', onProgress);


    await AsyncStorage.setItem('instanceUrl_for_datasyncer', instanceUrl);
    await AsyncStorage.setItem('accessToken_for_datasyncer', accessToken);
    const handleSyncData = async () => {
      await syncAttendanceRecords(apiFetch);
      await syncSurveyResponseRecord(apiFetch, apiComposite);
      await syncBeatDayRecord(apiFetch, apiComposite);
      await syncVisitRecord(apiFetch, apiComposite);
      await syncOrderRecord(apiFetch);
      await syncOrderItemRecord(apiFetch);
      await syncCollectionRecord(apiFetch);
      await syncCollectionAllocationRecord(apiFetch);
      await syncInvoiceRecord(apiFetch)
      await syncInvoiceItemRecord(apiFetch)
      await syncAccountRecord(apiFetch);
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
    // return;
    // ========== STEP 1: CLEAR LOCAL DATABASE ==========
    safeProgress('Clearing local database...', onProgress);

    const objectsToClear = CLEAR_TABLES_GET_DATA;
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

    // ========== FETCH ATTENDANCE DATA ==========
    safeProgress('Fetching attendance...', onProgress);

    const attendanceResult = await getAttendance({
      creds,
      fetchRecords,
      accessToken,
      instanceUrl,
    });

    if (!attendanceResult.success) return attendanceResult;

    safeProgress('Fetching Beat master data...', onProgress);

    const beatResult = await getBeatMaster({
      fetchRecords,
      accessToken,
      instanceUrl,
      loggedInUser: loggedInUser[0],
    });

    if (!beatResult.success) return beatResult;


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


    // return;
    safeProgress('Fetching Products...', onProgress);

    const productResult = await getProduct2({
      fetchRecords,
      apiFetch,
      accessToken,
      instanceUrl,
    });

    if (!productResult.success) return productResult;


    // safeProgress(`Fetching Unit of Measure...`, onProgress);

    // const uomResult = await getUnitOfMeasure({
    //   fetchRecords,
    //   accessToken,
    //   instanceUrl,
    // });

    // if (!uomResult.success) return uomResult;


    // Refresh orders for every role after synced local records are cleared.
    const orderResult = await getOrder({ fetchRecords, accessToken, instanceUrl });
    if (!orderResult.success) return orderResult;

    const orderItemResult = await getOrderItem({
      fetchRecords,
      accessToken,
      instanceUrl,
      onProgress,
    });
    if (!orderItemResult.success) return orderItemResult;



    //   if (loggedInUser[0].DeveloperName === 'H_T_SR' || loggedInUser[0].DeveloperName === 'H_T_ASO') {
    //     safeProgress('Fetching Invoices...', onProgress);
    //     const invoiceResult = await getInvoice({
    //       fetchRecords,
    //       accessToken,
    //       instanceUrl,
    //     });
    //     if (!invoiceResult.success) return invoiceResult;
    //     safeProgress(` Fetching Invoice Items...`, onProgress);
    //     const invoiceItemsResult = await getInvoiceItemsHNT({
    //       fetchRecords,
    //       accessToken,
    //       instanceUrl,
    //     });
    //     if (!invoiceItemsResult.success) return invoiceItemsResult;
    //   }

    //   const pricingResult = await getProductPrice({
    //     creds,
    //     apiFetch,
    //     loggedInUser: loggedInUser[0],
    //     fetchRecords,
    //     accessToken,
    //     instanceUrl,
    //   });
    //   if (!pricingResult.success) return pricingResult;

    //   // ========== STEP: FETCH PRICING MARGIN MASTER ==========
    //   safeProgress(`Fetching Pricing...`, onProgress);

    //   const cgcloudInventoryResult = await getCgcloudInventoryHNT({
    //     fetchRecords,
    //     accessToken,
    //     instanceUrl,
    //     loggedInUser: loggedInUser[0],
    //     creds,
    //     apiFetch,

    //   });

    //   if (!cgcloudInventoryResult.success) return cgcloudInventoryResult;

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

      safeProgress('Fetching Picklist Options...', onProgress);
      const picklistResult = await getPicklist({
        creds,
        apiFetch,
        fetchRecords,
        accessToken,
        instanceUrl,
      });
      if (!picklistResult.success) return picklistResult;


    // }

    const generateSYNC = () => {
      const timestamp = Date.now();
      return `Sync-${timestamp}`;
    };
    const date = moment().format('YYYY-MM-DD');
    // const date = moment().subtract(1, 'days').format('YYYY-MM-DD');
    const LastSyncPayload = {
      Sf_Id: generateSYNC(),
      DateTime: date,
      is_synced: true,
    }
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
    return { status: 'error', message: err.message };
  }
};
