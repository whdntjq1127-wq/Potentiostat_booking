export type Language = 'en' | 'ko';

export const languageOptions: Array<{ value: Language; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'ko', label: '한국어' },
];

const en = {
  site: {
    brandTitle: 'Potentiostat Booking Board',
    brandSubtitle: 'CH 1, CH 2, CH 3 integrated booking demo',
    footer:
      'This is a browser-only demo. There is no login, and admin rules are stored only in the current browser.',
    languageLabel: 'Language',
    languageAriaLabel: 'Select language',
    nav: {
      weekly: 'Weekly Board',
      myBookings: 'My Bookings',
      history: 'Booking Change History',
      admin: 'Admin Settings',
    },
  },
  home: {
    loadingEyebrow: 'Loading',
    loadingTitle: 'Preparing the weekly booking board.',
    weeklyEyebrow: 'Weekly Calendar',
    weeklyTitle: '7-Day Booking Status',
    asOf: (date: string) => `As of ${date}`,
    lastStartDate: (date: string) => `Last start date: ${date}`,
    bookingUnit: 'Booking unit: 1-hour increments',
    viewMyBookings: 'View My Bookings',
    noChannelSelected: 'No channel selected',
    createEyebrow: 'Create Booking',
    createTitle: 'Book the Selected Slot',
    close: 'Close',
    start: 'Start',
    end: 'End',
    userName: 'User Name',
    applicantPlaceholder: 'e.g. Dr. Kim',
    channels: 'Channels',
    conflictTitle: (applicant: string) =>
      `${applicant}'s booking overlaps this time range`,
    selectedTitle: (channel: string) => `${channel} selected`,
    addChannelTitle: (channel: string) => `Add ${channel}`,
    booked: 'Booked',
    selected: 'Selected',
    available: 'Available',
    channelHelp:
      'Channels already booked during the selected time range are disabled. Select multiple available channels to reserve them together.',
    equipmentStart: 'Equipment Start',
    equipmentEnd: 'Equipment End',
    memo: 'Memo',
    memoPlaceholder: 'Add experiment notes or handoff details.',
    endTimeHelp: (days: number) =>
      `The start time is fixed to the slot you clicked. The end time can only be set in 1-hour increments, up to ${days} days from the start time.`,
    saveBooking: 'Save Booking',
    cancel: 'Cancel',
  },
  schedule: {
    previousWeek: 'Previous Week',
    nextWeek: 'Next Week',
    startingTime: 'Starting time',
    bookedByTitle: (applicant: string) => `${applicant}'s booking`,
    blockedDateTitle: 'This date is blocked by the admin',
    notSelectableTitle: 'This slot cannot be selected',
    outsideWindowTitle: 'The start date is outside the booking window',
  },
};

const ko: typeof en = {
  site: {
    brandTitle: '포텐쇼스탯 예약 보드',
    brandSubtitle: 'CH 1, CH 2, CH 3 통합 예약 데모',
    footer:
      '이 데모는 브라우저에서만 동작합니다. 로그인은 없으며 관리자 규칙은 현재 브라우저에만 저장됩니다.',
    languageLabel: '언어',
    languageAriaLabel: '언어 선택',
    nav: {
      weekly: '주간 보드',
      myBookings: '내 예약',
      history: '예약 변경 내역',
      admin: '관리자 설정',
    },
  },
  home: {
    loadingEyebrow: '로딩 중',
    loadingTitle: '주간 예약 보드를 준비하는 중입니다.',
    weeklyEyebrow: '주간 캘린더',
    weeklyTitle: '7일 예약 현황',
    asOf: (date: string) => `${date} 기준`,
    lastStartDate: (date: string) => `마지막 예약 시작일: ${date}`,
    bookingUnit: '예약 단위: 1시간',
    viewMyBookings: '내 예약 보기',
    noChannelSelected: '선택된 채널 없음',
    createEyebrow: '예약 생성',
    createTitle: '선택한 시간 예약',
    close: '닫기',
    start: '시작',
    end: '종료',
    userName: '사용자 이름',
    applicantPlaceholder: '예: 김박사',
    channels: '채널',
    conflictTitle: (applicant: string) =>
      `${applicant}님의 예약과 선택한 시간이 겹칩니다`,
    selectedTitle: (channel: string) => `${channel} 선택됨`,
    addChannelTitle: (channel: string) => `${channel} 추가`,
    booked: '예약됨',
    selected: '선택됨',
    available: '예약 가능',
    channelHelp:
      '선택한 시간대에 이미 예약된 채널은 비활성화됩니다. 예약 가능한 여러 채널을 함께 선택할 수 있습니다.',
    equipmentStart: '장비 시작',
    equipmentEnd: '장비 종료',
    memo: '메모',
    memoPlaceholder: '실험 메모나 인수인계 내용을 입력하세요.',
    endTimeHelp: (days: number) =>
      `시작 시간은 클릭한 시간으로 고정됩니다. 종료 시간은 시작 시간부터 최대 ${days}일까지 1시간 단위로만 설정할 수 있습니다.`,
    saveBooking: '예약 저장',
    cancel: '취소',
  },
  schedule: {
    previousWeek: '이전 주',
    nextWeek: '다음 주',
    startingTime: '시작 시간',
    bookedByTitle: (applicant: string) => `${applicant}님의 예약`,
    blockedDateTitle: '관리자가 차단한 날짜입니다',
    notSelectableTitle: '선택할 수 없는 시간입니다',
    outsideWindowTitle: '예약 가능 기간 밖의 시작일입니다',
  },
};

export type TranslationCopy = typeof en;

export const translations: Record<Language, TranslationCopy> = { en, ko };

const dayNames: Record<Language, string[]> = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  ko: ['일', '월', '화', '수', '목', '금', '토'],
};

const monthNames = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export function isLanguage(value: string | null): value is Language {
  return value === 'en' || value === 'ko';
}

export function formatDateLabelForLanguage(date: Date, language: Language) {
  if (language === 'ko') {
    return `${date.getMonth() + 1}월 ${date.getDate()}일 (${dayNames.ko[date.getDay()]})`;
  }

  return `${monthNames[date.getMonth()]} ${date.getDate()} (${dayNames.en[date.getDay()]})`;
}

export function formatShortDateLabelForLanguage(
  date: Date,
  language: Language,
) {
  return `${date.getMonth() + 1}/${date.getDate()} (${dayNames[language][date.getDay()]})`;
}

export function formatDateTimeLabelForLanguage(
  value: string,
  language: Language,
) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const hour = String(parsed.getHours()).padStart(2, '0');
  const minute = String(parsed.getMinutes()).padStart(2, '0');

  return `${formatDateLabelForLanguage(parsed, language)} ${hour}:${minute}`;
}
