# MoA (모아)

> 흩어진 스크린샷을 나의 실천으로 모아요.
갤러리에 쌓인 스크린샷을 스와이프로 **실천 / 참고 / 삭제**로 나누고, 실천으로 고른 사진은 **AI가 마감기한·카테고리·실천 방법(체크리스트)** 으로 정리해 주는 앱이에요. 마감이 다가오거나, 저장한 장소 근처에 가면 푸시 알림으로 다시 떠올려 줘요.

- **프론트엔드(이 저장소)**: React Native + Expo (Android 우선)
- **백엔드**: Spring Boot + MySQL, GCP 배포 — 별도 저장소 `Line4-Likelion/Moa_BE`

---

## 목차

1. [핵심 기능](#1-핵심-기능)
2. [기술 스택](#2-기술-스택)
3. [전체 구조와 데이터 흐름](#3-전체-구조와-데이터-흐름)
4. [백엔드 상세](#4-백엔드-상세)
5. [프론트엔드 상세](#5-프론트엔드-상세)
6. [개발 환경 세팅과 실행](#6-개발-환경-세팅과-실행)
7. [빌드와 배포](#7-빌드와-배포)
8. [협업 규칙](#8-협업-규칙)
9. [보안 · 비밀 관리](#9-보안--비밀-관리)
10. [알려진 제한과 앞으로 할 일](#10-알려진-제한과-앞으로-할-일)

---

## 1. 핵심 기능

기능 명세서의 A~D 파트 기준이에요.

### A. 사진 불러오기와 분류
| 기능 | 설명 |
|---|---|
| 갤러리 권한 | 사진 접근 권한을 요청하고, 거부되면 시스템 설정으로 안내하는 화면을 보여줘요. |
| 스크린샷 불러오기 | 안드로이드는 `Screenshots`/`스크린샷` 등의 앨범, iOS는 스크린샷 서브타입에서 아직 분류하지 않은 사진만 가져와요. |
| 처음 세팅(온보딩) | 분류할 범위를 고르면(최근 30장 / 최근 한 달 / 전체) 그 범위가 "새 캡처", 나머지는 "지난 캡처"가 돼요. |
| 스와이프 분류 | 사진을 한 장씩 넘기며 **실천하기 / 참고하기 / 삭제**로 나눠요. 한 번에 12장 이하는 전부, 그보다 많으면 10장씩 나눠요. |
| 분류 취소·변경 | 이전 사진으로 돌아가 분류를 바꾸거나 취소할 수 있어요. 서버에 저장된 뒤에 다음 사진으로 넘어가요. |
| 삭제 | 삭제로 모은 사진은 묶음 완료 시 한 번 더 확인한 뒤 **기기에서** 삭제해요. 삭제 성공 후에만 서버에 기록해요. |

### B. AI 분석과 카테고리
| 기능 | 설명 |
|---|---|
| OCR + AI 분석 | 실천으로 분류한 사진을 서버로 올리면 OCR(Google Vision) → LLM(OpenAI)으로 분석해요. 사진은 분석에만 쓰고 **저장하지 않아요.** |
| 마감기한 판단 | `FOUND`(기한 있음) / `UNCLEAR`(날짜는 있지만 기한인지 불명확) / `NONE`(기한 없음)으로 구분해요. |
| 카테고리 분류 | 기본 카테고리 `패션·맛집·여행·레시피·정보·생활·기타` 중에서 AI가 정해요. 사용자가 직접 바꾸면 `category_source`가 `USER`가 돼요. |
| 카테고리 추가 | 사용자 카테고리를 만들 수 있어요(50자 이하, 중복 이름 불가). |
| 분석 진행 표시 | 분석 중에는 단계(원문 확인 → 정리 → 완료)를 보여주고, 실패하면 원인과 함께 **다시 분석**을 제공해요. |
| 추출 정보 | 제목(20자 이하), 핵심 정보(최대 6개), 실천 가이드, 체크리스트(최대 5개), 링크, 장소를 만들어 줘요. |

### C. 실천 상세와 보관함
| 기능 | 설명 |
|---|---|
| 실천함 | 진행 중·보류·완료 항목, 마감 임박·지남 표시, 카테고리 칩, 선택 모드 일괄 처리를 지원해요. |
| 실천 상세 | 원본 사진, 추출 정보, AI 실천 가이드, 체크리스트, 링크를 보여줘요. |
| 원본 전체 보기 | AI가 정보를 찾은 **위치(box)** 를 원본 위에 표시해요. |
| 정보 수정 | 추출된 정보를 고치고, `AI가 읽은 값으로 되돌리기`가 가능해요. |
| 완료 / 보류 / 안함 | 완료, 보류(날짜 선택, 기본은 다음 주 같은 요일), 안함(참고함으로 이동)을 처리해요. 처리 직후 **5초 동안 되돌리기**가 돼요. |
| 다시 하기 | 완료한 항목을 다시 진행 중으로 되돌려요. |
| 완료율 | `완료 ÷ (완료 + 실천 대기)`와 최근 6주 추이를 보여줘요. |
| 참고함 | 카테고리 칩(**미분류가 맨 앞**), 선택 모드로 여러 장 카테고리 변경 · **삭제** · **실천으로 바꾸기**, 참고함 상세(사진 확대)를 지원해요. |

### D. 리마인드와 마이페이지
| 기능 | 설명 |
|---|---|
| 마감 알림 | 마감일 **오전 9시(KST)** 에 푸시를 보내요. |
| 위치 기반 알림 | 저장한 장소 반경 **300m**에 들어가면 푸시를 보내요(장소별 하루 한 번). |
| 푸시 클릭 이동 | 알림을 누르면 해당 실천 상세로 이동해요(딥링크 `moa://captures/{id}`). |
| 알림 설정 | 리마인드 간격(12/24/48시간), 방해금지, 위치 기반 알림을 설정해요. |
| 권한 안내 | 알림·위치·사진 권한이 없을 때 이유와 함께 시스템 설정으로 안내해요. |
| 프로필 · 로그아웃 | 닉네임·이메일 조회, 로그아웃, 로그인 유지를 지원해요. |

---

## 2. 기술 스택

### 프론트엔드
| 구분 | 사용 기술 |
|---|---|
| 프레임워크 | Expo SDK 58, React Native 0.88, React 19.3 |
| 언어 | TypeScript 6 (`strict`) |
| 내비게이션 | React Navigation 7 (Native Stack + Bottom Tabs) |
| 상태 관리 | 외부 라이브러리 없이 `useSyncExternalStore` 기반 자체 스토어 (`src/store`) |
| 아이콘 · 폰트 | `lucide-react-native`, `react-native-svg`, Noto Sans KR · Noto Serif KR |
| 네이티브 모듈 | `expo-media-library`(갤러리), `expo-image-manipulator`(업로드용 JPEG), `expo-secure-store`(토큰), `expo-notifications`(푸시), `expo-location` + `expo-task-manager`(지오펜스), `expo-dev-client`, `expo-splash-screen`, `expo-linking`, `@react-native-async-storage/async-storage` |
| 빌드 | EAS Build (개발용 APK / preview / production) |

### 백엔드
| 구분 | 사용 기술 |
|---|---|
| 프레임워크 | Spring Boot 4.1 (Java 17), Spring Web MVC |
| 데이터 | MySQL, Spring Data JPA (Hibernate `ddl-auto: update`) |
| 인증 | Spring Security + JWT (jjwt 0.12), Access / Refresh 토큰 |
| API 문서 | springdoc-openapi (Swagger UI) |
| 푸시 | Firebase Admin SDK (FCM) |
| AI | Google Cloud Vision (OCR), OpenAI (기본 모델 `gpt-4.1-mini`) |
| 지오코딩 | Kakao Local API (주소·장소명 → 좌표) |
| 빌드 · 배포 | Gradle, GitHub Actions → GCP Compute Engine |

### 인프라
- **서버**: GCP Compute Engine (Ubuntu 22.04, e2-small, 고정 IP, 8080 포트)
- **DB / Java**: VM 내부에 MySQL, Java 17 직접 설치
- **배포 파이프라인**: `main` 푸시 → GitHub Actions가 `./gradlew bootJar` → SCP 전송 → 기존 프로세스 종료 후 `nohup java -jar` 실행

---

## 3. 전체 구조와 데이터 흐름

```
┌────────────────────────────┐        HTTPS/HTTP + JWT        ┌─────────────────────────────┐
│  앱 (React Native / Expo)   │ ─────────────────────────────▶ │  Spring Boot API 서버        │
│                            │ ◀───────────────────────────── │                             │
│  · 갤러리 스크린샷 읽기      │       {success, code,          │  Auth / User / Category     │
│  · 스와이프 분류             │        message, data}          │  Classification / Capture   │
│  · 실천함 · 참고함 · 마이     │                                │  Analysis / Alarm(Geofence) │
│  · 지오펜스 등록(백그라운드)  │                                └───────┬───────────┬─────────┘
└─────────────▲──────────────┘                                        │           │
              │ FCM 푸시                                         MySQL │           │ 외부 API
              │ (data: type, capture_id, deeplink)                     ▼           ▼
              └────────────────── Firebase Cloud Messaging     [사용자·분류·분석·알림]  Vision(OCR)
                                                                                        OpenAI(LLM)
                                                                                        Kakao(좌표)
```

### 핵심 시나리오

**스크린샷 → 실천 정리**
1. 앱이 갤러리에서 아직 분류하지 않은 스크린샷을 불러와요.
2. 사용자가 스와이프로 분류하면 `POST /screenshot-classifications`로 `{fileKey, classification}`을 저장해요. `fileKey`는 **기기 사진 ID**이고, 서버는 원본 이미지를 갖고 있지 않아요.
3. 실천으로 분류한 사진은 앱이 JPEG로 변환해 `POST /captures/{id}/analysis`(multipart)로 올려요 → 서버가 `202`와 `job_id`를 돌려줘요.
4. 앱이 `GET /analysis-jobs?ids=`를 2초 간격으로 확인해요(`PENDING → RUNNING → SUCCEEDED / FAILED`).
5. 성공하면 `GET /captures/{id}`로 상세(핵심 정보·가이드·체크리스트)를 받아 화면에 보여줘요.

**알림**
- 분석 결과의 마감일이 `FOUND`이면 서버가 마감일 09:00에 알림을 예약하고, 1분 간격 스케줄러가 시간이 된 알림을 FCM으로 보내요.
- 앱은 로그인 후 FCM 토큰을 `POST /push-tokens`로 등록해요. 알림을 누르면 `capture_id`로 실천 상세가 열려요.

**위치 알림**
1. 사용자가 위치 알림을 켜면 서버에 설정을 저장하고, `GET /geofences`로 좌표가 있는 장소 목록을 받아 기기에 지오펜스로 등록해요.
2. 장소 반경 300m에 들어가면 기기가 백그라운드 작업으로 `POST /geofences/{cap_id}/arrived`를 호출해요.
3. 서버는 같은 장소에 하루 한 번만 푸시를 보내요.

---

## 4. 백엔드 상세

> 저장소: `Line4-Likelion/Moa_BE` · 기본 브랜치 `dev`, 배포 브랜치 `main` · Swagger: `/swagger-ui/index.html`
### 4-1. 패키지 구조 (도메인형)

```
com.moa.moa_be
├─ domain
│  ├─ auth        로그인·회원가입·토큰 재발급, JWT 필터
│  ├─ user        프로필 조회·회원 탈퇴
│  ├─ category    기본/사용자 카테고리
│  ├─ screenshot  분류 결과 저장(실천/참고/삭제), 변경·취소
│  ├─ analysis    AI 분석 요청·작업 상태·결과, OCR/LLM 클라이언트
│  ├─ capture     실천함·참고함 조회, 상태 전이, 체크리스트, 정보 수정, 완료율
│  └─ alarm       알림 설정, 푸시 토큰, 마감 알림, 지오펜스, FCM
└─ global
   ├─ common      BaseResponse(공통 응답), BaseTimeEntity
   ├─ config      Security, Swagger, Web(CORS), Firebase
   └─ exception   CustomException, 전역 에러 코드·핸들러
```

### 4-2. 공통 응답 형식

모든 API가 아래 형태로 감싸서 응답해요(`204`는 본문 없음).

```json
{ "success": true, "code": 200, "message": "요청이 성공적으로 처리되었습니다.", "data": { } }
```

실패하면 `success: false`, `code`에 에러 코드 문자열이 들어가요. 캡처 API의 입력 오류는 `data.fields`에 필드별 사유를 담아요.

### 4-3. API 목록

인증이 필요한 API는 `Authorization: Bearer {access_token}` 헤더가 필요해요.

| 구분 | 메서드 · 경로 | 설명 |
|---|---|---|
| 인증 | `POST /auth/signup` | 회원가입 (이메일, 비밀번호 8자 이상, 닉네임) |
| | `POST /auth/login` | 로그인 → `access_token`, `refresh_token`, `expires_in`, `user` |
| | `POST /auth/reissue` | Refresh Token(Bearer)으로 재발급 |
| | `POST /auth/logout` | 로그아웃 |
| 사용자 | `GET /users/me` | 내 프로필 (`id`는 `usr_{번호}`) |
| | `DELETE /users/me` | 회원 탈퇴 (분석 기록도 함께 삭제) |
| 카테고리 | `GET /categories` | 목록 (기본 → 사용자 → 기타 순, `todo_count` 포함) |
| | `POST /categories` | 추가 `{ "name": "생활" }` |
| 분류 | `POST /screenshot-classifications` | 1~20장 일괄 저장 `{items:[{fileKey, classification}]}` |
| | `GET /screenshot-classifications` | 내 분류 기록 (최신순) |
| | `PATCH /screenshot-classifications/{id}` | `PRACTICE` ↔ `REFERENCE` 변경 |
| | `DELETE /screenshot-classifications/{id}` | 분류 취소 |
| 분석 | `POST /captures/{id}/analysis` | 사진 업로드(multipart, 필드 `image`) → `202` + `job_id` |
| | `GET /analysis-jobs?ids=1,2` | 작업 상태 (`status`, `step`, `error`) |
| | `GET /captures/{id}/analysis` | 분석 결과 |
| | `PATCH /captures/{id}/category` | 카테고리 수동 변경 `{ "category_id": 3 }` |
| 캡처 | `GET /captures` | 목록 (`status`, `snoozed`, `sort`, `cursor`, `limit`, `completed_on`, `category_id`) |
| | `GET /captures/{id}` | 상세 (핵심 정보·링크·가이드·체크리스트) |
| | `POST /captures/{id}/actions` | `COMPLETE` `SNOOZE` `DISMISS` `REOPEN` `UNDO` |
| | `PATCH /captures/{id}/checklist/{itemId}` | 체크 `{ "checked": true }` |
| | `PATCH /captures/{id}/facts` | 정보 수정 (`value: null`이면 AI 값으로 되돌림) |
| | `DELETE /captures/{id}` | 서버 기록 삭제 (`204`) |
| | `GET /stats/completion` | 완료율·최근 6주 |
| 알림 | `GET·PUT /settings/alarm` | `intervalHours`, `deadlineAlarmEnabled`, `dnd`, `locationAlarmEnabled` |
| | `POST /push-tokens` · `DELETE /push-tokens/{token}` | FCM 토큰 등록·삭제 |
| | `GET /geofences` | 위치 알림 장소 목록 (`capture_id`는 `cap_{번호}`) |
| | `POST /geofences/{cap_id}/arrived` | 장소 도착 알림 요청 |
| 개발용 | `POST /dev/analysis`, `POST /dev/alarms/test` | 분석·푸시 테스트 |

### 4-4. 캡처 상태 규칙

캡처 상태는 DB에 따로 저장하지 않고 **분류 · 분석 · 완료 여부로 계산**해요.

| 상태 | 조건 |
|---|---|
| `REFERENCE` | 분류가 참고 |
| `ANALYZING` | 실천 분류 + 분석 없음/진행 중 |
| `FAILED` | 실천 분류 + 분석 실패 |
| `TODO` | 실천 분류 + 분석 성공 + 미완료 |
| `DONE` | 실천 분류 + 분석 성공 + 완료 |

- **보류**는 별도 상태가 아니라 `TODO` + `snooze_until`(오늘 이후 날짜)이에요.
- **상태 전이**: `COMPLETE`·`SNOOZE`·`DISMISS`는 `TODO`에서, `REOPEN`은 `DONE`에서만 가능해요. 허용되지 않으면 `409 INVALID_STATE_TRANSITION`이에요.
- **보류 날짜**: 없으면 다음 주 같은 요일, 오늘 이전이면 `400`이에요.
- **되돌리기**: 완료·보류·안함 응답에 `undo.token`이 와요. 5초 안에 `UNDO`로 보내면 직전 상태로 돌아가요.
- **안함**: 참고함으로 옮기되 분석 내용은 되돌리기 시간이 지난 뒤(10초 간격 스케줄러) 삭제해요. 다시 실천으로 바꾸면 분석을 처음부터 다시 해요.
- **체크리스트**: 전부 체크해도 서버는 자동 완료하지 않고 `all_done`만 알려줘요. 앱이 `COMPLETE`를 함께 보내요.

### 4-5. AI 분석 파이프라인

```
앱 업로드(jpg/png/webp, 10MB 이하)
  → 요청 검증 · 사용자별 하루 한도(기본 50장) 확인 → 202 + job_id
  → [비동기] OCR (Google Vision)
  → [비동기] LLM (OpenAI): 마감기한 · 카테고리 · 제목 · 요약 · 핵심 정보 · 실천 가이드 · 체크리스트 · 장소
  → 결과 검증(길이·개수 제한, 앱 UI 텍스트 제외, 빈 정보 제한)
  → 저장 + 이미지 폐기 → 상태 SUCCEEDED
```

- 작업 상태: `PENDING → RUNNING → SUCCEEDED / FAILED`, 진행 단계는 `OCR → CATEGORIZE → DONE`이에요.
- 글자가 적은 스크린샷은 OCR 텍스트만으로 부족해서 이미지도 LLM에 함께 보내요.
- 오래 걸린 작업은 15초 주기 점검이 `ANALYSIS_TIMEOUT`으로 실패 처리해요. 실패하면 앱에서 다시 분석할 수 있어요.
- 결과에는 AI가 정보를 찾은 원본 속 위치 `box`(`[x, y, w, h]`, 0~1 비율)가 들어가고, 앱이 이를 원본 위에 표시해요.
- 장소가 있으면 Kakao Local API로 좌표를 구해요(주소 검색 → 장소명 키워드 검색 순).

### 4-6. 알림 시스템

| 종류 | 동작 |
|---|---|
| 마감 알림 | 분석 결과가 `FOUND`이고 마감일이 오늘 이후면 **마감일 09:00(KST)** 으로 예약해요. 1분 간격 스케줄러가 `PENDING` 중 시간이 된 것을 발송해요. |
| 위치 도착 알림 | `POST /geofences/{cap_id}/arrived` 요청 시 장소별 하루 한 번만 발송해요(`GeofenceNotificationLog`로 중복 방지). |
| 방해금지(DND) | 켜져 있으면 모든 푸시를 보내지 않아요. 마감 알림은 시간이 됐을 때 방해금지면 **취소**돼요. |
| 설정 OFF | `deadlineAlarmEnabled`가 꺼져 있으면 마감 알림을 취소하고, `locationAlarmEnabled`가 꺼져 있으면 `/geofences`가 빈 목록을 줘요. |

푸시 데이터(FCM `data`):

| 키 | 값 |
|---|---|
| `type` | 알림 종류 (`DEADLINE_REMINDER`, `LOCATION_ARRIVAL` 등) |
| `capture_id` | 캡처 번호(숫자 문자열) |
| `title`, `body` | 알림 제목·본문 |
| `deeplink` | `moa://captures/{capture_id}` |

### 4-7. 스케줄러

| 작업 | 주기 | 내용 |
|---|---|---|
| 마감 알림 발송 | 60초 | 시간이 된 예약 알림 전송 |
| 안함 분석 정리 | 10초 | 되돌리기 시간이 지난 안함 항목의 분석·체크·수정 기록 삭제 |
| 되돌리기 토큰 정리 | 10초 | 만료된 `undo.token` 삭제 |
| 분석 타임아웃 점검 | 15초 | 오래 걸린 분석 작업 실패 처리 |

### 4-8. 인증

- 로그인 시 Access Token(기본 1시간)과 Refresh Token(기본 14일)을 발급해요(`app.jwt.*` 설정으로 변경 가능).
- Access Token이 만료되면 앱이 `POST /auth/reissue`(Refresh Token을 Bearer로)로 재발급해요.
- 비밀번호는 8자 이상이고, 이메일은 중복될 수 없어요(`409 EMAIL_ALREADY_EXISTS`).

### 4-9. 에러 코드

| 코드 | HTTP | 의미 |
|---|---|---|
| `VALIDATION_ERROR` | 400 | 필수 값 누락·형식 오류 |
| `BATCH_LIMIT_EXCEEDED` | 400 | 한 번에 20장 초과 분류 |
| `UNAUTHORIZED` | 401 | 토큰 없음·만료 |
| `INVALID_CREDENTIALS` | 401 | 이메일 또는 비밀번호 오류 |
| `FORBIDDEN` | 403 | 다른 사용자의 데이터 접근 |
| `NOT_FOUND` / `USER_NOT_FOUND` | 404 | 리소스 없음 |
| `EMAIL_ALREADY_EXISTS` | 409 | 이미 가입된 이메일 |
| `DUPLICATE_FILE_KEY` | 409 | 이미 분류한 사진 |
| `DUPLICATE_NAME` | 409 | 같은 이름의 카테고리 |
| `INVALID_STATE_TRANSITION` | 409 | 지금 상태에서 할 수 없는 동작 |
| `IMAGE_TOO_LARGE` | 413 | 이미지 10MB 초과 |
| `UNSUPPORTED_IMAGE` | 415 | jpg·png·webp 외 형식 |
| `RATE_LIMITED` | 429 | 분석 요청이 너무 잦거나 하루 상한 초과 |
| `ANALYSIS_FAILED` / `ANALYSIS_TIMEOUT` | 502 / 504 | AI 분석 실패·시간 초과 |
| `INTERNAL_ERROR` | 500 | 서버 오류 |

### 4-10. 서버 환경변수

| 이름 | 설명 |
|---|---|
| `GOOGLE_VISION_API_KEY` | Google Vision OCR 키 |
| `OPENAI_API_KEY` | OpenAI 키 (`OPENAI_MODEL`로 모델 변경, 기본 `gpt-4.1-mini`) |
| `KAKAO_API_KEY` | Kakao Local API 키 (장소 좌표) |
| `ANALYSIS_DAILY_LIMIT` | 사용자당 하루 분석 상한 (기본 50) |
| `src/main/resources/firebase/firebase-service-account.json` | FCM 서비스 계정 키 파일 (**`.gitignore` 대상**) |

> 이 값들은 **서버 전용 비밀**이에요. 앱 코드나 `EXPO_PUBLIC_` 변수에 넣으면 APK에서 누구나 꺼내 볼 수 있어요.
---

## 5. 프론트엔드 상세

### 5-1. 폴더 구조

```
.
├─ App.tsx                    앱 진입점: 폰트 로드, 내비게이션, 로그인 복원, 푸시·지오펜스 연결
├─ app.json                   Expo 설정 (패키지명, 권한, 플러그인, 딥링크 scheme)
├─ eas.json                   EAS 빌드 프로필
├─ google-services.json       Firebase(FCM) 안드로이드 설정
└─ src
   ├─ screens                 화면 (아래 목록)
   ├─ components              공통 UI (Button, Screen, TabBar, 시트·다이얼로그, 토스트)
   ├─ store                   상태 저장소
   │   ├─ practices.ts        캡처(실천·참고) 전체 + 서버 연동·낙관적 업데이트·되돌리기
   │   ├─ account.ts          프로필·알림 설정
   │   ├─ home.ts             홈 데이터(미분류 사진, 온보딩, 오늘의 리마인드, 활동 달력)
   │   └─ quietHours.ts       방해금지 시간(기기 저장)
   ├─ services
   │   ├─ api.ts              API 클라이언트 (공통 응답·토큰 재발급·에러)
   │   ├─ config.ts           서버 모드 스위치 (USE_SERVER)
   │   ├─ native.ts           네이티브 모듈을 '있으면 쓰는' 방식으로 로드
   │   ├─ push.ts             FCM 토큰 등록, 알림 클릭 이동
   │   ├─ location.ts         지오펜스 등록·해제, 도착 시 서버 호출
   │   └─ screenshots.ts      기기 스크린샷 조회
   ├─ navigation/types.ts     라우트 타입
   ├─ mock                    서버 없이 화면을 볼 때 쓰는 목업 데이터
   └─ theme.ts                색상·폰트·모서리 값
```

### 5-2. 화면과 라우트

| 영역 | 화면 |
|---|---|
| 인증 | `Login`, `Signup` |
| 하단 탭 | `Home`(홈) · `Practice`(실천함) · `Archive`(보관함/참고함) · `My`(마이) |
| 온보딩 | `OnboardingPhoto` → `OnboardingRange` → `OnboardingResult` |
| 분류 | `Sort`(스와이프 분류) |
| 실천 | `PracticeDetail`, `OriginalView`(원본 전체 보기), `FactsEdit`(정보 수정) |
| 참고함 | `ReferenceDetail`(사진 확대·실천으로 바꾸기·삭제), `CategoryAdd`, `CategoryChange` |
| 설정 | `ReminderSettings`, `SettingsSaveFailed` |
| 권한 안내 | `PhotoPermission`, `LocationPermission`, `NotificationPermission` |
| 개발용 | `DevIndex` — 홈의 **MoA 로고를 길게 누르면** 열려요 |

### 5-3. 서버 모드와 목업 모드

`src/services/config.ts`의 `USE_SERVER`는 `.env.local`에 `EXPO_PUBLIC_API_URL`이 **있는지**로 정해져요.

- **있으면**: 실제 서버와 기기 사진을 사용해요.
- **없으면**: `src/mock`의 예시 데이터로 동작해요. 서버 없이 Expo Go로 화면만 확인할 때 유용해요.

### 5-4. 상태 관리 · 낙관적 업데이트

- 스토어는 `useSyncExternalStore`로 만든 모듈 단위 상태예요. 화면은 `useCaptures`, `useCapture(id)`, `usePractices`, `useCategories` 같은 훅만 써요.
- **낙관적 업데이트**: 완료·보류·제외 등은 화면에 먼저 반영하고 서버에 보내요. 실패하면 알림을 띄우고 서버 기준으로 다시 받아와요.
- **상세 지연 로딩**: 목록(요약형)에는 핵심 정보·체크리스트가 없어서, 상세 화면을 열 때 한 번 받아와요.
- **되돌리기**: 완료·보류·제외 직후 5초 동안 스냅샷으로 되돌리고, 서버에는 받아 둔 `undo.token`으로 `UNDO`를 보내요.

### 5-5. 인증과 로그인 유지

- 토큰은 기기 보안 저장소(`expo-secure-store`, Android Keystore)에 보관해요. 앱을 다시 켜면 복원하고, 만료됐으면 재발급을 시도해요.
- 요청이 `401`이면 Refresh Token으로 **한 번만** 재발급해서 다시 시도해요. 그래도 안 되면 로그인 화면으로 보내요.
- 오프라인이어도 저장된 로그인 정보는 지우지 않아요.

### 5-6. 사진 업로드와 분석

1. 기기 사진 ID(`file_key`)로 사진 주소를 찾아요.
2. `expo-image-manipulator`로 앱 캐시에 JPEG(품질 0.85)로 다시 저장해요. 기기마다 앨범 경로를 그대로 못 읽는 문제를 피하고 용량도 줄여요.
3. 업로드는 **동시에 2장까지만** 보내요. 한꺼번에 여러 장을 보내도 서버의 요청 제한(429)에 걸리지 않게 하려는 거예요.
4. 접수되면 2초 간격으로 작업 상태를 확인하며 진행 단계를 보여줘요. 실패 원인은 화면과 로그(`[moa] ...`)에 남겨요.

### 5-7. 푸시 알림 · 딥링크

- 로그인 후 알림 권한을 받고 **FCM 기기 토큰**(Expo 토큰이 아님)을 `POST /push-tokens`로 등록해요. 로그아웃하면 삭제해요.
- 알림의 `capture_id`(없으면 `deeplink`)로 실천 상세를 열어요. 앱이 꺼져 있다가 알림으로 켜진 경우도 처리해요.
- 앱 설정의 `scheme`은 `moa`예요.

### 5-8. 위치 기반 알림

- 마이에서 토글을 켜면 위치 권한(**항상 허용**)을 요청하고, 서버에 설정을 저장한 뒤 `/geofences`의 장소를 기기에 등록해요.
- 장소에 들어가면 `expo-task-manager` 백그라운드 작업이 깨어나 `POST /geofences/{cap_id}/arrived`를 호출해요. 앱이 꺼진 채 깨어나면 저장된 로그인 정보를 먼저 복원해요.
- 탭을 열 때마다(30초 간격 제한) 서버 목록과 기기 등록을 맞추고, 권한이 없거나 목록이 비면 등록을 해제해요.
- 앱 사용 중에만 허용된 경우에는 켤 수 없고 권한 안내 화면으로 이동해요.

### 5-9. 네이티브 모듈 선택 로드

`src/services/native.ts`는 네이티브 모듈을 `try { require(...) } catch { null }`로 불러와요. 설치된 앱(APK)에 해당 모듈이 없어도 앱이 꺼지지 않고 **그 기능만 비활성화**돼요(예: Expo Go에서의 푸시·위치).

### 5-10. 디자인 토큰 (`src/theme.ts`)

| 이름 | 값 | 용도 |
|---|---|---|
| `primary` | `#285a43` | 주요 버튼·강조 |
| `bg` | `#f8f7f3` | 배경 |
| `text` / `textSub` | `#222e28` / `#737a72` | 본문 / 보조 글자 |
| `tint` | `#eaf0e6` | 연한 초록 배경·칩 |
| `warn` / `error` | `#8d6134` / `#a44d3e` | 경고 / 오류 |

폰트는 Noto Sans KR(본문, Regular·Medium·Bold)과 Noto Serif KR(제목, SemiBold)이에요. 화면 높이를 고정하지 않고 최소 높이를 써서, OS 글자 크기를 키워도 글자가 잘리지 않게 해요.

---

## 6. 개발 환경 세팅과 실행

### 6-1. 요구 사항
- Node.js 22.13 이상 (24, 26 가능), npm
- 안드로이드 폰 + (선택) 개발용 APK, 또는 Expo Go
- **프로젝트를 OneDrive 같은 동기화 폴더 안에 두지 마세요.** Metro의 파일 감시가 `node_modules` 변경과 부딪혀 죽는 일이 있어요(예: `C:\dev\moa-app`).

### 6-2. 설치

```bash
git clone https://github.com/Line4-Likelion/Moa_FE.git
cd Moa_FE
npm install
```

### 6-3. 서버 주소 설정

프로젝트 루트에 `.env.local`을 만들어요(깃에 올라가지 않아요).

```bash
EXPO_PUBLIC_API_URL=http://<서버 주소>:8080
```

- 이 값이 있으면 서버 모드, 없으면 목업 모드예요. 값을 바꾼 뒤에는 `-c`로 캐시를 지우고 다시 시작하세요.
- 실기기에서 `localhost`는 폰 자신을 가리켜요. 로컬 서버를 쓸 때는 PC의 같은 네트워크 IP를 쓰세요.
- 안드로이드 최종 APK는 `http` 통신을 기본으로 막아요. 배포 서버에 HTTPS를 적용하세요.

### 6-4. 실행 방법

**방법 A. 개발용 APK (권장, 푸시·위치·사진 삭제까지 전부 확인)**
```bash
npx expo start --dev-client -c
```
폰과 PC를 같은 네트워크에 연결하고, 개발용 APK를 열어 PC 서버를 선택해요.

**방법 B. Expo Go (화면·서버 연동 확인, 푸시·백그라운드 위치는 불가)**
```bash
npx expo start --go -c
```
`expo-dev-client`가 설치돼 있어서 `--go`를 붙여야 Expo Go로 열려요. Expo Go와 CLI에 **같은 Expo 계정으로 로그인**돼 있어야 해요(`npx expo login`, 또는 환경변수 `EXPO_TOKEN`).

```powershell
# Windows PowerShell 예시
$env:EXPO_TOKEN="<expo.dev/settings/access-tokens 에서 만든 토큰>"
npx.cmd expo start --go -c
```
토큰은 채팅·코드·깃에 올리지 마세요.

### 6-5. 확인 · 점검 명령

```bash
npx tsc --noEmit        # 타입 검사
npx expo-doctor         # 의존성·설정 진단
npx expo install --fix  # Expo 호환 버전으로 맞추기
```

### 6-6. 백엔드를 내 PC에서 실행하기

배포 서버 대신 로컬에서 시험할 때 쓰는 방법이에요. 필요한 것:

- JDK 17, MySQL(DB·계정은 `application.yml`의 `datasource` 설정에 맞춤)
- `src/main/resources/firebase/firebase-service-account.json` (푸시를 쓸 때. 없으면 서버가 시작에 실패해요)
- 환경변수 `KAKAO_API_KEY`(필수), 분석을 시험하려면 `GOOGLE_VISION_API_KEY`, `OPENAI_API_KEY`

```bash
./gradlew bootRun
```

---

## 7. 빌드와 배포

### 7-1. EAS 빌드 프로필 (`eas.json`)

| 프로필 | 용도 |
|---|---|
| `development` | 개발용 클라이언트가 들어간 내부 배포 APK |
| `preview` | 내부 배포용 APK |
| `production` | 스토어 배포용 (`autoIncrement`) |

```bash
npx eas-cli build --profile development --platform android
```

- **Expo 프로젝트 소유자**는 팀 계정(`line4-moa`)이에요. 빌드하려면 이 계정에 초대돼 있어야 해요.
- 안드로이드 패키지명은 `com.line4.moa`예요.
- **새 네이티브 모듈**(푸시, 위치, 보안 저장소, 사진 등)을 추가하거나 `google-services.json`을 바꿨다면 **개발용 APK를 다시 빌드**해야 해요. 앱 코드(JS)만 바뀐 경우에는 다시 빌드할 필요 없어요.

### 7-2. 푸시(FCM) 설정
1. Firebase 콘솔에서 안드로이드 앱을 `com.line4.moa`로 등록해요.
2. 받은 `google-services.json`을 루트에 두고 `app.json`의 `android.googleServicesFile`로 연결해요(이미 연결됨).
3. 백엔드에는 **서비스 계정 키(JSON)** 를 따로 둬요. 이 두 파일은 서로 다른 거예요.

### 7-3. 백엔드 배포
`Moa_BE`의 `main` 브랜치에 머지하면 GitHub Actions가 자동으로 빌드·전송·재시작해요. 머지 전에 서버에 아래가 설정돼 있는지 확인하세요.
- Firebase 서비스 계정 키 파일
- `KAKAO_API_KEY`, `GOOGLE_VISION_API_KEY`, `OPENAI_API_KEY`
- DB 이름·계정이 `application.yml`과 일치

---

## 8. 협업 규칙

### 브랜치
| 브랜치 | 용도 |
|---|---|
| `main` | 프론트: 통합 브랜치 / 백엔드: **배포 브랜치**(머지 시 자동 배포) |
| `dev` | 백엔드 개발 통합 브랜치 |
| `feat/…` · `fix/…` · `chore/…` · `docs/…` | 작업 브랜치. PR로 합쳐요 |

### 커밋 메시지
- 프론트: `feat: …`, `fix: …`, `chore: …`처럼 **종류: 내용** 형식이에요.
- 백엔드: `[깃모지] Type: Subject (#이슈번호)` 형식이에요 (예: `✨ Feat: …`).

### PR
- 작업 브랜치에서 PR을 올리고 팀원이 확인 후 머지해요.
- 머지 전에 `npx tsc --noEmit`이 통과하는지 확인하세요.
- 앱과 서버의 요청·응답 필드는 대부분 **snake_case**예요. 분류 API(`fileKey`, `classifiedAt`)와 알림 설정 API(`intervalHours`, `deadlineAlarmEnabled`, `dnd`, `locationAlarmEnabled`)는 camelCase예요.

---

## 9. 보안 · 비밀 관리

- **서버 비밀키**(OpenAI, Google Vision, Kakao, Firebase 서비스 계정)는 앱 코드, `EXPO_PUBLIC_*` 변수, 깃, 메신저에 올리지 않아요. 노출됐다면 즉시 **재발급**하세요.
- `.env.local`, Firebase 서비스 계정 파일(`src/main/resources/firebase/`)은 `.gitignore`로 제외돼 있어요.
- 앱에 들어가는 `google-services.json`은 비밀키가 아니지만, 함부로 공개 배포하지 않는 것이 좋아요.
- Expo 액세스 토큰은 비밀번호와 같아요. 노출되면 expo.dev에서 폐기하세요.
- 로그인 토큰은 기기 보안 저장소에만 보관하고, 로그에 출력하지 않아요.
- 사진 원본은 서버에 저장하지 않아요. 분석에만 일시적으로 쓰고 폐기해요.

---

## 10. 알려진 제한과 앞으로 할 일

| 항목 | 현재 상태 |
|---|---|
| 방해금지 **시간대** | 서버에는 켜짐/꺼짐만 있어요. 시간(예: 22:00~08:00)은 기기에만 저장돼서, 서버 푸시는 시간대와 상관없이 켜져 있으면 모두 막혀요. |
| 링크 수정 | 서버에 수정 API가 없어서 앱 화면에서만 바뀌어요. |
| 보류 해제 | 해제 API가 없어서 "오늘 날짜로 보류"하는 방식으로 풀어요. |
| HTTPS | 현재 서버가 `http`예요. 최종 APK에는 HTTPS 적용이 필요해요. |
| iOS | 안드로이드 우선이에요. iOS는 사진 주소(`ph://`) 표시 문제가 있고, 푸시·백그라운드 위치는 별도 설정과 빌드가 필요해요. |
| 푸시·위치 | Expo Go에서는 동작하지 않아요. 개발용 APK + `google-services.json`이 필요해요. 위치 알림은 분석에서 **좌표가 추출된 항목**만 대상이에요. |
| 하루 분석 한도 | 사용자당 50장이에요. 초과하면 `RATE_LIMITED`로 분석이 실패해요. |
| 홈 데이터 | 서버에 `GET /home`이 없어서 오늘의 리마인드(마감 임박 → 보류 도래 → 랜덤 1개, 최대 5개)와 활동 달력을 앱에서 계산해요. |
| DB 스키마 | `ddl-auto: update`를 써서 자동으로 바뀌어요. 운영 전에 마이그레이션 도구 도입을 검토하세요. |
| 테스트 | 백엔드에는 상태 전이·되돌리기·완료율·참고함 개수 테스트가 있고, 프론트 자동 테스트는 아직 없어요. |

---

## 라이선스

`LICENSE` 파일을 참고하세요.
