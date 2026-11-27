// 학생 2단계 로그인 그림 (동물 + 과일). 서버와 브라우저가 함께 사용한다.
export const ANIMALS = [
  { key: 'dog', label: '강아지', emoji: '🐶' },
  { key: 'cat', label: '고양이', emoji: '🐱' },
  { key: 'rabbit', label: '토끼', emoji: '🐰' },
  { key: 'pig', label: '돼지', emoji: '🐷' },
  { key: 'elephant', label: '코끼리', emoji: '🐘' },
  { key: 'panda', label: '판다', emoji: '🐼' },
];

export const FRUITS = [
  { key: 'apple', label: '사과', emoji: '🍎' },
  { key: 'banana', label: '바나나', emoji: '🍌' },
  { key: 'grape', label: '포도', emoji: '🍇' },
  { key: 'orange', label: '오렌지', emoji: '🍊' },
  { key: 'peach', label: '복숭아', emoji: '🍑' },
  { key: 'watermelon', label: '수박', emoji: '🍉' },
];

export const animalOf = (key) => ANIMALS.find((a) => a.key === key) || null;
export const fruitOf = (key) => FRUITS.find((f) => f.key === key) || null;
