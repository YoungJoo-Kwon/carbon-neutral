// firebaseConfig.ts - Firebase 설정 파일 예시
// Firebase 콘솔 (https://console.firebase.google.com/)에서 프로젝트를 만들고, 설정 > 일반 > 내 앱 > SDK 설정 > 구성에서 키를 복사하세요.
// VS Code에서 이 파일을 열고, 아래의 placeholder를 실제 키로 교체하세요.

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics'; // 추가

// Firebase 프로젝트 구성 객체
const firebaseConfig = {
  apiKey: "AIzaSyAP8PtcSM8-I4nVMW6E8WYzS7d19wouf9s", // API 키
  authDomain: "c-neutral.firebaseapp.com", // 인증 도메인
  projectId: "c-neutral", // 프로젝트 ID
  storageBucket: "c-neutral.firebasestorage.app", // 스토리지 버킷
  messagingSenderId: "156481963038", // 메시징 발신자 ID
  appId: "1:156481963038:web:e5a7d662218c08fc411a0f", // 앱 ID
  measurementId: "G-FM4FL3HPL7" // 추가
};

// Firebase 앱 초기화
const app = initializeApp(firebaseConfig);

// Firestore 데이터베이스 인스턴스 내보내기
export const db = getFirestore(app);
export const analytics = getAnalytics(app); 