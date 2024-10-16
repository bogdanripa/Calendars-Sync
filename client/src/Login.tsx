import React, { useState } from 'react';
import { CredentialResponse, GoogleLogin } from '@react-oauth/google';
import { AuthService } from '@genezio/auth';
import { useNavigate } from 'react-router-dom';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [googleLoginLoading, setGoogleLoginLoading] = useState(false);

  const handleGoogleLogin = async (credentialResponse: CredentialResponse) => {
      setGoogleLoginLoading(true);
      try {
        await AuthService.getInstance().googleRegistration(credentialResponse.credential!)

        console.log('Login Success');
        navigate('/');
      } catch(error: any) {
        console.log('Login Failed', error);
        alert('Login Failed');
      }

      setGoogleLoginLoading(false);
  };

  return (
    <div className="form-container">
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
  );
};

export default Login;