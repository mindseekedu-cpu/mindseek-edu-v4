import { useMemo, useState } from 'react';
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
  pin: '',
  confirmPin: '',
  curriculum: 'Kurikulum Merdeka',
  student_email: '',
  school_name: '',
  interests: '',
  learning_style: 'Campuran',
  additional_notes: '',
};

function validateForm(values) {
  const errors = {};
  const trimmedName = values.student_name.trim();
  const gradeNumber = Number(values.grade);
  const normalizedPin = String(values.pin || '').trim();
  const normalizedConfirmPin = String(values.confirmPin || '').trim();

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

  if (!normalizedPin) {
    errors.pin = 'PIN wajib diisi.';
  } else if (!/^\d{6}$/.test(normalizedPin)) {
    errors.pin = 'PIN harus 6 digit angka.';
  }

  if (!normalizedConfirmPin) {
    errors.confirmPin = 'Konfirmasi PIN wajib diisi.';
  } else if (normalizedPin !== normalizedConfirmPin) {
    errors.confirmPin = 'Konfirmasi PIN tidak cocok.';
  }

  if (values.student_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.student_email.trim())) {
    errors.student_email = 'Format Student Email tidak valid.';
  }

  return errors;
}

export default function AddStudentPage() {
  const router = useRouter();
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isFormDirty = useMemo(() => {
    return Object.keys(INITIAL_FORM).some((key) => form[key] !== INITIAL_FORM[key]);
  }, [form]);

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
        pin: String(form.pin).trim(),
        confirmPin: String(form.confirmPin).trim(),
        curriculum: form.curriculum.trim() || 'Kurikulum Merdeka',
        student_email: form.student_email.trim(),
        school_name: form.school_name.trim(),
        interests: form.interests.trim(),
        learning_style: form.learning_style,
        additional_notes: form.additional_notes.trim(),
      };

      const response = await fetch('/api/parent/students/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Gagal menambahkan siswa.');
      }

      await router.push('/dashboard');
    } catch (error) {
      setServerError(error.message || 'Terjadi kesalahan saat menyimpan data siswa.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>Tambah Siswa Baru</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8 flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">Manajemen Siswa</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900">Tambah Siswa Baru</h1>
              <p className="mt-2 text-sm text-slate-500">
                Lengkapi data siswa untuk menambahkan profil baru ke akun parent.
              </p>
            </div>

            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Kembali ke Dashboard
            </Link>
          </div>

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
                <label htmlFor="pin" className="mb-2 block text-sm font-semibold text-slate-700">
                  PIN 6 Digit <span className="text-red-500">*</span>
                </label>
                <input
                  id="pin"
                  name="pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={form.pin}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="******"
                />
                {errors.pin ? <p className="mt-2 text-sm text-red-600">{errors.pin}</p> : null}
              </div>

              <div>
                <label htmlFor="confirmPin" className="mb-2 block text-sm font-semibold text-slate-700">
                  Konfirmasi PIN <span className="text-red-500">*</span>
                </label>
                <input
                  id="confirmPin"
                  name="confirmPin"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={form.confirmPin}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="******"
                />
                {errors.confirmPin ? (
                  <p className="mt-2 text-sm text-red-600">{errors.confirmPin}</p>
                ) : null}
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
                Field bertanda <span className="font-semibold text-red-500">*</span> wajib diisi.
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
                  {submitting ? 'Menyimpan...' : 'Simpan Siswa'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </main>
    </>
  );
}