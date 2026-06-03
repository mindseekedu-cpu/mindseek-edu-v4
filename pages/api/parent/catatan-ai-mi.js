import { getAuthenticatedParent } from '@/lib/auth';
import supabase from '@/lib/supabaseClient';
import { getWorstTopics } from '@/lib/statistics';

function buildRecommendation(topic) {
  const topicName = topic.topic || 'topik ini';
  const kategori = topic.kategori || 'Kurang Data';

  if (kategori === 'Remedial intensif') {
    return `Fokuskan 10-15 menit per hari untuk mengulang konsep dasar ${topicName}. Dampingi anak saat mengerjakan soal, mulai dari contoh paling sederhana, lalu naikkan bertahap setelah anak mulai konsisten menjawab benar.`;
  }

  if (kategori === 'Perlu pendampingan') {
    return `Anak mulai memahami ${topicName}, tetapi masih perlu arahan. Dampingi pada 3-5 soal pertama, ajak anak menjelaskan langkah berpikirnya, lalu kurangi bantuan sedikit demi sedikit agar kemandiriannya meningkat.`;
  }

  if (kategori === 'Latihan lagi') {
    return `Pemahaman ${topicName} sudah terbentuk, namun masih perlu penguatan. Tambahkan latihan singkat dan rutin dengan variasi soal agar anak lebih stabil saat menghadapi bentuk pertanyaan yang berbeda.`;
  }

  if (kategori === 'Perlu percaya diri') {
    return `Hasil di ${topicName} cukup baik, tetapi anak masih sering ragu untuk mandiri. Beri apresiasi saat anak mencoba sendiri, tahan untuk tidak langsung membantu, dan minta anak memeriksa jawabannya sebelum bertanya.`;
  }

  if (kategori === 'Kuasai') {
    return `Topik ${topicName} sudah dikuasai dengan baik. Pertahankan dengan review ringan mingguan dan mulai kenalkan soal lanjutan agar kemampuan anak terus berkembang.`;
  }

  return `Data untuk ${topicName} masih belum cukup. Lanjutkan latihan beberapa sesi lagi agar pola kemampuan dan kebutuhan pendampingan anak bisa terlihat lebih akurat.`;
}

function buildAiMiNote(topic) {
  return {
    topic: topic.topic,
    kategori: topic.kategori,
    total_questions: topic.total_questions,
    penguasaan_percent: topic.penguasaan_percent,
    kemandirian_percent: topic.kemandirian_percent,
    recommendation: buildRecommendation(topic),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      success: false,
      message: 'Method tidak diizinkan',
    });
  }

  try {
    const parentAuth = await getAuthenticatedParent(req, res);

    if (!parentAuth) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const parentId = String(parentAuth?.parentId || '').trim();

    if (!parentId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const studentId = String(req.query.studentId || '').trim();

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: 'studentId wajib diisi',
      });
    }

    const { data: student, error: studentError } = await supabase
      .from('students_profile')
      .select('id')
      .eq('id', studentId)
      .eq('parent_id', parentId)
      .maybeSingle();

    if (studentError) {
      throw new Error(`Gagal memverifikasi siswa: ${studentError.message}`);
    }

    if (!student) {
      return res.status(403).json({
        success: false,
        message: 'Siswa tidak terdaftar pada parent yang login',
      });
    }

    const worstTopics = await getWorstTopics(studentId, 3);
    const notes = worstTopics.map(buildAiMiNote);

    return res.status(200).json({
      success: true,
      data: notes,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan pada server';

    return res.status(500).json({
      success: false,
      message,
    });
  }
}