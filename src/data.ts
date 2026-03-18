export interface Question {
  id: string;
  title: string;
  next: string;
}

export interface Keyword {
  id: string;
  title: string;
}

export interface Section {
  id: string;
  title: string;
  questions?: Question[];
  keywords?: Keyword[];
}

export interface SurveyData {
  surveyTitle: string;
  sections: Section[];
}

export const surveyData: SurveyData = {
  surveyTitle: "탄소중립 카페 체크리스트",
  sections: [
    {
      id: "sec1",
      title: "1. 탄소중립",
      questions: [
        {
          id: "q1_1",
          title: "매장 안에서는 다회용컵을 사용하나요?",
          next: "q1_2",
        },
        {
          id: "q1_2",
          title: "개인 텀블러 사용시 혜택이 있나요?",
          next: "q1_3",
        },
        {
          id: "q1_3",
          title: "현지 상품 활용 메뉴가 있나요?",
          next: "q1_4",
        },
        {
          id: "q1_4",
          title: "매장 안에 친환경 기후 관련 정보나 포스터가 있나요?",
          next: "q1_5",
        },
        {
          id: "q1_5",
          title: "빨대, 시럽, 스틱은 요청시에만 제공하나요?",
          next: "q1_6",
        },
        {
          id: "q1_6",
          title: "냉/난방이 적절한가요?",
          next: "NEXT_SECTION",
        },
      ],
    },
    {
      id: "sec2",
      title: "2. 카페 특징",
      keywords: [
        {
          id: "q2_1",
          title: "전자영수증",
        },
        {
          id: "q2_2",
          title: "탄소중립포인트",
        },
        {
          id: "q2_3",
          title: "베이커리",
        },
        {
          id: "q2_4",
          title: "친절한 서비스",
        },
        {
          id: "q2_5",
          title: "뷰맛집",
        },
        {
          id: "q2_6",
          title: "무인카페",
        },
      ],
    },
  ],
};
