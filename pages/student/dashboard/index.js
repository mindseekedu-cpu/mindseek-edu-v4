import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function StudentDashboardPage() {
  const router = useRouter();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [language, setLanguage] = useState('id');
  const [showSettings, setShowSettings] = useState(false);
  const [showUploadPopup, setShowUploadPopup] = useState(false);

  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const [subject, setSubject] = useState('Matematika');
  const [grade, setGrade] = useState('');
  const [topic, setTopic] = useState('');
  const [mode, setMode] = useState('homework');

  const [recentSessions, setRecentSessions] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

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
  };

  const sendMessage = async () => {
    if (!inputText.trim()) return;
    const userMessage = { role: 'user', content: inputText, createdAt: new Date().toISOString() };
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
      const aiMessage = { role: 'assistant', content: json.data.response, createdAt: new Date().toISOString(), xp: json.data.xpEarned };
      setMessages(prev => [...prev, aiMessage]);
      await loadRecentSessions();
    } catch (err) { setError(err.message); } finally { setChatLoading(false); }
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

  if (loading) return <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">Memuat dashboard...</div>;

  return (
    <>
      <Head><title>Dashboard Siswa - MindSeek Edu</title></Head>
      <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors duration-200">
        {/* Top Bar */}
        <div className="fixed top-0 left-0 right-0 z-20 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between px-4 py-3 max-w-7xl mx-auto">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-xl">
              {sidebarOpen ? '✕' : '☰'}
            </button>
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-full p-1">
              <button onClick={() => setMode('homework')} className={`px-4 py-1.5 text-sm font-medium rounded-full ${mode === 'homework' ? 'bg-white dark:bg-gray-700 shadow-sm' : 'text-gray-500'}`}>Homework</button>
              <button onClick={() => setMode('practice')} className={`px-4 py-1.5 text-sm font-medium rounded-full ${mode === 'practice' ? 'bg-white dark:bg-gray-700 shadow-sm' : 'text-gray-500'}`}>Practice</button>
              <button onClick={() => setMode('exam')} className={`px-4 py-1.5 text-sm font-medium rounded-full ${mode === 'exam' ? 'bg-white dark:bg-gray-700 shadow-sm' : 'text-gray-500'}`}>Exam</button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setLanguage('id')} className={`px-2 py-1 text-sm rounded ${language === 'id' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700' : 'text-gray-500'}`}>ID</button>
              <button onClick={() => setLanguage('en')} className={`px-2 py-1 text-sm rounded ${language === 'en' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700' : 'text-gray-500'}`}>EN</button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <aside className={`fixed top-14 left-0 bottom-0 z-10 w-72 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            <button onClick={handleNewChat} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium">💬 {t.newChat}</button>
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">{t.recentChats}</h3>
              <div className="space-y-1">
                {recentSessions.slice(0,10).map(s => (
                  <button key={s.id} className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2">💬 <span className="truncate">{s.topic || 'Diskusi'}</span></button>
                ))}
                {recentSessions.length===0 && <p className="text-xs text-gray-400 px-3 py-2">Belum ada chat</p>}
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-3"><h3 className="text-xs font-semibold text-gray-400 uppercase">{t.leaderboard}</h3><button onClick={() => router.push('/student/leaderboard')} className="text-xs text-blue-600">{t.viewAll}</button></div>
              <div className="space-y-2">{leaderboard.map(item => (<div key={item.rank} className="flex justify-between text-xs"><span className="text-gray-500 w-6">#{item.rank}</span><span className="flex-1 text-gray-700 dark:text-gray-300 truncate">{item.name}</span><span className="text-gray-500">{item.total_xp} XP</span></div>))}</div>
            </div>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">👤</div><div className="text-sm"><p className="font-medium">{student?.name || 'Siswa'}</p><div className="flex gap-3 text-xs text-gray-500"><span>{student?.total_xp || 0} XP</span><span>🔥 {student?.current_streak || 0}</span><span>⭐ {student?.longest_streak || 0}</span><span>👑 0</span></div></div></div>
              <div className="relative"><button onClick={() => setShowSettings(!showSettings)} className="p-2 rounded-lg hover:bg-gray-100">⚙️</button>{showSettings && (<div className="absolute bottom-full right-0 mb-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-lg border p-2 z-20"><div className="px-3 py-2 text-sm font-medium">📚 {t.subject}</div><select value={subject} onChange={e=>setSubject(e.target.value)} className="w-full px-3 py-2 text-sm border rounded-lg"><option>Matematika</option><option>Fisika</option><option>Biologi</option><option>Kimia</option></select><div className="px-3 py-2 text-sm font-medium">🎓 {t.grade}</div><select value={grade} onChange={e=>setGrade(e.target.value)} className="w-full px-3 py-2 text-sm border rounded-lg">{[...Array(12)].map((_,i)=><option key={i+1}>{i+1}</option>)}</select><div className="px-3 py-2 text-sm font-medium">📖 {t.topic}</div><input type="text" value={topic} onChange={e=>setTopic(e.target.value)} placeholder="Opsional" className="w-full px-3 py-2 text-sm border rounded-lg" /><button onClick={toggleDarkMode} className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-100 rounded-lg">{darkMode ? '☀️' : '🌙'} {darkMode ? t.lightMode : t.darkMode}</button><button onClick={handleLogout} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-gray-100 rounded-lg">🚪 {t.logout}</button></div>)}</div>
            </div>
          </div>
        </aside>

        <main className={`pt-14 transition-all duration-300 ${sidebarOpen ? 'ml-72' : 'ml-0'}`}>
          <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col min-h-[calc(100vh-56px)]">
            {messages.length === 0 && !chatLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-24 h-24 flex items-center justify-center text-4xl font-bold text-blue-600">🧠</div>
                <h2 className="text-2xl font-light text-gray-800 dark:text-gray-200">{t.greeting} {student?.name || 'Siswa'}.</h2>
                <p className="text-sm text-gray-400">{t.ready}</p>
              </div>
            ) : (
              <div className="flex-1 space-y-4 pb-4">
                {messages.map((msg, idx) => (<div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[80%] rounded-2xl px-4 py-2 ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'}`}><p className="text-sm whitespace-pre-wrap">{msg.content}</p>{msg.xp && <p className="text-xs mt-1 opacity-70">+{msg.xp} XP</p>}</div></div>))}
                {chatLoading && (<div className="flex justify-start"><div className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-2"><div className="flex gap-1"><span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span><span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:'150ms'}}></span><span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:'300ms'}}></span></div></div></div>)}
                <div ref={messagesEndRef} />
              </div>
            )}

            <div className="relative mt-4">
              <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full shadow-sm">
                <div className="relative"><button onClick={() => setShowUploadPopup(!showUploadPopup)} className="p-3 rounded-full hover:bg-gray-100">➕</button>{showUploadPopup && (<div className="absolute bottom-full left-0 mb-2 w-44 bg-white dark:bg-gray-800 rounded-xl shadow-lg border p-2 z-20"><button className="flex items-center gap-3 w-full px-3 py-2 text-sm hover:bg-gray-100 rounded-t-lg">📷 Camera</button><button className="flex items-center gap-3 w-full px-3 py-2 text-sm hover:bg-gray-100">🖼️ Gallery</button><button className="flex items-center gap-3 w-full px-3 py-2 text-sm hover:bg-gray-100 rounded-b-lg">📁 File</button></div>)}</div>
                <input type="text" value={inputText} onChange={e=>setInputText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendMessage()} placeholder={t.placeholder} className="flex-1 py-3 px-2 bg-transparent outline-none text-sm" />
                <button onClick={sendMessage} disabled={!inputText.trim()} className={`p-3 rounded-full transition ${inputText.trim() ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-gray-400 cursor-not-allowed'}`}>↑</button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
