# GitHub 업데이트 스크립트
# Carbon Neutral Cafe 프로젝트를 GitHub에 업데이트하기 위한 스크립트

echo "=== Carbon Neutral Cafe - GitHub 업데이트 스크립트 ==="
echo ""

# 1. 현재 상태 확인
echo "1. 현재 Git 상태 확인..."
git status
echo ""

# 2. 변경사항 스테이징
echo "2. 변경사항 스테이징..."
git add .
echo "✓ 모든 변경사항이 스테이징되었습니다."
echo ""

# 3. 커밋 메시지 작성
echo "3. 커밋 생성..."
COMMIT_MESSAGE="feat: 지도 기능 개선 및 버그 수정

- 지도 표출 문제 해결 (KakaoMapProvider 제거)
- MapOverview 컴포넌트 Hook 호출 순서 버그 수정
- 지도 범위 변경 시 리스트 실시간 업데이트
- 리스트 스크롤 초기화로 누적 문제 해결
- Firebase 및 Kakao Places 데이터 통합 개선"

git commit -m "$COMMIT_MESSAGE"
echo "✓ 커밋이 생성되었습니다."
echo ""

# 4. 원격 저장소 확인
echo "4. 원격 저장소 상태 확인..."
git remote -v
echo ""

# 5. 푸시 전 확인
echo "5. 푸시 전 최종 확인..."
git log --oneline -3
echo ""
echo "푸시할 변경사항:"
git show --stat HEAD
echo ""

# 6. 푸시 실행 (수동 확인 필요)
echo "6. GitHub로 푸시 준비 완료!"
echo ""
echo "⚠️  다음 명령어를 실행하여 GitHub로 푸시하세요:"
echo "   git push origin main"
echo ""
echo "💡 만약 브랜치 이름이 다르다면 'main'을 실제 브랜치 이름으로 변경하세요."
echo ""
echo "=== 스크립트 완료 ==="