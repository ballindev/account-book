# Supabase DB 변경 가이드

## 이번 마이그레이션

파일: `migrations/20261005_create_categories_and_category_id.sql`

### 하는 일
1. `categories` 마스터 테이블 생성
2. 기본 카테고리 시드: 식비, 교통, 쇼핑, 문화, 기타
3. 기존 `expenses.category` 텍스트 값을 `categories`에 반영
4. `expenses.category_id` 추가 및 매핑
5. FK / NOT NULL / 인덱스 설정
6. `categories` RLS 정책 추가 (현재 공개 사용 기준)

### 적용 방법
1. Supabase Dashboard → SQL Editor
2. 위 마이그레이션 파일 내용 전체 붙여넣기
3. Run
4. 결과에서 `unmapped_expenses = 0` 인지 확인

### 아직 하지 않는 것
- 앱 코드를 `category_id` 기준으로 전환 (다음 단계)
- 텍스트 `expenses.category` 컬럼 삭제 (앱 전환 후 마지막에 진행)

### 삭제 정책 (앱 구현 시 기준)
- `is_protected = true` (기타): 삭제 불가
- 사용 중인 카테고리: 삭제 전 확인 후 `기타`로 이동하거나 소프트 삭제(`is_active=false`)
