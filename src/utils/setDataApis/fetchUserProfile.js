// fetchUserProfile.js
const fetchUserProfile = async (fetchRecords, userId, accessToken, instanceUrl) => {
  console.log('🔍 Fetching profile for userId:', userId);

  const query = `
  SELECT Deviceid__c,Assigned_Latitude__c,Assigned_Longitude__c,Name,UserRole.Name,User_Type__c,EmployeeCode__c,Phone,Email FROM User WHERE Id = '${userId}' LIMIT 200
  `;
  console.log('query ', query)
  try {
    const result = await fetchRecords('User', query, accessToken, instanceUrl);
    // console.log('result ',result)
    return result;
  } catch (err) {
    console.error(' Error in fetchUserProfile:', err);
    throw err;
  }
};

export default fetchUserProfile;
