// 랜딩 페이지 설정 — 서비스 운영자가 직접 바꾸는 값 (요금, 회사 정보, 연락처)
export const SITE = {
  brand: '미아트스쿨',
  brandEn: 'MiArt School',
  contactEmail: 'hello@miart.school',
  // 요금 안내: 실제 판매 가격으로 바꾸세요.
  pricing: {
    note: '선생님 1인 이용권 기준 · 학생 최대 35명',
    plans: [
      {
        key: 'single',
        name: '개인 이용권',
        audience: '선생님 1명',
        tiers: [{ label: '선생님 1명', price: 50000 }],
        features: ['학생 35명까지', '수업 개설 무제한', '마음 날씨 체크인 · 갤러리보드'],
      },
      {
        key: 'team',
        name: '단체 이용권',
        audience: '선생님 2명 이상',
        recommended: true,
        tiers: [
          { label: '선생님 2명 이상', price: 50000 },
          { label: '선생님 5명 이상', price: 45000, discount: '10% 할인' },
          { label: '선생님 10명 이상', price: 42500, discount: '15% 할인' },
        ],
        features: ['선생님 1명당 학생 35명 (전체 안에서 자유 배정)', '학교 단위 갤러리보드 · 관리자 화면', '수업 개설 무제한'],
      },
    ],
    unit: '/월 (1인당)',
  },
  // 사업자 정보: 실제 정보로 바꾸세요. 비워 두면 표시하지 않습니다.
  company: {
    name: '',
    ceo: '',
    bizNo: '',
    address: '',
    phone: '',
  },
};
