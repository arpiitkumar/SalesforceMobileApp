const fetchAttendance = async (fetchRecords, accessToken, instanceUrl) => {

  const query = `
    SELECT 
        Id, 
        Name, 
        User__c, 
        AttendanceDate__c, 
        AttendanceStartTime__c, 
        AttendanceEndTime__c, 
        GeoLocation__c, 
        Reason__c, 
        AttendanceStatus__c, 
        Approval_Status__c,
        LeaveDuration__c, 
        CapturedSelfie__c, 
        SelfieURL__c,
        Attendance_Image_URL__c,
        Other_Leave_Reason__c,
        From_Date__c,
        To_Date__c
    FROM Attendance__c WHERE CreatedDate >= LAST_N_MONTHS:1
`;

  console.log('query ', query)
  try {
    const result = await fetchRecords('User', query, accessToken, instanceUrl);
    //console.log('result ',result)
    return result;
  } catch (err) {
    console.error(' Error in fetchUserProfile:', err);
    throw err;
  }
};

export default fetchAttendance;
