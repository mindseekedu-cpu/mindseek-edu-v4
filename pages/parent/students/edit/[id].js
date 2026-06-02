import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';

const LEARNING_STYLE_OPTIONS = [
  'Visual',
  'Auditori',
  'Kinestetik',
  'BacaTulis',
  'Campuran',
];

const INITIAL_FORM = {
  student_name: '',
  grade: '',
  curriculum: 'Kurikulum Merdeka',
  student_email: '',
  school_name: '',
  interests: '',
  learning_style: 'Campuran',
  additional_notes: '',
};

function normalizeFormData(student) {
  return {
    student_name: student?.student_name || '',
    grade: student?.grade ? String(student.grade) : '',
    curriculum: student?.curriculum || 'Kurikulum Merdeka',
    student_email: student?.student_email || '',
    school_name: student?.school_name || '',
    interests: student?.interests || '',
    learning_style: student?.learning_style || 'Campuran',
    additional_notes: student?.additional_notes || '',
  };
}

function validateForm(values) {
  const errors = {};
  const trimmedName = String(values.student_name || '').trim();
  const gradeNumber = Number(values.grade);
  const studentEmail = String(values.student_email || '').trim();
  const learningStyle = String(values.learning_style || '').trim();

  if (!trimmedName) {
    errors.student_name = 'Student Name wajib diisi.';
  } else if (trimmedName.length < 3) {
    errors.student_name = 'Student Name minimal 3 karakter.';
  }

  if (!values.grade) {
    errors.grade = 'Grade wajib diisi.';
  } else if (!Number.isInteger(gradeNumber) || gradeNumber < 1 || gradeNumber > 12) {
    errors.grade = 'Grade harus berupa angka 1 sampai 12.';
  }

  if (studentEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(studentEmail)) {
    errors.student_email = 'Format Student Email tidak valid.';
  }

  if (learningStyle && !LEARNING_STYLE_OPTIONS.includes(learningStyle)) {
    errors.learning_style = 'Learning Style tidak valid.';
  }

  return errors;
}

export default function EditStudentPage() {
  const router = useRouter();
  const { id } = router.query;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [errors, setErrors] = useState({});
  const [studentMeta, setStudentMeta] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [initialSnapshot, setInitialSnapshot] = useState(JSON.stringify(INITIAL_FORM));

  useEffect(() => {
    if (!router.isReady || !id) {
      return;
    }

    let isMounted = true;

    async function loadStudent() {
      try {
        setLoading(true);
        setServerError('');

        const response = await fetch(`/api/parent/students/${id}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Gagal memuat data siswa.');
        }

        if (!isMounted) return;

        const nextForm = normalizeFormData(result.student || {});
        setStudentMeta({
          id: result.student?.id || '',
          student_id: result.student?.student_id || '',
        });
        setForm(nextForm);
        setInitialSnapshot(JSON.stringify(nextForm));
      } catch (error) {
        if (!isMounted) return;
        setServerError(error.message || 'Terjadi kesalahan saat memuat data siswa.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadStudent();

    return () => {
      isMounted = false;
    };
  }, [router.isReady, id]);

  const isFormDirty = useMemo(() => {
    return JSON.stringify(form) !== initialSnapshot;
  }, [form, initialSnapshot]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    setErrors((prev) => ({
      ...prev,
      [name]: '',
    }));
    setServerError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const validationErrors = validateForm(form);
    setErrors(validationErrors);
    setServerError('');

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        student_name: form.student_name.trim(),
        grade: Number(form.grade),
        curriculum: form.curriculum.trim() || 'Kurikulum Merdeka',
        student_email: form.student_email.trim(),
        school_name: form.school_name.trim(),
        interests: form.interests.trim(),
        learning_style: form.learning_style,
        additional_notes: form.additional_notes.trim(),
      };

      const response = await fetch(`/api/parent/students/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Gagal memperbarui data siswa.');
      }

      await router.push('/dashboard');
    } catch (error) {
      setServerError(error.message || 'Terjadi kesalahan saat memperbarui data siswa.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>Edit Siswa</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8 flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">Manajemen Siswa</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900">Edit Siswa</h1>
              <p className="mt-2 text-sm text-slate-500">
                Perbarui data profil siswa yang terhubung ke akun parent.
              </p>
              {studentMeta?.student_id ? (
                <p className="mt-2 text-xs font-medium text-slate-500">
                  Student ID: <span className="text-slate-700">{studentMeta.student_id}</span>
                </p>
              ) : null}
            </div>

            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Kembali ke Dashboard
            </Link>
          </div>

          {loading ? (
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="animate-pulse space-y-4">
                <div className="h-5 w-48 rounded bg-slate-200" />
                <div className="h-12 w-full rounded-xl bg-slate-200" />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="h-12 w-full rounded-xl bg-slate-200" />
                  <div className="h-12 w-full rounded-xl bg-slate-200" />
                  <div className="h-12 w-full rounded-xl bg-slate-200" />
                  <div className="h-12 w-full rounded-xl bg-slate-200" />
                </div>
                <div className="h-32 w-full rounded-xl bg-slate-200" />
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              {serverError ? (
                <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {serverError}
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label htmlFor="student_name" className="mb-2 block text-sm font-semibold text-slate-700">
                    Student Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="student_name"
                    name="student_name"
                    type="text"
                    value={form.student_name}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="Masukkan nama siswa"
                  />
                  {errors.student_name ? (
                    <p className="mt-2 text-sm text-red-600">{errors.student_name}</p>
                  ) : null}
                </div>

                <div>
                  <label htmlFor="grade" className="mb-2 block text-sm font-semibold text-slate-700">
                    Grade <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="grade"
                    name="grade"
                    type="number"
                    min="1"
                    max="12"
                    value={form.grade}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="1 - 12"
                  />
                  {errors.grade ? <p className="mt-2 text-sm text-red-600">{errors.grade}</p> : null}
                </div>

                <div>
                  <label htmlFor="curriculum" className="mb-2 block text-sm font-semibold text-slate-700">
                    Curriculum
                  </label>
                  <input
                    id="curriculum"
                    name="curriculum"
                    type="text"
                    value={form.curriculum}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="Kurikulum Merdeka"
                  />
                </div>

                <div>
                  <label htmlFor="student_email" className="mb-2 block text-sm font-semibold text-slate-700">
                    Student Email
                  </label>
                  <input
                    id="student_email"
                    name="student_email"
                    type="email"
                    value={form.student_email}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="email@siswa.com"
                  />
                  {errors.student_email ? (
                    <p className="mt-2 text-sm text-red-600">{errors.student_email}</p>
                  ) : null}
                </div>

                <div>
                  <label htmlFor="school_name" className="mb-2 block text-sm font-semibold text-slate-700">
                    School Name
                  </label>
                  <input
                    id="school_name"
                    name="school_name"
                    type="text"
                    value={form.school_name}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="Nama sekolah"
                  />
                </div>

                <div>
                  <label htmlFor="learning_style" className="mb-2 block text-sm font-semibold text-slate-700">
                    Learning Style
                  </label>
                  <select
                    id="learning_style"
                    name="learning_style"
                    value={form.learning_style}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    {LEARNING_STYLE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  {errors.learning_style ? (
                    <p className="mt-2 text-sm text-red-600">{errors.learning_style}</p>
                  ) : null}
                </div>

                <div>
                  <label htmlFor="interests" className="mb-2 block text-sm font-semibold text-slate-700">
                    Interests
                  </label>
                  <input
                    id="interests"
                    name="interests"
                    type="text"
                    value={form.interests}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="Contoh: Sains, Matematika, Musik"
                  />
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="additional_notes" className="mb-2 block text-sm font-semibold text-slate-700">
                    Additional Notes
                  </label>
                  <textarea
                    id="additional_notes"
                    name="additional_notes"
                    rows="5"
                    value={form.additional_notes}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="Tambahkan catatan tambahan jika diperlukan"
                  />
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-500">
                  PIN tidak dapat diubah dari halaman ini. Fitur reset PIN akan dibuat terpisah.
                </p>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Batal
                  </Link>
                  <button
                    type="submit"
                    disabled={submitting || !isFormDirty}
                    className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? 'Menyimpan...' : 'Simpan Perubahan'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </main>
    </>
  );
}