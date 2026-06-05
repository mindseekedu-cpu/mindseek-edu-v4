import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function StudentDashboardPage() {
  const router = useRouter();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [language, setLanguage] = useState('id');
  const [showSettings, setShowSettings] = useState(false);
  const [showUploadPopup, setShowUploadPopup] = useState(false);

  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const [subject, setSubject] = useState('Matematika');
  const [grade, setGrade] = useState('');
  const [topic, setTopic] = useState('');
  const [mode, setMode] = useState('homework');

  const [recentSessions, setRecentSessions] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);

  // Dark mode system preference
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = savedTheme === 'dark' || (savedTheme === null && systemDark);
    setDarkMode(isDark);
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, []);

  // Responsive sidebar
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setSidebarOpen(true);
      else setSidebarOpen(false);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load profile
  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch('/api/student/profile', { credentials: 'include' });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message || 'Gagal memuat profil');
        setStudent(json.data);
        setGrade(json.data.grade?.toString() || '');
      } catch (err) {
        setError(err.message);
        if (err.message.includes('Unauthorized')) router.push('/student/login');
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [router]);

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

  const sendMessage = async () => {
    if (!inputText.trim()) return;
    const userMessage = { role: 'user', content: inputText, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setChatLoading(true);
    try {
      const res = await fetch('/api/student/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ subject, topic: topic || 'general', grade, mode, questionText: inputText, clueUsedCount: 0, attempts: 1 }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Gagal mengirim pesan');
      const aiMessage = { role: 'assistant', content: json.data.response, created_at: new Date().toISOString(), xp: json.data.xpEarned };
      setMessages(prev => [...prev, aiMessage]);
      await loadRecentSessions();
    } catch (err) { setError(err.message); } finally { setChatLoading(false); }
    setTimeout(() => inputRef.current?.focus(), 100);
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

  const t = {
    newChat: language === 'id' ? 'Obrolan Baru' : 'New Chat',
    recentChats: language === 'id' ? 'Riwayat Chat' : 'Recent Chats',
    leaderboard: language === 'id' ? 'Papan Peringkat' : 'Leaderboard',
    viewAll: language === 'id' ? 'Lihat semua' : 'View all',
    logout: language === 'id' ? 'Keluar' : 'Logout',
    darkMode: language === 'id' ? 'Mode Gelap' : 'Dark Mode',
    lightMode: language === 'id' ? 'Mode Terang' : 'Light Mode',
    subject: language === 'id' ? 'Mata Pelajaran' : 'Subject',
    grade: language === 'id' ? 'Kelas' : 'Grade',
    topic: language === 'id' ? 'Topik' : 'Topic',
    placeholder: language === 'id' ? 'Tanyakan soalmu dan dapatkan bantuan langkah demi langkah...' : 'Ask your question and get step-by-step help...',
    greeting: language === 'id' ? 'Mulai belajar,' : 'Let\'s start in,',
    ready: language === 'id' ? 'Siap membantu' : 'Ready when you are',
  };

  if (loading) return <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center text-gray-900 dark:text-white">Memuat dashboard...</div>;

  return (
    <>
      <Head><title>Dashboard Siswa - MindSeek Edu</title></Head>
      <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors duration-200">
        {/* Mobile overlay */}
        {isMobile && sidebarOpen && (
          <div className="fixed inset-0 bg-black/50 z-20" onClick={() => setSidebarOpen(false)}></div>
        )}

        {/* Top Bar */}
        <div className="fixed top-0 left-0 right-0 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between px-4 py-3 max-w-7xl mx-auto">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-2xl text-gray-700 dark:text-gray-200">
              ☰
            </button>
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-full p-1">
              {['homework', 'practice', 'exam'].map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-full transition ${
                    mode === m
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {m === 'homework' ? 'Homework' : m === 'practice' ? 'Practice' : 'Exam'}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setLanguage('id')} className={`px-2 py-1 text-sm font-medium rounded ${language === 'id' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400'}`}>ID</button>
              <button onClick={() => setLanguage('en')} className={`px-2 py-1 text-sm font-medium rounded ${language === 'en' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400'}`}>EN</button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <aside className={`fixed top-14 bottom-0 z-20 w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-transform duration-300 flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${isMobile ? 'shadow-xl' : ''}`}>
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            <button onClick={handleNewChat} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white text-base font-semibold rounded-xl transition">💬 {t.newChat}</button>
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{t.recentChats}</h3>
              <div className="space-y-1">
                {recentSessions.slice(0,10).map(s => (
                  <button key={s.id} onClick={() => handleLoadSession(s.id)} className="w-full text-left px-3 py-2 rounded-lg text-base text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2">
                    💬 <span className="truncate">{s.topic || 'Diskusi'}</span>
                  </button>
                ))}
                {recentSessions.length===0 && <p className="text-sm text-gray-400 px-3 py-2">Belum ada chat</p>}
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-3"><h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t.leaderboard}</h3><button onClick={() => router.push('/student/leaderboard')} className="text-xs text-blue-600 hover:underline">{t.viewAll}</button></div>
              <div className="space-y-2">
                {leaderboard.map(item => (
                  <div key={item.rank} className="flex justify-between text-sm"><span className="text-gray-500 w-6">#{item.rank}</span><span className="flex-1 text-gray-800 dark:text-gray-200 truncate">{item.name}</span><span className="text-gray-600 dark:text-gray-400">{item.total_xp} XP</span></div>
                ))}
              </div>
            </div>
          </div>
          {/* Profile & Settings */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-xl">👤</div>
                <div className="text-sm">
                  <p className="font-semibold text-gray-800 dark:text-white">{student?.name || 'Siswa'}</p>
                  <div className="flex gap-3 text-xs text-gray-500 dark:text-gray-400"><span>{student?.total_xp || 0} XP</span><span>🔥 {student?.current_streak || 0}</span><span>⭐ {student?.longest_streak || 0}</span><span>👑 0</span></div>
                </div>
              </div>
              <div className="relative">
                <button onClick={() => setShowSettings(!showSettings)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">⚙️</button>
                {showSettings && (
                  <div className="absolute bottom-full right-0 mb-2 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-3 z-30">
                    <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">📚 {t.subject}</div>
                    <select value={subject} onChange={e=>setSubject(e.target.value)} className="w-full px-3 py-2 text-sm border rounded-lg mb-3 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"><option>Matematika</option><option>Fisika</option><option>Biologi</option><option>Kimia</option></select>
                    <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">🎓 {t.grade}</div>
                    <select value={grade} onChange={e=>setGrade(e.target.value)} className="w-full px-3 py-2 text-sm border rounded-lg mb-3 bg-white dark:bg-gray-700 text-gray-800 dark:text-white">{[...Array(12)].map((_,i)=><option key={i+1}>{i+1}</option>)}</select>
                    <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">📖 {t.topic}</div>
                    <input type="text" value={topic} onChange={e=>setTopic(e.target.value)} placeholder="Opsional" className="w-full px-3 py-2 text-sm border rounded-lg mb-3 bg-white dark:bg-gray-700 text-gray-800 dark:text-white" />
                    <button onClick={toggleDarkMode} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg mb-2">{darkMode ? '☀️' : '🌙'} {darkMode ? t.lightMode : t.darkMode}</button>
                    <button onClick={handleLogout} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">🚪 {t.logout}</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* Main Chat Area */}
        <main className={`pt-14 transition-all duration-300 ${!isMobile && sidebarOpen ? 'ml-80' : 'ml-0'}`}>
          <div className="max-w-3xl mx-auto px-4 pb-32 pt-8 flex flex-col min-h-[calc(100vh-56px)]">
            {messages.length === 0 && !chatLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-5">
                <div className="w-32 h-32 flex items-center justify-center text-6xl font-bold text-blue-600">🧠</div>
                <h2 className="text-3xl font-light text-gray-800 dark:text-gray-200">{t.greeting} {student?.name || 'Siswa'}.</h2>
                <p className="text-base text-gray-400">{t.ready}</p>
              </div>
            ) : (
              <div className="flex-1 space-y-5 pb-6">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-5 py-3 text-base ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'}`}>
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                      {msg.xp && <p className="text-xs mt-1 opacity-70">+{msg.xp} XP</p>}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-5 py-3">
                      <div className="flex gap-1"><span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span><span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:'150ms'}}></span><span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:'300ms'}}></span></div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}

            {/* Floating Input Pill */}
            <div className="relative mt-4">
              <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full shadow-sm">
                <div className="relative">
                  <button onClick={() => setShowUploadPopup(!showUploadPopup)} className="p-3 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 text-xl">➕</button>
                  {showUploadPopup && (
                    <div className="absolute bottom-full left-0 mb-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-1 z-50">
                      <button className="flex items-center gap-3 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-t-lg">📷 Camera</button>
                      <button className="flex items-center gap-3 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">🖼️ Gallery</button>
                      <button className="flex items-center gap-3 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-b-lg">📁 File</button>
                    </div>
                  )}
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder={t.placeholder}
                  className="flex-1 py-3 px-3 bg-transparent outline-none text-base text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                />
                <button onClick={sendMessage} disabled={!inputText.trim()} className={`p-3 rounded-full transition text-xl ${inputText.trim() ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-gray-400 cursor-not-allowed'}`}>↑</button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
