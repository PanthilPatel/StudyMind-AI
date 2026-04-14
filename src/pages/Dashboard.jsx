/**
 * Dashboard Page — Production-Grade Learning Interface (v2.1)
 * 
 * DESIGN: Indigo Spatial Minimalism
 * STATE: Robust / Async Sync
 * STABILITY: Memory-safe timers, Guarded math, Protected deck integrity
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../utils/supabaseClient';
import { generateWithGemini, TOOLS } from '../utils/gemini';
import { initiatePayment } from '../utils/razorpay';
import { markdownToHtml } from '../utils/markdown';
import './Dashboard.css';

export default function Dashboard() {
  const { user, profile, signOut, refreshProfile, isPro } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  // Refs for DOM and Timers
  const outputRef = useRef(null);
  const typewriterRef = useRef(null);
  const answerTimerRef = useRef(null); // IMPROVEMENT: Memory leak prevention
  const feedbackTimerRef = useRef(null);

  // --- Core UI State ---
  const [activeTool, setActiveTool] = useState('topic-explainer');
  const [activeView, setActiveView] = useState('tool'); // 'tool', 'history', 'analytics'
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [displayedOutput, setDisplayedOutput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  
  // --- History & Stats ---
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [usageCount, setUsageCount] = useState(0);
  const [userStreak, setUserStreak] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [utilityOpen, setUtilityOpen] = useState(true);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  
  // --- Flashcard & Study State ---
  const [originalFlashcards, setOriginalFlashcards] = useState([]); // FIX: Deck integrity
  const [flashcards, setFlashcards] = useState([]); // Active deck (subset or full)
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showFlashcards, setShowFlashcards] = useState(false);
  const [isGeneratingFlashcards, setIsGeneratingFlashcards] = useState(false);
  const [isStudyMode, setIsStudyMode] = useState(false);
  const [sessionFeedback, setSessionFeedback] = useState(null);
  const [studyResults, setStudyResults] = useState({ 
    correct: 0, 
    incorrect: 0, 
    total: 0, 
    showResults: false,
    weakCards: [] 
  });

  const [analytics, setAnalytics] = useState({
    totalRequests: 0, todayRequests: 0, toolBreakdown: {}, recentDays: [],
  });
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const currentTool = TOOLS.find(t => t.id === activeTool);
  const DAILY_LIMIT = 10;

  // --- Helper: Safe JSON Parsing ---
  // FIX: Robust handling of AI JSON with markdown backticks
  const safeParseFlashcards = (raw) => {
    try {
      const cleaned = raw.trim()
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      const parsed = JSON.parse(cleaned);
      if (!Array.isArray(parsed)) throw new Error("Output was not an array");
      return parsed.map(c => ({ 
        front: c.front || "Empty Question", 
        back: c.back || "Empty Answer", 
        known: false 
      }));
    } catch (e) {
      console.error("[Dashboard] Internal JSON Parse Error:", e, raw);
      return null;
    }
  };

  // --- Helper: Timer Cleanup ---
  // IMPROVEMENT: Centralized cleanup to prevent memory leaks
  const cleanupAllTimers = useCallback(() => {
    if (typewriterRef.current) clearInterval(typewriterRef.current);
    if (answerTimerRef.current) clearTimeout(answerTimerRef.current);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
  }, []);

  useEffect(() => {
    return () => cleanupAllTimers();
  }, [cleanupAllTimers]);

  // --- Math Safety Guards ---
  // FIX: Division by zero protection
  const getUsagePercentage = () => {
    if (DAILY_LIMIT === 0) return 0;
    return Math.min(Math.round((usageCount / DAILY_LIMIT) * 100), 100);
  };

  const getScorePercentage = () => {
    if (!flashcards || flashcards.length === 0) return 0;
    return Math.round((studyResults.correct / flashcards.length) * 100);
  };

  // --- Typewriter effect ---
  const typewriterEffect = useCallback((fullText) => {
    setIsTyping(true);
    setDisplayedOutput('');
    let index = 0;
    const chunkSize = 40; 

    if (typewriterRef.current) clearInterval(typewriterRef.current);

    typewriterRef.current = setInterval(() => {
      index += chunkSize;
      if (index >= fullText.length) {
        setDisplayedOutput(fullText);
        setIsTyping(false);
        clearInterval(typewriterRef.current);
      } else {
        setDisplayedOutput(fullText.substring(0, index));
      }
    }, 12);
  }, []);

  // --- Persistence & Sync (Local + Supabase) ---
  const getLocalData = (key, fallback) => {
    try {
      return JSON.parse(localStorage.getItem(key)) || fallback;
    } catch {
      return fallback;
    }
  };

  const saveLocalData = (key, data) => {
    localStorage.setItem(key, JSON.stringify(data));
  };

  useEffect(() => {
    if (user) {
      fetchUsage();
      fetchStreak();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function fetchUsage() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const localData = getLocalData(`studymind_usage_${user.id}`, null);
      const localCount = (localData?.last_reset_date === today) ? localData.daily_count : 0;
      
      setUsageCount(localCount);
      
      const { data, error } = await supabase.from('usage').select('*').eq('user_id', user.id).single();

      if (error && error.code === 'PGRST116') {
        await supabase.from('usage').insert({ user_id: user.id, daily_count: localCount, last_reset_date: today });
        return;
      }

      if (data) {
        const dbCount = (data.last_reset_date === today) ? data.daily_count : 0;
        const trueCount = Math.max(dbCount, localCount);
        setUsageCount(trueCount);
        saveLocalData(`studymind_usage_${user.id}`, { daily_count: trueCount, last_reset_date: today });
      }
    } catch (err) {
      console.error('Usage retrieval failed:', err);
    }
  }

  async function incrementUsage() {
    const today = new Date().toISOString().split('T')[0];
    const newCount = usageCount + 1;
    setUsageCount(newCount);
    saveLocalData(`studymind_usage_${user.id}`, { daily_count: newCount, last_reset_date: today });
    await supabase.from('usage').update({ daily_count: newCount, last_reset_date: today }).eq('user_id', user.id).catch(() => null);
  }

  async function fetchStreak() {
    try {
      const local = getLocalData(`studymind_streak_${user.id}`, { count: 0, last_date: null });
      setUserStreak(local.count);
      const { data } = await supabase.from('profiles').select('streak_count, last_study_date').eq('id', user.id).single();
      if (data && data.streak_count > local.count) {
        setUserStreak(data.streak_count);
        saveLocalData(`studymind_streak_${user.id}`, { count: data.streak_count, last_date: data.last_study_date });
      }
    } catch {}
  }

  async function handleUpdateStreak() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const local = getLocalData(`studymind_streak_${user.id}`, { count: 0, last_date: null });
      if (local.last_date === today) return;

      let newCount = local.count;
      const lastDate = local.last_date ? new Date(local.last_date) : null;
      const diffDays = lastDate ? Math.floor((new Date(today) - lastDate) / (1000 * 60 * 60 * 24)) : Infinity;

      newCount = (diffDays === 1) ? newCount + 1 : 1;
      setUserStreak(newCount);
      saveLocalData(`studymind_streak_${user.id}`, { count: newCount, last_date: today });
      await supabase.from('profiles').update({ streak_count: newCount, last_study_date: today }).eq('id', user.id).catch(() => null);
    } catch {}
  }

  // --- Generation Logic ---
  async function handleGenerate() {
    if (loading || !input.trim()) return; // FIX: API Spam protection
    if (!isPro && usageCount >= DAILY_LIMIT) {
      setError(`Daily limit reached (${DAILY_LIMIT}). Upgrade for unlimited access.`);
      return;
    }

    setLoading(true);
    setError('');
    setOutput('');
    setDisplayedOutput('');

    try {
      const result = await generateWithGemini(activeTool, input);
      
      if (activeTool === 'flashcard-generator') {
        const parsed = safeParseFlashcards(result);
        if (parsed) {
          setOriginalFlashcards(parsed); // FIX: Separate storage
          setFlashcards(parsed);
          setCurrentCardIndex(0);
          setIsFlipped(false);
          setShowFlashcards(true);
          setOutput('Cards generated. Ready for study.');
          setDisplayedOutput('Cards generated. Ready for study.');
        } else {
          throw new Error("The AI returned a messy response. Please try being more specific.");
        }
      } else {
        setOutput(result);
        typewriterEffect(result);
      }
      
      incrementUsage().catch(console.error);
      saveToHistory(result).catch(console.error);
    } catch (err) {
      setError(err.message || 'Operation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateFlashcards() {
    if (isGeneratingFlashcards || !output.trim()) return; // FIX: API Spam protection
    setIsGeneratingFlashcards(true);
    setError('');
    
    try {
      const result = await generateWithGemini('flashcard-generator', output);
      const parsed = safeParseFlashcards(result);
      if (parsed) {
        setOriginalFlashcards(parsed); // FIX: Separate storage
        setFlashcards(parsed);
        setCurrentCardIndex(0);
        setIsFlipped(false);
        setShowFlashcards(true);
      } else {
        throw new Error("Could not extract cards from this output. Try a different topic.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsGeneratingFlashcards(false);
    }
  }

  // --- Flashcard Control ---
  const handleNav = (dir) => {
    if (!flashcards || flashcards.length === 0) return;
    const newIdx = currentCardIndex + dir;
    if (newIdx >= 0 && newIdx < flashcards.length) {
      setCurrentCardIndex(newIdx);
      setIsFlipped(false);
    }
  };

  const handleMarkKnown = () => {
    setFlashcards(prev => {
      const updated = [...prev];
      if (updated[currentCardIndex]) updated[currentCardIndex].known = !updated[currentCardIndex].known;
      return updated;
    });
  };

  // --- Study Mode Logic ---
  const handleStartStudy = (isReviewOnly = false) => {
    // FIX: Use originalFlashcards to restore full deck if needed
    const starterDeck = isReviewOnly ? studyResults.weakCards : originalFlashcards;
    
    if (!starterDeck || starterDeck.length === 0) return;

    setStudyResults(prev => ({
      ...prev,
      correct: 0,
      incorrect: 0,
      total: starterDeck.length,
      showResults: false,
      weakCards: []
    }));
    
    setFlashcards(starterDeck);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setIsStudyMode(true);
  };

  const handleAnswer = (isCorrect) => {
    if (sessionFeedback) return; // FIX: Prevent spam during auto-advance

    setSessionFeedback(isCorrect ? 'Correct! ✨' : 'Review this 🧠');
    
    setStudyResults(prev => {
      const updated = { ...prev };
      if (isCorrect) updated.correct += 1;
      else {
        updated.incorrect += 1;
        updated.weakCards = [...updated.weakCards, flashcards[currentCardIndex]];
      }
      return updated;
    });

    answerTimerRef.current = setTimeout(() => {
      setSessionFeedback(null);
      if (currentCardIndex < flashcards.length - 1) {
        setCurrentCardIndex(prev => prev + 1);
        setIsFlipped(false);
      } else {
        setStudyResults(prev => ({ ...prev, showResults: true }));
        handleUpdateStreak();
      }
    }, 500);
  };

  const handleRestartStudy = () => {
    handleStartStudy(false); // Restore original deck from originalFlashcards
  };

  const handleExitStudyMode = () => {
    cleanupAllTimers();
    setIsStudyMode(false);
    setShowFlashcards(false);
    setFlashcards(originalFlashcards); // Restore main deck view
    setStudyResults(prev => ({ ...prev, showResults: false }));
  };

  // --- View Management & DB Calls ---
  async function saveToHistory(outputText) {
    try {
      const newItem = {
        user_id: user.id, tool_used: activeTool, input_text: input, output_text: outputText,
      };
      await supabase.from('history').insert(newItem).catch(() => null);
    } catch {}
  }

  async function fetchHistory() {
    setHistoryLoading(true);
    try {
      let query = supabase.from('history').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      if (!isPro) {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        query = query.gte('created_at', sevenDaysAgo.toISOString());
      }
      const { data } = await query.limit(50);
      setHistory(data || []);
    } catch (err) {
      console.error('History fetch failed:', err);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function fetchAnalytics() {
    setAnalyticsLoading(true);
    try {
      const { data } = await supabase.from('history').select('tool_used, created_at').eq('user_id', user.id);
      processAnalytics(data || []);
    } catch {
      processAnalytics(history);
    } finally {
      setAnalyticsLoading(false);
    }
  }

  function processAnalytics(items) {
    const today = new Date().toISOString().split('T')[0];
    const toolBreakdown = {};
    TOOLS.forEach(t => { toolBreakdown[t.id] = 0; });
    items.forEach(item => { toolBreakdown[item.tool_used] = (toolBreakdown[item.tool_used] || 0) + 1; });
    const todayRequests = items.filter(item => item.created_at?.split('T')[0] === today).length;
    
    const recentDays = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const count = items.filter(item => item.created_at?.split('T')[0] === dateStr).length;
      recentDays.push({ label: d.toLocaleDateString([], { weekday: 'short' }), count });
    }
    setAnalytics({ totalRequests: items.length, todayRequests, toolBreakdown, recentDays });
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { console.error("Clipboard failed"); }
  };

  const handleExportPDF = async () => {
    if (!isPro) {
      setError('PDF export is a Pro feature.');
      return;
    }
    try {
      const element = outputRef.current;
      if (!element) return;
      html2pdf().set({
        margin: [10, 10], filename: `studymind-${activeTool}.pdf`,
        html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4' }
      }).from(element).save();
    } catch { setError('PDF export failed.'); }
  };

  const handleUpgrade = () => {
    setUpgradeLoading(true);
    initiatePayment({
      userEmail: user?.email,
      onSuccess: async (pd) => {
        await supabase.from('profiles').update({ plan: 'pro', payment_id: pd.paymentId }).eq('id', user.id);
        await refreshProfile();
        setUpgradeLoading(false);
      },
      onError: () => setUpgradeLoading(false),
    });
  };

  const openTool = (id) => {
    cleanupAllTimers();
    setActiveTool(id);
    setActiveView('tool');
    setOutput('');
    setDisplayedOutput('');
    setInput('');
    setError('');
    setSidebarOpen(false);
  };

  return (
    <div className={`dashboard ${utilityOpen ? 'utility-open' : ''}`}>
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <span className="logo-icon-main">✦</span>
          <span className="sidebar-logo-text">StudyMind</span>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-group">
            <span className="sidebar-group-label">STUDY TOOLS</span>
            {TOOLS.map(tool => (
              <button
                key={tool.id}
                className={`sidebar-link ${activeTool === tool.id && activeView === 'tool' ? 'active' : ''}`}
                onClick={() => openTool(tool.id)}
              >
                <span className="sidebar-link-icon">{tool.icon}</span>
                <span className="sidebar-link-text">{tool.name}</span>
              </button>
            ))}
          </div>

          <div className="sidebar-divider" />

          <div className="sidebar-group">
            <span className="sidebar-group-label">ACCOUNT</span>
            <button className={`sidebar-link ${activeView === 'analytics' ? 'active' : ''}`} onClick={() => { setActiveView('analytics'); fetchAnalytics(); }}>
              <span className="sidebar-link-icon">📊</span>
              <span className="sidebar-link-text">Analytics</span>
            </button>
            <button className={`sidebar-link ${activeView === 'history' ? 'active' : ''}`} onClick={() => { setActiveView('history'); fetchHistory(); }}>
              <span className="sidebar-link-icon">📋</span>
              <span className="sidebar-link-text">History</span>
            </button>
            <button className="sidebar-link" onClick={toggleTheme}>
              <span className="sidebar-link-icon">{theme === 'dark' ? '☀️' : '🌙'}</span>
              <span className="sidebar-link-text">{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>
          </div>
        </nav>

        <div className="sidebar-footer">
          <button className="sidebar-link sidebar-signout-link" onClick={async () => { await signOut(); navigate('/'); }}>
            <span className="sidebar-link-icon">🚪</span>
            <span className="sidebar-link-text">Sign Out</span>
          </button>
        </div>
      </aside>

      <div className="dashboard-content">
        <header className="dashboard-top-bar">
          <div className="top-bar-actions">
            {userStreak > 0 && (
              <div className="streak-badge-elite animate-in">
                <span className="streak-icon">🔥</span>
                <span className="streak-count">{userStreak}</span>
              </div>
            )}
            <div className="user-profile-badge">
              <span className="user-email">{user?.email}</span>
              <div className="user-avatar">{user?.email?.charAt(0).toUpperCase()}</div>
            </div>
          </div>
        </header>

        <main className="dashboard-main">
          <div className="content-container">
            {activeView === 'tool' && (
              <div className="tool-focus-area animate-in">
                <header className="tool-header">
                  <h1 className="tool-title">{currentTool?.name}</h1>
                  <p className="tool-description">{currentTool?.description}</p>
                </header>

                <div className={`tool-composition-card ${!isPro && usageCount >= DAILY_LIMIT ? 'limit-reached' : ''}`}>
                  <textarea
                    className="tool-input-textarea"
                    placeholder={currentTool?.placeholder}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={loading || (!isPro && usageCount >= DAILY_LIMIT)}
                  />
                  
                  {!isPro && usageCount >= DAILY_LIMIT && (
                    <div className="usage-limit-warning">
                      <p>🔒 Daily limit reached. Upgrade for unlimited access.</p>
                      <button className="btn btn-primary" onClick={handleUpgrade}>Upgrade to Pro</button>
                    </div>
                  )}

                  <div className="tool-control-bar">
                    <button
                      className="btn-generate-dominant"
                      onClick={handleGenerate}
                      disabled={loading || !input.trim() || (!isPro && usageCount >= DAILY_LIMIT)}
                    >
                      {loading ? 'Generating...' : 'Generate Content'}
                    </button>
                  </div>
                </div>

                {error && <div className="tool-error-status">⚠️ {error}</div>}

                {loading && (
                  <div className="tool-skeleton-shimmer">
                    <div className="skeleton-line-long" />
                    <div className="skeleton-line-med" />
                  </div>
                )}

                {displayedOutput && !loading && (
                  <div className="tool-output-card animate-in">
                    <header className="output-header">
                      <h3>Results</h3>
                      <div className="output-control-group">
                        <button className="btn-secondary-sm" onClick={handleCopy}>{copied ? 'Copied' : 'Copy'}</button>
                        <button className="btn-secondary-sm" onClick={handleExportPDF}>PDF {!isPro && '🔒'}</button>
                        <button className="btn-accent-sm" onClick={handleGenerateFlashcards} disabled={isGeneratingFlashcards}>
                          {isGeneratingFlashcards ? '...' : '⚡ Flashcard Pro'}
                        </button>
                      </div>
                    </header>
                    <div ref={outputRef} className={`output-body ${isTyping ? 'is-typing' : ''}`} dangerouslySetInnerHTML={{ __html: markdownToHtml(displayedOutput) }} />
                  </div>
                )}
              </div>
            )}

            {activeView === 'analytics' && (
              <div className="view-center-constraint animate-in">
                <h2 className="view-header-title">Analytics</h2>
                <div className="analytics-summary-grid">
                  <div className="elite-stat-card"><span className="stat-label">Total Requests</span><span className="stat-value">{analytics.totalRequests}</span></div>
                  <div className="elite-stat-card"><span className="stat-label">Today</span><span className="stat-value">{analytics.todayRequests}</span></div>
                </div>
              </div>
            )}

            {activeView === 'history' && (
              <div className="view-center-constraint animate-in">
                <h2 className="view-header-title">History</h2>
                <div className="history-stack">
                  {history.map(item => (
                    <div key={item.id} className="history-item-card" onClick={() => { setInput(item.input_text); setOutput(item.output_text); setDisplayedOutput(item.output_text); setActiveView('tool'); }}>
                      <span className="history-tag">{TOOLS.find(t => t.id === item.tool_used)?.name}</span>
                      <p className="history-text-preview">{item.input_text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      <aside className={`utility-side-panel ${utilityOpen ? 'open' : ''}`}>
        <div className="utility-card-stack">
          {!isPro && (
            <section className="utility-section-card">
              <h4 className="card-heading">DAILY USAGE</h4>
              <div className="usage-meter-container">
                <div className="usage-numeric-stats">
                  <span>{usageCount} / {DAILY_LIMIT}</span>
                  <span>{getUsagePercentage()}%</span>
                </div>
                <div className="progress-track-bg">
                  <div className="progress-fill-active" style={{ width: `${getUsagePercentage()}%` }} />
                </div>
              </div>
            </section>
          )}

          <section className="utility-section-card highlight-card">
            <h4 className="card-heading">{isPro ? 'ELITE ACCESS' : 'PRO ACCESS'}</h4>
            <p className="card-context-text">{isPro ? 'You have unlimited power. Explore without limits.' : 'Unlock unlimited generations and PDF exports.'}</p>
            {!isPro && <button className="btn-primary-full" onClick={handleUpgrade} disabled={upgradeLoading}>{upgradeLoading ? '...' : 'Upgrade Now'}</button>}
          </section>
        </div>
      </aside>

      <button className="utility-floating-toggle" onClick={() => setUtilityOpen(!utilityOpen)}>{utilityOpen ? '✕' : '📊'}</button>
      
      {showFlashcards && flashcards.length > 0 && (
        <div className={`flashcard-overlay animate-in ${isStudyMode ? 'study-mode-active' : ''}`}>
          <div className="overlay-backdrop" onClick={handleExitStudyMode} />
          
          <div className="flashcard-container">
            <header className="flashcard-header">
              <div className="flashcard-progress">
                {isStudyMode ? <span className="study-tag">Study Session</span> : <><span className="current">{currentCardIndex + 1}</span><span className="total">/ {flashcards.length}</span></>}
              </div>
              <button className="close-overlay" onClick={handleExitStudyMode}>✕</button>
            </header>

            {studyResults.showResults ? (
              <div className="study-results-screen animate-in">
                <div className="circular-progress">
                  <span className="score-num">{studyResults.correct}</span>
                  <span className="score-total">/ {studyResults.total}</span>
                  <div className="score-percent-badge">{getScorePercentage()}%</div>
                </div>
                <h2 className="results-title">Session Complete!</h2>
                <div className="results-actions">
                  {studyResults.weakCards.length > 0 && <button className="btn-secondary-full" onClick={() => handleStartStudy(true)}>Review Weak Cards ({studyResults.weakCards.length})</button>}
                  <button className="btn-primary-full" onClick={handleRestartStudy}>Restart Full Session</button>
                  <button className="btn-link-action" onClick={handleExitStudyMode}>Exit to Overview</button>
                </div>
              </div>
            ) : (
              <>
                {isStudyMode && <div className="study-mini-progress">Card {currentCardIndex + 1} of {flashcards.length}</div>}
                <div className={`flashcard ${isFlipped ? 'flipped' : ''}`} onClick={() => setIsFlipped(!isFlipped)}>
                  <div className="flashcard-inner">
                    <div className="flashcard-face front">
                      <div className="card-label">QUESTION</div>
                      <div className="card-content">{flashcards[currentCardIndex]?.front}</div>
                      <div className="card-hint">Tap to see answer</div>
                      {sessionFeedback && <div className="feedback-toast-inner animate-in">{sessionFeedback}</div>}
                    </div>
                    <div className="flashcard-face back">
                      <div className="card-label">ANSWER</div>
                      <div className="card-content">{flashcards[currentCardIndex]?.back}</div>
                      <div className="card-hint">Tap to flip back</div>
                    </div>
                  </div>
                </div>
                <footer className="flashcard-controls">
                  {isStudyMode ? (
                    <div className="study-actions-group">
                      <button className="btn-study-action btn-incorrect" onClick={(e) => { e.stopPropagation(); handleAnswer(false); }}>Needs Review</button>
                      <button className="btn-study-action btn-correct" onClick={(e) => { e.stopPropagation(); handleAnswer(true); }}>I Knew This</button>
                    </div>
                  ) : (
                    <>
                      <button className="btn-nav" onClick={(e) => { e.stopPropagation(); handleNav(-1); }} disabled={currentCardIndex === 0}>←</button>
                      <button className="btn-study-prime" onClick={(e) => { e.stopPropagation(); handleStartStudy(); }}>Start Study Session</button>
                      <button className="btn-nav" onClick={(e) => { e.stopPropagation(); handleNav(1); }} disabled={currentCardIndex === flashcards.length - 1}>→</button>
                    </>
                  )}
                </footer>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
