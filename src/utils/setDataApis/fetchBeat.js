//.js
const fetchBeat = async (apiFetch, userId) => {

  const payload = {
    "month": "July",
    "userId": userId,
  }
  // console.log('payload Beat',payload)
  try {
    const result = await apiFetch('POST', 'visitsSchedule', payload, 'custom');
    //console.log('result ',result)
    return result;
  } catch (err) {
    console.error(' Error in fetchUserProfile:', err);
    throw err;
  }
};

export default fetchBeat;