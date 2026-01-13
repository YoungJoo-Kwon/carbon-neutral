import { useEffect, useState } from "react";
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
}

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

  if (loading)
    return <div style={{ padding: "20px" }}>지점을 불러오는 중입니다...</div>;
  if (!window.kakao || !window.kakao.maps) {
    return (
      <div style={{ padding: "20px" }}>
        카카오 맵이 로드되지 않았습니다. 새로고침해 주세요.
      </div>
    );
  }

  const optionPresets = [
    "텀블러 할인",
    "커피박 활용",
    "다회용컵 사용",
    "채식 메뉴",
    "재생에너지",
    "분리수거 우수",
  ];

  const filteredLocations = locations.filter((loc) => {
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
        <input
          type="text"
          placeholder="키워드로 검색 (카페명, 주소)"
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value);
            setActiveId(null);
          }}
        />
        <div className="map-stats">
          {keyword.trim()
            ? `필터 결과: ${filteredLocations.length}곳`
            : `총 ${locations.length}곳`}
        </div>
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
      </div>

      <Map
        center={center}
        style={{ width: "100%", height: "520px" }}
        level={4}
        onCreate={(map) => setMapInstance(map)}
        onCenterChanged={(map) => {
          const c = map.getCenter();
          setCenter({ lat: c.getLat(), lng: c.getLng() });
        }}
      >
        {filteredLocations.map((loc, idx) => {
          const isActive = activeId === loc.id;
          const matchesOption =
            !selectedOption ||
            (loc.options || []).some((opt) =>
              opt?.toLowerCase().includes(selectedOption.toLowerCase()),
            );
          const dimmed = selectedOption ? !matchesOption : false;
          const badge = (
            <div
              onClick={() => setActiveId(loc.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 10px",
                background: isActive
                  ? "#0ea5e9"
                  : matchesOption
                    ? "#111827"
                    : "#9ca3af",
                color: "white",
                borderRadius: 999,
                boxShadow: "0 8px 16px rgba(0,0,0,0.25)",
                cursor: "pointer",
                transform: "translateY(-10px)",
                fontWeight: 700,
                fontSize: "12px",
                border: "1px solid rgba(255,255,255,0.2)",
                opacity: dimmed ? 0.35 : 1,
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "white",
                  color: isActive
                    ? "#0ea5e9"
                    : matchesOption
                      ? "#111827"
                      : "#9ca3af",
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
          );

          return (
            <div key={loc.id}>
              <MapMarker
                position={{ lat: loc.lat, lng: loc.lng }}
                clickable
                onClick={() => setActiveId(loc.id)}
                image={{
                  src: isActive
                    ? "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png"
                    : matchesOption
                      ? "https://t1.daumcdn.net/mapjsapi/images/2x/pin_spot.png"
                      : "https://t1.daumcdn.net/mapjsapi/images/marker_b.png",
                  size: { width: 24, height: 35 },
                }}
              />
              <CustomOverlayMap
                position={{ lat: loc.lat, lng: loc.lng }}
                yAnchor={1.2}
                zIndex={isActive ? 3 : 1}
              >
                {badge}
              </CustomOverlayMap>
              {isActive && (
                <CustomOverlayMap
                  position={{ lat: loc.lat, lng: loc.lng }}
                  yAnchor={-0.2}
                  zIndex={3}
                >
                  <div
                    style={{
                      background: "white",
                      padding: "10px 12px",
                      borderRadius: 12,
                      boxShadow: "0 10px 22px rgba(0,0,0,0.25)",
                      minWidth: 220,
                      border: "1px solid #e5e7eb",
                    }}
                  >
                    <div style={{ fontWeight: 800, marginBottom: 4 }}>
                      {loc.name}
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
                      <div style={{ color: "#f59e0b" }}>
                        {"★".repeat(loc.stars)}
                      </div>
                    ) : (
                      <div style={{ color: "#9ca3af" }}>별점 정보 없음</div>
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
