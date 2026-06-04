import { getAuthenticatedParent } from '@/lib/auth';
import supabase from '@/lib/supabaseClient';
import { getTopicCategory } from '@/lib/statistics';

const ALLOWED_PACKAGES = ['smart_parent', 'smart_family'];
const AUTO_PILOT_TOTAL_QUESTIONS = 15;
const AUTO_PILOT_COOLDOWN_DAYS = 7;
const MIN_WEAK_TOPIC_QUESTIONS = 5;
const WEAK_RATIO = 0.6;
const REVIEW_RATIO = 0.2;
const NEW_RATIO = 0.2;

function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function normalizeText(value) {
  return String(value ?? '').trim();
}

function calculatePercent(value, total) {
  if (!total) return 0;
  return Number(((value / total) * 100).toFixed(2));
}

function getPackageCodeFromParent(parent) {
  if (!parent) return null;
  const tier = parent.subscription_tier;
  if (tier === 'smart_parent' || tier === 'smart_family') return tier;
  return null;
}

async function getStudentProfile(studentId, parentId) {
  const { data, error } = await supabase
    .from('students_profile')
    .select('id, student_name, last_auto_pilot_at')
    .eq('id', studentId)
    .eq('parent_id', parentId)
    .maybeSingle();

  if (error) {
    throw new Error(`Gagal mengambil data siswa: ${error.message}`);
  }
  return data || null;
}

async function checkAutoPilotCooldown(studentId, lastAutoPilotAt) {
  const sevenDaysAgo = addDays(new Date(), -AUTO_PILOT_COOLDOWN_DAYS);
  if (lastAutoPilotAt) {
    const lastRun = new Date(lastAutoPilotAt);
    if (!Number.isNaN(lastRun.getTime()) && lastRun >= sevenDaysAgo) {
      return true;
    }
  }
  const { data, error } = await supabase
    .from('remedial_tasks')
    .select('id, created_at, status, title')
    .eq('student_id', studentId)
    .in('status', ['pending', 'completed'])
    .gte('created_at', sevenDaysAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) {
    throw new Error(`Gagal memeriksa batas Auto-Pilot: ${error.message}`);
  }
  return Array.isArray(data) && data.length > 0;
}

async function fetchSessionsMap(studentId) {
  const { data, error } = await supabase
    .from('learning_sessions')
    .select('*')
    .eq('student_id', studentId)
    .order('started_at', { ascending: false }); // FIXED: created_at -> started_at
  if (error) {
    throw new Error(`Gagal mengambil learning_sessions: ${error.message}`);
  }
  const sessions = data || [];
  const sessionsMap = new Map();
  sessions.forEach((session) => {
    sessionsMap.set(session.id, session);
  });
  return { sessions, sessionsMap };
}

async function fetchAnsweredLogs(studentId, startDate, endDate) {
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

function summarizeByTopic(logs, sessionsMap) {
  const grouped = new Map();
  logs.forEach((log) => {
    const session = sessionsMap.get(log.session_id) || null;
    const topic = normalizeTopic(log, session);
    const bucket = normalizeBucket(log);
    if (!grouped.has(topic)) {
      grouped.set(topic, {
        topic,
        total_questions: 0,
        mandiri: 0,
        dibantu: 0,
        perlu_dampingan: 0,
      });
    }
    const current = grouped.get(topic);
    current.total_questions += 1;
    if (bucket === 'mandiri') current.mandiri += 1;
    else if (bucket === 'dibantu') current.dibantu += 1;
    else current.perlu_dampingan += 1;
  });
  return Array.from(grouped.values()).map((item) => {
    const penguasaan_percent = calculatePercent(item.mandiri + item.dibantu, item.total_questions);
    const kemandirian_percent = calculatePercent(item.mandiri, item.total_questions);
    return {
      ...item,
      penguasaan_percent,
      kemandirian_percent,
      kategori: getTopicCategory(item),
    };
  });
}

function distributeQuestions(totalQuestions, topics) {
  if (!topics.length || totalQuestions <= 0) return [];
  const base = Math.floor(totalQuestions / topics.length);
  let remainder = totalQuestions % topics.length;
  return topics.map((topic) => {
    const extra = remainder > 0 ? 1 : 0;
    if (remainder > 0) remainder -= 1;
    return { ...topic, questions: base + extra };
  });
}

function takeUniqueTopics(topics, limit, excludedTopics) {
  const excluded = new Set(excludedTopics);
  const picked = [];
  for (const topic of topics) {
    if (excluded.has(topic.topic)) continue;
    picked.push(topic);
    excluded.add(topic.topic);
    if (picked.length >= limit) break;
  }
  return picked;
}

function buildSessionTopicPool(sessions, excludedTopics) {
  const excluded = new Set(excludedTopics);
  const seen = new Set();
  const pool = [];
  sessions.forEach((session) => {
    const candidates = [
      session?.topic,
      session?.topic_name,
      session?.subject_topic,
      session?.session_topic,
      session?.title,
      session?.subject,
    ];
    let topic = '';
    for (const candidate of candidates) {
      const normalized = normalizeText(candidate);
      if (normalized) {
        topic = normalized;
        break;
      }
    }
    if (!topic || seen.has(topic) || excluded.has(topic)) return;
    seen.add(topic);
    pool.push({ topic });
  });
  return pool;
}

function rebalancePlan(weakPlan, reviewPlan, newPlan) {
  const currentTotal = [...weakPlan, ...reviewPlan, ...newPlan].reduce((sum, item) => sum + item.questions, 0);
  let deficit = AUTO_PILOT_TOTAL_QUESTIONS - currentTotal;
  if (deficit <= 0) return { weakPlan, reviewPlan, newPlan };
  const targets = [weakPlan, reviewPlan, newPlan].filter((group) => group.length > 0);
  let index = 0;
  while (deficit > 0 && targets.length > 0) {
    const group = targets[index % targets.length];
    const item = group[index % group.length];
    item.questions += 1;
    deficit -= 1;
    index += 1;
  }
  return { weakPlan, reviewPlan, newPlan };
}

function buildAutoPilotTitle(studentName) {
  const suffix = studentName ? ` - ${studentName}` : '';
  return `Auto-Pilot Remedial 15 Soal${suffix}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: 'Method tidak diizinkan' });
  }

  try {
    const parentAuth = await getAuthenticatedParent(req, res);
    if (!parentAuth) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const parentId = String(parentAuth?.parentId || '').trim();
    if (!parentId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const packageCode = getPackageCodeFromParent(parentAuth.parent);
    if (!packageCode || !ALLOWED_PACKAGES.includes(packageCode)) {
      return res.status(403).json({ success: false, message: 'Paket parent tidak mendukung fitur Auto-Pilot' });
    }

    const studentId = String(req.body?.studentId || '').trim();
    if (!studentId) {
      return res.status(400).json({ success: false, message: 'studentId wajib diisi' });
    }

    const student = await getStudentProfile(studentId, parentId);
    if (!student) {
      return res.status(403).json({ success: false, message: 'Siswa tidak terdaftar pada parent yang login' });
    }

    const isCooldownActive = await checkAutoPilotCooldown(studentId, student.last_auto_pilot_at);
    if (isCooldownActive) {
      return res.status(429).json({ success: false, message: 'Auto-Pilot hanya dapat dijalankan maksimal 1 kali dalam 7 hari' });
    }

    const now = new Date();
    const sevenDaysAgo = addDays(now, -6);
    const thirtyDaysAgo = addDays(now, -29);

    const [{ sessions, sessionsMap }, logs7Days, logs30Days] = await Promise.all([
      fetchSessionsMap(studentId),
      fetchAnsweredLogs(studentId, sevenDaysAgo, now),
      fetchAnsweredLogs(studentId, thirtyDaysAgo, now),
    ]);

    const topicSummary7Days = summarizeByTopic(logs7Days, sessionsMap);
    const topicSummary30Days = summarizeByTopic(logs30Days, sessionsMap);

    const weakTopics = topicSummary7Days
      .filter((topic) => topic.total_questions >= MIN_WEAK_TOPIC_QUESTIONS)
      .sort((a, b) => {
        if (a.kemandirian_percent !== b.kemandirian_percent) return a.kemandirian_percent - b.kemandirian_percent;
        if (a.penguasaan_percent !== b.penguasaan_percent) return a.penguasaan_percent - b.penguasaan_percent;
        return b.total_questions - a.total_questions;
      })
      .slice(0, 5);

    if (!weakTopics.length) {
      return res.status(400).json({ success: false, message: 'Belum cukup data 7 hari terakhir untuk menjalankan Auto-Pilot' });
    }

    const weakTopicNames = weakTopics.map((item) => item.topic);

    const reviewTopics = takeUniqueTopics(
      topicSummary30Days
        .filter((topic) => topic.kategori === 'Kuasai')
        .sort((a, b) => {
          if (b.kemandirian_percent !== a.kemandirian_percent) return b.kemandirian_percent - a.kemandirian_percent;
          if (b.penguasaan_percent !== a.penguasaan_percent) return b.penguasaan_percent - a.penguasaan_percent;
          return b.total_questions - a.total_questions;
        }),
      3,
      weakTopicNames,
    );

    const newTopics = takeUniqueTopics(
      buildSessionTopicPool(sessions, [...weakTopicNames, ...reviewTopics.map((item) => item.topic)]),
      3,
      [],
    );

    const weakQuestionCount = Math.round(AUTO_PILOT_TOTAL_QUESTIONS * WEAK_RATIO);
    const reviewQuestionCount = Math.round(AUTO_PILOT_TOTAL_QUESTIONS * REVIEW_RATIO);
    const newQuestionCount = AUTO_PILOT_TOTAL_QUESTIONS - weakQuestionCount - reviewQuestionCount;

    let weakPlan = distributeQuestions(weakQuestionCount, weakTopics);
    let reviewPlan = distributeQuestions(reviewQuestionCount, reviewTopics);
    let newPlan = distributeQuestions(newQuestionCount, newTopics);

    const rebalanced = rebalancePlan(weakPlan, reviewPlan, newPlan);
    weakPlan = rebalanced.weakPlan;
    reviewPlan = rebalanced.reviewPlan;
    newPlan = rebalanced.newPlan;

    const taskTitle = buildAutoPilotTitle(student.student_name);
    const timestamp = new Date().toISOString();

    const { error: insertError } = await supabase
      .from('remedial_tasks')
      .insert({
        student_id: studentId,
        title: taskTitle,
        status: 'pending',
        total_questions: AUTO_PILOT_TOTAL_QUESTIONS,
        created_at: timestamp,
        updated_at: timestamp,
      });

    if (insertError) {
      throw new Error(`Gagal membuat remedial_tasks: ${insertError.message}`);
    }

    const { error: updateStudentError } = await supabase
      .from('students_profile')
      .update({ last_auto_pilot_at: timestamp })
      .eq('id', studentId);

    if (updateStudentError) {
      throw new Error(`Gagal memperbarui last_auto_pilot_at: ${updateStudentError.message}`);
    }

    return res.status(200).json({
      success: true,
      message: 'Auto-Pilot berhasil dijalankan',
      data: { composition: { weak_topics: weakPlan, review_topics: reviewPlan, new_topics: newPlan } },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan pada server';
    return res.status(500).json({ success: false, message });
  }
}