import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { useDispatch } from 'react-redux';
import Spinner from 'react-native-spinkit';
import { oauth } from 'react-native-force';
import { loginSuccess } from '../../redux/slices/authSlice.js';
import { setDataReady } from '../../redux/slices/appNavigationSlice.js'
import { useApiFetch } from '../apiFetchHooks/useApiFetch.js';
import fetchUserProfile from '../setDataApis/fetchUserProfile.js';
import fetchAttendance from '../setDataApis/fetchAttendance.js';
import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert.js'
import { isInternetAvailable } from '../networkUtils.js'
import GetObjectData from './GetObjectData.js'
import AsyncStorage from '@react-native-async-storage/async-storage';
import moment from 'moment';import { convertSharePointUrl } from '../imageHelper.js';




const AuthStartupScreen = ({ navigation }) => {
  const [spinnerVisible, setSpinnerVisible] = useState(true)
  const dispatch = useDispatch();
  const { fetchRecords } = useApiFetch();
  const { apiFetch } = useApiFetch();


  // useEffect(() => {
  //   (async () => {
  //     const alreadySynced = await AsyncStorage.getItem('initialDataSynced');
  //     if (alreadySynced === 'true') {
  //       // Skip re‑sync
  //       dispatch(setDataReady(true));
  //       setSpinnerVisible(false);
  //     } else {
  //       // First run: actually do your auth + data‑fetch
  //       authenticateUser();
  //     }
  //   })();
  // }, []);

  useEffect(() => {
    authenticateUser();

  }, [])


  const authenticateUser = () => {
    oauth.getAuthCredentials(
      async (creds) => {
        try {
          console.log('Existing credentials found:', creds);
          await handleLogin(creds);
        } catch (error) {
          console.error('🔴 Error reusing credentials:', error);
        }
      },
      () => {
        oauth.authenticate(
          async (creds) => {
            try {
              console.log('Logged in successfully:', creds);
              await handleLogin(creds);
            } catch (error) {
              console.error('🔴 Authentication failed:', error);
            }
          },
          (err) => {
            console.error(' Authentication error:', err);
          }
        );
      }
    );
  };

  const handleLogin = async (creds) => {




    // Get the first day of the current month
    const firstDay = moment().startOf('month').format('YYYY-MM-DD');

    // Get the last day of the current month
    const lastDay = moment().endOf('month').format('YYYY-MM-DD');


    const isOnline = await isInternetAvailable()

    console.log(`Network is ----- ${isOnline ? 'Online' : 'Offline'}`);

    if (isOnline) {
      try {

        // 1. Fetch profile from API
        const userData = await fetchUserProfile(fetchRecords, creds.userId, creds.accessToken, creds.instanceUrl);
        const userDataForDb = {
          Sf_Id: creds.userId,
          DeviceId__c: userData?.[0]?.Deviceid__c,
          Name: userData?.[0]?.Name,
          Role: userData?.[0]?.UserRole?.Name,
        };
        console.log('USER DATA AND ROLE::::', userDataForDb)

        await UniversalUpdateInsert({ ObjectName: 'User', Type: 'insert', data: userDataForDb });





        // const fieldNamesRoute = 'Id,Name,Assigned_To__c,Approved_By__c,Status__c,Start_Date__c,End_Date__c,Reject_Reason__c,Assigned_To__r.UserRole.Name'
        // const AlldataRoute = await GetObjectData(fieldNamesRoute, "Route_Plans__c", fetchRecords, creds.accessToken, creds.instanceUrl)
        // // console.log("Alldata Mahendra Barwal", JSON.stringify(AlldataRoute))
        // const RoutecleanedData = AlldataRoute.map(item => {
        //   const { attributes, Id, ...rest } = item;
        //   return {
        //     Sf_Id: Id,
        //     ...rest
        //   };
        // });
        // const RouteSbData = await UniversalUpdateInsert({
        //   ObjectName: 'Route_Plans__c',
        //   Type: 'insert',
        //   data: RoutecleanedData,
        // });

        //const fieldNamesBeat = 'Id,Name,Beat_Status__c,VisitFrequency__c,DirectDBSubDB__c,SR_TSI_ASO_Name__c'
        //const AlldataBeat = await GetObjectData(fieldNamesBeat, "Beat__c", fetchRecords, creds.accessToken, creds.instanceUrl)
        // const BeatcleanedData = AlldataBeat.map(item => {
        //   const { attributes, Id, ...rest } = item;
        //   return {
        //     Sf_Id: Id,
        //     ...rest
        //   };
        // });
        // // console.log("AlldataBeat Mahendra Barwal", JSON.stringify(BeatcleanedData))
        // const BeatData = await UniversalUpdateInsert({
        //   ObjectName: 'Beat__c',
        //   Type: 'insert',
        //   data: BeatcleanedData,
        // });

        // const fieldNamesVisit = 'Id,Name, Beat__c, BeatDay__c, VisitDate__c, AccountId, PJPOutlet__c, VisitStatus__c, VisitNotes__c, CheckInTime__c, CheckOutTime__c, ProductiveCall__c, TimeSpentOnOutlet__c, CheckInLocation__c, CheckOutLocation__c, DistanceTravelledKm__c, Before12Noon__c, Before3PM__c, Before6PM__c, After6PM__c, VisitType__c, AdHocVisit__c, CheckInPhotoCaptured__c, IsOrderPlaced__c, OriginalMTPType__c, OriginalDBName__c, OriginalRepName__c, RevisedMTPType__c, RevisedDBName__c, RevisedRepName__c, MTPEditDate__c, MTPEditTime__c, ApprovedBy__c, ApprovalDate__c, Status__c, SRTransactionTime__c, SRTransactionLocation__c, LocationVarianceOLtoSCA__c, LocationVarianceOrdertoSCA__c'
        // const AlldataVisit = await GetObjectData(fieldNamesVisit, "Visit", fetchRecords, creds.accessToken, creds.instanceUrl)
        // const VisitcleanedData = AlldataVisit.map(item => {
        //   const { attributes, Id, ...rest } = item;
        //   return {
        //     Sf_Id: Id,

        //     ...rest
        //   };
        // });
        // // console.log("VisitcleanedData Mahendra Barwal", JSON.stringify(VisitcleanedData))

        // const VisitData = await UniversalUpdateInsert({
        //   ObjectName: 'Visit',
        //   Type: 'insert',
        //   data: VisitcleanedData,
        // });

        const fieldNamesAccount = 'Id,RecordTypeId,RecordType.Name,Party_Code__c,Name,Type,Outlet_Visit_Day__c,Channel__c,Class__c,BillingAddress,Phone,Email__c,PAN_Number__c,GSTIN_Number__c,OTPVerified__c,OTPVerifiedDate__c,KYC_Updated__c,CreditLimit__c,CreditDays__c,CensusCode__c,DBType__c'
        const AlldataAccount = await GetObjectData(fieldNamesAccount, "Account", fetchRecords, creds.accessToken, creds.instanceUrl)

        console.log(AlldataAccount)
        // const AccountcleanedData = AlldataAccount.map(item => {
        //   const { attributes, Id, BillingAddress, RecordType, ...rest } = item;
        //   return {
        //     Sf_Id: Id,
        //     RecordType: RecordType.Name,
        //     BillingAddress: `${BillingAddress.street}, ${BillingAddress.city}, ${BillingAddress.state}, ${BillingAddress.postalCode}, ${BillingAddress.country}`,
        //     ...rest
        //   };
        // });
        // console.log("AccountcleanedData Mahendra Barwal", JSON.stringify(AccountcleanedData))


        const AccountcleanedData = AlldataAccount.map(item => {
          const { attributes, Id, BillingAddress, RecordType, ...rest } = item;

          //  const rawAddress = `${BillingAddress.street}, ${BillingAddress.city}, ${BillingAddress.state}, ${BillingAddress.postalCode}, ${BillingAddress.country}`;
          const rawAddress = BillingAddress
            ? `${BillingAddress.street ?? ''}, ${BillingAddress.city ?? ''}, ${BillingAddress.state ?? ''}, ${BillingAddress.postalCode ?? ''}, ${BillingAddress.country ?? ''}`
            : '';
          const cleanedAddress = rawAddress
            .replace(/null/gi, '')                // remove "null"
            .replace(/\s*,\s*/g, ', ')            // normalize spaces around commas
            .replace(/(,\s*){2,}/g, ', ')         // collapse multiple commas
            .replace(/^,|,$/g, '')                // remove leading/trailing comma
            .trim();                              // remove extra whitespace

          return {
            Sf_Id: Id,
            RecordType: RecordType?.Name || '',
            BillingAddress: cleanedAddress,
            ...rest
          };
        });
        const AccountData = await UniversalUpdateInsert({
          ObjectName: 'Account',
          Type: 'insert',
          data: AccountcleanedData,
        });



        // 2. Fetch Attendance from API
        const attendances = await fetchAttendance(fetchRecords, creds.accessToken, creds.instanceUrl);
        for (const item of attendances) {
          const entry = {
            Sf_Id: item?.Id,
            Name: item?.Name,
            User__c: item?.User__c || creds.userId,
            AttendanceDate__c: item?.AttendanceDate__c,
            StartTime__c: item?.AttendanceStartTime__c,
            EndTime__c: item?.AttendanceEndTime__c,
            GeoLocation__c: item?.GeoLocation__c
              ? `${item.GeoLocation__c.latitude},${item.GeoLocation__c.longitude}`
              : '',
            Reason__c: item?.Reason__c,
            AttendanceStatus__c: item?.AttendanceStatus__c,
            LeaveDuration__c: item?.LeaveDuration__c,
            CapturedSelfie__c: item?.CapturedSelfie__c,
            Selfie_URL__c: item?.SelfieURL__c,
          };
          await UniversalUpdateInsert({ ObjectName: 'Attendant__c', Type: 'insert', data: entry });
        }

        // Optionally: insert dummy route/beat/visits here

        //DATA VISIT HISTRORY STARTS HEREREREERE



        const getBeatData = async () => {
          const query = `SELECT
  Id,
  Name,
  Assigned_To__c,
  Approved_By__c,
  Status__c,
  Start_Date__c,
  End_Date__c,
  Reject_Reason__c,
  Salesperson_Role__c,
  (SELECT
    Id,
    BeatDate__c,
    Beat__c,
    Beat__r.Name,
    Productivity__c,
    FirstScaTime__c,
    LastScaTime__c,
    First_Call_Time__c,
    Last_Call_Time__c,
    PlannedOutlets__c,
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
    EodComment__c,   SecOrderValue__c,
    SecOrderQuantityPcs__c,
 
    SecondaryOrderQuantityInKG__c,
    SecondaryOrderQuantityInValue__c,
    Planned_Outlets_Coverage__c,
    (SELECT
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
    FROM Visits__r)
  FROM Beat_Day__r)
FROM Route_Plans__c
WHERE Assigned_To__c = '${creds.userId}'  AND Start_Date__c = ${firstDay}
  AND End_Date__c = ${lastDay} AND status__c = 'approved'`
          const res = await fetchRecords('Beat__c', query, creds.accessToken, creds.instanceUrl)
          return res
          console.log("maha Barwal Data Beat And RoutePlan===============", JSON.stringify(getData))
        }



        const apiData = await getBeatData();
        //console.log("this is api data-----------------------------------------------------", JSON.stringify(apiData))

        const cleanedPayload = apiData?.map(item => ({
          Sf_Id: item.Id, // manual remap
          Name: item.Name,
          Assigned_To__c: item.Assigned_To__c,
          Approved_By__c: item.Approved_By__c,
          Status__c: item.Status__c,
          Start_Date__c: item.Start_Date__c,
          End_Date__c: item.End_Date__c,
          Reject_Reason__c: item.Reject_Reason__c,
          Salesperson_Role__c: item.Assigned_To__r?.UserRole?.Name
        }));

        //console.log('this is new map for api data of  ROUTE PLAN====', cleanedPayload)

        await UniversalUpdateInsert({
          ObjectName: 'Route_Plans__c',
          Type: 'insert',
          data: cleanedPayload
        });


        const logBeatNamesFromApiData = (apiData) => {
          if (!Array.isArray(apiData)) {
            console.warn('apiData is not an array');
            return;
          }

          apiData.forEach(routePlan => {
            const beatDays = routePlan.Beat_Day__r?.records || [];
            beatDays.forEach(beatDay => {
              const beatName = beatDay.Beat__r?.Name || 'N/A';
              console.log(`Beat Name: ${beatName}`);
            });
          });
        };

        logBeatNamesFromApiData(apiData);




        const fieldNamesBeat =
          "SELECT Id,Name,Beat_Status__c,VisitFrequency__c,DirectDBSubDB__c,SR_TSI_ASO_Name__c FROM Beat__c";
        const res = await fetchRecords(
          "Beat__c",
          fieldNamesBeat,
          creds.accessToken,
          creds.instanceUrl
        );

        const BeatcleanedData = res.map((item) => {
          // const { attributes, Id, ...rest } = item;
          return {
            Sf_Id: item.Id,
            Name: item.Name || "",
            Beat_Status__c: item.Beat_Status__c || "",
            VisitFrequency__c: item.VisitFrequency__c || "",
            DirectDBSubDB__c: item.DirectDBSubDB__c || "",
            SR_TSI_ASO_Name__c: item.SR_TSI_ASO_Name__c || "",
            is_locally_changed: false,
            operation_type: "insert",
            last_modified: Date.now(),
            is_synced: true,
          };
        });
        const BeatData = await UniversalUpdateInsert({
          ObjectName: "Beat__c",
          Type: "insert",
          data: BeatcleanedData,
        });

        // console.log(
        //   "Beat__c inserted successfully...................",
        //   BeatData
        // );





        // Extract and flatten all Beat_Day__r records
        const allBeatDays = apiData?.flatMap(routePlan => {
          const tourPlanId = routePlan.Id; // for Tour_Plan__c reference
          return (routePlan.Beat_Day__r?.records || []).map(beatDay => ({
            Sf_Id: beatDay.Id,
            Productivity__c: beatDay.Productivity__c,
            Beat__Name: beatDay?.Beat__r?.Name || '',
            Beat__c: beatDay?.Beat__c || "",
            First_SCA_Time__c: beatDay.FirstScaTime__c,
            Last_SCA_Time__c: beatDay.LastScaTime__c,
            First_Call_Time__c: beatDay.First_Call_Time__c,
            Last_Last_Time__c: beatDay.Last_Call_Time__c,
            Planned_Outlets__c: beatDay.PlannedOutlets__c,
            Not_Visited_Outlets__c: beatDay.NotVisitedOutlets__c,
            Time_Spent_On_Field_c: beatDay.TimeSpentOnField__c,
            Total_Time_in_Outlet__c: beatDay.Total_Time_in_Outlet__c,
            Avg_Time_Spent_in_OL_for_Calls__c: beatDay.AvgTimeSpentinOlforCalls__c,
            End_Of_Day_Time__c: beatDay.EndOfDayTime__c,
            PJP_Outlet_Visited__c: beatDay.PjpOutletVisited__c,
            Non_PJP_Outlet_Visited__c: beatDay.NonPjpOutletVisited__c,
            Non_PJP_Productive_Call__c: beatDay.NonPjpProductiveCall__c,
            Total_Distance_Travelled_KM__c: beatDay.TotalDistanceTravelledKm__c,
            Non_PJP_TC__c: beatDay.NonPjpTc__c,
            Productive_Calls__c: beatDay.ProductiveCalls__c,
            Non_Productive_Calls__c: beatDay.NonProductiveCalls__c,
            Productive_Calls_Duration__c: beatDay.TotalProductiveCallsDuration__c,
            Avg_Time_PC__c: beatDay.AvgTimeSpentinOlforPc__c,
            TC_Till_12PM__c: beatDay.TcTill12Noon__c,
            TC_Till_3PM__c: beatDay.TcTill3PM__c,
            TC_Till_6PM__c: beatDay.TcTill6PM__c,
            TC_After_6PM__c: beatDay.TcAfter6PM__c,
            No_of_SCA_Done_through_Other_Beat__c: beatDay.NoofScaDonethroughOtherBeat__c,
            No_of_SCA_Done_in_Schedule_Beat__c: beatDay.NoofScaDoneinScheduleBeat__c,
            BeatDate__c: beatDay.BeatDate__c,
            EOD_Comment__c: beatDay.EodComment__c,
            Tour_Plan__c: tourPlanId,
            Sec_Order_Value__c: beatDay.SecOrderValue__c,
            Sec_Order_Qty_Pcs__c: beatDay.SecOrderQuantityPcs__c,
            PJP_Beat_Outlets: beatDay.PjpBeatOutlets__c,
            Secondary_Order_Qty_in_KG: beatDay.SecondaryOrderQuantityInKG__c,
            Secondary_Order_Qty_in_Value: beatDay.SecondaryOrderQuantityInValue__c,
            Planned_Outlets_Coverage__c: beatDay.Planned_Outlets_Coverage__c,
            is_locally_changed: false,
            is_synced: true,
            last_modified: Date.now(),
            operation_type: 'insert'
          }));
        });




        await UniversalUpdateInsert({
          ObjectName: 'BeatDay__c',
          Type: 'insert',
          data: allBeatDays
        });




        const allVisits = apiData?.flatMap(routePlan => {
          return (routePlan.Beat_Day__r?.records || []).flatMap(beatDay => {
            const beatDayId = beatDay.Id;

            return (beatDay.Visits__r?.records || []).map(visit => ({
              Sf_Id: visit.Id,
              Name: visit.Name,
              Beat__c: visit.Beat__c,
              BeatDay__c: beatDayId,
              VisitDate__c: visit.VisitDate__c,
              AccountId__c: visit.AccountId__c,
              PJPOutlet__c: String(visit.PJPOutlet__c),
              NonPjpOutlet__c: String(visit.NonPjpOutlet__c),
              FirstCallVisit__c: String(visit.FirstCallVisit__c),
              LastCallVisit__c: String(visit.LastCallVisit__c),
              ChangedBeatOutlet__c: String(visit.ChangedBeatOutlet__c),
              VisitStatus__c: visit.VisitStatus__c,
              VisitNotes__c: visit.VisitNotes__c,
              CheckInTime__c: visit.CheckInTime__c,
              CheckOutTime__c: visit.CheckOutTime__c,
              ProductiveCall__c: String(visit.ProductiveCall__c),
              TimeSpentOnOutlet__c: visit.TimeSpentOnOutlet__c,
              CheckInComment__c: visit.CheckInComment__c,
              CheckInLocation__c: visit.CheckInLocation__c,
              CheckInLocation__Longitude__s: visit.CheckInLocation__Longitude__s,
              CheckInLocation__Latitude__s: visit.CheckInLocation__Latitude__s,
              CheckOutLocation__Longitude__s: visit.CheckOutLocation__Longitude__s,
              CheckOutLocation__Latitude__s: visit.CheckOutLocation__Latitude__s,
              CheckOutLocation__c: visit.CheckOutLocation__c,
              DistanceTravelledKm__c: visit.DistanceTravelledKm__c,
              Before12Noon__c: String(visit.Before12Noon__c),
              Before3PM__c: String(visit.Before3PM__c),
              Before6PM__c: String(visit.Before6PM__c),
              After6PM__c: String(visit.After6PM__c),
              VisitType__c: visit.VisitType__c,
              AdHocVisit__c: String(visit.AdHocVisit__c),
              CheckInPhotoCaptured__c: String(visit.CheckInPhotoCaptured__c),
              IsOrderPlaced__c: String(visit.IsOrderPlaced__c),
              OriginalMTPType__c: visit.OriginalMTPType__c,
              OriginalDBName__c: visit.OriginalDBName__c,
              OriginalRepName__c: visit.OriginalRepName__c,
              RevisedMTPType__c: visit.RevisedMTPType__c,
              RevisedDBName__c: visit.RevisedDBName__c,
              RevisedRepName__c: visit.RevisedRepName__c,
              MTPEditDate__c: visit.MTPEditDate__c,
              MTPEditTime__c: visit.MTPEditTime__c,
              ApprovedBy__c: visit.ApprovedBy__c,
              ApprovalDate__c: visit.ApprovalDate__c,
              Status__c: visit.Status__c,
              SRTransactionTime__c: visit.SRTransactionTime__c,
              SRTransactionLocation__c: visit.SRTransactionLocation__c,
              LocationVarianceOLtoSCA__c: visit.LocationVarianceOLtoSCA__c,
              LocationVarianceOrdertoSCA__c: visit.LocationVarianceOrdertoSCA__c,
              AdHocReason__c: visit.AdHocReason__c,
              NonProductiveCallReason__c: visit.NonProductiveCallReason__c,
              DB_SUB_DB_Super_Name__c: visit.DB_SUB_DB_Super_Name__c,
              WorkingWith__c: visit.WorkingWith__c,
              Add_New_Retailer_Visit__c: String(visit.Add_New_Retailer_Visit__c),
              Postman_Call__c: String(visit.Postman_Call__c),
              Appropriate_Call__c: String(visit.Appropriate_Call__c),
              Inappropriate_Call__c: String(visit.Inappropriate_Call__c),
              MTP_Admin_Approval_Status__c: visit.MTP_Admin_Approval_Status__c,
              MTP_Approval_Comment__c: visit.MTP_Approval_Comment__c,
              MTP_ApprovalSubmitedDate__c: visit.MTP_ApprovalSubmitedDate__c,
              MTP_Approved_Date__c: visit.MTP_Approved_Date__c,
              Device_Id__c: visit.Device_Id__c ?? '',
              is_locally_changed: false,
              is_synced: false,
              last_modified: Date.now(),
              operation_type: 'insert'
            }));
          });
        });

        // Push into local DB
        await UniversalUpdateInsert({
          ObjectName: 'Visit',
          Type: 'insert',
          data: allVisits
        });

        console.log('Visit records synced successfully!====================');


        console.log('BeatDay__c synced successfully!');

        console.log('INSERTED ')



        const query = `SELECT Id,PTR__c,PTD__c,Product2Id,Product2.Name,Product2.UnitperCase__c,
Product2.Brand__c,Product2.Category__c,Product2.SubCategory__c,Product2.WeightKG__c,Product2.ProductImageURL__c, Product2.Active_in_SFA__c FROM PricebookEntry  WHERE Pricebook2Id ='01sC1000000VL09IAG'`
        const Product2Data = await fetchRecords('Beat__c', query, creds.accessToken, creds.instanceUrl)

        console.log("THIS I SPRODUCT @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ DATA", JSON.stringify(Product2Data))


        const transformedProduct2Data = Product2Data.map(item => {
          const p = item.Product2;
          console.log(item.PTR__c)
          return {
            Sf_Id: item.Product2Id,
            PTR__c: item.PTR__c,
            PTD__c: item.PTD__c,
            UnitperCase__c: p.UnitperCase__c,
            PriceBookId: item.Id,
            Name: p.Name,
            Brand__c: p.Brand__c,
            Category__c: p.Category__c,
            SubCategory__c: p.SubCategory__c,
            WeightKG__c: p.WeightKG__c,
            ProductImageURL__c: convertSharePointUrl(p.ProductImageURL__c),
            Active_in_SFA__c: p.Active_in_SFA__c,
            // Default flags for new records
            operation_type: 'insert',
            is_synced: true,
            is_locally_changed: false,
            last_modified: Date.now(), // Optional if tracking sync
          };
        });



        await UniversalUpdateInsert({
          ObjectName: 'Product2',
          Type: 'insert',
          data: transformedProduct2Data,
        });
        console.log('inserted into the database================ PRoduct 2')


        //
        const query_order = `SELECT Id, OrderNumber, TotalAmount,CreatedDate FROM Order`
        const data_order = await fetchRecords('Order', query_order, creds.accessToken, creds.instanceUrl)
        //console.log('Order Data ======= ', data_order)
        const cleanedOrderPayload = data_order?.map(item => ({
          Sf_Id: item.Id ?? '',
          zRecordType: item.zRecordType ?? '',
          AccountId__c: item.AccountId__c ?? '',
          OrderPlacedBy__c: item.OrderPlacedBy__c ?? '',
          Source__c: item.Source__c ?? '',
          OrderSubmissionTime__c: item.OrderSubmissionTime__c ?? '',
          OrderStatus__c: item.OrderStatus__c ?? '',
          TotalAmount: item.TotalAmount ?? 0,
          TotalOrderQtyKg__c: item.TotalOrderQtyKg__c ?? 0,
          TotalOrderQtyInPcs__c: item.TotalOrderQtyInPcs__c ?? 0,
          FulfilledQtyKg__c: item.FulfilledQtyKg__c ?? 0,
          TotalFulfilledValue__c: item.TotalFulfilledValue__c ?? 0,
          RejectedQtyKg__c: item.RejectedQtyKg__c ?? 0,
          RejectedValue__c: item.RejectedValue__c ?? 0,
          Visit__c: item.Visit__c ?? '',
          OrderNumber: item.OrderNumber ?? '',
          CreatedDate: item.CreatedDate ?? '',

          // Optional fields (sync-related)
          is_locally_changed: false,
          is_synced: false,
          last_modified: Date.now(),
          operation_type: 'insert'
        }));
        await UniversalUpdateInsert({
          ObjectName: 'Order',
          Type: 'insert',
          data: cleanedOrderPayload
        });





        //Invice data
        // const invoice_data = `SELECT Id,  FROM Invoice__c`
        const invoice_query = `SELECT Id, Name,InvoiceNo__c,InvoiceDate__c,Order__c,Customer__c,Status__c,Total_Net_Amount__c FROM Invoice__c`;
        const data_invoice = await fetchRecords('Invoice__c', invoice_query, creds.accessToken, creds.instanceUrl)
        console.log('invoice data---', data_invoice)

        const cleanedInvoicePayload = data_invoice?.map(item => ({
          Sf_Id: item.Id ?? '',
          Name: item.Name ?? '',
          InvoiceNo__c: item.InvoiceNo__c ?? '',
          InvoiceDate__c: item.InvoiceDate__c ?? '',
          Order__c: item.Order__c ?? '',
          Customer__c: item.Customer__c ?? '',
          Status__c: item.Status__c ?? '',
          AdditionalDiscount__c: item.AdditionalDiscount__c ?? 0,
          TotalGSTAmt__c: item.TotalGSTAmt__c ?? 0,
          GSTRATE__c: item.GSTRATE__c ?? 0,
          Total_Net_Amount__c: item.Total_Net_Amount__c ?? 0,
          // Optional sync-related fields
          is_locally_changed: false,
          is_synced: false,
          last_modified: Date.now(),
          operation_type: 'insert'
        }));

        await UniversalUpdateInsert({
          ObjectName: 'Invoice__c',
          Type: 'insert',
          data: cleanedInvoicePayload
        });



        const fieldNamesOrderItem = `
SELECT ID,OrderNumber,OrderPlacedBy__c,Source__c,AccountId,EffectiveDate, OrderSubmissionTime__c,Status,OrderRejectionReason__c,TotalAmount,
(SELECT Id,Product2id,Quantity,AdditionalDiscount__c,NetAmount__c FROM OrderItems) FROM Order`;
        const resItem = await fetchRecords(
          "OrderItem",
          fieldNamesOrderItem,
          creds.accessToken,
          creds.instanceUrl
        );
        console.log("---------------------------------order", JSON.stringify(resItem));


        // const OrderItemCleanedData = resItem.map((item) => ({
        //   Sf_Id: item.Id,
        //   OrderId: item.OrderId || "",
        //   Product2Id: item.Product2Id || "",
        //   QuantityPcs__c: item.QuantityPcs__c || 0,
        //   Quantity: item.Quantity || 0,
        //   Fulfilled_Qty_KG__c: item.Fulfilled_Qty_KG__c || 0,
        //   Fulfilled_Value__c: item.Fulfilled_Value__c || 0,
        //   Rejected_Qty_KG__c: item.Rejected_Qty_KG__c || 0,
        //   Rejected_Value__c: item.Rejected_Value__c || 0,
        //   OrderQtyinCase__c: item.OrderQtyinCase__c || 0,
        //   UnitPrice__c: item.UnitPrice__c || 0,
        //   GrossAmount__c: item.GrossAmount__c || 0,
        //   GrossAmountExcelMargin__c: item.GrossAmountExcelMargin__c || 0,
        //   SchemeDiscount__c: item.SchemeDiscount__c || 0,
        //   NetAmount__c: item.NetAmount__c || 0,
        //   SchemeCode__c: item.SchemeCode__c || "",
        //   SKUCode__c: item.SKUCode__c || "",
        //   UOM__c: item.UOM__c || "",
        //   TaxableAmount__c: item.TaxableAmount__c || 0,
        //   Sceheme__c: item.Sceheme__c || "",
        //   is_locally_changed: false,
        //   operation_type: "insert",
        //   last_modified: Date.now(),
        //   is_synced: true,
        // }));


        const orders = resItem; // JSON from your API
        const orderItemsFlattened = orders.flatMap(order => {
          return (order.OrderItems?.records || []).map(item => ({
            Sf_Id: item.Id,
            OrderId: order.Id,
            Product2Id: item.Product2Id || "",
            Quantity: item.Quantity || 0,
            AdditionalDiscount__c: item.AdditionalDiscount__c || 0,
            NetAmount__c: item.NetAmount__c || 0,
            // Include defaults for any other fields you track...
            last_modified: Date.now(),
            is_synced: true,
          }));
        });

        console.log("---------------------------------orderItemsFlattened.....", JSON.stringify(orderItemsFlattened));

        await UniversalUpdateInsert({
          ObjectName: "OrderItem",
          Type: "insert",
          data: orderItemsFlattened,
        });





        //Survey data
        const Survey_query = `SELECT Id, Name FROM Survey`;
        const data_Survey = await fetchRecords('Survey', Survey_query, creds.accessToken, creds.instanceUrl)
        console.log('invoice data---', data_Survey)
        const cleanedSurveyePayload = data_Survey?.map(item => ({
          Sf_Id: item.Id ?? '',
          Name: item.Name ?? '',
          // Optional sync-related fields
          is_locally_changed: false,
          is_synced: false,
          last_modified: Date.now(),
          operation_type: 'insert'
        }));

        await UniversalUpdateInsert({
          ObjectName: 'Survey',
          Type: 'insert',
          data: cleanedSurveyePayload
        });







        //
        dispatch(
          loginSuccess({
            userId: creds.userId,
            accessToken: creds.accessToken,
            communityId: creds.communityId || null,
            communityUrl: creds.communityUrl || null,
            instanceUrl: creds.instanceUrl,
            refreshToken: creds.refreshToken || null,
            orgId: creds.orgId,
            sessionTime: Date.now(),
          })
        );

        setSpinnerVisible(false);

        await AsyncStorage.setItem('initialDataSynced', 'true');
        dispatch(setDataReady(true));

        //navigation.navigate('TabbedScreen');
        //onDeviceValidated();

      } catch (error) {
        console.error(' Failed to sync online data:', error);
      }
    } else {
      console.warn('🛑 No Internet. Attempting offline login...');
      const userFromDb = await UniversalUpdateInsert({ ObjectName: 'User', Type: 'get' });

      // console.log()
      if (!userFromDb || userFromDb.length === 0) {
        console.error(' No local user data found. Cannot proceed offline.');
        return;
      }
      console.log('Loaded user from offline DB:', userFromDb);
      setSpinnerVisible(false);
      // Dispatch login success for both online/offline
      //navigation.navigate('TabbedScreen')
      //onDeviceValidated();
      navigation.navigate('TabbedScreen')

    }


  }



  return (
    <View style={styles.loaderContainer}>
      <Spinner isVisible={spinnerVisible} size={40} type="Wave" color="#C9A24D" />
      {spinnerVisible ? <Text>Syncing Data...</Text> : ''}
    </View>
  );
};

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default AuthStartupScreen;
