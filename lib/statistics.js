import supabase from './supabaseClient';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const DEFAULT_RECENT_DAYS = 30;
const STATUS_PRIORITY = {
  'Remedial intensif': 5,
  'Perlu pendampingan': 4,
  'Latihan lagi': 3,
  'Perlu percaya diri': 2,
  Kuasai: 1,
  'Kurang Data': 0,
};

function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(value) {
  const date = toDate(value);
  if (!date) return null;
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(value) {
  const date = toDate(value);
  if (!date) return null;
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function addDays(value, days) {
  const date = toDate(value);
  if (!date) return null;
  return new Date(date.getTime() + days * DAY_IN_MS);
}

function formatDayKey(value) {
  const date = toDate(value);
  if (!date) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeTopic(log, session) {
  const candidates = [
    log?.topic,
    log?.topic_name,
    log?.subtopic,
    log?.material_topic,
    session?.topic,
    session?.topic_name,
    session?.subject_topic,
    session?.title,
    session?.session_topic,
    session?.subject,
  ];

  for (const candidate of candidates) {
    const text = normalizeText(candidate);
    if (text) return text;
  }

  return 'Tanpa Topik';
}

function normalizeBucket(log) {
  const textCandidates = [
    log?.support_level,
    log?.assistance_level,
    log?.help_level,
    log?.answer_support,
    log?.answer_mode,
    log?.completion_type,
    log?.result_category,
    log?.status,
  ]
    .map((value) => normalizeText(value).toLowerCase())
    .filter(Boolean);

  if (log?.needs_assistance === true || log?.requires_guidance === true) {
    return 'perlu_dampingan';
  }

  if (log?.is_assisted === true || log?.used_hint === true || log?.was_helped === true) {
    return 'dibantu';
  }

  if (log?.is_independent === true || log?.self_solved === true) {
    return 'mandiri';
  }

  for (const text of textCandidates) {
    if (
      text.includes('perlu_dampingan') ||
      text.includes('perlu dampingan') ||
      text.includes('butuh bantuan') ||
      text.includes('needs assistance') ||
      text.includes('guided')
    ) {
      return 'perlu_dampingan';
    }

    if (
      text.includes('dibantu') ||
      text.includes('assisted') ||
      text.includes('with help') ||
      text.includes('hint')
    ) {
      return 'dibantu';
    }

    if (
      text.includes('mandiri') ||
      text.includes('independent') ||
      text.includes('self') ||
      text.includes('benar')
    ) {
      return 'mandiri';
    }
  }

  return 'perlu_dampingan';
}

function createTopicAccumulator(topic) {
  return {
    topic,
    total_questions: 0,
    mandiri: 0,
    dibantu: 0,
    perlu_dampingan: 0,
  };
}

function calculatePercent(value, total) {
  if (!total) return 0;
  return Number(((value / total) * 100).toFixed(2));
}

export function getTopicCategory(metrics) {
  const total = Number(metrics?.total_questions || 0);
  const mandiri = Number(metrics?.mandiri || 0);
  const dibantu = Number(metrics?.dibantu || 0);

  if (total < 10) {
    return 'Kurang Data';
  }

  const penguasaan = calculatePercent(mandiri + dibantu, total);
  const kemandirian = calculatePercent(mandiri, total);

  if (penguasaan < 50) {
    return 'Remedial intensif';
  }

  if (penguasaan < 75 && kemandirian < 40) {
    return 'Perlu pendampingan';
  }

  if (penguasaan < 75) {
    return 'Latihan lagi';
  }

  if (kemandirian < 60) {
    return 'Perlu percaya diri';
  }

  return 'Kuasai';
}

function mergeLogsByTopic(logs, sessionsMap) {
  const topics = new Map();

  for (const log of logs) {
    const session = sessionsMap.get(log.session_id) || null;
    const topic = normalizeTopic(log, session);
    const bucket = normalizeBucket(log);

    if (!topics.has(topic)) {
      topics.set(topic, createTopicAccumulator(topic));
    }

    const current = topics.get(topic);
    current.total_questions += 1;

    if (bucket === 'mandiri') current.mandiri += 1;
    else if (bucket === 'dibantu') current.dibantu += 1;
    else current.perlu_dampingan += 1;
  }

  return topics;
}

async function fetchAnsweredQuestionLogs(studentId, startDate, endDate) {
  let query = supabase
    .from('question_logs')
    .select('*')
    .eq('student_id', studentId)
    .not('answered_at', 'is', null)
    .order('answered_at', { ascending: true });

  if (startDate) {
    query = query.gte('answered_at', startOfDay(startDate).toISOString());
  }

  if (endDate) {
    query = query.lte('answered_at', endOfDay(endDate).toISOString());
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Gagal mengambil question_logs: ${error.message}`);
  }

  return data || [];
}

async function fetchStudentSessions(studentId) {
  const { data, error } = await supabase
    .from('learning_sessions')
    .select('*')
    .eq('student_id', studentId);

  if (error) {
    throw new Error(`Gagal mengambil learning_sessions: ${error.message}`);
  }

  return data || [];
}

async function getLogsAndSessions(studentId, startDate, endDate) {
  if (!studentId) {
    throw new Error('studentId wajib diisi');
  }

  const [logs, sessions] = await Promise.all([
    fetchAnsweredQuestionLogs(studentId, startDate, endDate),
    fetchStudentSessions(studentId),
  ]);

  const sessionsMap = new Map();
  for (const session of sessions) {
    sessionsMap.set(session.id, session);
  }

  return { logs, sessionsMap };
}

function buildSummaryRows(logs, sessionsMap) {
  const grouped = mergeLogsByTopic(logs, sessionsMap);
  const rows = [];

  for (const [, metrics] of grouped.entries()) {
    rows.push({
      ...metrics,
      kemandirian_percent: calculatePercent(metrics.mandiri, metrics.total_questions),
    });
  }

  rows.sort((a, b) => b.total_questions - a.total_questions || a.topic.localeCompare(b.topic));
  return rows;
}

function getTrendForTopic(currentLogs, previousLogs, topic, currentSessionsMap, previousSessionsMap) {
  const currentTopicLogs = currentLogs.filter((log) => normalizeTopic(log, currentSessionsMap.get(log.session_id)) === topic);
  const previousTopicLogs = previousLogs.filter((log) => normalizeTopic(log, previousSessionsMap.get(log.session_id)) === topic);

  const currentMandiri = currentTopicLogs.filter((log) => normalizeBucket(log) === 'mandiri').length;
  const previousMandiri = previousTopicLogs.filter((log) => normalizeBucket(log) === 'mandiri').length;

  const currentPercent = calculatePercent(currentMandiri, currentTopicLogs.length);
  const previousPercent = calculatePercent(previousMandiri, previousTopicLogs.length);

  return Number((currentPercent - previousPercent).toFixed(2));
}

export async function getStudentLearningSummary(studentId, startDate, endDate) {
  const normalizedEndDate = endDate ? endOfDay(endDate) : endOfDay(new Date());
  const normalizedStartDate = startDate
    ? startOfDay(startDate)
    : startOfDay(addDays(normalizedEndDate, -(DEFAULT_RECENT_DAYS - 1)));

  const { logs, sessionsMap } = await getLogsAndSessions(studentId, normalizedStartDate, normalizedEndDate);
  const summary = buildSummaryRows(logs, sessionsMap);

  const currentWeekStart = startOfDay(addDays(normalizedEndDate, -6));
  const previousWeekStart = startOfDay(addDays(currentWeekStart, -7));
  const previousWeekEnd = endOfDay(addDays(currentWeekStart, -1));

  const [{ logs: currentWeekLogs, sessionsMap: currentWeekSessionsMap }, { logs: previousWeekLogs, sessionsMap: previousWeekSessionsMap }] =
    await Promise.all([
      getLogsAndSessions(studentId, currentWeekStart, normalizedEndDate),
      getLogsAndSessions(studentId, previousWeekStart, previousWeekEnd),
    ]);

  return summary.map((item) => ({
    topic: item.topic,
    total_questions: item.total_questions,
    mandiri: item.mandiri,
    dibantu: item.dibantu,
    perlu_dampingan: item.perlu_dampingan,
    kemandirian_percent: item.kemandirian_percent,
    tren: getTrendForTopic(
      currentWeekLogs,
      previousWeekLogs,
      item.topic,
      currentWeekSessionsMap,
      previousWeekSessionsMap,
    ),
  }));
}

export async function getConsistency(studentId, days = 7) {
  const totalDays = Math.max(1, Number(days) || 7);
  const endDate = endOfDay(new Date());
  const startDate = startOfDay(addDays(endDate, -(totalDays - 1)));
  const { logs } = await getLogsAndSessions(studentId, startDate, endDate);

  const activeDates = new Set(logs.map((log) => formatDayKey(log.answered_at)).filter(Boolean));
  const result = [];

  for (let offset = 0; offset < totalDays; offset += 1) {
    const date = addDays(startDate, offset);
    const key = formatDayKey(date);
    result.push({
      date: key,
      active: activeDates.has(key),
    });
  }

  return result;
}

export async function getFrequentTopics(studentId, limit = 5) {
  const endDate = endOfDay(new Date());
  const startDate = startOfDay(addDays(endDate, -(DEFAULT_RECENT_DAYS - 1)));
  const { logs, sessionsMap } = await getLogsAndSessions(studentId, startDate, endDate);
  const rows = buildSummaryRows(logs, sessionsMap);

  return rows.slice(0, Math.max(1, Number(limit) || 5)).map((item) => ({
    topic: item.topic,
    total_questions: item.total_questions,
    average_kemandirian: item.kemandirian_percent,
    mandiri: item.mandiri,
    dibantu: item.dibantu,
    perlu_dampingan: item.perlu_dampingan,
  }));
}

export async function getWorstTopics(studentId, limit = 3) {
  const endDate = endOfDay(new Date());
  const startDate = startOfDay(addDays(endDate, -(DEFAULT_RECENT_DAYS - 1)));
  const { logs, sessionsMap } = await getLogsAndSessions(studentId, startDate, endDate);
  const rows = buildSummaryRows(logs, sessionsMap).map((item) => {
    const penguasaan_percent = calculatePercent(item.mandiri + item.dibantu, item.total_questions);
    const kemandirian_percent = calculatePercent(item.mandiri, item.total_questions);
    const kategori = getTopicCategory(item);

    return {
      topic: item.topic,
      total_questions: item.total_questions,
      mandiri: item.mandiri,
      dibantu: item.dibantu,
      perlu_dampingan: item.perlu_dampingan,
      penguasaan_percent,
      kemandirian_percent,
      kategori,
      severity: STATUS_PRIORITY[kategori] || 0,
    };
  });

  return rows
    .sort((a, b) => {
      if (b.severity !== a.severity) return b.severity - a.severity;
      if (a.penguasaan_percent !== b.penguasaan_percent) return a.penguasaan_percent - b.penguasaan_percent;
      if (a.kemandirian_percent !== b.kemandirian_percent) return a.kemandirian_percent - b.kemandirian_percent;
      return b.total_questions - a.total_questions;
    })
    .slice(0, Math.max(1, Number(limit) || 3))
    .map(({ severity, ...item }) => item);
}

export default {
  getStudentLearningSummary,
  getConsistency,
  getFrequentTopics,
  getWorstTopics,
  getTopicCategory,
};