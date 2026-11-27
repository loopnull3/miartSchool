// 마음 날씨 체크인 정의. 서버와 브라우저가 함께 사용한다.
// level: 그래프 높이 (6 = 가장 맑음)
export const WEATHERS = [
  { key: 'sunny', label: '맑음', emoji: '☀️', desc: '기분 최고예요', level: 6, color: '#ff9f0a' },
  { key: 'partly', label: '구름 조금', emoji: '🌤️', desc: '괜찮아요', level: 5, color: '#ffcc00' },
  { key: 'cloudy', label: '흐림', emoji: '☁️', desc: '그저 그래요', level: 4, color: '#98989d' },
  { key: 'fog', label: '안개', emoji: '🌫️', desc: '마음이 뿌예요', level: 3, color: '#8e8e93' },
  { key: 'rain', label: '비', emoji: '🌧️', desc: '슬퍼요', level: 2, color: '#0a84ff' },
  { key: 'storm', label: '천둥 번개', emoji: '⛈️', desc: '화가 나요', level: 1, color: '#5e5ce6' },
];

export const EMOTIONS = [
  { key: 'happy', label: '기뻐요', positive: true },
  { key: 'joyful', label: '즐거워요', positive: true },
  { key: 'excited', label: '신나요', positive: true },
  { key: 'calm', label: '편안해요', positive: true },
  { key: 'proud', label: '뿌듯해요', positive: true },
  { key: 'thrilled', label: '설레요', positive: true },
  { key: 'thankful', label: '고마워요', positive: true },
  { key: 'tired', label: '피곤해요', positive: false },
  { key: 'bored', label: '심심해요', positive: false },
  { key: 'worried', label: '걱정돼요', positive: false },
  { key: 'sad', label: '슬퍼요', positive: false },
  { key: 'upset', label: '속상해요', positive: false },
  { key: 'angry', label: '화나요', positive: false },
  { key: 'lonely', label: '외로워요', positive: false },
];

export const CAUSES = [
  { key: 'friend', label: '친구' },
  { key: 'family', label: '가족' },
  { key: 'school', label: '학교·공부' },
  { key: 'self', label: '나 자신' },
  { key: 'health', label: '몸·건강' },
  { key: 'play', label: '놀이·취미' },
  { key: 'unknown', label: '잘 모르겠어요' },
];

export const MAX_EMOTIONS = 3;
export const weatherOf = (key) => WEATHERS.find((w) => w.key === key) || null;
