import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function Privacy() {
  return (
    <div className="legal-page">
      <Navbar />
      <div className="container" style={{ paddingTop: '120px', paddingBottom: '80px', maxWidth: '800px' }}>
        <h1 style={{ fontSize: '3rem', marginBottom: '2rem', fontWeight: 800 }}>Privacy Policy</h1>
        <p className="text-secondary" style={{ marginBottom: '2rem' }}>Last updated: April 13, 2026</p>
        
        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', fontWeight: 700 }}>1. Introduction</h2>
          <p style={{ lineHeight: 1.7, marginBottom: '1rem' }}>
            Welcome to StudyMind AI. We respect your privacy and are committed to protecting your personal data. 
            This Privacy Policy will inform you as to how we look after your personal data when you visit our 
            website and tell you about your privacy rights.
          </p>
        </section>

        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', fontWeight: 700 }}>2. Information We Collect</h2>
          <p style={{ lineHeight: 1.7, marginBottom: '1rem' }}>
            We collect information you provide directly to us when you create an account, such as your email address 
            and name. When you use our AI tools, we also process the prompts and content you submit to provide the service.
          </p>
        </section>

        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', fontWeight: 700 }}>3. How We Use Your Data</h2>
          <p style={{ lineHeight: 1.7, marginBottom: '1rem' }}>
            We use your data to provide, maintain, and improve our services, including to personalize your experience 
            and to protect the security of our website. Your prompts are sent to Gemini AI API for processing but are 
            not used to train models without your explicit consent.
          </p>
        </section>

        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', fontWeight: 700 }}>4. Data Security</h2>
          <p style={{ lineHeight: 1.7, marginBottom: '1rem' }}>
            We have put in place appropriate security measures to prevent your personal data from being accidentally 
            lost, used, or accessed in an unauthorized way.
          </p>
        </section>
      </div>
      <Footer />
    </div>
  );
}
