import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { 
  PlusIcon, 
  ArrowUpIcon, 
  UserCircleIcon,
  BookOpenIcon,
  SunIcon,
  MoonIcon,
  CameraIcon,
  PhotoIcon,
  DocumentIcon,
  FireIcon,
  StarIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline';

export default function StudentDashboardPage() {
  const router = useRouter();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [showUploadPopup, setShowUploadPopup] = useState(false);

  // Chat state
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const textareaRef = useRef(null);

  // Settings (persisted to localStorage)
  const [mode, setMode] = useState('homework');
  const [grade, setGrade] = useState('');
  const [curriculum, setCurriculum] = useState('Kurikulum Merdeka');
  const [subject, setSubject] = useState('Matematika');
  const [topic, setTopic] = useState('');
  const [otherTopic, setOtherTopic] = useState('');

  // Data from API
  const [recentSessions, setRecentSessions] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);

  // Dark mode from system + localStorage
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = saved === 'dark' || (saved === null && systemDark);
    setDarkMode(isDark);
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, []);

  // Load preferences from localStorage
  useEffect(() => {
    const savedMode = localStorage.getItem('student_mode');
    const savedGrade = localStorage.getItem('student_grade');
    const savedCurriculum = localStorage.getItem('student_curriculum');
    const savedSubject = localStorage.getItem('student_subject');
    if (savedMode) setMode(savedMode);
    if (savedGrade) setGrade(savedGrade);
    if (savedCurriculum) setCurriculum(savedCurriculum);
    if (savedSubject) setSubject(savedSubject);
  }, []);

  // Save preferences to localStorage
  useEffect(() => {
    localStorage.setItem('student_mode', mode);
    if (grade) localStorage.setItem('student_grade', grade);
    if (curriculum) localStorage.setItem('student_curriculum', curriculum);
    if (subject) localStorage.setItem('student_subject', subject);
  }, [mode, grade, curriculum, subject]);

  // Responsive sidebar
  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setSidebarOpen(false);
      else setSidebarOpen(false);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Load profile
  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch('/api/student/profile', { credentials: 'include' });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message || 'Gagal memuat profil');
        setStudent(json.data);
        if (!grade) setGrade(json.data.grade?.toString() || '');
      } catch (err) {
        setError(err.message);
        if (err.message.includes('Unauthorized')) router.push('/student/login');
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [router, grade]);

  const loadRecentSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/student/recent-chats', { credentials: 'include' });
      const json = await res.json();
      if (res.ok && json.success) setRecentSessions(json.data || []);
    } catch (err) { console.error(err); }
  }, []);

  const loadLeaderboard = useCallback(async () => {
    if (!grade) return;
    try {
      const res = await fetch(`/api/student/leaderboard?grade=${grade}&limit=3`, { credentials: 'include' });
      const json = await res.json();
      if (res.ok && json.success) setLeaderboard(json.data || []);
    } catch (err) { console.error(err); }
  }, [grade]);

  useEffect(() => { if (student) loadRecentSessions(); }, [student, loadRecentSessions]);
  useEffect(() => { if (grade) loadLeaderboard(); }, [grade, loadLeaderboard]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 128) + 'px';
    }
  }, [inputText]);

  const handleNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
    if (isMobile) setSidebarOpen(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleLoadSession = async (sessionId) => {
    setActiveSessionId(sessionId);
    setMessages([]);
    try {
      const res = await fetch(`/api/student/session-messages?sessionId=${sessionId}`, { credentials: 'include' });
      const json = await res.json();
      if (res.ok && json.success) setMessages(json.data || []);
    } catch (err) { console.error(err); }
    if (isMobile) setSidebarOpen(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // Streaming sendMessage
  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage = { role: 'user', content: inputText, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputText;
    setInputText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setChatLoading(true);
    setError('');

    // Untuk mode Homework: tidak kirim grade & topic (biar AI fleksibel)
    const payload = {
      subject,
      mode,
      questionText: currentInput,
    };
    if (mode !== 'homework') {
      payload.grade = grade;
      payload.topic = topic || 'general';
    } else {
      payload.grade = '';
      payload.topic = '';
    }

    try {
      const res = await fetch('/api/student/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Gagal terhubung ke AI Tutor');

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      const aiMessageId = Date.now();
      let accumulatedText = '';

      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: '', created_at: new Date().toISOString(), id: aiMessageId, isStreaming: true }
      ]);
      setStreamingMessageId(aiMessageId);
      setChatLoading(false);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulatedText += chunk;
        setMessages(prev =>
          prev.map(msg =>
            msg.id === aiMessageId ? { ...msg, content: accumulatedText } : msg
          )
        );
      }

      setMessages(prev =>
        prev.map(msg =>
          msg.id === aiMessageId ? { ...msg, isStreaming: false } : msg
        )
      );
      setStreamingMessageId(null);
      await loadRecentSessions();
    } catch (err) {
      setError(err.message);
      setChatLoading(false);
    } finally {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/student/logout', { method: 'POST' });
    router.push('/student/login');
  };

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('theme', newMode ? 'dark' : 'light');
    if (newMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  };

  const handleOtherTopicAdd = () => {
    if (otherTopic.trim()) {
      setTopic(otherTopic.trim());
      setOtherTopic('');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Memuat dashboard...</div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Dashboard Siswa - MindSeek Edu</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=yes" />
      </Head>

      <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors duration-200">
        {/* Mobile overlay for sidebar */}
        {isMobile && sidebarOpen && (
          <div className="fixed inset-0 bg-black/40 z-20" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Top Bar – Gemini Style (tanpa dropdown subject) */}
        <div className="fixed top-0 left-0 right-0 z-30 bg-white/70 dark:bg-gray-900/70 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between px-4 py-3 max-w-7xl mx-auto">
            <div className="flex items-center gap-4">
              {/* Logo */}
              <div className="text-xl font-bold text-blue-600 dark:text-blue-400">MindSeek</div>
              <div className="h-6 w-px bg-gray-200 dark:bg-gray-700" />
              
              {/* Mode Dropdown (satu-satunya dropdown di top bar) */}
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="bg-transparent font-medium text-gray-800 dark:text-gray-200 text-base outline-none cursor-pointer"
              >
                <option value="homework">Homework</option>
                <option value="practice">Practice</option>
                <option value="exam">Exam</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              {/* Book icon to toggle sidebar (semua pengaturan ada di sini) */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
                title="Pengaturan Belajar"
              >
                <BookOpenIcon className="w-5 h-5" />
              </button>

              {/* Dark mode toggle */}
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
              >
                {darkMode ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
              </button>

              {/* Avatar */}
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                {student?.name?.charAt(0) || 'S'}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar (Settings) - muncul dari kanan, berisi semua kontrol */}
        <aside
          className={`fixed top-0 bottom-0 z-40 w-80 bg-white dark:bg-gray-800 shadow-xl border-l border-gray-200 dark:border-gray-700 transition-transform duration-300 flex flex-col ${
            sidebarOpen ? 'translate-x-0' : 'translate-x-full'
          } right-0`}
        >
          <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Pengaturan Belajar</h2>
            <button onClick={() => setSidebarOpen(false)} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kurikulum</label>
              <select
                value={curriculum}
                onChange={(e) => setCurriculum(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
              >
                <option>Kurikulum Merdeka</option>
                <option>Kurikulum 2013</option>
                <option>Cambridge</option>
                <option>IB</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Grade</label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
              >
                {[...Array(12)].map((_, i) => (
                  <option key={i+1}>{i+1}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
              >
                <option>Matematika</option>
                <option>Fisika</option>
                <option>Biologi</option>
                <option>Kimia</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Topic (Standar)</label>
              <select
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
              >
                <option value="">Pilih topik (opsional)</option>
                <option>Penjumlahan</option>
                <option>Pengurangan</option>
                <option>Perkalian</option>
                <option>Pembagian</option>
                <option>Pecahan</option>
                <option>Eksponen</option>
                <option>Logaritma</option>
                <option>Aljabar</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Other Topics</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={otherTopic}
                  onChange={(e) => setOtherTopic(e.target.value)}
                  placeholder="Tambah topik sendiri..."
                  className="flex-1 px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                />
                <button
                  onClick={handleOtherTopicAdd}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  +
                </button>
              </div>
              {otherTopic && <p className="text-xs text-gray-500 mt-1">Tekan + untuk menambah</p>}
            </div>
          </div>
          {/* Profile & XP di bawah sidebar (statis) */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <UserCircleIcon className="w-10 h-10 text-gray-400" />
              <div>
                <p className="font-semibold text-gray-800 dark:text-white">{student?.name || 'Siswa'}</p>
                <div className="flex gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <span>{student?.total_xp || 0} XP</span>
                  <span><FireIcon className="w-3 h-3 inline" /> {student?.current_streak || 0}</span>
                  <span><StarIcon className="w-3 h-3 inline" /> {student?.longest_streak || 0}</span>
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="mt-3 flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <ArrowRightOnRectangleIcon className="w-4 h-4" /> Keluar
            </button>
          </div>
        </aside>

        {/* Main Chat Area – Borderless Gemini Style */}
        <main className="pt-14">
          <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col min-h-[calc(100vh-56px)]">
            {/* Chat messages container */}
            <div className="flex-1 overflow-y-auto pb-6 space-y-8">
              {messages.length === 0 && !chatLoading ? (
                <div className="flex flex-col items-center justify-center text-center space-y-4 min-h-[60vh]">
                  <div className="text-7xl font-bold text-blue-600">🧠</div>
                  <h2 className="text-3xl md:text-4xl font-light text-gray-800 dark:text-gray-100">
                    Mulai belajar, {student?.name || 'Siswa'}.
                  </h2>
                  <p className="text-base md:text-lg text-gray-500 dark:text-gray-400">Siap membantu</p>
                </div>
              ) : (
                <>
                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[85%] text-base md:text-lg ${msg.role === 'user' ? 'text-gray-800 dark:text-white' : 'text-gray-700 dark:text-gray-200'}`}>
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                        {msg.xp && <div className="text-xs text-gray-400 mt-1">+{msg.xp} XP</div>}
                        {msg.isStreaming && <span className="gemini-streaming inline-block ml-1"></span>}
                      </div>
                    </div>
                  ))}
                  {chatLoading && !streamingMessageId && (
                    <div className="flex justify-start">
                      <div className="text-gray-500 dark:text-gray-400">Ai Mi sedang mengetik...</div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Floating Input Pill */}
            <div className="relative mt-auto pt-4">
              <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full shadow-sm focus-within:shadow-md transition">
                <div className="relative">
                  <button
                    onClick={() => setShowUploadPopup(!showUploadPopup)}
                    className="p-3 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
                  >
                    <PlusIcon className="w-5 h-5" />
                  </button>
                  {showUploadPopup && (
                    <div className="absolute bottom-full left-0 mb-2 w-44 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-1 z-50">
                      <button className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded-t-lg">
                        <CameraIcon className="w-4 h-4" /> Camera
                      </button>
                      <button className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700">
                        <PhotoIcon className="w-4 h-4" /> Gallery
                      </button>
                      <button className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded-b-lg">
                        <DocumentIcon className="w-4 h-4" /> File
                      </button>
                    </div>
                  )}
                </div>
                <textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Tanyakan soalmu dan dapatkan bantuan langkah demi langkah..."
                  rows={1}
                  className="flex-1 py-3 px-2 bg-transparent outline-none resize-none overflow-y-auto max-h-32 text-base text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                />
                <button
                  onClick={sendMessage}
                  disabled={!inputText.trim()}
                  className={`p-3 rounded-full transition ${
                    inputText.trim()
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <ArrowUpIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
