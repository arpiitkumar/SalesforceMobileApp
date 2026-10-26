// UtilityMain/producthelpers/categoryDataService.js
import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import moment from 'moment';

export async function getValueInRupees(categoryName) {
  try {
    const dateNow = moment().format("YYYY-MM-DD");

    // 1️⃣ Fetch user
    const userFromDb = await UniversalUpdateInsert({
      ObjectName: "User",
      Type: "get",
    });

    // 2️⃣ Fetch route plans
    const RoutePlans = await UniversalUpdateInsert({
      ObjectName: "Route_Plans__c",
      Type: "get",
      filters: [
        { field: 'Assigned_To__c', value: userFromDb[0]?.Sf_Id },
      ],
    });

    // 3️⃣ Current month route plans
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const currentMonthRoutePlans = RoutePlans.filter(plan => {
      const startDate = new Date(plan.Start_Date__c);
      const endDate = new Date(plan.End_Date__c);
      return startDate <= lastDayOfMonth && endDate >= firstDayOfMonth;
    });

    const activePlanId = currentMonthRoutePlans[0]?.Sf_Id;

    // 4️⃣ Fetch BeatDays
    const BeatDays = await UniversalUpdateInsert({
      ObjectName: "BeatDay__c",
      Type: "get",
    });

    const beatDayForDate = BeatDays.find(b =>
      b.Tour_Plan__c === activePlanId && b.BeatDate__c === dateNow
    );

    if (!beatDayForDate) {
      console.log('No Beat Day found for date', dateNow);
      return 0;
    }

    // 5️⃣ Fetch Visits
    const Visits = await UniversalUpdateInsert({
      ObjectName: "Visit",
      Type: "get",
      filters: [
        { field: "SoftDelete", value: false },
        { field: "BeatDay__c", value: beatDayForDate?.Sf_Id },
      ],
    });

    // 6️⃣ Fetch Orders, OrderItems, Products
    const Orders = await UniversalUpdateInsert({
      ObjectName: "Order",
      Type: "get",
      // filters: [{ field: "SoftDelete", value: false }],
      filters: [{ field: "SoftDelete", value: false },{ field: "Type", value: 'Secondary Order' }],
    });

    const OrderItems = await UniversalUpdateInsert({
      ObjectName: "OrderItem",
      Type: "get",
      filters: [{ field: "SoftDelete", value: false }],
    });

    const Products = await UniversalUpdateInsert({
      ObjectName: "Product2",
      Type: "get",
      filters: [{ field: "SoftDelete", value: false }],
    });

    // 7️⃣ Calculate total value in rupees
    const totalValueInRupees = Visits
      .filter(v =>
        v &&
        (
          (v.CheckInTime__c && v.CheckOutTime__c) ||
          v.VisitStatus__c === "Check In"
        )
      )
      .flatMap(visit =>
        Orders
          .filter(order => order.Visit__c === visit.Sf_Id)
          .flatMap(order =>
            OrderItems
              .filter(item => item.OrderId === order.Sf_Id)
              .map(item => {
                const product = Products.find(p => p.Sf_Id === item.Product2Id);
                return {
                  ...item,
                  productCategory: product?.Category__c,
                };
              })
              .filter(item => item.productCategory === categoryName)
          )
      )
      .reduce(
        (sum, item) => sum + (Number(item.NetAmount__c) || 0),
        0
      );

    // console.log(
    //   'Total Value in Rupees for category',
    //   categoryName,
    //   ':',
    //   totalValueInRupees
    // );

    return totalValueInRupees.toFixed(2);

  } catch (e) {
    console.warn('getValueInRupees err', e);
    return '—';
  }
}

export async function getQuantityInKg(categoryName) {
  try {

    const dateNow = moment().format("YYYY-MM-DD");


    // 1️⃣ Fetch user
    const userFromDb = await UniversalUpdateInsert({
      ObjectName: "User",
      Type: "get",
    });
    // console.log('USER FROM DB ::::', userFromDb);
    // setUserFromDbState(userFromDb);

    // 2️⃣ Fetch accounts
    const accountData = await UniversalUpdateInsert({
      ObjectName: "Account",
      Type: "get",
    });

    // 3️⃣ Fetch route plans of logged in user
    const RoutePlans = await UniversalUpdateInsert({
      ObjectName: "Route_Plans__c",
      Type: "get",
      filters: [
        { field: 'Assigned_To__c', value: userFromDb[0]?.Sf_Id },
      ],
    });

    // 4️⃣ Current month route plans
    const todayForRoutePlans = new Date();
    const firstDayOfMonth = new Date(todayForRoutePlans.getFullYear(), todayForRoutePlans.getMonth(), 1);
    const lastDayOfMonth = new Date(todayForRoutePlans.getFullYear(), todayForRoutePlans.getMonth() + 1, 0);

    const currentMonthRoutePlans = RoutePlans.filter(plan => {
      const startDate = new Date(plan.Start_Date__c);
      const endDate = new Date(plan.End_Date__c);
      return startDate <= lastDayOfMonth && endDate >= firstDayOfMonth;
    });

    const activePlanId = currentMonthRoutePlans[0]?.Sf_Id;

    // 5️⃣ Fetch BeatDays
    const BeatDays = await UniversalUpdateInsert({
      ObjectName: "BeatDay__c",
      Type: "get",
    });

    const beatDayForDate = BeatDays.find(b =>
      b.Tour_Plan__c === activePlanId && b.BeatDate__c === dateNow
    );

    if (!beatDayForDate) {
      console.log('No Beat Day found for date', dateNow);
      // setSelectedBeatName(null);
      // setSelecteBeatId(null);
      // setBeatDaysId(null);
      // setFilteredVisits([]);
      // setCategorizedData({ Upcoming: [], "In Progress": [], Completed: [] });
      return;
    }

    // setSelectedBeatName(beatDayForDate?.Beat__Name);
    // setSelecteBeatId(beatDayForDate?.Beat__c);
    // setBeatDaysId(beatDayForDate?.Sf_Id);

    // 6️⃣ Fetch Visits
    const Visits = await UniversalUpdateInsert({
      ObjectName: "Visit",
      Type: "get",
      filters: [
        { field: "SoftDelete", value: false },
        { field: "BeatDay__c", value: beatDayForDate?.Sf_Id },
      ],
    });

    // 7️⃣ Fetch Orders, OrderItems, Products
    const Orders = await UniversalUpdateInsert({
      ObjectName: "Order",
      Type: "get",
      // filters: [{ field: "SoftDelete", value: false }],
      filters: [{ field: "SoftDelete", value: false },{ field: "Type", value: 'Secondary Order' }],
    });

    const OrderItems = await UniversalUpdateInsert({
      ObjectName: "OrderItem",
      Type: "get",
      filters: [{ field: "SoftDelete", value: false }],
    });

    const Products = await UniversalUpdateInsert({
      ObjectName: "Product2",
      Type: "get",
      filters: [{ field: "SoftDelete", value: false }],
    });




    const totalQuantityInKg = Visits
      .filter(v =>
        v &&
        (
          (v.CheckInTime__c && v.CheckOutTime__c) ||
          v.VisitStatus__c === "Check In"
        )
      )
      .flatMap(visit =>
        Orders
          .filter(order => order.Visit__c === visit.Sf_Id)
          .flatMap(order =>
            OrderItems
              .filter(item => item.OrderId === order.Sf_Id)
              .map(item => {
                const product = Products.find(p => p.Sf_Id === item.Product2Id);
                return {
                  ...item,
                  productCategory: product?.Category__c,
                };
              })
              .filter(item => item.productCategory === categoryName)
          )
      )
      .reduce(
        (sum, item) => sum + (Number(item.Order_Quantity_In_Kg__c) || 0),
        0
      );

    // console.log('Total Quantity in KG for category', categoryName, ':', totalQuantityInKg);
    return totalQuantityInKg.toFixed(2);
  } catch (e) {
    console.warn('getDropSizeForCategory err', e);
    return '—';
  }
}
