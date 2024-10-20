import { useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import { BackendService } from "@genezio-sdk/Calendars-Sync";

const GoogleCallback: React.FC = () => {
    const navigate = useNavigate();
    let loaded = false;

    useEffect(() => {
        if (loaded) return;
        loaded = true;
        
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get("code");
        if (code) {
            // Save the tokens
            BackendService.saveTokens(code)
            .catch((error) => {
                alert(error);
            }).finally(() => {
                navigate('/');
            });
        }
    }, []);

    return (
        <div>
            <h1>Loading...</h1>
        </div>
    );
}

export default GoogleCallback;