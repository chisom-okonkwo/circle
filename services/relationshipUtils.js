const TIER_FREQUENCY_DAYS = {
  1: 14,
  2: 30,
  3: 90,
  4: 180,
};

function toStartOfDay(dateInput) {
  const date = dateInput instanceof Date ? new Date(dateInput) : new Date(dateInput);

  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date input');
  }

  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Computes nextTouchDate from tier + lastContactedDate using v1 spec formulas:
 * Tier 1: +14 days, Tier 2: +30 days, Tier 3: +90 days, Tier 4: +180 days.
 */
export function computeNextTouchDate(tier, lastContactedDate) {
  const frequencyDays = TIER_FREQUENCY_DAYS[tier];

  if (!frequencyDays) {
    throw new Error('Invalid tier. Tier must be 1, 2, 3, or 4.');
  }

  const lastContacted = toStartOfDay(lastContactedDate);
  return addDays(lastContacted, frequencyDays);
}

/**
 * Returns relationship health based on nextTouchDate and today:
 * green: today < (nextTouchDate - 7 days)
 * yellow: today is within 7 days of nextTouchDate (including nextTouchDate)
 * red: today > nextTouchDate
 */
export function getHealthStatus(nextTouchDate, todayDate = new Date()) {
  const nextTouch = toStartOfDay(nextTouchDate);
  const today = toStartOfDay(todayDate);
  const yellowStart = addDays(nextTouch, -7);

  if (today > nextTouch) {
    return 'red';
  }

  if (today >= yellowStart) {
    return 'yellow';
  }

  return 'green';
}
