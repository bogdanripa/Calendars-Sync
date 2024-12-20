import Footer from './Footer.tsx';

const PrivacyPolicy: React.FC = () => {
  return (
    <>
      <div>
        <h1>Privacy Policy</h1>

        <div>Effective Date: October 2023</div>
        <ul>
          <li>Information Collection: We collect information from the calendars you connect to our app, including events, dates, and times.</li>
          <li>Use of Information: We use the information to synchronize your calendar events across multiple platforms.</li>
          <li>Data Sharing: We do not share your information with third parties.</li>
          <li>Data Security: We implement standard security measures to protect your information.</li>
          <li>Retention of Data: We retain Google user data collected through our app only for as long as necessary to provide you with our services.</li>
          <li>Deletion of Data: You may request deletion of your data at any time, and we will comply with your request within a reasonable timeframe, unless otherwise required to retain the data by law.</li>
          <li>Changes to Policy: We may update this policy and will notify you of changes.</li>
          <li>Contact Us: For questions, contact us at bogdanripa+calendar@gmail.com.</li>
        </ul>
      </div>
      <Footer />
    </>
  );
};

export default PrivacyPolicy;