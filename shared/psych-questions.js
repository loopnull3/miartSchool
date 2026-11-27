// 그림 마음 탐색 (HTP: 집-나무-사람) 단계·질문 정의
// 서버(분석)와 브라우저(검사 화면)가 함께 사용한다.

export const PSYCH_DISCLAIMER =
  '그림 마음 탐색은 아이를 더 잘 이해하기 위한 참고 자료이며 의학적·심리학적 진단이 아닙니다. ' +
  '한 번의 그림으로 아이를 판단하지 말고, 평소 관찰과 대화를 함께 살펴 주세요. ' +
  '걱정되는 모습이 계속되면 학교 상담 선생님이나 전문가와 상의해 주세요.';

const MOOD5 = [
  { value: 'great', label: '아주 좋아요', score: 2 },
  { value: 'good', label: '좋아요', score: 1 },
  { value: 'soso', label: '그저 그래요', score: 0 },
  { value: 'sad', label: '조금 슬퍼요', score: -1 },
  { value: 'verysad', label: '많이 슬퍼요', score: -2 },
];

const AGREE3 = [
  { value: 'yes', label: '그래요', score: 1 },
  { value: 'sometimes', label: '가끔 그래요', score: 0 },
  { value: 'no', label: '아니에요', score: -1 },
];

export const PSYCH_STEPS = [
  {
    key: 'house',
    icon: 'home',
    title: '집 그리기',
    instruction: '집을 그려 보세요. 어떤 집이든 좋아요. 정답은 없어요!',
    orientation: 'landscape',
    questions: [
      {
        id: 'h1',
        text: '이 집에는 누가 살고 있나요?',
        type: 'choice',
        options: [
          { value: 'family', label: '우리 가족' },
          { value: 'me', label: '나 혼자' },
          { value: 'friends', label: '친구들' },
          { value: 'animals', label: '동물 친구들' },
          { value: 'nobody', label: '아무도 안 살아요' },
        ],
      },
      {
        id: 'h2',
        text: '이 집에 들어가면 어떤 느낌일까요?',
        type: 'choice',
        options: [
          { value: 'warm', label: '따뜻해요', score: 2 },
          { value: 'fun', label: '신나요', score: 2 },
          { value: 'calm', label: '조용해요', score: 1 },
          { value: 'lonely', label: '쓸쓸해요', score: -1 },
          { value: 'scary', label: '무서워요', score: -2 },
        ],
      },
      { id: 'h3', text: '이 집에서 가장 좋아하는 곳은 어디예요?', type: 'text', optional: true, placeholder: '예) 내 방, 거실, 마당' },
    ],
  },
  {
    key: 'tree',
    icon: 'tree',
    title: '나무 그리기',
    instruction: '나무 한 그루를 그려 보세요. 마음에 떠오르는 나무를 그리면 돼요.',
    orientation: 'portrait',
    questions: [
      {
        id: 't1',
        text: '이 나무는 몇 살쯤 되었을까요?',
        type: 'choice',
        options: [
          { value: 'baby', label: '아기 나무' },
          { value: 'child', label: '어린이 나무' },
          { value: 'adult', label: '어른 나무' },
          { value: 'old', label: '아주 오래된 나무' },
        ],
      },
      { id: 't2', text: '이 나무는 지금 어떤 기분일까요?', type: 'choice', options: MOOD5 },
      {
        id: 't3',
        text: '이 나무 곁에는 무엇이 있나요? (여러 개 골라도 돼요)',
        type: 'multi',
        options: [
          { value: 'trees', label: '다른 나무들' },
          { value: 'flowers', label: '꽃과 풀' },
          { value: 'animals', label: '새나 동물' },
          { value: 'people', label: '사람들' },
          { value: 'sun', label: '햇님' },
          { value: 'rain', label: '비나 바람' },
          { value: 'alone', label: '아무것도 없어요' },
        ],
      },
      {
        id: 't4',
        text: '이 나무에게 가장 필요한 것은 무엇일까요?',
        type: 'choice',
        options: [
          { value: 'enough', label: '이미 충분해요' },
          { value: 'water', label: '물' },
          { value: 'sun', label: '햇빛' },
          { value: 'friends', label: '친구' },
          { value: 'rest', label: '쉬는 시간' },
        ],
      },
    ],
  },
  {
    key: 'person',
    icon: 'user',
    title: '사람 그리기',
    instruction: '사람을 그려 보세요. 머리부터 발끝까지 그려 보면 좋아요.',
    orientation: 'portrait',
    questions: [
      {
        id: 'p1',
        text: '이 사람은 누구인가요?',
        type: 'choice',
        options: [
          { value: 'me', label: '나' },
          { value: 'family', label: '가족' },
          { value: 'friend', label: '친구' },
          { value: 'teacher', label: '선생님' },
          { value: 'imaginary', label: '상상 속 사람' },
        ],
      },
      { id: 'p2', text: '이 사람의 기분은 어때요?', type: 'choice', options: MOOD5 },
      { id: 'p3', text: '이 사람은 지금 무엇을 하고 있나요?', type: 'text', optional: true, placeholder: '예) 친구랑 놀고 있어요' },
      { id: 'p4', text: '이 사람이 가장 바라는 것은 무엇일까요?', type: 'text', optional: true, placeholder: '예) 강아지를 키우고 싶어요' },
    ],
  },
  {
    key: 'self',
    icon: 'sunCloud',
    title: '내 마음 날씨',
    instruction: '요즘 나의 마음을 골라 보세요. 솔직하게 골라도 괜찮아요.',
    questions: [
      {
        id: 's1',
        text: '요즘 내 마음 날씨는 어때요?',
        type: 'choice',
        options: [
          { value: 'sunny', label: '맑음', score: 2 },
          { value: 'partly', label: '구름 조금', score: 1 },
          { value: 'cloudy', label: '흐림', score: 0 },
          { value: 'rain', label: '비', score: -1 },
          { value: 'storm', label: '천둥 번개', score: -2 },
        ],
      },
      { id: 's2', text: '친구들과 함께 노는 게 즐거워요.', type: 'choice', options: AGREE3 },
      { id: 's3', text: '학교(학원)에 오는 게 좋아요.', type: 'choice', options: AGREE3 },
      { id: 's4', text: '걱정되는 일이 많아요.', type: 'choice', options: AGREE3 },
      { id: 's5', text: '나는 잘하는 것이 있어요.', type: 'choice', options: AGREE3 },
      { id: 's6', text: '속상할 때 이야기할 사람이 있어요.', type: 'choice', options: AGREE3 },
      { id: 's7', text: '밤에 잠을 잘 자요.', type: 'choice', options: AGREE3 },
    ],
  },
];

export const DRAWING_STEPS = PSYCH_STEPS.filter((s) => s.key !== 'self').map((s) => s.key);

export const DOMAINS = [
  { key: 'emotion', icon: 'heart', label: '정서 안정', desc: '마음이 편안하고 안정된 정도' },
  { key: 'expression', icon: 'palette', label: '자기 표현', desc: '생각과 느낌을 그림·말로 드러내는 힘' },
  { key: 'relation', icon: 'people', label: '관계·소통', desc: '가족·친구와 연결되어 있다고 느끼는 정도' },
  { key: 'confidence', icon: 'star', label: '자신감', desc: '스스로를 믿고 당당하게 표현하는 정도' },
  { key: 'energy', icon: 'sparkles', label: '활력·적응', desc: '학교생활에 대한 즐거움과 에너지' },
];

export const MIND_WEATHER = [
  { key: 'sunny', min: 68, label: '맑음', desc: '전반적으로 밝고 안정된 마음이 보여요.' },
  { key: 'partly', min: 55, label: '구름 조금', desc: '대체로 편안하지만 살짝 신경 쓰이는 부분이 있어요.' },
  { key: 'cloudy', min: 42, label: '흐림', desc: '마음에 무거운 구름이 조금 있어요. 따뜻한 관심이 도움이 돼요.' },
  { key: 'rain', min: 0, label: '비', desc: '요즘 마음이 힘들 수 있어요. 편안한 대화 시간을 마련해 주세요.' },
];

export function findQuestion(id) {
  for (const step of PSYCH_STEPS) {
    const q = step.questions.find((x) => x.id === id);
    if (q) return q;
  }
  return null;
}

export function optionOf(questionId, value) {
  const q = findQuestion(questionId);
  return q?.options?.find((o) => o.value === value) || null;
}
