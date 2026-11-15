/**
 * 오류 화면 확인용 스위치 (서버 연결 전 목업)
 * true 로 바꾸고 저장하면 그 상황의 화면이 보여요. 확인 후 꼭 false 로 되돌려 주세요.
 *
 * 로그인·회원가입 오류는 스위치 없이 아래 이메일로 확인할 수 있어요
 * - 로그인 실패 (401): fail@example.com
 * - 이미 가입된 이메일 (409): taken@example.com
 */
export const MOCK_FAIL = {
  /** 홈 정보를 못 불러옴 (GET /home) */
  homeLoad: false,
  /** 분류 저장 실패 (POST /captures/classify 500) */
  classifySave: false,
  /** 오늘 분석 한도 초과 (POST /captures/{id}/analysis 429) */
  analysisLimit: false,
  /** 실천함 목록을 못 불러옴 (GET /captures) */
  practiceListLoad: false,
  /** 실천 상세를 못 불러옴 (GET /captures/{id}) */
  detailLoad: false,
  /** 완료·보류·제외·체크·카테고리·정보 수정 저장 실패 */
  actionSave: false,
};

export const MOCK_LOGIN_FAIL_EMAIL = 'fail@example.com';
export const MOCK_TAKEN_EMAIL = 'taken@example.com';
