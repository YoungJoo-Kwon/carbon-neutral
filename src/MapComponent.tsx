import { useEffect, useRef, useState } from 'react';
import { Map, MapMarker } from 'react-kakao-maps-sdk';
import { db } from './firebaseConfig';
import { collection, getDocs } from 'firebase/firestore';

export interface SelectedCafe {
  id?: string;
  lat: number;
  lng: number;
  name: string;
  address?: string | null;
  stars?: number;
}

interface CafeLocation {
  id: string;
  lat: number;
  lng: number;
  name: string;
  stars: number;
}

interface MapComponentProps {
  onSelectCafe?: (cafe: SelectedCafe) => void;
  onBackToMenu?: () => void;
  selectedCafe?: SelectedCafe | null;
}

declare global {
  interface Window {
    kakao: any;
  }
}

function MapComponent({ onSelectCafe, onBackToMenu, selectedCafe }: MapComponentProps) {
  const [locations, setLocations] = useState<CafeLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [center, setCenter] = useState<{ lat: number; lng: number }>({
    lat: selectedCafe?.lat || 37.5665,
    lng: selectedCafe?.lng || 126.9780
  });
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hasUserCentered, setHasUserCentered] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const placesRef = useRef<any>(null);

  useEffect(() => {
    if (window.kakao && window.kakao.maps && window.kakao.maps.services && !placesRef.current) {
      placesRef.current = new window.kakao.maps.services.Places();
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'surveyResults'));
        const data: CafeLocation[] = querySnapshot.docs.map(doc => {
          const item = doc.data();
          const starsValue = item.grade?.stars;
          const stars =
            typeof starsValue === 'number'
              ? starsValue
              : typeof starsValue === 'string'
                ? starsValue.length
                : 0;

          return {
            id: doc.id,
            lat: Number(item.location?.lat) || 37.5665,
            lng: Number(item.location?.lng) || 126.9780,
            name: item.cafeName || '이름 없음',
            stars
          };
        });

        setLocations(data);
      } catch (error) {
        console.error('Firebase 데이터를 불러오지 못했습니다:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (selectedCafe) {
      setCenter({ lat: selectedCafe.lat, lng: selectedCafe.lng });
      if (mapInstance && window.kakao?.maps) {
        mapInstance.setCenter(new window.kakao.maps.LatLng(selectedCafe.lat, selectedCafe.lng));
      }
    }
  }, [selectedCafe, mapInstance]);

  // 현재 위치로 지도 중심 이동
  useEffect(() => {
    if (hasUserCentered) return;
    if (!navigator.geolocation || !window.kakao?.maps) {
      setHasUserCentered(true);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCenter(coords);
        if (mapInstance) {
          mapInstance.setCenter(new window.kakao.maps.LatLng(coords.lat, coords.lng));
        }
        setHasUserCentered(true);
      },
      () => setHasUserCentered(true)
    );
  }, [mapInstance, hasUserCentered]);

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    if (!placesRef.current) {
      setSearchError('카카오 지도 서비스가 아직 로드되지 않았습니다. 잠시 후 다시 시도하세요.');
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    const locationOption =
      window.kakao?.maps && mapInstance
        ? { location: new window.kakao.maps.LatLng(center.lat, center.lng) }
        : undefined;

    placesRef.current.keywordSearch(
      searchQuery,
      (data: any[], status: string) => {
        setIsSearching(false);
        if (status === window.kakao.maps.services.Status.OK) {
          setSearchResults(data);
          const first = data[0];
          const lat = parseFloat(first.y);
          const lng = parseFloat(first.x);
          setCenter({ lat, lng });
          setActiveId(`search-${first.id}`);
          if (mapInstance && window.kakao?.maps) {
            mapInstance.setCenter(new window.kakao.maps.LatLng(lat, lng));
          }
        } else if (status === window.kakao.maps.services.Status.ZERO_RESULT) {
          setSearchResults([]);
          setSearchError('검색 결과가 없습니다.');
        } else {
          setSearchError('검색 중 오류가 발생했습니다. 다시 시도해 주세요.');
        }
      },
      locationOption
    );
  };

  const handleSelectResult = (res: any) => {
    const lat = parseFloat(res.y);
    const lng = parseFloat(res.x);
    const cafe: SelectedCafe = {
      id: res.id,
      name: res.place_name,
      lat,
      lng,
      address: res.road_address_name || res.address_name || null
    };
    setActiveId(`search-${res.id}`);
    setCenter({ lat, lng });
    if (mapInstance && window.kakao?.maps) {
      mapInstance.setCenter(new window.kakao.maps.LatLng(lat, lng));
    }
    const confirmed = window.confirm(`${res.place_name} 카페가 맞습니까?`);
    if (!confirmed) return;
    onSelectCafe?.(cafe);
  };

  if (loading) return <div style={{ padding: '20px' }}>지도를 불러오는 중입니다...</div>;
  if (!window.kakao || !window.kakao.maps) {
    return <div style={{ padding: '20px' }}>카카오 맵이 로드되지 않았습니다. 새로고침해 주세요.</div>;
  }

  return (
    <div className="app-container wide">
      <div className="toolbar">
        {onBackToMenu && (
          <button className="btn-back subtle" onClick={onBackToMenu}>
            메인으로 돌아가기
          </button>
        )}
        {selectedCafe && (
          <div className="pill">
            선택됨: {selectedCafe.name}
          </div>
        )}
      </div>

      <div className="content fade-in">
        <div className="section-badge">VIEW</div>
        <h1>탄소중립 지도</h1>
        <p className="muted-text">
          저장된 설문 결과를 지도에서 확인하고, 카페를 검색해 선택하면 설문에 함께 기록됩니다.
        </p>

        <div className="map-search">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="카페 이름 또는 주소를 입력하세요"
          />
          <button onClick={handleSearch} disabled={isSearching}>
            {isSearching ? '검색 중...' : '검색'}
          </button>
        </div>
        {searchError && <div className="error-text">{searchError}</div>}
        {searchResults.length > 0 && (
          <div className="search-results">
            {searchResults.map(res => (
              <button
                key={res.id}
                className={`search-item ${activeId === res.id ? 'active' : ''}`}
                onClick={() => handleSelectResult(res)}
              >
                <div className="search-title">{res.place_name}</div>
                <div className="muted-text">{res.road_address_name || res.address_name}</div>
              </button>
            ))}
          </div>
        )}

          <div className="map-frame">
          <Map
            center={center}
            style={{ width: '100%', height: '520px' }}
            level={3}
            onCreate={(map) => setMapInstance(map)}
            onCenterChanged={(map) => {
              const c = map.getCenter();
              setCenter({ lat: c.getLat(), lng: c.getLng() });
            }}
          >
            {locations.map((loc) => (
              <MapMarker
                key={loc.id}
                position={{ lat: loc.lat, lng: loc.lng }}
                clickable
                onClick={() => setActiveId(loc.id)}
              >
                {activeId === loc.id && (
                  <div className="info-window">
                    <div className="info-title">{loc.name}</div>
                    <div className="info-stars">{'★'.repeat(loc.stars || 0)}</div>
                  </div>
                )}
              </MapMarker>
            ))}

            {searchResults.map((res) => {
              const lat = parseFloat(res.y);
              const lng = parseFloat(res.x);
              const id = `search-${res.id}`;
              return (
                <MapMarker
                  key={id}
                  position={{ lat, lng }}
                  clickable
                  onClick={() => handleSelectResult(res)}
                >
                  {activeId === id && (
                    <div className="info-window">
                      <div className="info-title">{res.place_name}</div>
                      <div className="muted-text">{res.road_address_name || res.address_name}</div>
                    </div>
                  )}
                </MapMarker>
              );
            })}

            {selectedCafe && (
              <MapMarker
                key="selected"
                position={{ lat: selectedCafe.lat, lng: selectedCafe.lng }}
                clickable
                onClick={() => setActiveId(selectedCafe.id || 'selected')}
              >
                {activeId === (selectedCafe.id || 'selected') && (
                  <div className="info-window">
                    <div className="info-title">{selectedCafe.name}</div>
                    <div className="muted-text">{selectedCafe.address || '선택한 카페'}</div>
                  </div>
                )}
              </MapMarker>
            )}
          </Map>
        </div>
      </div>
    </div>
  );
}

export default MapComponent;
