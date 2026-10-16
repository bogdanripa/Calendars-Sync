import { Footer, Nav } from "./Layout.tsx";

const ITEMS = [
  'Acceptance of Terms: By using our app, you agree to these terms. If you do not agree, please do not use the app.',
  'Service Description: Our app synchronizes events across multiple calendars you own.',
  'User Responsibilities: You are responsible for maintaining the confidentiality of your login information and for all activities under your account.',
  'Prohibited Use: You may not use the app for any illegal or unauthorized purpose.',
  'Intellectual Property: All content provided by the app is our property or the property of our licensors and is protected by copyright laws.',
  'Termination: We may terminate or suspend access to our app immediately, without prior notice, for any breach of these Terms.',
  'Limitation of Liability: We are not liable for any direct, indirect, incidental, or consequential damages resulting from your use of the app.',
  'Governing Law: These Terms are governed by the Romanian law.',
  'Changes to Terms: We reserve the right to modify these terms at any time, and will update the Effective Date accordingly.',
  'Contact Us: For any questions about these terms, please contact bogdanripa+calendar@gmail.com.',
];

export default function TermsOfService() {
  return (
    <div className="page">
      <Nav />
      <main className="section">
        <div className="container narrow legal">
          <h1>Terms of Service</h1>
          <p className="muted">Effective Date: October 2023</p>
          <ul>
            {ITEMS.map((item) => {
              const [head, ...rest] = item.split(": ");
              return (
                <li key={head}>
                  <b>{head}:</b> {rest.join(": ")}
                </li>
              );
            })}
          </ul>
        </div>
      </main>
      <Footer />
    </div>
  );
}
