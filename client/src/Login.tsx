import React, { useState } from 'react';
import { CredentialResponse, GoogleLogin } from '@react-oauth/google';
import { AuthService } from '@genezio/auth';
import { useNavigate } from 'react-router-dom';
import Header from './Header.tsx';
import Footer from './Footer.tsx';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [googleLoginLoading, setGoogleLoginLoading] = useState(false);

  AuthService.getInstance().userInfo()
  .then((userInfo) => {
      if (userInfo) {
          navigate('/calendars');
      }
  })
  .catch((error) => {
      console.error('Failed to get user info', error);
  });

  const handleGoogleLogin = async (credentialResponse: CredentialResponse) => {
      setGoogleLoginLoading(true);
      try {
        await AuthService.getInstance().googleRegistration(credentialResponse.credential!)

        console.log('Login Success');
        navigate('/calendars');
      } catch(error: any) {
        console.log('Login Failed', error);
        alert('Login Failed');
      }

      setGoogleLoginLoading(false);
  };

  return (
    <>
      <Header />
      <div>Welcome to the Calendars Sync app! This app lets you synchronize events across multiple calendars you own.</div>
      <div>&nbsp;</div>
      <div>You could use it to copy over personal events to your work calendar so that that when you have personal events that time gets blocked automatically in your work calendar. Each calendar you add can be a source, a destination, or both.</div>
      <div>&nbsp;</div>
      <div>To get started, sign in with your Google account.</div>
      <div className="form-container" style={{ width: "15em" }}>
        { googleLoginLoading ? 
              <>Loading...</> :
              <GoogleLogin
                  onSuccess={credentialResponse => {
                      handleGoogleLogin(credentialResponse);
                  }}
                  onError={() => {
                      console.log('Login Failed');
                      alert('Login Failed')
                  }}
              />
        }
      </div>
      <Footer />
    </>
  );
};

export default Login;