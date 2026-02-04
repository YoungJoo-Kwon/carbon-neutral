import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

declare global {
  interface Window {
    kakao: any;
  }
}

const loadKakaoSdk = () =>
  new Promise<void>((resolve, reject) => {
    if (window.kakao?.maps) {
      resolve();
      return;
    }
    const appKey = import.meta.env.VITE_KAKAO_API_KEY;
    if (!appKey) {
      console.error("VITE_KAKAO_API_KEY is missing");
      reject(new Error("Missing Kakao API key"));
      return;
    }
    const script = document.createElement("script");
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false&libraries=services`;
    script.async = true;
    script.onload = () => {
      if (window.kakao?.maps?.load) {
        window.kakao.maps.load(() => resolve());
      } else {
        reject(new Error("Kakao SDK load failed"));
      }
    };
    script.onerror = () => reject(new Error("Kakao SDK script error"));
    document.head.appendChild(script);
  });

loadKakaoSdk()
  .catch((err) => console.error(err))
  .finally(() => {
    createRoot(document.getElementById("root")!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
