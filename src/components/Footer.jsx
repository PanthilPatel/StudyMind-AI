/**
 * Footer Component
 * 
 * Site-wide footer with logo, tagline, and legal links.
 */

import { Link } from 'react-router-dom';
import './Footer.css';

export default function Footer() {
  return (
    <footer className="footer" id="footer">
      <div className="container footer-inner">
        <div className="footer-brand">
          <div className="footer-logo">
            <span className="logo-icon">✦</span>
            <span className="logo-text">StudyMind AI</span>
          </div>
          <p className="footer-tagline">Learn smarter. Create faster.</p>
        </div>

        <div className="footer-links">
          <Link to="/privacy" className="footer-link" id="footer-privacy">Privacy Policy</Link>
          <Link to="/terms" className="footer-link" id="footer-terms">Terms of Service</Link>
          <a href="mailto:hello@studymind.ai" className="footer-link" id="footer-contact">Contact</a>
        </div>

        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} StudyMind AI. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
