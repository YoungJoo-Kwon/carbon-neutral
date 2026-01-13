import { useEffect, useMemo, useRef, useState } from "react";
import {
  Leaf,
  Smile,
  Frown,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  MapPin,
} from "lucide-react";
import { surveyData } from "./data";
import { db } from "./firebaseConfig";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import MapComponent, { type SelectedCafe } from "./MapComponent";
import MapOverview from "./MapOverview";
import "./App.css";

interface CafeInfo {
  name: string;
  gpsEnabled: boolean;
  coords: { lat: number; lng: number } | null;
  address?: string | null;
}

interface HistoryItem {
  s: number;
  q: string;
}

interface Grade {
  name: string;
  emoji: string;
  stars: number;
  msg: string;
}

interface ReportWidgetProps {
  context: string;
  selectedCafe?: SelectedCafe | null;
}

function ReportWidget({ context, selectedCafe }: ReportWidgetProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string>("");
  const modalRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const contextLabel = useMemo(() => {
    if (context === "survey") return "설문";
    if (context === "mapSearch") return "지도(검색)";
    if (context === "mapOverview") return "지도(전체)";
    return "메뉴";
  }, [context]);

  const handleSubmit = async () => {
    if (!text.trim()) {
      setMessage("내용을 입력해주세요.");
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      await addDoc(collection(db, "reports"), {
        context,
        contextLabel,
        message: text.trim(),
        selectedCafe: selectedCafe || null,
        createdAt: serverTimestamp(),
      });
      setMessage("리포트가 접수되었습니다. 감사합니다!");
      setText("");
      setOpen(false);
    } catch (error) {
      console.error("report submit failed", error);
      setMessage("저장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (open) {
      textareaRef.current?.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement as HTMLElement;
        if (e.shiftKey) {
          if (active === first || !modalRef.current.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (active === last || !modalRef.current.contains(active)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <>
      <button onClick={() => setOpen(true)} className="report-fab">
        리포트 보내기
      </button>
      {open && (
        <div className="modal-overlay">
          <div className="modal" ref={modalRef}>
            <div className="modal-header">
              <div className="modal-title">
                리포트 작성 ({contextLabel})
              </div>
              <button
                onClick={() => setOpen(false)}
                className="modal-close"
                aria-label="닫기"
              >
                ×
              </button>
            </div>
            {selectedCafe && (
              <div className="modal-context">
                선택된 카페: <b>{selectedCafe.name}</b>
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="버그 신고, 개선 아이디어, 잘못된 정보 등을 알려주세요."
              className="modal-textarea"
            />
            <div className="modal-actions">
              <button onClick={() => setOpen(false)} className="btn-secondary">
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="btn-main btn-compact"
              >
                {submitting ? "제출 중..." : "제출"}
              </button>
            </div>
            {message && <div className="modal-context">{message}</div>}
          </div>
        </div>
      )}
    </>
  );
}

interface SurveyFlowProps {
  onBackToMenu?: () => void;
  onRequestMap?: () => void;
  selectedCafe?: SelectedCafe | null;
}

function SurveyFlow({
  onBackToMenu,
  onRequestMap,
  selectedCafe,
}: SurveyFlowProps) {
  const [currentQuestionId, setCurrentQuestionId] = useState<string>("START");
  const [currentSectionIdx, setCurrentSectionIdx] = useState<number>(-1);
  const [cafeInfo, setCafeInfo] = useState<CafeInfo>({
    name: "",
    gpsEnabled: false,
    coords: null,
    address: null,
  });
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [answersBool, setAnswersBool] = useState<
    Record<string, boolean | null>
  >({});
  const [openSections, setOpenSections] = useState<Record<number, boolean>>({
    0: true,
  });
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitMessage, setSubmitMessage] = useState<string>("");

  useEffect(() => {
    if (selectedCafe) {
      setCafeInfo((prev) => ({
        ...prev,
        name: selectedCafe.name,
        coords: { lat: selectedCafe.lat, lng: selectedCafe.lng },
        address: selectedCafe.address ?? null,
      }));
    }
  }, [selectedCafe]);

  useEffect(() => {
    if (
      navigator.geolocation &&
      currentQuestionId === "CAFE_INFO" &&
      !selectedCafe
    ) {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          setCafeInfo((prev) => ({
            ...prev,
            gpsEnabled: true,
            coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          })),
        () =>
          setCafeInfo((prev) => ({ ...prev, gpsEnabled: false, coords: null })),
      );
    }
  }, [currentQuestionId, selectedCafe]);

  const calculateGrade = (): Grade => {
    const scoreFromBool = (v: boolean | null | undefined) => {
      if (v === true) return 1;
      if (v === false) return 0;
      return 0.5; // null 또는 모르겠어요
    };
    let rawScore = 0;
    let totalQuestions = 0;

    surveyData.sections.forEach((sec) =>
      sec.questions.forEach((q) => {
        rawScore += scoreFromBool(answersBool[q.id]);
        totalQuestions++;
      }),
    );

    const percent = totalQuestions ? (rawScore / totalQuestions) * 100 : 0;
    if (percent >= 80)
      return {
        name: "최우수",
        emoji: "🌿",
        stars: 3,
        msg: "탄소중립 실천이 잘 되고 있어요!",
      };
    if (percent >= 60)
      return {
        name: "양호",
        emoji: "🙂",
        stars: 2,
        msg: "조금만 더 보완하면 금방 올라갈 거예요.",
      };
    return {
      name: "기초",
      emoji: "🪴",
      stars: 1,
      msg: "작은 습관부터 하나씩 실천해 보세요.",
    };
  };

  const updateName = (value: string) => {
    setCafeInfo((prev) => ({ ...prev, name: value }));
  };

  const goToInfo = () => setCurrentQuestionId("CAFE_INFO");

  const startSurvey = () => {
    setCurrentSectionIdx(0);
    setCurrentQuestionId("SECTION_INTRO");
  };

  const startQuestions = () => {
    setCurrentQuestionId(
      surveyData.sections[currentSectionIdx].questions[0].id,
    );
  };

  const toggleAccordion = (i: number) => {
    setOpenSections((prev) => ({ ...prev, [i]: !prev[i] }));
  };

  const handleSelect = (q: string, a: string, n: string) => {
    const normalized = a === "예" ? true : a === "아니요" ? false : null;

    setAnswers((prev) => ({ ...prev, [q]: a }));
    setAnswersBool((prev) => ({ ...prev, [q]: normalized }));
    if (isEditing) {
      setIsEditing(false);
      setCurrentQuestionId("SUMMARY");
    } else {
      setHistory((prev) => [
        ...prev,
        { s: currentSectionIdx, q: currentQuestionId },
      ]);
      if (n === "NEXT_SECTION") {
        const nextIdx = currentSectionIdx + 1;
        setCurrentSectionIdx(nextIdx);
        setCurrentQuestionId(
          nextIdx < surveyData.sections.length ? "SECTION_INTRO" : "SUMMARY",
        );
      } else {
        setCurrentQuestionId(n);
      }
    }
  };

  const editQuestion = (s: number, q: string) => {
    setIsEditing(true);
    setCurrentSectionIdx(s);
    setCurrentQuestionId(q);
  };

  const handleBack = () => {
    if (currentQuestionId === "CAFE_INFO") {
      setCurrentQuestionId("START");
    } else if (history.length > 0) {
      const last = history[history.length - 1];
      setHistory((prev) => prev.slice(0, -1));
      setCurrentSectionIdx(last.s);
      setCurrentQuestionId(last.q);
    } else {
      setCurrentQuestionId("START");
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitMessage("");

    try {
      const grade = calculateGrade();
      const location = cafeInfo.coords
        ? { lat: cafeInfo.coords.lat, lng: cafeInfo.coords.lng }
        : selectedCafe
          ? { lat: selectedCafe.lat, lng: selectedCafe.lng }
          : null;

      await addDoc(collection(db, "surveyResults"), {
        cafeName: cafeInfo.name || selectedCafe?.name || null,
        cafeAddress: cafeInfo.address || selectedCafe?.address || null,
        gpsEnabled:
          cafeInfo.gpsEnabled ||
          Boolean(selectedCafe?.lat && selectedCafe?.lng),
        location,
        answers,
        answersBool,
        grade,
        selectedCafe: selectedCafe || null,
        createdAt: serverTimestamp(),
      });
      setSubmitMessage("제출되었습니다. 감사합니다!");
    } catch (error) {
      console.error("Failed to submit survey", error);
      setSubmitMessage(
        "제출 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderContent = () => {
    if (currentQuestionId === "START") {
      return (
        <div>
          <div style={{ color: "var(--primary)", marginBottom: "20px" }}>
            <Leaf size={48} />
          </div>
          <h1>{surveyData.surveyTitle}</h1>
          <p>우리 카페의 탄소중립 실천 수준을 체크해 보세요.</p>
          <div
            style={{
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
              marginTop: "14px",
            }}
          >
            <button className="btn-main" onClick={goToInfo} style={{ flex: 1 }}>
              설문 시작하기
            </button>
            {onRequestMap && (
              <button
                className="btn-back"
                style={{ flex: 1 }}
                onClick={onRequestMap}
              >
                지도에서 카페 찾기
              </button>
            )}
          </div>
        </div>
      );
    }

    if (currentQuestionId === "CAFE_INFO") {
      return (
        <div>
          <h1>카페 정보를 입력해 주세요</h1>
          <p className="muted-text">
            지도에서 선택했거나 직접 입력해도 됩니다.
          </p>

          {selectedCafe && (
            <div
              className="summary-card"
              style={{ marginTop: "10px", alignItems: "flex-start" }}
            >
              <div>
                <div style={{ fontWeight: 700, marginBottom: "6px" }}>
                  <MapPin
                    size={16}
                    style={{ verticalAlign: "middle", marginRight: "4px" }}
                  />
                  {selectedCafe.name}
                </div>
                <div className="muted-text" style={{ lineHeight: 1.4 }}>
                  {selectedCafe.address || "주소 정보 없음"}
                </div>
              </div>
              <span className="tag">지도 선택</span>
            </div>
          )}

          <input
            type="text"
            className="info-input"
            placeholder="카페 이름을 입력하세요"
            value={cafeInfo.name}
            onChange={(e) => updateName(e.target.value)}
          />
          <textarea
            className="info-textarea"
            placeholder="주소/참고 메모 (선택)"
            value={cafeInfo.address ?? ""}
            onChange={(e) =>
              setCafeInfo((prev) => ({ ...prev, address: e.target.value }))
            }
          />

          <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
            <button
              className="btn-main"
              onClick={startSurvey}
              disabled={!cafeInfo.name && !selectedCafe}
            >
              설문 시작
            </button>
            {onRequestMap && (
              <button className="btn-back" onClick={onRequestMap}>
                지도에서 검색
              </button>
            )}
          </div>
        </div>
      );
    }

    if (currentQuestionId === "SUMMARY") {
      const grade = calculateGrade();
      return (
        <div>
          <div className="grade-board">
            <span className="grade-emoji">{grade.emoji}</span>
            <div className="grade-name">{grade.name}</div>
            <div className="stars">{"★".repeat(grade.stars)}</div>
            <p
              style={{
                fontSize: "0.9rem",
                marginTop: "10px",
                color: "white",
                lineHeight: 1.5,
              }}
            >
              {(cafeInfo.name || selectedCafe?.name || "카페 이름 없음") + " "}
              <br />
              {grade.msg}
            </p>
          </div>
          {surveyData.sections.map((sec, sIdx) => (
            <div key={sec.id}>
              <div
                className="accordion-header"
                onClick={() => toggleAccordion(sIdx)}
              >
                <b>{sec.title}</b>
                {openSections[sIdx] ? (
                  <ChevronUp size={18} />
                ) : (
                  <ChevronDown size={18} />
                )}
              </div>
              <div
                className={`accordion-content ${
                  openSections[sIdx] ? "open" : ""
                }`}
              >
                {sec.questions.map((q) => (
                  <div
                    key={q.id}
                    className="summary-card"
                    onClick={() => editQuestion(sIdx, q.id)}
                  >
                    <span>{q.title}</span>
                    <b style={{ color: "var(--primary-dark)" }}>
                      {answers[q.id]}
                    </b>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <button
            className="btn-main"
            style={{ marginTop: "30px" }}
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "제출 중..." : "결과 제출"}
          </button>
          {submitMessage && (
            <p
              style={{
                marginTop: "12px",
                textAlign: "center",
                fontSize: "0.9rem",
                color: "#6b7280",
              }}
            >
              {submitMessage}
            </p>
          )}
        </div>
      );
    }

    if (currentQuestionId === "SECTION_INTRO") {
      const sec = surveyData.sections[currentSectionIdx];
      return (
        <div>
          <div className="section-badge">SECTION {currentSectionIdx + 1}</div>
          <h1>{sec.title}</h1>
          <p>해당 섹션의 질문을 시작합니다.</p>
          <button className="btn-main" onClick={startQuestions}>
            질문 시작
          </button>
        </div>
      );
    }

    const sec = surveyData.sections[currentSectionIdx];
    const q = sec.questions.find((item) => item.id === currentQuestionId)!;
    return (
      <div>
        <div className="question-card">
          <div className="section-badge">{sec.title}</div>
          <h2>{q.title}</h2>
        </div>
        <div className="button-card">
          <div className="option-container">
            <div className="row">
              <button
                className="btn-opt"
                onClick={() => handleSelect(q.id, "예", q.next)}
              >
                <Smile size={22} /> 예
              </button>
              <button
                className="btn-opt"
                onClick={() => handleSelect(q.id, "아니요", q.next)}
              >
                <Frown size={22} /> 아니요
              </button>
            </div>
            <button
              className="btn-opt full"
              onClick={() => handleSelect(q.id, "모르겠어요", q.next)}
            >
              모르겠어요
            </button>
          </div>
          <div className="empty-card"></div>
        </div>
      </div>
    );
  };

  const showFooter =
    currentQuestionId === "CAFE_INFO" ||
    (currentQuestionId !== "START" && currentQuestionId !== "SUMMARY");
  const showProgress =
    currentQuestionId !== "START" &&
    currentQuestionId !== "CAFE_INFO" &&
    currentQuestionId !== "SUMMARY";

  return (
    <div className="app-container">
      {onBackToMenu && (
        <div className="toolbar">
          <button className="btn-back subtle" onClick={onBackToMenu}>
            <ChevronLeft size={16} /> 메뉴로 돌아가기
          </button>
          {selectedCafe && (
            <div className="pill">
              <MapPin size={14} /> {selectedCafe.name}
            </div>
          )}
        </div>
      )}

      {showProgress && (
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{
              width: `${
                ((currentSectionIdx + 1) / surveyData.sections.length) * 100
              }%`,
            }}
          ></div>
        </div>
      )}
      <div className="content fade-in">{renderContent()}</div>
      {showFooter && (
        <div className="footer">
          <button className="btn-back" onClick={handleBack}>
            <ChevronLeft size={18} /> 이전으로
          </button>
        </div>
      )}
    </div>
  );
}

type MainView = "menu" | "survey" | "mapSearch" | "mapOverview";

function App() {
  const [view, setView] = useState<MainView>("menu");
  const [selectedCafe, setSelectedCafe] = useState<SelectedCafe | null>(null);

  if (view === "survey") {
    return (
      <>
        <SurveyFlow
          selectedCafe={selectedCafe}
          onBackToMenu={() => setView("menu")}
          onRequestMap={() => setView("mapSearch")}
        />
        <ReportWidget context="survey" selectedCafe={selectedCafe} />
      </>
    );
  }

  if (view === "mapSearch") {
    return (
      <>
        <MapComponent
          selectedCafe={selectedCafe}
          onSelectCafe={(cafe) => {
            setSelectedCafe(cafe);
            setView("survey");
          }}
          onBackToMenu={() => setView("survey")}
        />
        <ReportWidget context="mapSearch" selectedCafe={selectedCafe} />
      </>
    );
  }

  if (view === "mapOverview") {
    return (
      <>
        <div className="app-container">
          <div className="content fade-in">
            <div className="section-badge">지도 보기</div>
            <h1>등록된 탄소중립 카페</h1>
            <p className="muted-text">
              Firebase에 저장된 카페 위치를 지도에서 확인하세요.
            </p>
            <div
              style={{
                borderRadius: "16px",
                overflow: "hidden",
                boxShadow: "0 8px 24px -12px rgba(0,0,0,0.25)",
              }}
            >
              <MapOverview />
            </div>
          </div>
          <div className="footer">
            <button className="btn-back" onClick={() => setView("menu")}>
              <ChevronLeft size={18} /> 메뉴로 돌아가기
            </button>
          </div>
        </div>
        <ReportWidget context="mapOverview" selectedCafe={selectedCafe} />
      </>
    );
  }

  return (
    <>
      <div className="app-container">
        <div className="content fade-in">
          <div className="section-badge">WELCOME</div>
          <h1>탄소중립 카페 찾기</h1>
          <p className="muted-text">
            설문으로 매장의 탄소중립 실천을 진단하고 지도에서 참여 카페를
            찾아보세요.
          </p>

          {selectedCafe && (
            <div className="summary-card" style={{ alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 800, marginBottom: "6px" }}>
                  선택된 카페
                </div>
                <div
                  style={{
                    color: "#6b7280",
                    fontSize: "0.95rem",
                    lineHeight: 1.4,
                  }}
                >
                  {selectedCafe.name}
                  <br />
                  {selectedCafe.address || "주소 정보 없음"}
                </div>
              </div>
              <span className="tag">지도 선택</span>
            </div>
          )}

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              marginTop: "18px",
            }}
          >
            <div className="summary-card" style={{ alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 800, marginBottom: "6px" }}>
                  설문 조사
                </div>
                <div
                  style={{
                    color: "#6b7280",
                    fontSize: "0.95rem",
                    lineHeight: 1.4,
                  }}
                >
                  체크리스트로 매장 운영 상태를 점검하고 결과를 저장합니다.
                </div>
              </div>
              <button
                className="btn-main"
                style={{ width: "160px" }}
                onClick={() => setView("survey")}
              >
                설문 시작
              </button>
            </div>
            <div className="summary-card" style={{ alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 800, marginBottom: "6px" }}>
                  지도 보기
                </div>
                <div
                  style={{
                    color: "#6b7280",
                    fontSize: "0.95rem",
                    lineHeight: 1.4,
                  }}
                >
                  검색해서 카페를 찾으면 설문 정보에 그대로 반영됩니다.
                </div>
              </div>
              <button
                className="btn-back"
                style={{ width: "160px", background: "#f3f4f6" }}
                onClick={() => setView("mapOverview")}
              >
                지도 열기
              </button>
            </div>
          </div>
        </div>
      </div>
      <ReportWidget context="menu" selectedCafe={selectedCafe} />
    </>
  );
}

export default App;
