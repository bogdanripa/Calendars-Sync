import Footer from './Footer.tsx';

const TermsOfService: React.FC = () => {
  return (
    <>
      <div>
        <h1>Terms Of Service</h1>

        <div>Effective Date: October 2023</div>
        <ul>
        <li>Acceptance of Terms: By using our app, you agree to these terms. If you do not agree, please do not use the app.</li>
          <li>Service Description: Our app synchronizes events across multiple calendars you own.</li>
          <li>User Responsibilities: You are responsible for maintaining the confidentiality of your login information and for all activities under your account.</li>
          <li>Prohibited Use: You may not use the app for any illegal or unauthorized purpose.</li>
          <li>Intellectual Property: All content provided by the app is our property or the property of our licensors and is protected by copyright laws.</li>
          <li>Termination: We may terminate or suspend access to our app immediately, without prior notice, for any breach of these Terms.</li>
          <li>Limitation of Liability: We are not liable for any direct, indirect, incidental, or consequential damages resulting from your use of the app.</li>
          <li>Governing Law: These Terms are governed by the Romanian law.</li>
          <li>Changes to Terms: We reserve the right to modify these terms at any time, and will update the Effective Date accordingly.</li>
          <li>Contact Us: For any questions about these terms, please contact bogdanripa+calendar@gmail.com.</li>
        </ul>
      </div>
      <Footer />
    </>
  );
};

export default TermsOfService;