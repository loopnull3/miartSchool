// 학생 2단계 로그인 그림 (동물 + 과일). 서버와 브라우저가 함께 사용한다.
export const ANIMALS = [
  { key: 'dog', label: '강아지', },
  { key: 'cat', label: '고양이', },
  { key: 'rabbit', label: '토끼', },
  { key: 'pig', label: '돼지', },
  { key: 'elephant', label: '코끼리', },
  { key: 'panda', label: '판다', },
];

export const FRUITS = [
  { key: 'apple', label: '사과', },
  { key: 'banana', label: '바나나', },
  { key: 'grape', label: '포도', },
  { key: 'orange', label: '오렌지', },
  { key: 'peach', label: '복숭아', },
  { key: 'watermelon', label: '수박', },
];

export const animalOf = (key) => ANIMALS.find((a) => a.key === key) || null;
export const fruitOf = (key) => FRUITS.find((f) => f.key === key) || null;
