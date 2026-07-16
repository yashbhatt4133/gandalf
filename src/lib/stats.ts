/** Longest run of consecutive calendar days (UTC) ending today, from a list of ISO timestamps. */
export function computeCurrentStreak(timestamps: string[]): number {
  if (timestamps.length === 0) return 0;
  const days = new Set(timestamps.map((t) => t.slice(0, 10)));

  let streak = 0;
  const cursor = new Date();
  for (;;) {
    const key = cursor.toISOString().slice(0, 10);
    if (!days.has(key)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function computeLongestStreak(timestamps: string[]): number {
  if (timestamps.length === 0) return 0;
  const days = Array.from(new Set(timestamps.map((t) => t.slice(0, 10)))).sort();
  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1]);
    const curr = new Date(days[i]);
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000);
    if (diffDays === 1) {
      run++;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }
  return longest;
}
