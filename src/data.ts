export interface Question {
  id: string;
  title: string;
  next: string;
}

export interface Section {
  id: string;
  title: string;
  questions: Question[];
}

export interface SurveyData {
  surveyTitle: string;
  sections: Section[];
}

export const surveyData: SurveyData = {
  surveyTitle: "탄소중립 매장 체크리스트",
  sections: [
    {
      id: "sec1",
      title: "1. 매장 운영·포장",
      questions: [
        {
          id: "q1_1",
          title: "다회용컵/텀블러 사용을 장려하나요?",
          next: "q1_2",
        },
        {
          id: "q1_2",
          title: "개인 텀블러 할인 혜택을 제공하나요?",
          next: "q1_3",
        },
        {
          id: "q1_3",
          title: "배달·포장 시 일회용품 사용을 줄이고 있나요?",
          next: "q1_4",
        },
        {
          id: "q1_4",
          title: "다회용 컵이나 리유저블 포장 솔루션을 도입했나요?",
          next: "NEXT_SECTION",
        },
      ],
    },
    {
      id: "sec2",
      title: "2. 메뉴 구성",
      questions: [
        {
          id: "q2_1",
          title: "채식·친환경 메뉴를 상시 제공하나요?",
          next: "q2_2",
        },
        {
          id: "q2_2",
          title: "계절·지역 식재료를 활용한 메뉴가 있나요?",
          next: "q2_3",
        },
        {
          id: "q2_3",
          title: "무가당·무첨가 음료 옵션을 제공하나요?",
          next: "q2_4",
        },
        {
          id: "q2_4",
          title: "주문 시 친환경 포장/옵션을 안내하나요?",
          next: "q2_5",
        },
        {
          id: "q2_5",
          title: "원두·우유 등 공급망의 친환경 인증을 확인하나요?",
          next: "NEXT_SECTION",
        },
      ],
    },
    {
      id: "sec3",
      title: "3. 에너지 사용",
      questions: [
        { id: "q3_1", title: "매장 단열·창문이 잘 되어 있나요?", next: "q3_2" },
        {
          id: "q3_2",
          title: "실내 LED 조명 및 고효율 장비를 사용하나요?",
          next: "q3_3",
        },
        { id: "q3_3", title: "냉난방 온도 설정을 표준화했나요?", next: "q3_4" },
        {
          id: "q3_4",
          title: "전력 사용량을 모니터링하고 절감 활동을 하나요?",
          next: "NEXT_SECTION",
        },
      ],
    },
    {
      id: "sec4",
      title: "4. 자원·폐기물",
      questions: [
        {
          id: "q4_1",
          title: "분리배출 가이드를 매장에 표시하고 있나요?",
          next: "q4_2",
        },
        {
          id: "q4_2",
          title: "커피박을 따로 모아 재활용하거나 활용하고 있나요?",
          next: "q4_3",
        },
        {
          id: "q4_3",
          title: "음식물/재활용 폐기물이 잘 분리되나요?",
          next: "q4_4",
        },
        {
          id: "q4_4",
          title: "플라스틱·비닐을 줄이고 대체재를 사용하나요?",
          next: "NEXT_SECTION",
        },
      ],
    },
  ],
};
