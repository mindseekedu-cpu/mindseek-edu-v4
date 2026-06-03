import bcrypt from 'bcryptjs';
import supabase from '@/lib/supabaseClient';
import { getAuthenticatedParent } from '@/lib/auth';

const STUDENTS_TABLE = process.env.STUDENTS_TABLE_NAME || 'students_profile';
const BCRYPT_SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 10);

export default async function handler(req, res) {
  console.log('=== ADD STUDENT API CALLED ===');
  console.log('Method:', req.method);
  
  if (req.method !== 'POST') {
    console.log('Method not allowed');
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: 'Method tidak diizinkan.' });
  }

  try {
    console.log('1. Getting authenticated parent...');
    const { parentId } = await getAuthenticatedParent(req);
    console.log('2. Parent ID:', parentId);

    const { student_name, grade, pin, confirmPin, curriculum, student_email, school_name, interests, learning_style, additional_notes } = req.body;
    console.log('3. Request body:', req.body);

    // Validasi sederhana
    if (!student_name || student_name.trim().length < 3) {
      throw new Error('Student Name minimal 3 karakter');
    }
    const gradeNum = parseInt(grade);
    if (isNaN(gradeNum) || gradeNum < 1 || gradeNum > 12) {
      throw new Error('Grade harus 1-12');
    }
    if (!pin || !/^\d{6}$/.test(pin)) {
      throw new Error('PIN harus 6 digit angka');
    }
    if (pin !== confirmPin) {
      throw new Error('Konfirmasi PIN tidak cocok');
    }
    console.log('4. Validasi berhasil');

    console.log('5. Hashing PIN...');
    const pinHash = await bcrypt.hash(pin, BCRYPT_SALT_ROUNDS);
    
    console.log('6. Generating student ID...');
    const studentId = Math.floor(100000 + Math.random() * 900000).toString();
    console.log('7. Student ID:', studentId);

    const insertPayload = {
      parent_id: parentId,
      student_name: student_name.trim(),
      grade: gradeNum,
      pin_hash: pinHash,
      curriculum: curriculum || 'Kurikulum Merdeka',
      student_email: student_email || null,
      school_name: school_name || null,
      interests: interests || null,
      learning_style: learning_style || 'Campuran',
      additional_notes: additional_notes || null,
      student_id: studentId,
    };
    console.log('8. Insert payload:', insertPayload);

    console.log('9. Inserting to Supabase...');
    const { data, error } = await supabase
      .from(STUDENTS_TABLE)
      .insert(insertPayload)
      .select('id, student_name, grade, student_id')
      .single();

    if (error) {
      console.error('10. Supabase error:', error);
      throw new Error(error.message);
    }
    console.log('11. Insert success:', data);

    return res.status(201).json({ success: true, student: data });
  } catch (error) {
    console.error('!!! ERROR IN ADD STUDENT !!!');
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
}