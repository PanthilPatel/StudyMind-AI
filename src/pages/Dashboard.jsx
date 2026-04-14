/**
 * Dashboard Page — Main Product Interface (v2)
 * 
 * Improvements:
 * - Analytics dashboard with usage stats and history breakdown
 * - Skeleton loaders for loading states
 * - Typewriter animation for AI output
 * - Cleaner state management
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
  const outputRef = useRef(null);
  const typewriterRef = useRef(null);

  // State
  const [activeTool, setActiveTool] = useState('topic-explainer');
  const [activeView, setActiveView] = useState('tool'); // 'tool', 'history', 'analytics'
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [displayedOutput, setDisplayedOutput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [usageCount, setUsageCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [utilityOpen, setUtilityOpen] = useState(true); // Default open on desktop
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  
  // Flashcard State
  const [flashcards, setFlashcards] = useState([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showFlashcards, setShowFlashcards] = useState(false);
  const [isGeneratingFlashcards, setIsGeneratingFlashcards] = useState(false);
  
  // Study Mode & Streak State
  const [isStudyMode, setIsStudyMode] = useState(false);
  const [sessionFeedback, setSessionFeedback] = useState(null);
  const [studyResults, setStudyResults] = useState({ 
    correct: 0, 
    incorrect: 0, 
    total: 0, 
    showResults: false,
    weakCards: [] 
  });
  const [userStreak, setUserStreak] = useState(0);

  // Analytics state
  const [analytics, setAnalytics] = useState({
    totalRequests: 0,
    todayRequests: 0,
    toolBreakdown: {},
    recentDays: [],
  });
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const currentTool = TOOLS.find(t => t.id === activeTool);
  const DAILY_LIMIT = 10;

  // --- Typewriter effect ---
  const typewriterEffect = useCallback((fullText) => {
    setIsTyping(true);
    setDisplayedOutput('');
    let index = 0;
    const chunkSize = 40; // Sped up significantly so users don't wait for text

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

    return () => clearInterval(typewriterRef.current);
  }, []);

  // Cleanup typewriter on unmount
  useEffect(() => {
    return () => {
      if (typewriterRef.current) clearInterval(typewriterRef.current);
    };
  }, []);

  // --- Local Storage Helpers ---
  function getLocalHistory(uid) {
    return JSON.parse(localStorage.getItem(`studymind_history_${uid}`) || '[]');
  }
  function saveLocalHistory(uid, historyArray) {
    localStorage.setItem(`studymind_history_${uid}`, JSON.stringify(historyArray));
  }
  
  function getLocalUsage(uid) {
    const today = new Date().toISOString().split('T')[0];
    const data = JSON.parse(localStorage.getItem(`studymind_usage_${uid}`) || 'null');
    if (data && data.last_reset_date === today) {
      return data.daily_count;
    }
    return 0;
  }
  function saveLocalUsage(uid, count) {
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem(`studymind_usage_${uid}`, JSON.stringify({
      daily_count: count, last_reset_date: today
    }));
  }

  function getLocalStreak(uid) {
    return JSON.parse(localStorage.getItem(`studymind_streak_${uid}`) || '{"count": 0, "last_date": null}');
  }
  function saveLocalStreak(uid, streakObj) {
    localStorage.setItem(`studymind_streak_${uid}`, JSON.stringify(streakObj));
  }

  // --- Fetch usage & streak on mount ---
  useEffect(() => {
    if (user) {
      fetchUsage();
      fetchStreak();
    }
  }, [user]);

  async function fetchUsage() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const localCount = getLocalUsage(user.id);
      
      // Optimistically assume local is right to avoid flashes of 0 credits while network loads
      setUsageCount(localCount);
      
      const { data, error } = await supabase
        .from('usage')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No record exists in Supabase. Create one with our local count.
          await supabase.from('usage').insert({
            user_id: user.id, daily_count: localCount, last_reset_date: today,
          }).catch(() => null);
        }
        // Fallback to local is implicitly handled since we already did setUsageCount(localCount)
        return;
      }

      // We have Supabase Data!
      // If DB date is old, its count for *today* is 0. Otherwise, use what's in the DB.
      const dbCount = (data.last_reset_date === today) ? data.daily_count : 0;
      
      // True count is the maximum of offline tracking and DB tracking. Protects against desyncs safely.
      const trueCount = Math.max(dbCount, localCount);

      // If DB is stale (lower count or wrong date), push the true state up.
      if (trueCount > data.daily_count || data.last_reset_date !== today) {
         await supabase.from('usage').update({ 
           daily_count: trueCount, last_reset_date: today 
         }).eq('user_id', user.id).catch(() => null);
      }

      // Align state with truth
      setUsageCount(trueCount);
      saveLocalUsage(user.id, trueCount);

    } catch (err) {
      console.error('Error fetching usage strictly skipped:', err);
      // Implicitly relies on the pre-loaded optimistic `localCount`
    }
  }

  async function incrementUsage() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const newCount = usageCount + 1;
      
      // Update local storage ALWAYS
      saveLocalUsage(user.id, newCount);
      setUsageCount(newCount);

      // Attempt Supabase
      await supabase
        .from('usage')
        .update({ daily_count: newCount, last_reset_date: today })
        .eq('user_id', user.id);
    } catch (err) {
      console.error('Error updating usage:', err);
    }
  }

  async function fetchStreak() {
    try {
      const local = getLocalStreak(user.id);
      setUserStreak(local.count);

      const { data, error } = await supabase
        .from('profiles')
        .select('streak_count, last_study_date')
        .eq('id', user.id)
        .single();

      if (data) {
        // Sync local with Supabase if needed
        if (data.streak_count > local.count) {
          setUserStreak(data.streak_count);
          saveLocalStreak(user.id, { count: data.streak_count, last_date: data.last_study_date });
        }
      }
    } catch (err) {
      console.error('Error fetching streak:', err);
    }
  }

  async function handleUpdateStreak() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const local = getLocalStreak(user.id);
      
      let newCount = local.count;
      
      if (!local.last_date) {
        // First time studying
        newCount = 1;
      } else if (local.last_date === today) {
        // Already studied today
        return;
      } else {
        const lastDate = new Date(local.last_date);
        const currentDate = new Date(today);
        const diffDays = Math.floor((currentDate - lastDate) / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
          newCount += 1;
        } else if (diffDays > 1) {
          newCount = 1;
        }
      }

      setUserStreak(newCount);
      saveLocalStreak(user.id, { count: newCount, last_date: today });

      // Persist to Supabase
      await supabase
        .from('profiles')
        .update({ streak_count: newCount, last_study_date: today })
        .eq('id', user.id);

    } catch (err) {
      console.error('Error updating streak:', err);
    }
  }

  // --- Generate AI content ---
  async function handleGenerate() {
    if (!input.trim()) {
      setError('Please enter some text to generate content.');
      return;
    }
    if (!isPro && usageCount >= DAILY_LIMIT) {
      setError(`You've reached your daily limit of ${DAILY_LIMIT} requests. Upgrade to Pro for unlimited access.`);
      return;
    }

    setLoading(true);
    setError('');
    setOutput('');
    setDisplayedOutput('');

    try {
      const result = await generateWithGemini(activeTool, input);
      
      // If the tool is the flashcard generator, parse and show overlay instead of just setting output
      if (activeTool === 'flashcard-generator') {
        try {
          const parsed = JSON.parse(result.trim().replace(/```json|```/g, ''));
          if (Array.isArray(parsed) && parsed.length > 0) {
            setFlashcards(parsed.map(card => ({ ...card, known: false })));
            setCurrentCardIndex(0);
            setIsFlipped(false);
            setShowFlashcards(true);
            setOutput('Flashcards generated successfully! Click the button above to view them again if closed.');
            setDisplayedOutput('Flashcards generated successfully! Click the button above to view them again if closed.');
          }
        } catch (e) {
          console.error("Flashcard parse error on main call:", e);
          setOutput(result);
          typewriterEffect(result);
        }
      } else {
        setOutput(result);
        typewriterEffect(result);
      }
      
      // Fire and forget - don't let database issues hang the UI
      incrementUsage().catch(console.error);
      saveToHistory(result).catch(console.error);
    } catch (err) {
      setError(err.message || 'Failed to generate content. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // --- Generate Flashcards from current output ---
  async function handleGenerateFlashcards() {
    if (!output.trim()) return;
    
    setIsGeneratingFlashcards(true);
    setError('');
    
    try {
      // We pass the current AI output to Gemini to extract concepts
      const result = await generateWithGemini('flashcard-generator', output);
      
      // Attempt to parse JSON strictly
      try {
        const parsed = JSON.parse(result.trim());
        if (Array.isArray(parsed) && parsed.length > 0) {
          setFlashcards(parsed.map(card => ({ ...card, known: false })));
          setCurrentCardIndex(0);
          setIsFlipped(false);
          setShowFlashcards(true);
        } else {
          throw new Error("Invalid flashcard format received.");
        }
      } catch (parseErr) {
        console.error("JSON Parse Error:", result);
        throw new Error("Failed to parse flashcards. The AI might have returned non-JSON text.");
      }
    } catch (err) {
      setError(`Flashcard Error: ${err.message}`);
    } finally {
      setIsGeneratingFlashcards(false);
    }
  }

  const handleNextCard = () => {
    if (currentCardIndex < flashcards.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
      setIsFlipped(false);
    }
  };

  const handlePrevCard = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(prev => prev - 1);
      setIsFlipped(false);
    }
  };

  const handleMarkKnown = () => {
    const updated = [...flashcards];
    updated[currentCardIndex].known = !updated[currentCardIndex].known;
    setFlashcards(updated);
  };

  // --- Study Mode Handlers ---
  const handleStartStudy = (isReviewOnly = false) => {
    let activeCards = flashcards;
    if (isReviewOnly && studyResults.weakCards.length > 0) {
      activeCards = studyResults.weakCards;
    }
    
    setStudyResults({
      correct: 0,
      incorrect: 0,
      total: activeCards.length,
      showResults: false,
      weakCards: []
    });
    
    setFlashcards(activeCards);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setIsStudyMode(true);
  };

  const handleAnswer = (isCorrect) => {
    // Show feedback
    setSessionFeedback(isCorrect ? 'Correct! ✨' : 'Review this 🧠');
    
    // Update results
    setStudyResults(prev => {
      const updated = { ...prev };
      if (isCorrect) updated.correct += 1;
      else {
        updated.incorrect += 1;
        updated.weakCards.push(flashcards[currentCardIndex]);
      }
      return updated;
    });

    // Auto-advance after delay
    setTimeout(() => {
      setSessionFeedback(null);
      if (currentCardIndex < flashcards.length - 1) {
        setCurrentCardIndex(prev => prev + 1);
        setIsFlipped(false);
      } else {
        // Session Complete
        setStudyResults(prev => ({ ...prev, showResults: true }));
        handleUpdateStreak();
      }
    }, 500);
  };

  const handleRestartStudy = () => {
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setStudyResults(prev => ({ ...prev, correct: 0, incorrect: 0, showResults: false, weakCards: [] }));
  };

  const handleExitStudyMode = () => {
    setIsStudyMode(false);
    setShowFlashcards(false);
    setStudyResults(prev => ({ ...prev, showResults: false }));
  };

  // --- Save to history ---
  async function saveToHistory(outputText) {
    try {
      const newItem = {
        id: crypto.randomUUID(),
        user_id: user.id,
        tool_used: activeTool,
        input_text: input,
        output_text: outputText,
        created_at: new Date().toISOString()
      };
      
      const localHistory = [newItem, ...getLocalHistory(user.id)];
      saveLocalHistory(user.id, localHistory);

      await supabase.from('history').insert({
        user_id: user.id,
        tool_used: activeTool,
        input_text: input,
        output_text: outputText,
      });
    } catch (err) {
      console.error('Error saving to history:', err);
    }
  }

  // --- Fetch history ---
  async function fetchHistory() {
    setHistoryLoading(true);
    try {
      let query = supabase
        .from('history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!isPro) {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        query = query.gte('created_at', sevenDaysAgo.toISOString());
      }

      // Increase timeout to 15 seconds for slower DB connections
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Database connection timed out")), 15000)
      );
      
      const { data, error } = await Promise.race([query.limit(50), timeoutPromise]);
      if (error) throw error;
      
      saveLocalHistory(user.id, data || []);
      setHistory(data || []);
    } catch (err) {
      console.error('Error fetching history:', err);
      let localHistory = getLocalHistory(user.id);
      if (!isPro) {
         const limitTime = Date.now() - 7 * 24 * 60 * 60 * 1000;
         localHistory = localHistory.filter(item => new Date(item.created_at).getTime() >= limitTime);
      }
      setHistory(localHistory); 
    } finally {
      setHistoryLoading(false);
    }
  }

  // --- Fetch analytics ---
  async function fetchAnalytics() {
    setAnalyticsLoading(true);
    try {
      const { data, error } = await supabase
        .from('history')
        .select('tool_used, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      processAnalytics(data || []);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      processAnalytics(getLocalHistory(user.id));
    } finally {
      setAnalyticsLoading(false);
    }
  }

  function processAnalytics(items) {
    const today = new Date().toISOString().split('T')[0];

    // Tool breakdown
    const toolBreakdown = {};
    TOOLS.forEach(t => { toolBreakdown[t.id] = 0; });
    items.forEach(item => {
      toolBreakdown[item.tool_used] = (toolBreakdown[item.tool_used] || 0) + 1;
    });

    // Today's count
    const todayRequests = items.filter(
      item => item.created_at?.split('T')[0] === today
    ).length;

    // Last 7 days breakdown
    const recentDays = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayLabel = d.toLocaleDateString('en-IN', { weekday: 'short' });
      const count = items.filter(item => item.created_at?.split('T')[0] === dateStr).length;
      recentDays.push({ date: dateStr, label: dayLabel, count });
    }

    setAnalytics({
      totalRequests: items.length,
      todayRequests,
      toolBreakdown,
      recentDays,
    });
  }

  // --- Copy to clipboard ---
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = output;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  // --- Export as PDF ---
  async function handleExportPDF() {
    if (!isPro) {
      setError('PDF export is a Pro feature. Upgrade to unlock it.');
      return;
    }
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const element = outputRef.current;
      if (!element) return;
      html2pdf().set({
        margin: [10, 10, 10, 10],
        filename: `studymind-${activeTool}-${Date.now()}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      }).from(element).save();
    } catch (err) {
      setError('Failed to export PDF. Please try again.');
    }
  }

  // --- Handle payment ---
  function handleUpgrade() {
    setUpgradeLoading(true);
    initiatePayment({
      userEmail: user?.email,
      userName: '',
      onSuccess: async (paymentData) => {
        try {
          await supabase
            .from('profiles')
            .update({ plan: 'pro', payment_id: paymentData.paymentId })
            .eq('id', user.id);
          await refreshProfile();
          setUpgradeLoading(false);
          alert('🎉 Welcome to Pro! You now have unlimited access.');
        } catch (err) {
          console.error('Error upgrading plan:', err);
          setUpgradeLoading(false);
        }
      },
      onError: (err) => {
        console.error('Payment error:', err);
        alert(`Payment unable to launch: ${err.message}`);
        setUpgradeLoading(false);
      },
    });
  }

  // --- Switch views ---
  function openHistory() {
    setActiveView('history');
    fetchHistory();
    setSidebarOpen(false);
  }

  function openAnalytics() {
    setActiveView('analytics');
    fetchAnalytics();
    setSidebarOpen(false);
  }

  function openTool(toolId) {
    setActiveTool(toolId);
    setActiveView('tool');
    setOutput('');
    setDisplayedOutput('');
    setInput('');
    setError('');
    setSidebarOpen(false);
    if (typewriterRef.current) clearInterval(typewriterRef.current);
  }

  function loadHistoryItem(item) {
    setActiveTool(item.tool_used);
    setInput(item.input_text);
    setOutput(item.output_text);
    setDisplayedOutput(item.output_text);
    setIsTyping(false);
    setActiveView('tool');
  }

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  // --- Analytics helpers ---
  const maxBarCount = Math.max(...analytics.recentDays.map(d => d.count), 1);

  return (
    <div className={`dashboard ${utilityOpen ? 'utility-open' : ''}`} id="dashboard">
      {/* ===== SIDEBAR ===== */}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`} id="sidebar">
        <div className="sidebar-header">
          <span className="logo-icon-main">✦</span>
          <span className="sidebar-logo-text">StudyMind</span>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-group">
            <span className="sidebar-group-label">AI TOOLS</span>
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

          <div className="sidebar-divider" aria-hidden="true" />

          <div className="sidebar-group">
            <span className="sidebar-group-label">ACCOUNT</span>
            <button
              className={`sidebar-link ${activeView === 'analytics' ? 'active' : ''}`}
              onClick={openAnalytics}
            >
              <span className="sidebar-link-icon">📊</span>
              <span className="sidebar-link-text">Analytics</span>
            </button>
            <button
              className={`sidebar-link ${activeView === 'history' ? 'active' : ''}`}
              onClick={openHistory}
            >
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
          <button className="sidebar-link sidebar-signout-link" onClick={handleSignOut}>
            <span className="sidebar-link-icon">🚪</span>
            <span className="sidebar-link-text">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ===== MAIN CONTENT WRAPPER ===== */}
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
              <div className="user-avatar">
                {user?.email?.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* ===== MAIN PANEL ===== */}
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
                      <span className="limit-icon">🔒</span>
                      <p>You’ve reached your daily limit. Upgrade to continue.</p>
                      <button className="btn btn-primary upgrade-cta-inline" onClick={handleUpgrade}>
                        Upgrade to Pro
                      </button>
                    </div>
                  )}

                  <div className="tool-control-bar">
                    <button
                      className="btn-generate-dominant"
                      onClick={handleGenerate}
                      disabled={loading || !input.trim() || (!isPro && usageCount >= DAILY_LIMIT)}
                    >
                      {loading ? (
                        <span className="loading-state">
                          <span className="loading-spinner" />
                          Generating...
                        </span>
                      ) : 'Generate Content'}
                    </button>
                  </div>
                </div>

                {error && <div className="tool-error-status">{error}</div>}

                {/* Loading Skeleton */}
                {loading && (
                  <div className="tool-skeleton-shimmer">
                    <div className="skeleton-line-long" />
                    <div className="skeleton-line-med" />
                    <div className="skeleton-line-long" />
                  </div>
                )}

                {/* Output Display */}
                {displayedOutput && !loading && (
                  <div className="tool-output-card animate-in">
                    <header className="output-header">
                      <h3>Results</h3>
                      <div className="output-control-group">
                        <button className="btn-secondary-sm" onClick={handleCopy}>
                          {copied ? 'Copied' : 'Copy'}
                        </button>
                        <button className="btn-secondary-sm" onClick={handleExportPDF}>
                          PDF {!isPro && '🔒'}
                        </button>
                        <button 
                          className="btn-accent-sm" 
                          onClick={handleGenerateFlashcards}
                          disabled={isGeneratingFlashcards}
                        >
                          {isGeneratingFlashcards ? '...' : '⚡ Flashcard Pro'}
                        </button>
                      </div>
                    </header>
                    <div
                      ref={outputRef}
                      className={`output-body ${isTyping ? 'is-typing' : ''}`}
                      dangerouslySetInnerHTML={{ __html: markdownToHtml(displayedOutput) }}
                    />
                  </div>
                )}
              </div>
            )}

            {activeView === 'analytics' && (
              <div className="view-center-constraint animate-in">
                <h2 className="view-header-title">Analytics</h2>
                <div className="analytics-summary-grid">
                  <div className="elite-stat-card">
                    <span className="stat-label">Total Requests</span>
                    <span className="stat-value">{analytics.totalRequests}</span>
                  </div>
                  <div className="elite-stat-card">
                    <span className="stat-label">Today</span>
                    <span className="stat-value">{analytics.todayRequests}</span>
                  </div>
                </div>
              </div>
            )}

            {activeView === 'history' && (
              <div className="view-center-constraint animate-in">
                <h2 className="view-header-title">History</h2>
                <div className="history-stack">
                  {history.map(item => (
                    <div key={item.id} className="history-item-card" onClick={() => loadHistoryItem(item)}>
                      <span className="history-tag">{TOOLS.find(t => t.id === item.tool_used)?.name}</span>
                      <p className="history-text-preview">{item.input_text}</p>
                    </div>
                  ))}
                  {history.length === 0 && (
                    <div className="empty-history-state">
                      <span className="empty-icon">📂</span>
                      <p>No activity yet. Start generating content to see your history!</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ===== UTILITY PANEL ===== */}
      <aside className={`utility-side-panel ${utilityOpen ? 'open' : ''}`}>
        <div className="utility-card-stack">
          {/* Usage Stats Card */}
          {!isPro && (
            <section className="utility-section-card">
              <h4 className="card-heading">DAILY USAGE</h4>
              <div className="usage-meter-container">
                <div className="usage-numeric-stats">
                  <span>{usageCount} / {DAILY_LIMIT}</span>
                  <span>{Math.round((usageCount/DAILY_LIMIT)*100)}%</span>
                </div>
                <div className="progress-track-bg">
                  <div 
                    className="progress-fill-active" 
                    style={{ width: `${Math.min((usageCount / DAILY_LIMIT) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </section>
          )}

          {/* Upsell Card */}
          {!isPro && (
            <section className="utility-section-card highlight-card">
              <h4 className="card-heading">PRO ACCESS</h4>
              <p className="card-context-text">Unlock unlimited generations and PDF exports.</p>
              <button className="btn-primary-full" onClick={handleUpgrade} disabled={upgradeLoading}>
                {upgradeLoading ? '...' : 'Upgrade Now'}
              </button>
            </section>
          )}

          {/* Mini Activity Card */}
          <section className="utility-section-card">
            <h4 className="card-heading">RECENT ACTIVITY</h4>
            <div className="activity-compact-list">
              {history.slice(0, 5).map(item => (
                <div key={item.id} className="activity-compact-item" onClick={() => loadHistoryItem(item)}>
                  <span className="activity-tool-name">{TOOLS.find(t => t.id === item.tool_used)?.name}</span>
                  <span className="activity-timestamp">{new Date(item.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
              ))}
              {history.length === 0 && <p className="empty-compact-hint">No activity yet</p>}
            </div>
            {history.length > 0 && (
              <button className="btn-link-action" onClick={openHistory}>View All History</button>
            )}
          </section>
        </div>
      </aside>

      {/* Floating Panel Toggle */}
      <button className="utility-floating-toggle" onClick={() => setUtilityOpen(!utilityOpen)}>
        {utilityOpen ? '✕' : '📊'}
      </button>
      
      {/* ===== FLASHCARD FOCUS OVERLAY ===== */}
      {showFlashcards && flashcards.length > 0 && (
        <div className={`flashcard-overlay animate-in ${isStudyMode ? 'study-mode-active' : ''}`} id="flashcard-overlay">
          <div className="overlay-backdrop" onClick={handleExitStudyMode} />
          
          <div className="flashcard-container">
            <header className="flashcard-header">
              <div className="flashcard-progress">
                {isStudyMode ? (
                  <span className="study-tag">Study Session</span>
                ) : (
                  <>
                    <span className="current">{currentCardIndex + 1}</span>
                    <span className="total">/ {flashcards.length}</span>
                  </>
                )}
              </div>
              <button className="close-overlay" onClick={handleExitStudyMode}>✕</button>
            </header>

            {studyResults.showResults ? (
              /* RESULTS SCREEN */
              <div className="study-results-screen animate-in">
                <div className="results-graphic">
                  <div className="circular-progress">
                    <span className="score-num">{studyResults.correct}</span>
                    <span className="score-total">/ {studyResults.total}</span>
                  </div>
                </div>
                <h2 className="results-title">Session Complete!</h2>
                <p className="results-subtitle">
                  {studyResults.correct === studyResults.total 
                    ? "Perfect mastery! You're crushing it. ✨" 
                    : `Good effort! You mastered ${studyResults.correct} concepts today.`}
                </p>
                
                <div className="results-actions">
                  {studyResults.weakCards.length > 0 && (
                    <button className="btn-secondary-full" onClick={() => handleStartStudy(true)}>
                      Review Weak Cards ({studyResults.weakCards.length})
                    </button>
                  )}
                  <button className="btn-primary-full" onClick={handleRestartStudy}>
                    Restart Full Session
                  </button>
                  <button className="btn-link-action" onClick={handleExitStudyMode}>
                    Exit to Overview
                  </button>
                </div>
              </div>
            ) : (
              /* ACTIVE CARD (Browser or Study Mode) */
              <>
                {isStudyMode && (
                  <div className="study-mini-progress">
                    Card {currentCardIndex + 1} of {flashcards.length}
                  </div>
                )}

                <div 
                  className={`flashcard ${isFlipped ? 'flipped' : ''}`} 
                  onClick={() => setIsFlipped(!isFlipped)}
                >
                  <div className="flashcard-inner">
                    <div className="flashcard-face front">
                      <div className="card-label">QUESTION</div>
                      <div className="card-content">{flashcards[currentCardIndex]?.front}</div>
                      <div className="card-hint">Tap to see answer</div>
                      {sessionFeedback && (
                        <div className="feedback-toast-inner animate-in">
                          {sessionFeedback}
                        </div>
                      )}
                    </div>
                    
                    <div className="flashcard-face back">
                      <div className="card-label">ANSWER</div>
                      <div className="card-content">{flashcards[currentCardIndex]?.back}</div>
                      <div className="card-hint">Tap to see question</div>
                    </div>
                  </div>
                </div>
                
                <footer className="flashcard-controls">
                  {isStudyMode ? (
                    <div className="study-actions-group">
                      <button 
                        className="btn-study-action btn-incorrect"
                        onClick={(e) => { e.stopPropagation(); handleAnswer(false); }}
                      >
                        Needs Review
                      </button>
                      <button 
                        className="btn-study-action btn-correct"
                        onClick={(e) => { e.stopPropagation(); handleAnswer(true); }}
                      >
                        I Knew This
                      </button>
                    </div>
                  ) : (
                    <>
                      <button 
                        className="btn-nav" 
                        onClick={(e) => { e.stopPropagation(); handlePrevCard(); }}
                        disabled={currentCardIndex === 0}
                      >
                        ←
                      </button>
                      
                      <button 
                        className="btn-study-prime"
                        onClick={(e) => { e.stopPropagation(); handleStartStudy(); }}
                      >
                        Start Study Session
                      </button>
                      
                      <button 
                        className="btn-nav" 
                        onClick={(e) => { e.stopPropagation(); handleNextCard(); }}
                        disabled={currentCardIndex === flashcards.length - 1}
                      >
                        →
                      </button>
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
