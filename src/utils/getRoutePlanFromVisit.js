import UniversalUpdateInsert from "../database/dbService/UniversalUpdateInsert";

export const getRoutePlanFromVisit = async (visit) => {
  const BeatDays = await UniversalUpdateInsert({
    ObjectName: "BeatDay__c",
    Type: "get",
  });

  // console.log('beat days', BeatDays)
  console.log('selected visit', visit)
  const RoutePlans = await UniversalUpdateInsert({
    ObjectName: "Route_Plans__c",
    Type: "get",
  });

  const beatDay = BeatDays.find(
    (bd) => bd.Sf_Id === visit.BeatDay__c
  );

  if (!beatDay) return null;

  const routePlan = RoutePlans.find(
    (rp) => rp.Sf_Id === beatDay.Tour_Plan__c
  );

  return {
    // beatDay,
    routePlanName: routePlan?.Name ?? null,
  };
  // return {
  //   beatDay,
  //   routePlan,
  // };
};


