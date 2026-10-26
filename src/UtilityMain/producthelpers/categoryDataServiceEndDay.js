// UtilityMain/producthelpers/categoryDataService.js
import UniversalUpdateInsert from '../../database/dbService/UniversalUpdateInsert';
import moment from 'moment';
/**
 * Example functions to fetch metrics per category.
 * Adapt ObjectName/fields/filters to your actual DB schema.
 */

export async function getTlsdSubCategoryCount(categoryName) {
  try {
    const dateNow = moment().format("YYYY-MM-DD");

    // 1️⃣ Fetch user
    const userFromDb = await UniversalUpdateInsert({
      ObjectName: "User",
      Type: "get",
    });

    // 2️⃣ Route Plans
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

    const beatDayForDate = BeatDays.find(
      b => b.Tour_Plan__c === activePlanId && b.BeatDate__c === dateNow
    );

    if (!beatDayForDate) return {};

    // 4️⃣ Visits
    const Visits = await UniversalUpdateInsert({
      ObjectName: "Visit",
      Type: "get",
      filters: [
        { field: "SoftDelete", value: false },
        { field: "BeatDay__c", value: beatDayForDate.Sf_Id },
      ],
    });

    // 5️⃣ Orders / OrderItems / Products
    const Orders = await UniversalUpdateInsert({
      ObjectName: "Order",
      Type: "get",
      filters: [{ field: "SoftDelete", value: false }],
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

    // console.log('order items................NEW', OrderItems.length)
    // console.log('order items................NEW', OrderItems.length)

    // 6️⃣ Build order items list (same flow as before)
    const orderItemsMain = Visits
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
                const product = Products.find(
                  p => p.Sf_Id === item.Product2Id
                );
                // console.log('PRODUUCT>>>>>>>>>>>', product)
                return {
                  ...item,
                  category: product?.Category__c,
                  subCategory: product?.SubCategory__c,
                };
              })
              .filter(item => item.category === categoryName)
          )
      );

    // console.log('order items main..............', orderItemsMain)
    // 7️⃣ GROUP BY SUBCATEGORY & COUNT
    const subCategoryCountMap = orderItemsMain.reduce((acc, item) => {
      const key = item.subCategory || "Unknown";

      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const subCategoryKgMap = orderItemsMain.reduce((acc, item) => {
      const key = item.subCategory || "Unknown";

      const qtyKg = Number(item.Order_Quantity_In_Kg__c) || 0;


      acc[key] = (acc[key] || 0) + qtyKg;
      return acc;
    }, {});

    console.log('sub category map', subCategoryKgMap)

    return subCategoryKgMap;

  } catch (error) {
    console.error("getTlsdSubCategoryCount error", error);
    return {};
  }
}



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
      filters: [{ field: "SoftDelete", value: false }],
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



export async function getTlsdForCategory(categoryName) {
  try {

    const dateNow = moment().format("YYYY-MM-DD");

    try {
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
        filters: [{ field: "SoftDelete", value: false }],
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



      // 9️⃣ Process visits with orders - only relevant visits

      const orderItemsMain = Visits
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
        );

      // console.log('order TLSD calculation', orderItemsMain)

      const uniqueOrderItemsMap = new Map();

      orderItemsMain.forEach(item => {
        if (!uniqueOrderItemsMap.has(item.Product2Id)) {
          uniqueOrderItemsMap.set(item.Product2Id, item);
        }
      });

      const uniqueOrderItems = Array.from(uniqueOrderItemsMap.values());
      return {
        totalProducts: orderItemsMain.length,        // all order items
        uniqueProducts: uniqueOrderItems.length,     // unique by Product2Id
      };
      // return orderItemsMain.length





      // 1️⃣1️⃣ Stats
      const ordersPlacedCount = visitsWithOrders.reduce(
        (sum, visit) => sum + (visit.orders ? visit.orders.length : 0),
        0
      );

      const inProgressCount = visitsWithOrders.filter(
        v => (v.CheckInTime__c && !v.CheckOutTime__c) || v.VisitStatus__c === "Check In"
      ).length;

      const completedCount = visitsWithOrders.filter(v => v.CheckInTime__c && v.CheckOutTime__c).length;



      // console.log("CATEGORIZED DATA PREPARED =======", JSON.stringify(prepared));
      // commit to state
      setCategorizedData(prepared);

    } catch (error) {
      console.error('Failed to get data safely:', error);

    };




    // const res = await UniversalUpdateInsert({
    //   ObjectName: 'CategoryMetric__c',
    //   Type: 'get',
    //   filters: [
    //     { field: 'CategoryName__c', value: categoryName },
    //     { field: 'MetricType__c', value: 'Productivity' },
    //   ],
    // });
    // return res?.[0]?.MetricValue__c ?? '0 %';
    // return 0
  } catch (e) {
    console.warn('getProductivityForCategory err', e);
    return '0 %';
  }
}

export async function getLpscForCategory(categoryName) {
  try {
    // const res = await UniversalUpdateInsert({
    //   ObjectName: 'CategoryMetric__c',
    //   Type: 'get',
    //   filters: [
    //     { field: 'CategoryName__c', value: categoryName },
    //     { field: 'MetricType__c', value: 'LPSC' },
    //   ],
    // });
    // return res?.[0]?.MetricValue__c ?? '—';
    return 0
  } catch (e) {
    console.warn('getLpscForCategory err', e);
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
      filters: [{ field: "SoftDelete", value: false }],
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

export async function getDropSizeForCategory(categoryName) {
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
      filters: [{ field: "SoftDelete", value: false }],
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
    return totalQuantityInKg;
  } catch (e) {
    console.warn('getDropSizeForCategory err', e);
    return '—';
  }
}

/**
 * Optional: compute productivity for category (example).
 * You can also store productivity in DB and fetch similarly.
 */
export async function getProductivityForCategory(categoryName) {
  try {

    const dateNow = moment().format("YYYY-MM-DD");

    try {
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
        filters: [{ field: "SoftDelete", value: false }],
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



      // 9️⃣ Process visits with orders - only relevant visits
      const visitsWithOrders = Visits
        .filter(v => v && ((v.CheckInTime__c && v.CheckOutTime__c) || v.VisitStatus__c === "Check In"))
        .map(visit => {
          const account = accountData.find(acc => acc.Sf_Id === visit.AccountId__c);
          const accountName = account ? account.Name : 'Unknown Account';

          const ordersForVisit = Orders.filter(order => order.Visit__c === visit.Sf_Id)
            .map(order => ({
              ...order,
              items: OrderItems.filter(item => item.OrderId === order.Sf_Id)
                .map(item => {
                  const product = Products.find(p => p.Sf_Id === item.Product2Id);
                  return {
                    ...item,
                    productCategory: product ? product.Category__c : item.Product2Id,
                  };
                }),
            }));



          return {
            ...visit,
            title: accountName,
            code: account.PartyCode__c,
            orders: ordersForVisit,
          };
        });

      // console.log("VISITS WITH ORDERS ::::::::::", visitsWithOrders.length);

      const visitsWithOrdersCategory = Visits
        .filter(v =>
          v &&
          (
            (v.CheckInTime__c && v.CheckOutTime__c) ||
            v.VisitStatus__c === "Check In"
          )
        )
        .map(visit => {
          const account = accountData.find(acc => acc.Sf_Id === visit.AccountId__c);

          // 🔹 Orders for this visit
          const ordersForVisit = Orders
            .filter(order => order.Visit__c === visit.Sf_Id)
            .map(order => {
              // 🔹 Order items filtered by CATEGORY
              const filteredItems = OrderItems
                .filter(item => item.OrderId === order.Sf_Id)
                .map(item => {
                  const product = Products.find(p => p.Sf_Id === item.Product2Id);
                  return {
                    ...item,
                    productCategory: product?.Category__c,
                  };
                })
                .filter(item => item.productCategory === categoryName); // ⭐ KEY FILTER

              return {
                ...order,
                items: filteredItems,
              };
            })
            // 🔹 Remove orders that have NO matching items
            .filter(order => order.items.length > 0);

          return {
            ...visit,
            title: account?.Name ?? 'Unknown Account',
            code: account?.PartyCode__c ?? null,
            orders: ordersForVisit,
          };
        })
        // 🔹 Remove visits with NO matching orders
        .filter(visit => visit.orders.length > 0);
      const percentage = (visitsWithOrdersCategory.length / Visits.length) * 100;
      return {
        categorySpecificOrderVisitsNumber: visitsWithOrdersCategory.length,
        categorySpecificOrderVisits: percentage.toFixed(2),
        totalVisits: Visits.length
      }





      // 1️⃣1️⃣ Stats
      const ordersPlacedCount = visitsWithOrders.reduce(
        (sum, visit) => sum + (visit.orders ? visit.orders.length : 0),
        0
      );

      const inProgressCount = visitsWithOrders.filter(
        v => (v.CheckInTime__c && !v.CheckOutTime__c) || v.VisitStatus__c === "Check In"
      ).length;

      const completedCount = visitsWithOrders.filter(v => v.CheckInTime__c && v.CheckOutTime__c).length;



      // console.log("CATEGORIZED DATA PREPARED =======", JSON.stringify(prepared));
      // commit to state
      setCategorizedData(prepared);

    } catch (error) {
      console.error('Failed to get data safely:', error);

    };




    // const res = await UniversalUpdateInsert({
    //   ObjectName: 'CategoryMetric__c',
    //   Type: 'get',
    //   filters: [
    //     { field: 'CategoryName__c', value: categoryName },
    //     { field: 'MetricType__c', value: 'Productivity' },
    //   ],
    // });
    // return res?.[0]?.MetricValue__c ?? '0 %';
    // return 0
  } catch (e) {
    console.warn('getProductivityForCategory err', e);
    return '0 %';
  }
}


export async function getCategorySubCategoryNesting(categoryName) {
  const Products = await UniversalUpdateInsert({
    ObjectName: "Product2",
    Type: "get",
    filters: [
      { field: "SoftDelete", value: false },
      { field: "Category__c", value: categoryName },
    ],
  });

  const uniqueSubCategoryByCategory = new Set(
    Products.map(item => item.SubCategory__c)
  )

  // console.log(
  //   'sub category under a particular category',
  //   categoryName,
  //   '==',
  //   [...uniqueSubCategoryByCategory])

  return [...uniqueSubCategoryByCategory]
}