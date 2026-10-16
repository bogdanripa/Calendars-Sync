import { Footer, Nav } from "./Layout.tsx";

const ITEMS = [
  'Information Collection: We collect information from the calendars you connect to our app, including events, dates, and times.',
  'Use of Information: We use the information to synchronize your calendar events across multiple platforms.',
  'Data Sharing: We do not share your information with third parties.',
  'Data Security: We implement standard security measures to protect your information.',
  'Retention of Data: We retain Google user data collected through our app only for as long as necessary to provide you with our services.',
  'Deletion of Data: You may request deletion of your data at any time, and we will comply with your request within a reasonable timeframe, unless otherwise required to retain the data by law.',
  'Changes to Policy: We may update this policy and will notify you of changes.',
  'Contact Us: For questions, contact us at bogdanripa+calendar@gmail.com.',
];

export default function PrivacyPolicy() {
  return (
    <div className="page">
      <Nav />
      <main className="section">
        <div className="container narrow legal">
          <h1>Privacy Policy</h1>
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
