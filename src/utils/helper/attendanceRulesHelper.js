import moment from 'moment';

/**
 * Convert backend rule record into parsed structure
 */
export const parseAttendanceRules = (rule) => {
  if (!rule || !rule.Start_Time__c) return null;

  // "10:00" -> [10, 0]
  const [hours, minutes] = String(rule.Start_Time__c).split(':').map(Number);

  return {
    startTime: { hours, minutes },
    warningThresholdMinutes: Number(rule.Warning_Threshold__c ?? 15),
    halfDayThresholdMinutes: Number(rule.Half_Day_Threshold__c ?? 30),
    fullDayThresholdMinutes: Number(rule.Full_Day_Threshold__c ?? 120),
  };
};

/**
 * Calculate dynamic windows & current status
 */
export const calculateAttendanceStatus = (rule, currentMoment = null) => {
  const now = currentMoment || moment();
  const parsed = parseAttendanceRules(rule);
  if (!parsed) {
    console.warn('Invalid attendance rule');
    return { status: 'unknown', recommendation: null };
  }

  const startTime = now.clone().set({
    hour: parsed.startTime.hours,
    minute: parsed.startTime.minutes,
    second: 0,
  });

  const warningDeadline = startTime.clone().add(parsed.warningThresholdMinutes, 'minutes');
  const halfDayDeadline = startTime.clone().add(parsed.halfDayThresholdMinutes, 'minutes');
  const fullDayDeadline = startTime.clone().add(parsed.fullDayThresholdMinutes, 'minutes');

  let status = 'unknown';
  let recommendation = null;

  if (now.isBefore(warningDeadline)) {
    status = 'present';
  } else if (now.isBefore(halfDayDeadline)) {
    status = 'late';
    recommendation = 'warning';
  } else if (now.isBefore(fullDayDeadline)) {
    status = 'half_day';
    recommendation = 'half_day_leave';
  } else {
    status = 'full_day';
    recommendation = 'full_day_leave';
  }

  return {
    status,
    recommendation,
    now,
    startTime,
    warningDeadline,
    halfDayDeadline,
    fullDayDeadline,
    parsed,
  };
};
