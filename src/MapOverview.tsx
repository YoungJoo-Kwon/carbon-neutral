import { useEffect, useState, useCallback, useRef } from "react";
import { Map, MapMarker, CustomOverlayMap } from "react-kakao-maps-sdk";
import { db } from "./firebaseConfig";
import { collection, getDocs } from "firebase/firestore";

declare global {
  interface Window {
    kakao: any;
  }
}

interface CafePoint {
  id: string;
  lat: number;
  lng: number;
  name: string;
  stars?: number;
  address?: string | null;
  options?: string[];
  gradeLevel?: number;
  gradeColor?: string;
  isFromKakao?: boolean; // true = Kakao 검색 결과, false/undefined = Firebase 데이터
}

// 두 좌표 간의 거리(미터) 계산 (Haversine 공식)
const calculateDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number => {
  const R = 6371e3; // 지구 반지름 (미터)
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// 계열사 카페 기본 옵션 반환 (JSON에서 로드한 데이터 사용)
const getChainCafeOptions = (cafeName: string, chains: Array<{ name: string; keywords: string[]; options: string[] }>): string[] => {
  const name = cafeName.toLowerCase();
  const options: string[] = [];

  for (const chain of chains) {
    // keywords 중 하나라도 카페명에 포함되면 해당 chain의 options 추가
    if (chain.keywords.some(keyword => name.includes(keyword.toLowerCase()))) {
      chain.options.forEach(opt => {
        if (!options.includes(opt)) options.push(opt);
      });
    }
  }

  return options;
};

function MapOverview() {
  const [locations, setLocations] = useState<CafePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [center, setCenter] = useState<{ lat: number; lng: number }>({
    lat: 37.5665,
    lng: 126.978,
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [keyword, setKeyword] = useState<string>("");
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [kakaoResults, setKakaoResults] = useState<CafePoint[]>([]);
  const [chainCafes, setChainCafes] = useState<Array<{ name: string; keywords: string[]; options: string[] }>>([]);
  const [mapBounds, setMapBounds] = useState<{ sw: { lat: number; lng: number }; ne: { lat: number; lng: number } } | null>(null);
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Kakao Places에서 '커피전문점' 검색
  const searchCoffeePlaces = useCallback(
    async (centerLat: number, centerLng: number) => {
      if (!window.kakao?.maps?.services?.Places) {
        console.warn("Kakao Places API not ready");
        return;
      }

      // Helpers: wrap keywordSearch in a Promise so we can await pages
      const fetchPage = (page: number) =>
        new Promise<any[]>((resolve) => {
          try {
            const placesService = new window.kakao.maps.services.Places();
            placesService.keywordSearch(
              "커피전문점",
              (result: any[], status: any) => {
                if (status === window.kakao.maps.services.Status.OK && result.length > 0) {
                  resolve(result);
                } else {
                  resolve([]);
                }
              },
              { location: new window.kakao.maps.LatLng(centerLat, centerLng), page },
            );
          } catch (e) {
            resolve([]);
          }
        });

      try {
        const MAX_PAGES = 5; // configurable: pages to fetch (each page ~15 results)
        const MAX_TOTAL = 150; // safety cap to avoid huge result sets
        const collected: any[] = [];
        const seen = new Set<string>();

        for (let p = 1; p <= MAX_PAGES; p++) {
          // eslint-disable-next-line no-await-in-loop
          const pageResults = await fetchPage(p);
          if (!pageResults || pageResults.length === 0) break;

          for (const place of pageResults) {
            if (seen.has(place.id)) continue;
            seen.add(place.id);
            const dist = calculateDistance(centerLat, centerLng, Number(place.y), Number(place.x));
            collected.push({ place, distance: dist });
            if (collected.length >= MAX_TOTAL) break;
          }
          if (collected.length >= MAX_TOTAL) break;
          // small pause to be gentle on API
          // eslint-disable-next-line no-await-in-loop
          await new Promise((r) => setTimeout(r, 120));
        }

        // sort by distance and limit to desired display size (we keep extra for merging logic)
        collected.sort((a, b) => a.distance - b.distance);
        const RESULTS_LIMIT = 60; // keep a buffer for merging
        const top = collected.slice(0, RESULTS_LIMIT).map(({ place }) => ({
          id: `kakao_${place.id}`,
          lat: Number(place.y),
          lng: Number(place.x),
          name: place.place_name,
          address: place.address_name || null,
          isFromKakao: true,
          options: getChainCafeOptions(place.place_name, chainCafes),
        }));

        setKakaoResults(top);
      } catch (error) {
        console.error("Kakao Places 검색 오류:", error);
        setKakaoResults([]);
      }
    },
    [chainCafes],
  );

  useEffect(() => {
    // cafe-chains.json 로드
    const loadChainCafes = async () => {
      try {
        const response = await fetch("/cafe-chains.json");
        if (!response.ok) throw new Error("Failed to load cafe chains");
        const data = await response.json();
        setChainCafes(data.chains || []);
      } catch (error) {
        console.warn("계열사 카페 정보 로드 실패:", error);
        setChainCafes([]);
      }
    };

    loadChainCafes();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const snap = await getDocs(collection(db, "surveyResults"));
        const data: CafePoint[] = snap.docs.map((doc) => {
          const item = doc.data();
          const answersBool = item.answersBool || {};
          const answers = item.answers || {};
          const normalizeYes = (v: any) => {
            if (typeof v === "boolean") return v;
            if (typeof v === "string") {
              const lower = v.toLowerCase();
              if (lower === "예" || lower === "네") return true;
              if (lower === "아니요") return false;
              return lower === "yes" || lower === "y";
            }
            return false;
          };

          const starsValue = item.grade?.stars;
          const stars =
            typeof starsValue === "number"
              ? starsValue
              : typeof starsValue === "string"
                ? starsValue.length
                : 0;

          // grade level (1..3) -> map to color
          const gradeLevel = stars >= 3 ? 3 : stars === 2 ? 2 : 1;
          const gradeColor = gradeLevel === 3 ? "#16a34a" : gradeLevel === 2 ? "#f59e0b" : "#ef4444";

          const derivedOptions: string[] = [];
          if (normalizeYes(answersBool.q1_2 ?? answers.q1_2))
            derivedOptions.push("텀블러 할인");
          if (normalizeYes(answersBool.q4_2 ?? answers.q4_2))
            derivedOptions.push("커피박 활용");

          const existingOptions = item.options || item.tags || [];
          const combinedOptions = Array.from(
            new Set([...(existingOptions as string[]), ...derivedOptions]),
          );

          return {
            id: doc.id,
            lat: Number(item.location?.lat) || 37.5665,
            lng: Number(item.location?.lng) || 126.978,
            name: item.cafeName || "이름 없음",
            stars,
            address: item.cafeAddress || null,
            options: combinedOptions,
            gradeLevel,
            gradeColor,
          };
        });
        setLocations(data);
      } catch (error) {
        console.error("지점 정보를 불러오지 못했습니다:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (!navigator.geolocation || !window.kakao?.maps) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCenter(coords);
        if (mapInstance) {
          mapInstance.setCenter(
            new window.kakao.maps.LatLng(coords.lat, coords.lng),
          );
        }
      },
      () => {},
    );
  }, [mapInstance]);

  useEffect(() => {
    if (!mapInstance || !window.kakao?.maps || locations.length === 0) return;
    const bounds = new window.kakao.maps.LatLngBounds();
    locations.forEach((loc) =>
      bounds.extend(new window.kakao.maps.LatLng(loc.lat, loc.lng)),
    );
    mapInstance.setBounds(bounds);
  }, [mapInstance, locations]);



  // Kakao Places 검색 - 지도 중심 변경 시
  useEffect(() => {
    if (!mapInstance || !window.kakao?.maps) return;
    const timer = setTimeout(() => {
      searchCoffeePlaces(center.lat, center.lng);
    }, 800); // debounce
    return () => clearTimeout(timer);
  }, [center, mapInstance, searchCoffeePlaces]);

  // Firebase 데이터와 Kakao 검색 결과 병합
  // 같은 지점의 여러 데이터는 하나로 병합하고 별점 평균화
  const mergedLocations = (() => {
    const MATCH_THRESHOLD_M = 100; // 100m 이내를 같은 카페로 간주
    const merged: CafePoint[] = [];
    const processedKakaoIds = new Set<string>();

    // 각 Kakao 결과에 대해 Firebase 데이터 매칭 시도
    kakaoResults.forEach((kakaoLoc) => {
      // 같은 위치의 모든 Firebase 데이터 찾기
      const matchedFbLocs: CafePoint[] = [];
      locations.forEach((fbLoc) => {
        const dist = calculateDistance(kakaoLoc.lat, kakaoLoc.lng, fbLoc.lat, fbLoc.lng);
        if (dist < MATCH_THRESHOLD_M) {
          matchedFbLocs.push(fbLoc);
        }
      });

      if (matchedFbLocs.length > 0) {
        // 여러 Firebase 데이터 병합: 별점 평균화
        const avgStars = matchedFbLocs.reduce((sum, fb) => sum + (fb.stars || 0), 0) / matchedFbLocs.length;
        const gradeLevel = avgStars >= 3 ? 3 : avgStars >= 2 ? 2 : 1;
        const gradeColor = gradeLevel === 3 ? "#16a34a" : gradeLevel === 2 ? "#f59e0b" : "#ef4444";
        
        // 모든 옵션 합치기 (중복 제거)
        const allOptions = new Set<string>();
        matchedFbLocs.forEach((fbLoc) => {
          fbLoc.options?.forEach((opt) => allOptions.add(opt));
        });
        // 계열사 기본 옵션도 추가
        getChainCafeOptions(kakaoLoc.name, chainCafes).forEach((opt) => allOptions.add(opt));

        const merged_item: CafePoint = {
          id: matchedFbLocs[0].id, // 첫 번째 Firebase ID 사용
          lat: kakaoLoc.lat,
          lng: kakaoLoc.lng,
          name: kakaoLoc.name,
          address: kakaoLoc.address,
          stars: Math.round(avgStars * 10) / 10, // 소수점 1자리
          gradeLevel,
          gradeColor,
          options: Array.from(allOptions),
          isFromKakao: false, // Firebase 데이터 포함됨
        };
        merged.push(merged_item);
      } else {
        // Firebase 매칭 없음: 계열사 옵션만 추가해서 Kakao 결과로 저장
        merged.push(kakaoLoc);
      }
      processedKakaoIds.add(kakaoLoc.id);
    });

    // Firebase 데이터 중 Kakao와 매칭되지 않은 항목 추가
    locations.forEach((fbLoc) => {
      let alreadyMerged = false;
      for (const kakaoLoc of kakaoResults) {
        const dist = calculateDistance(fbLoc.lat, fbLoc.lng, kakaoLoc.lat, kakaoLoc.lng);
        if (dist < MATCH_THRESHOLD_M) {
          alreadyMerged = true;
          break;
        }
      }
      if (!alreadyMerged) {
        merged.push(fbLoc);
      }
    });

    // 지도 중심으로부터의 거리 순서로 정렬 (Kakao와 Firebase 섞임)
    merged.sort((a, b) => {
      const distA = calculateDistance(center.lat, center.lng, a.lat, a.lng);
      const distB = calculateDistance(center.lat, center.lng, b.lat, b.lng);
      return distA - distB;
    });

    return merged;
  })();

  if (loading)
    return <div style={{ padding: "20px" }}>지점을 불러오는 중입니다...</div>;
  if (!window.kakao || !window.kakao.maps) {
    console.error('Kakao SDK not available on window.kakao');
    return (
      <div style={{ padding: "20px" }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>카카오 맵 로드 실패</div>
        <div style={{ marginBottom: 8 }}>
          카카오 지도 SDK가 로드되지 않았습니다. 다음을 확인해 주세요:
        </div>
        <ul style={{ marginTop: 0 }}>
          <li>`.env`에 `VITE_KAKAO_API_KEY`가 설정되어 있는지 확인하세요.</li>
          <li>개발 서버를 재시작했는지 확인하세요 (`npm run dev` 또는 `npm run preview`).</li>
          <li>브라우저 개발자 도구의 Network 탭에서 `dapi.kakao.com` 요청이 성공했는지 확인하세요.</li>
        </ul>
      </div>
    );
  }

  const optionPresets = [
    "텀블러 할인",
    "전자영수증",
    "베이커리",
    "저탄소메뉴",
    "무인카페",
  ];

  const filteredLocations = mergedLocations.filter((loc) => {
    // 지도 범위 내 필터링
    if (mapBounds) {
      const { sw, ne } = mapBounds;
      if (loc.lat < sw.lat || loc.lat > ne.lat || loc.lng < sw.lng || loc.lng > ne.lng) {
        return false;
      }
    }
    
    // 키워드 필터링
    if (!keyword.trim()) return true;
    const q = keyword.trim().toLowerCase();
    return (
      loc.name.toLowerCase().includes(q) ||
      (loc.address || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="map-frame">
      <div className="map-controls">
        {showSearch && (
          <input
            ref={searchInputRef}
            type="text"
            placeholder="키워드로 검색 (카페명, 주소)"
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              setActiveId(null);
            }}
          />
        )}
        
      </div>
      <div className="option-pills">
        {optionPresets.map((opt) => {
          const isActive = selectedOption === opt;
          return (
            <button
              key={opt}
              onClick={() => setSelectedOption(isActive ? null : opt)}
              className={`option-pill ${isActive ? "active" : ""}`}
            >
              {opt}
            </button>
          );
        })}
        {/* magnifier pill */}
        <button
          key="search-toggle"
          onClick={() => setShowSearch((s) => !s)}
          className={`option-pill search-pill ${showSearch ? "active" : ""}`}
          title="검색"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Legend showing color meanings */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", margin: "10px 0 8px", flexWrap: "wrap" }}>
        <div style={{ color: "#374151", fontSize: 13, fontWeight: 700 }}>탄소중립 수준</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", color: "#374151", fontSize: 13 }}>
          <span style={{ width: 18, height: 18, borderRadius: 6, background: "#16a34a", display: "inline-block", border: "1px solid #fff" }} />
          <span>높음</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", color: "#374151", fontSize: 13 }}>
          <span style={{ width: 18, height: 18, borderRadius: 6, background: "#f59e0b", display: "inline-block", border: "1px solid #fff" }} />
          <span>보통</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", color: "#374151", fontSize: 13 }}>
          <span style={{ width: 18, height: 18, borderRadius: 6, background: "#ef4444", display: "inline-block", border: "1px solid #fff" }} />
          <span>낮음</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", color: "#374151", fontSize: 13 }}>
          <span style={{ width: 18, height: 18, borderRadius: 6, background: "#9ca3af", display: "inline-block", border: "1px solid #fff" }} />
          <span>평가전</span>
        </div>
      </div>

      <Map
        onBoundsChanged={(map) => {
          const bounds = map.getBounds();
          const sw = bounds.getSouthWest();
          const ne = bounds.getNorthEast();
          setMapBounds({
            sw: { lat: sw.getLat(), lng: sw.getLng() },
            ne: { lat: ne.getLat(), lng: ne.getLng() },
          });
        }}
        center={center}
        style={{ width: "100%", height: "520px" }}
        level={4}
        onCreate={(map) => setMapInstance(map)}
        onCenterChanged={(map) => {
          const c = map.getCenter();
          setCenter({ lat: c.getLat(), lng: c.getLng() });
        }}
        onClick={() => setActiveId(null)}
      >
        {filteredLocations.map((loc, idx) => {
          const isActive = activeId === loc.id;
          const matchesOption =
            !selectedOption ||
            (loc.options || []).some((opt: string) =>
              opt?.toLowerCase().includes(selectedOption?.toLowerCase() || ""),
            );
          
          // 키워드 선택 안 함: 모든 마커 표시 (불투명 100%)
          // 키워드 선택 함:
          //   - 매칭됨: 불투명 100% + 배지 표시
          //   - 미매칭: 불투명 30% + 배지 없음
          const showBadge = !selectedOption || matchesOption;
          const markerOpacity = !selectedOption ? 0.5 : (matchesOption ? 1 : 0.3);
          const badgeOpacity = !selectedOption ? 0.7 : (matchesOption ? 1 : 0);
          
          // Kakao 검색 결과(Firebase 데이터 없음)는 회색, Firebase가 있으면 등급 색상
          const markerColor = loc.gradeColor || (loc.isFromKakao ? "#9ca3af" : (isActive ? "#0ea5e9" : matchesOption ? "#111827" : "#9ca3af"));
          
          const badge = showBadge ? (
            <div
              onClick={(e) => {
                e.stopPropagation();
                setActiveId(loc.id);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 10px",
                background: markerColor,
                color: "white",
                borderRadius: 999,
                boxShadow: "0 8px 16px rgba(0,0,0,0.25)",
                cursor: "pointer",
                transform: "translateY(-10px)",
                fontWeight: 700,
                fontSize: "12px",
                border: "1px solid rgba(255,255,255,0.2)",
                opacity: badgeOpacity,
                transition: "opacity 0.2s ease",
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "white",
                  color: markerColor,
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 800,
                  fontSize: "11px",
                }}
              >
                {idx + 1}
              </div>
              <span style={{ whiteSpace: "nowrap" }}>{loc.name}</span>
            </div>
          ) : null;

          // create SVG marker colored by markerColor - 점 모양
          const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' width='16' height='16'><circle cx='8' cy='8' r='7' fill='${markerColor}' stroke='%23ffffff' stroke-width='2' opacity='${markerOpacity}'/></svg>`;
          const dataUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

          return (
            <div key={loc.id}>
              <MapMarker
                position={{ lat: loc.lat, lng: loc.lng }}
                clickable
                onClick={() => setActiveId(loc.id)}
                image={{ src: dataUrl, size: { width: 16, height: 16 } }}
              />
              {badge && (
                <CustomOverlayMap
                  position={{ lat: loc.lat, lng: loc.lng }}
                  yAnchor={1.2}
                  zIndex={isActive ? 3 : 1}
                >
                  {badge}
                </CustomOverlayMap>
              )}
              {isActive && (
                <CustomOverlayMap
                  position={{ lat: loc.lat, lng: loc.lng }}
                  yAnchor={-0.2}
                  zIndex={3}
                >
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      background: "white",
                      padding: "10px 12px",
                      borderRadius: 12,
                      boxShadow: "0 10px 22px rgba(0,0,0,0.25)",
                      minWidth: 220,
                      border: "1px solid #e5e7eb",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                      <div style={{ fontWeight: 800 }}>
                        {loc.name}
                        {loc.isFromKakao && !loc.stars && (
                          <span style={{ fontSize: "10px", color: "#9ca3af", fontWeight: 400, marginLeft: 4 }}>
                            (검색 결과)
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => setActiveId(null)}
                        style={{
                          background: "none",
                          border: "none",
                          fontSize: "18px",
                          cursor: "pointer",
                          color: "#9ca3af",
                          padding: "0 4px",
                          lineHeight: 1,
                          marginLeft: 8,
                        }}
                        title="닫기"
                      >
                        ✕
                      </button>
                    </div>
                    {loc.address && (
                      <div
                        style={{
                          color: "#6b7280",
                          fontSize: "12px",
                          marginBottom: 6,
                        }}
                      >
                        {loc.address}
                      </div>
                    )}
                    {loc.stars ? (
                      <div style={{ color: "#f59e0b", marginBottom: 4 }}>
                        {"★".repeat(loc.stars)}
                      </div>
                    ) : (
                      <div style={{ color: "#9ca3af", fontSize: "12px", marginBottom: 4 }}>별점 정보 없음</div>
                    )}
                    {loc.options && loc.options.length > 0 && (
                      <div style={{ fontSize: "11px", color: "#6b7280", marginTop: 4 }}>
                        태그: {loc.options.join(", ")}
                      </div>
                    )}
                  </div>
                </CustomOverlayMap>
              )}
            </div>
          );
        })}
      </Map>

    </div>
  );
}

export default MapOverview;
