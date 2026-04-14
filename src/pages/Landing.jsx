/**
 * Landing Page
 * 
 * The public-facing marketing page for StudyMind AI.
 * Sections: Hero, Features, How It Works, Pricing, CTA
 */

import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { initiatePayment } from '../utils/razorpay';
import { supabase } from '../utils/supabaseClient';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import './Landing.css';

// Feature data
const features = [
  {
    icon: '💡',
    title: 'Topic Explainer',
    description: 'Get clear, beginner-friendly explanations of any topic with analogies and examples.',
  },
  {
    icon: '📝',
    title: 'Notes Generator',
    description: 'Convert any topic into structured, comprehensive study notes ready for revision.',
  },
  {
    icon: '✍️',
    title: 'Content Writer',
    description: 'Generate professional blogs, social media captions, emails, and essays in seconds.',
  },
  {
    icon: '🧠',
    title: 'MCQ Quiz Maker',
    description: 'Create quiz questions with answers for any subject — perfect for exam prep.',
  },
];

// Steps data
const steps = [
  {
    number: '01',
    title: 'Sign up free',
    description: 'Create your account in seconds. No credit card required.',
  },
  {
    number: '02',
    title: 'Choose a tool',
    description: 'Pick from Topic Explainer, Notes Generator, Content Writer, or MCQ Maker.',
  },
  {
    number: '03',
    title: 'Get AI results instantly',
    description: 'Enter your topic and get polished, structured output powered by Gemini AI.',
  },
];

// Testimonials data
const testimonials = [
  {
    quote: "StudyMind AI completely changed how I prepare for exams. The Notes Generator takes my messy thoughts and turns them into perfect study sheets.",
    author: "Sarah J.",
    role: "Computer Science Student",
    avatar: "👩‍💻",
    rating: 5
  },
  {
    quote: "As a creator, the Content Writer saves me hours every week. It's like having a writing assistant that never sleeps.",
    author: "David M.",
    role: "Content Creator",
    avatar: "🧑‍🎨",
    rating: 5
  },
  {
    quote: "The MCQ Maker is unreal. I type in a topic, and boom—I get a 10-question practice test. Essential for midterms.",
    author: "Priya K.",
    role: "Medical Student",
    avatar: "👩‍⚕️",
    rating: 5
  }
];

// FAQ data
const faqs = [
  {
    question: "Is StudyMind AI actually free?",
    answer: "Yes! The free plan gives you 10 AI requests per day, access to all 4 tools, and saves your history for 7 days. No credit card required."
  },
  {
    question: "What's included in the Pro plan?",
    answer: "Pro users get unlimited AI requests, full lifetime history access, PDF exports for notes, and priority support for just ₹1/month."
  },
  {
    question: "Which AI model powers StudyMind?",
    answer: "StudyMind AI is powered by Google's Gemini 1.5 Flash, an incredibly fast and capable model designed for high-quality text and content generation."
  },
  {
    question: "Can I use the content for commercial purposes?",
    answer: "Absolutely. Any content you generate using the Content Writer or other tools belongs to you and can be used anywhere you like."
  }
];

export default function Landing() {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);

  function handleUpgrade() {
    if (!user) {
      navigate('/auth?mode=signup');
      return;
    }

    setLoading(true);
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
          setLoading(false);
          alert('🎉 Welcome to Pro! You now have unlimited access.');
          navigate('/dashboard');
        } catch (err) {
          console.error('Error upgrading plan:', err);
          setLoading(false);
        }
      },
      onError: (err) => {
        console.error('Payment error:', err);
        alert(`Payment unable to launch: ${err.message}`);
        setLoading(false);
      },
    });
  }

  return (
    <div className="landing-page">
      <Navbar />

      {/* ===== HERO SECTION ===== */}
      <section className="hero section" id="hero">
        <div className="container hero-container animate-in">
          <div className="hero-badge">
            <span className="badge">AI-Powered Learning Platform</span>
          </div>
          <h1 className="hero-title">
            Learn Smarter.<br />
            <span className="hero-title-accent">Create Faster.</span>
          </h1>
          <p className="hero-subtitle">
            The professional AI companion for studying, note-taking, and content creation.
          </p>
          <div className="hero-actions">
            <Link to="/auth?mode=signup" className="btn btn-primary btn-lg" id="hero-cta-primary">
              Get Started Free
            </Link>
            <a href="#features" className="btn btn-secondary btn-lg" id="hero-cta-secondary">
              See Features
            </a>
          </div>
          <div className="hero-stats">
            <div className="hero-stat">
              <span className="hero-stat-number">4</span>
              <span className="hero-stat-label">AI Tools</span>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-number">Free</span>
              <span className="hero-stat-label">To Start</span>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-number">10s</span>
              <span className="hero-stat-label">Results</span>
            </div>
          </div>
        </div>
      </section>

      <div className="section-divider" aria-hidden="true" />

      {/* ===== FEATURES SECTION ===== */}
      <section className="features section" id="features">
        <div className="container">
          <div className="section-header text-center">
            <span className="badge">Features</span>
            <h2 className="section-title">Everything you need to learn & create</h2>
            <p className="section-subtitle text-secondary">
              Professional AI tools designed for high-performance productivity.
            </p>
          </div>
          <div className="features-grid animate-in">
            {features.map((feature, index) => (
              <div
                className="feature-card"
                key={feature.title}
                id={`feature-card-${index}`}
              >
                <div className="feature-icon">{feature.icon}</div>
                <h3 className="feature-title">{feature.title}</h3>
                <p className="feature-description text-secondary">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS SECTION ===== */}
      <section className="how-it-works section" id="how-it-works">
        <div className="container">
          <div className="section-header text-center">
            <span className="badge">How It Works</span>
            <h2 className="section-title">Start learning in 3 simple steps</h2>
          </div>
          <div className="steps-grid">
            {steps.map((step, index) => (
              <div className="step-card" key={step.number} id={`step-card-${index}`}>
                <div className="step-number">{step.number}</div>
                <h3 className="step-title">{step.title}</h3>
                <p className="step-description text-secondary">{step.description}</p>
                {index < steps.length - 1 && <div className="step-connector"></div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="section-divider" aria-hidden="true" />

      {/* ===== TESTIMONIALS SECTION ===== */}
      <section className="testimonials section" id="testimonials">
        <div className="container">
          <div className="section-header text-center">
            <span className="badge">Success</span>
            <h2 className="section-title">Verified by power users</h2>
          </div>
          <div className="testimonials-grid animate-in">
            {testimonials.map((test, index) => (
              <div className="testimonial-card" key={index}>
                <div className="testimonial-stars" aria-label={`${test.rating} stars`}>
                  {"★".repeat(test.rating)}
                </div>
                <p className="testimonial-quote">{test.quote}</p>
                <div className="testimonial-author">
                  <div className="testimonial-avatar">{test.avatar}</div>
                  <div className="testimonial-meta">
                    <span className="testimonial-name">{test.author}</span>
                    <span className="testimonial-role">{test.role}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pricing section" id="pricing">
        <div className="container">
          <div className="section-header text-center">
            <span className="badge">Pricing</span>
            <h2 className="section-title">Simple, transparent pricing</h2>
            <p className="section-subtitle text-secondary">
              Professional plans for individuals and teams.
            </p>
          </div>
          <div className="pricing-grid animate-in">
            {/* Free Plan */}
            <div className="pricing-card" id="pricing-free">
              <div className="pricing-card-header">
                <h3 className="pricing-plan-name">Free</h3>
                <div className="pricing-amount">
                  <span className="pricing-price">₹0</span>
                  <span className="pricing-period">/mo</span>
                </div>
                <p className="pricing-tagline text-secondary">For personal exploration</p>
              </div>
              <ul className="pricing-features">
                <li className="pricing-feature">
                  <span className="pricing-check">✓</span> 10 AI requests / day
                </li>
                <li className="pricing-feature">
                  <span className="pricing-check">✓</span> Core AI tools
                </li>
                <li className="pricing-feature">
                  <span className="pricing-check">✓</span> 7-day history
                </li>
              </ul>
              <button 
                onClick={() => navigate('/auth?mode=signup')} 
                className="btn btn-secondary btn-lg pricing-cta" 
              >
                Sign Up
              </button>
            </div>

            {/* Pro Plan */}
            <div className="pricing-card pricing-card-pro" id="pricing-pro">
              <div className="pricing-popular-badge">Recommended</div>
              <div className="pricing-card-header">
                <h3 className="pricing-plan-name">Pro</h3>
                <div className="pricing-amount">
                  <span className="pricing-price">₹1</span>
                  <span className="pricing-period">/mo</span>
                </div>
                <p className="pricing-tagline text-secondary">Unlimited performance</p>
              </div>
              <ul className="pricing-features">
                <li className="pricing-feature">
                  <span className="pricing-check">✓</span> Unlimited AI requests
                </li>
                <li className="pricing-feature">
                  <span className="pricing-check">✓</span> Priority processing
                </li>
                <li className="pricing-feature">
                  <span className="pricing-check">✓</span> PDF exports
                </li>
              </ul>
              <button
                onClick={handleUpgrade}
                className="btn btn-primary btn-lg pricing-cta"
                disabled={loading}
              >
                {loading ? 'Processing' : 'Upgrade to Pro'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FAQ SECTION ===== */}
      <section className="faq section" id="faq">
        <div className="container">
          <div className="section-header text-center">
            <span className="badge">FAQ</span>
            <h2 className="section-title">Frequently asked questions</h2>
          </div>
          <div className="faq-list">
            {faqs.map((faq, index) => (
              <div className="faq-item card" key={index}>
                <h3 className="faq-question">{faq.question}</h3>
                <p className="faq-answer text-secondary">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA SECTION ===== */}
      <section className="cta-section section" id="cta">
        <div className="container">
          <div className="cta-card animate-in">
            <h2 className="cta-title">Ready for industrial AI?</h2>
            <p className="cta-subtitle">
              Join the new standard of AI-powered learning.
            </p>
            <Link to="/auth?mode=signup" className="btn btn-primary btn-lg">
              Start Building Now
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
