/* Vercel Serverless — 匹配算法引擎 */

/**
 * 百分制匹配: 性别(50) + 标签(30) + 情绪画像(10) + 活跃时段(10)
 */
function calculateScore(userA, userB) {
  var score = 0;

  // 1. 性别权重 (50%): 异性优先
  if (userA.target_gender !== userB.gender) {
    // 如果A期望的性别不等于B的性别
    if (userA.target_gender === 'opposite') {
      // A期望异性, 但B的gender不等于A... 需要检查B的gender是否不等于A的gender
    }
  }

  // 性别匹配: secret 可配任何人，否则异性优先
  if (userA.gender === 'secret' || userB.gender === 'secret') {
    score += 50;
  } else if (userA.gender && userB.gender && userA.gender !== userB.gender) {
    score += 50;
  } else if (userA.target_gender === 'any' && userB.target_gender === 'any') {
    score += 25;
  } else {
    return 0;
  }

  // 2. 标签匹配 (30%)
  var tagsA = (userA.selected_tags || []).concat(userA.tags || []);
  var tagsB = (userB.selected_tags || []).concat(userB.tags || []);
  if (tagsA.length > 0 && tagsB.length > 0) {
    var intersection = 0;
    for (var i = 0; i < tagsA.length; i++) {
      for (var j = 0; j < tagsB.length; j++) {
        if (tagsA[i] === tagsB[j]) { intersection++; break; }
      }
    }
    var unionSet = new Set(tagsA.concat(tagsB));
    var jaccard = intersection / unionSet.size;
    score += Math.round(jaccard * 30);
  }

  // 3. 情绪画像 (10%) — 互补加分
  if (userA.emotional_pattern && userB.emotional_pattern) {
    score += complementaryScore(userA.emotional_pattern, userB.emotional_pattern);
  }

  // 4. 活跃时段重合 (10%)
  if (userA.active_hours && userB.active_hours) {
    score += activeHourOverlap(userA.active_hours, userB.active_hours);
  }

  return score;
}

var COMPLEMENTARY = {
  'anxious': { 'calm': 10, 'warm': 5 },
  'sad': { 'warm': 10, 'hopeful': 5 },
  'angry': { 'calm': 8, 'warm': 4 },
  'calm': { 'anxious': 10, 'angry': 8 },
  'lonely': { 'warm': 10, 'joyful': 6 },
  'lost': { 'determined': 10, 'calm': 5 },
  'warm': { 'sad': 10, 'lonely': 10 },
  'joyful': { 'lonely': 6 },
  'determined': { 'lost': 10 }
};

function complementaryScore(patternA, patternB) {
  var moodA = (patternA.dominant_mood || 'calm').toLowerCase();
  var moodB = (patternB.dominant_mood || 'calm').toLowerCase();
  if (COMPLEMENTARY[moodA] && COMPLEMENTARY[moodA][moodB]) {
    return COMPLEMENTARY[moodA][moodB];
  }
  if (moodA === moodB) return 2;
  return 0;
}

function activeHourOverlap(hoursA, hoursB) {
  var a = Array.isArray(hoursA) ? hoursA : [];
  var b = Array.isArray(hoursB) ? hoursB : [];
  if (a.length === 0 || b.length === 0) return 0;
  var overlap = 0;
  for (var i = 0; i < a.length; i++) {
    for (var j = 0; j < b.length; j++) {
      if (Math.abs(a[i] - b[j]) <= 1) { overlap++; break; }
    }
  }
  return Math.round((overlap / Math.max(a.length, b.length)) * 10);
}

/* 扫描匹配池, 找出最佳匹配对 */
function scanPool(pool) {
  if (!pool || pool.length < 2) return null;
  var bestPair = null;
  var bestScore = -1;
  for (var i = 0; i < pool.length; i++) {
    for (var j = i + 1; j < pool.length; j++) {
      var score = calculateScore(pool[i], pool[j]);
      if (score > bestScore) {
        bestScore = score;
        bestPair = { a: pool[i], b: pool[j], score: score };
      }
    }
  }
  return bestPair;
}

export { calculateScore, scanPool };
