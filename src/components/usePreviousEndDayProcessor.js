import moment from 'moment';
import UniversalUpdateInsert from '../database/dbService/UniversalUpdateInsert';
import { isInternetAvailable } from '../utils/networkUtils';
import { useApiFetch } from '../utils/apiFetchHooks/useApiFetch';

const toNumber = value => Number(value) || 0;

const cleanDateString = value => {
  if (!value) return null;
  return String(value).trim().replace(/^"+|"+$/g, '');
};

const getEndDayTime = latestVisit => {
  const checkOutTime = cleanDateString(latestVisit?.CheckOutTime__c);
  const checkInTime = cleanDateString(latestVisit?.CheckInTime__c);

  if (checkOutTime && moment(checkOutTime).isValid()) return moment(checkOutTime);
  if (checkInTime && moment(checkInTime).isValid()) return moment(checkInTime);

  return moment();
};

const getDateTimeForBeatDay = endMoment => endMoment.format('YYYY-MM-DD HH:mm:ss');
const getFallbackEndMomentForDate = date => moment(`${date} 23:59:59`, 'YYYY-MM-DD HH:mm:ss');

const calculateDistanceInMeters = (lat1, lon1, lat2, lon2) => {
  const toRadians = degrees => degrees * (Math.PI / 180);
  const R = 6371000;
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaPhi = toRadians(lat2 - lat1);
  const deltaLambda = toRadians(lon2 - lon1);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

export const usePreviousEndDayProcessor = () => {
  const { apiComposite } = useApiFetch();

  const processPreviousEndDay = async ({
    date,
    beatDayId,
    comment = 'Auto end day from Start Day',
  }) => {
    try {
      if (!date || !beatDayId) {
        return { success: false, message: 'date and beatDayId are required' };
      }

      const connected = await isInternetAvailable();
      if (!connected) {
        return { success: false, message: 'Internet connection is required' };
      }

      const userFromDb = await UniversalUpdateInsert({
        ObjectName: 'User',
        Type: 'get',
      });

      const userId = userFromDb?.[0]?.Sf_Id;
      if (!userId) {
        return { success: false, message: 'User not found in local DB' };
      }

      const beatDayRecords = await UniversalUpdateInsert({
        ObjectName: 'BeatDay__c',
        Type: 'get',
        filters: [{ field: 'Sf_Id', value: beatDayId }],
      });

      const beatDayRecord = beatDayRecords?.[0];
      if (!beatDayRecord) {
        return { success: false, message: `BeatDay not found for ${beatDayId}` };
      }

      const attendanceRecords = await UniversalUpdateInsert({
        ObjectName: 'Attendant__c',
        Type: 'get',
        filters: [
          { field: 'AttendanceDate__c', value: date },
          { field: 'User__c', value: userId },
        ],
      });

      const lastAttendance =
        attendanceRecords?.length > 0 ? attendanceRecords[attendanceRecords.length - 1] : null;

      const visits = await UniversalUpdateInsert({
        ObjectName: 'Visit',
        Type: 'get',
        filters: [
          { field: 'SoftDelete', value: false },
          { field: 'BeatDay__c', value: beatDayId },
        ],
      });

      if (!visits?.length) {
        return { success: false, message: `No visits found for BeatDay ${beatDayId}` };
      }

      const accountData = await UniversalUpdateInsert({
        ObjectName: 'Account',
        Type: 'get',
      });

      const orders = await UniversalUpdateInsert({
        ObjectName: 'Order',
        Type: 'get',
        filters: [{ field: 'SoftDelete', value: false }],
      });

      const orderItems = await UniversalUpdateInsert({
        ObjectName: 'OrderItem',
        Type: 'get',
        filters: [{ field: 'SoftDelete', value: false }],
      });

      const products = await UniversalUpdateInsert({
        ObjectName: 'Product2',
        Type: 'get',
        filters: [{ field: 'SoftDelete', value: false }],
      });

      const collections = await UniversalUpdateInsert({
        ObjectName: 'Collection__c',
        Type: 'get',
        filters: [{ field: 'DateOfPayment__c', value: date }],
      });

      let grandTotalOrderQty = 0;
      let grandTotalReturnQty = 0;

      const visitsWithOrders = visits
        .filter(v => v && ((v.CheckInTime__c && v.CheckOutTime__c) || v.VisitStatus__c === 'In Progress'))
        .map(visit => {
          const account = accountData.find(acc => acc.Sf_Id === visit.AccountId__c);
          const ordersForVisit = orders
            .filter(order => order.Visit__c === visit.Sf_Id)
            .map(order => ({
              ...order,
              items: orderItems
                .filter(item => item.OrderId === order.Sf_Id)
                .map(item => {
                  const product = products.find(p => p.Sf_Id === item.Product2Id);
                  return {
                    ...item,
                    productName: product ? product.Name : item.Product2Id,
                  };
                }),
            }));

          grandTotalOrderQty += ordersForVisit.reduce((sum, order) => sum + toNumber(order.TotalOrderQtyInPcs__c), 0);
          grandTotalReturnQty += ordersForVisit.reduce((sum, order) => sum + toNumber(order.TotalReturnQuantity__c), 0);

          return {
            ...visit,
            title: account?.Name || 'Unknown Account',
            code: account?.PartyCode__c,
            orders: ordersForVisit,
          };
        });

      const totalpscCount = grandTotalOrderQty + grandTotalReturnQty;

      const completedVisits = visits.filter(v => v && v.CheckInTime__c && v.CheckOutTime__c);
      const latestVisit = completedVisits.reduce((latest, current) => {
        const currentTime = current?.CheckOutTime__c ? new Date(cleanDateString(current.CheckOutTime__c)).getTime() : 0;
        const latestTime = latest?.CheckOutTime__c ? new Date(cleanDateString(latest.CheckOutTime__c)).getTime() : 0;
        return currentTime > latestTime ? current : latest;
      }, null);

      const ordersPlacedCountTotal = visitsWithOrders.reduce(
        (sum, visit) => sum + (visit.orders ? visit.orders.length : 0),
        0
      );

      const safeField = (obj, ...candidates) => {
        for (const candidate of candidates) {
          if (obj && typeof obj[candidate] !== 'undefined' && obj[candidate] !== null) return obj[candidate];
        }
        return null;
      };

      const categorizedData = {
        Upcoming: [],
        'In Progress': [],
        Completed: [],
      };

      visits.forEach(visit => {
        // const accountDetails = accountData.find(acc => acc.Sf_Id === visit.AccountId) || {};
          const accountDetails =
            (accountData || []).find(acc => acc.Sf_Id === visit.AccountId__c);

          if (
            !accountDetails ||
            (
              accountDetails.Active__c === false &&
              !visit?.Add_New_Retailer_Visit__c
            )
          ) {
            return;
          }

        const base = {
          AccountId: visit?.AccountId__c || visit?.AccountId || null,
          sfId: visit?.Sf_Id || null,
          CheckInTime__c: visit?.CheckInTime__c || null,
          CheckOutTime__c: visit?.CheckOutTime__c || null,
          VisitStatus__c: visit?.VisitStatus__c || null,
          CheckInLocation__Longitude: safeField(visit, 'CheckInLocation__Longitude__s', 'CheckInLocation__Longitude') || null,
          CheckInLocation__Latitude: safeField(visit, 'CheckInLocation__Latitude__s', 'CheckInLocation__Latitude') || null,
          CheckOutLocation__Longitude: safeField(visit, 'CheckOutLocation__Longitude__s', 'CheckOutLocation__Longitude') || null,
          CheckOutLocation__Latitude: safeField(visit, 'CheckOutLocation__Latitude__s', 'CheckOutLocation__Latitude') || null,
          BillingLatitude: accountDetails?.BillingLatitude ?? null,
          BillingLongitude: accountDetails?.BillingLongitude ?? null,
          BeatDay__c: visit?.BeatDay__c || null,
          PJPOutlet__c: visit?.PJPOutlet__c,
          ProductiveCall__c: visit?.ProductiveCall__c,
          NonPjpOutlet__c: visit?.NonPjpOutlet__c,
          DistanceTravelledKm__c: visit?.DistanceTravelledKm__c,
          Before12Noon__c: visit?.Before12Noon__c,
          Before3PM__c: visit?.Before3PM__c,
          Before6PM__c: visit?.Before6PM__c,
          After6PM__c: visit?.After6PM__c,
          Postman_Call__c: visit?.Postman_Call__c,
          Inappropriate_Call__c: visit?.Inappropriate_Call__c,
          Appropriate_Call__c: visit?.Appropriate_Call__c,
        };

        let bucket = 'Upcoming';
        if (visit?.CheckInTime__c && visit?.CheckOutTime__c) {
          bucket = 'Completed';
        } else if ((visit?.CheckInTime__c && !visit?.CheckOutTime__c) || visit?.VisitStatus__c === 'In Progress') {
          bucket = 'In Progress';
        }

        categorizedData[bucket].push(base);
      });

      const countPJPOutletTrue = data =>
        data.Completed.filter(item => item.PJPOutlet__c === true).length +
        data['In Progress'].filter(item => item.PJPOutlet__c === true).length;

      const calculateOrderPercentage = (orderCount, data) => {
        const totalVisits = data.Upcoming.length + data['In Progress'].length + data.Completed.length;
        if (totalVisits === 0) return 0;
        return ((orderCount / totalVisits) * 100).toFixed(2);
      };

      const calculateTimeSpentOnField = (startValue, endMoment) => {
        if (!startValue) return '0.00 min';
        const startMoment = moment(cleanDateString(startValue));
        if (!startMoment.isValid()) return '0.00 min';
        return `${endMoment.diff(startMoment, 'minutes', true).toFixed(2)} min`;
      };

      const calculateTimeSpentonField = data => {
        let totalMinutes = 0;

        data.Completed.forEach(record => {
          const checkIn = cleanDateString(record.CheckInTime__c);
          const checkOut = cleanDateString(record.CheckOutTime__c);
          if (checkIn && checkOut) totalMinutes += moment(checkOut).diff(moment(checkIn), 'minutes', true);
        });

        data['In Progress'].forEach(record => {
          const checkIn = cleanDateString(record.CheckInTime__c);
          const checkOut = cleanDateString(record.CheckOutTime__c);
          if (checkIn && checkOut) {
            totalMinutes += moment(checkOut).diff(moment(checkIn), 'minutes', true);
          }
        });

        return totalMinutes.toFixed(2);
      };

      const calculateAverageTimeSpent = (data, totalVisitCount) => {
        const totalMinutes = Number(calculateTimeSpentonField(data)) || 0;
        return `${(totalVisitCount > 0 ? totalMinutes / totalVisitCount : 0).toFixed(2)} min`;
      };

      const calculateAverageProductiveCallTime = data => {
        let totalMinutes = 0;
        let productiveCallCount = 0;

        [...data.Completed, ...data['In Progress']].forEach(record => {
          if (record.ProductiveCall__c !== true) return;

          const checkIn = cleanDateString(record.CheckInTime__c);
          const checkOut = cleanDateString(record.CheckOutTime__c);

          if (checkIn && checkOut) {
            totalMinutes += moment(checkOut).diff(moment(checkIn), 'minutes', true);
            productiveCallCount += 1;
          }
        });

        return `${(productiveCallCount > 0 ? totalMinutes / productiveCallCount : 0).toFixed(2)} min`;
      };

      const countNonPjpOutletRecords = data =>
        [...data.Upcoming, ...data.Completed, ...data['In Progress']].filter(record => record.NonPjpOutlet__c === true).length;

      const countNonPjpOutletRecordscheckin = data =>
        [...data.Completed, ...data['In Progress']].filter(record => record.NonPjpOutlet__c === true).length;

      const countNonPjpAndProductiveCalls = data =>
        [...data.Completed, ...data['In Progress']].filter(
          record => record.NonPjpOutlet__c === true && record.ProductiveCall__c === true
        ).length;

      const getTotalDistanceTravelled = data =>
        Number(
          [...data.Upcoming, ...data['In Progress'], ...data.Completed]
            .reduce((sum, record) => sum + toNumber(record.DistanceTravelledKm__c), 0)
            .toFixed(2)
        );

      const countByFieldValue = (data, fieldName, expected = true) =>
        [...data.Upcoming, ...data['In Progress'], ...data.Completed].filter(record => record[fieldName] === expected).length;

      const getPlannedOutletsCoverage = completedLength => {
        const plannedOutlets = beatDayRecord?.PlannedOutlets__c ?? 0;
        if (plannedOutlets === 0) return 0;
        return (completedLength / plannedOutlets) * 100;
      };

      const getSecondaryOrderQuantityInValue = () => {
        let total = 0;
        visitsWithOrders.forEach(visit => {
          visit.orders?.forEach(order => {
            order.items?.forEach(item => {
              total += toNumber(item.GrossAmount__c);
            });
          });
        });
        return total;
      };

      const getSecondaryOrderQuantityInKG = () => {
        let total = 0;
        visitsWithOrders.forEach(visit => {
          visit.orders?.forEach(order => {
            order.items?.forEach(item => {
              total += toNumber(item.Order_Quantity_In_Kg__c);
            });
          });
        });
        return total;
      };

      const getISCFromCompletedVisits = completed => {
        if (!completed.length) return 0;

        let visitsWithin100 = 0;
        let validCompletedCount = 0;

        completed.forEach(visit => {
          if (
            visit.BillingLatitude &&
            visit.BillingLongitude &&
            visit.CheckInLocation__Latitude &&
            visit.CheckInLocation__Longitude
          ) {
            validCompletedCount += 1;

            const distance = calculateDistanceInMeters(
              visit.BillingLatitude,
              visit.BillingLongitude,
              visit.CheckInLocation__Latitude,
              visit.CheckInLocation__Longitude
            );

            if (distance <= 100) visitsWithin100 += 1;
          }
        });

        if (validCompletedCount === 0) return 0;
        return Math.round((visitsWithin100 / validCompletedCount) * 100);
      };

      const endMoment = latestVisit?.Sf_Id ? getEndDayTime(latestVisit) : getFallbackEndMomentForDate(date);
      const timeSpentOnField = calculateTimeSpentOnField(lastAttendance?.StartTime__c, endMoment);

      const beatDayPayload = {
        PjpOutletVisited__c: countPJPOutletTrue(categorizedData),
        Productivity__c: calculateOrderPercentage(ordersPlacedCountTotal, categorizedData),
        // Last_Call_Time__c: getDateTimeForBeatDay(endMoment),
        Last_Call_Time__c: latestVisit?.Sf_Id? getDateTimeForBeatDay(endMoment) : null,
        NotVisitedOutlets__c: categorizedData.Upcoming.length,
        TimeSpentOnField__c: timeSpentOnField,
        Total_Time_in_Outlet__c: calculateTimeSpentonField(categorizedData),
        AvgTimeSpentinOlforCalls__c: calculateAverageTimeSpent(
          categorizedData,
          categorizedData.Completed.length + categorizedData['In Progress'].length + categorizedData.Upcoming.length
        ),
        AvgTimeSpentinOlforPc__c: calculateAverageProductiveCallTime(categorizedData),
        EndOfDayTime__c: getDateTimeForBeatDay(endMoment),
        EodComment__c: comment,
        NonPjpOutletVisited__c: countNonPjpOutletRecordscheckin(categorizedData),
        NonPjpTc__c: countNonPjpOutletRecords(categorizedData),
        TotalDistanceTravelledKm__c: getTotalDistanceTravelled(categorizedData),
        NonProductiveCalls__c: countByFieldValue(categorizedData, 'ProductiveCall__c', false),
        TcTill12Noon__c: countByFieldValue(categorizedData, 'Before12Noon__c', true),
        TcTill3PM__c: countByFieldValue(categorizedData, 'Before3PM__c', true),
        TcTill6PM__c: countByFieldValue(categorizedData, 'Before6PM__c', true),
        TcAfter6PM__c: countByFieldValue(categorizedData, 'After6PM__c', true),
        SecOrderQuantityPcs__c: totalpscCount,
        Planned_Outlets_Coverage__c: getPlannedOutletsCoverage(categorizedData.Completed.length),
        SecondaryOrderQuantityInValue__c: getSecondaryOrderQuantityInValue(),
        SecondaryOrderQuantityInKG__c: getSecondaryOrderQuantityInKG(),
        Postman_Call_Less_than_1_min__c: countByFieldValue(categorizedData, 'Postman_Call__c', true),
        Inappropriate_Call_Less_than_3_min__c: countByFieldValue(categorizedData, 'Inappropriate_Call__c', true),
        Appropriate_Call_Greater_than_3_min__c: countByFieldValue(categorizedData, 'Appropriate_Call__c', true),
        Attendance__c: lastAttendance?.Sf_Id || null,
        ISC__c: getISCFromCompletedVisits(categorizedData.Completed),
      };

      const compositeRequest = [
        {
          method: 'PATCH',
          url: `/services/data/v61.0/sobjects/BeatDay__c/${beatDayId}`,
          referenceId: 'updateBeatDay',
          body: beatDayPayload,
        },
      ];

      if (latestVisit?.Sf_Id) {
        compositeRequest.unshift({
          method: 'PATCH',
          url: `/services/data/v61.0/sobjects/Visit/${latestVisit.Sf_Id}`,
          referenceId: 'updateVisit',
          body: {
            LastCallVisit__c: true,
          },
        });
      }

      if (lastAttendance?.Sf_Id) {
        compositeRequest.push({
          method: 'PATCH',
          url: `/services/data/v61.0/sobjects/Attendance__c/${lastAttendance.Sf_Id}`,
          referenceId: 'updateAttendance',
          body: {
            AttendanceEndTime__c: endMoment.toISOString(),
          },
        });
      }

      const compositePayload = {
        compositeRequest,
        allOrNone: true,
      };
// console.log('compositePayload:', JSON.stringify(compositePayload, null, 2));
      const response = await apiComposite('POST', 'composite', compositePayload);
      const compositeResponse = response?.data?.compositeResponse || [];

      const visitSuccess = latestVisit?.Sf_Id
        ? compositeResponse.find(
            item => item.referenceId === 'updateVisit' && item.httpStatusCode >= 200 && item.httpStatusCode < 300
          )
        : true;
      const beatDaySuccess = compositeResponse.find(
        item => item.referenceId === 'updateBeatDay' && item.httpStatusCode >= 200 && item.httpStatusCode < 300
      );
      const attendanceSuccess = lastAttendance?.Sf_Id
        ? compositeResponse.find(
            item => item.referenceId === 'updateAttendance' && item.httpStatusCode >= 200 && item.httpStatusCode < 300
          )
        : true;

      if (latestVisit?.Sf_Id) {
        await UniversalUpdateInsert({
          ObjectName: 'Visit',
          Type: 'insert',
          data: {
            Sf_Id: latestVisit.Sf_Id,
            LastCallVisit__c: true,
            is_locally_changed: !visitSuccess,
            is_synced: !!visitSuccess,
          }, 
        });
      }

      await UniversalUpdateInsert({
        ObjectName: 'BeatDay__c',
        Type: 'insert',
        data: {
          Sf_Id: beatDayId,
          ...beatDayPayload,
          is_locally_changed: !beatDaySuccess,
          is_synced: !!beatDaySuccess,
        },
      });

      if (lastAttendance?.Sf_Id) {
        await UniversalUpdateInsert({
          ObjectName: 'Attendant__c',
          Type: 'insert',
          data: {
            Sf_Id: lastAttendance.Sf_Id,
            EndTime__c: endMoment.toISOString(),
            is_locally_changed: !attendanceSuccess,
            is_synced: !!attendanceSuccess,
          },
        });
      }

      return {
        success: !!(visitSuccess && beatDaySuccess && attendanceSuccess),
        response,
        payload: compositePayload,
        summary: {
          date,
          beatDayId,
          latestVisitId: latestVisit?.Sf_Id || null,
          attendanceId: lastAttendance?.Sf_Id || null,
        },
      };
    } catch (error) {
      console.log('processPreviousEndDay error:', error);
      return { success: false, message: error.message || 'Previous end day processing failed' };
    }
  };

  return { processPreviousEndDay };
};
