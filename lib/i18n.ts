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
    lastStartDate: (date: string) => `Last bookable date (Korea time): ${date}`,
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
      `The start time is fixed to the slot you clicked. Use 1-hour increments, up to ${days} days from the start, but no later than midnight after the last bookable date (Korea time).`,
    saveBooking: 'Save Booking',
    cancel: 'Cancel',
  },
  adminRules: {
    eyebrow: 'Booking Rules',
    title: 'Admin Settings',
    intro: 'Set the equipment booking dates and usage limit. Dates roll forward at 00:00 Korea time; these limits are separate from the queue timer.',
    lock: 'Lock',
    windowLabel: 'Open calendar days (including today)',
    windowHelp: '3 means today, tomorrow and the day after tomorrow. At each Korean midnight, one new date opens and yesterday closes.',
    durationLabel: 'Maximum equipment use per booking (days)',
    durationHelp: (days: number) => `Up to ${days} days (${days * 24} hours) from the start, but never beyond the booking deadline below. This is not the time allowed to fill in the form.`,
    previewTitle: 'Preview for the values above',
    previewHint: 'Changes take effect only after saving. Existing bookings are not deleted.',
    dateRange: 'Bookable equipment dates (Korea time)',
    deadline: 'All bookings must end by (Korea time)',
    nextOpening: (at: string, date: string) => `At ${at} Korea time, ${date} becomes bookable.`,
    exclusions: 'Start and end times use whole hours. Blocked dates and overlapping bookings on the same channel remain unavailable.',
    invalidDraft: 'Enter a positive whole number in both fields to preview the rules.',
    flowTitle: 'Current booking flow',
    flow: 'Book Now → queue when enabled → calendar → click or drag blocks → enter a name and save.',
    queueNote: 'Every booking session has 2 minutes to choose slots and save, even without the queue. Expiry or refresh returns to Book Now. With the queue enabled, the timer starts on admission, not while waiting. Queue activation is managed on Render.',
    save: 'Save Booking Rules',
    saving: 'Saving...',
    saved: 'Booking rules saved.',
    saveError: 'Could not save the rules. Please try again.',
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
    lastStartDate: (date: string) => `마지막 예약 가능일 (한국 시간): ${date}`,
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
      `시작 시간은 클릭한 시간으로 고정됩니다. 종료 시간은 시작부터 최대 ${days}일 이내에서 1시간 단위로 선택하되, 마지막 예약 가능일 다음 날 00시(한국 시간)를 넘길 수 없습니다.`,
    saveBooking: '예약 저장',
    cancel: '취소',
  },
  adminRules: {
    eyebrow: '예약 운영 규칙',
    title: '관리자 설정',
    intro: '장비를 예약할 수 있는 날짜와 1회 사용 기간을 설정합니다. 날짜는 한국 시간 00시에 하루씩 이동하며, 대기열 입력 제한 시간과는 별개입니다.',
    lock: '잠그기',
    windowLabel: '열어둘 날짜 수 (오늘 포함)',
    windowHelp: '3이면 오늘·내일·모레까지 열립니다. 한국 시간 자정마다 새 날짜가 하루씩 열리고 어제 날짜는 닫힙니다.',
    durationLabel: '1회 예약당 장비 최대 사용 기간 (일)',
    durationHelp: (days: number) => `시작부터 최대 ${days}일(${days * 24}시간)까지 사용할 수 있지만, 아래 예약 종료 마감을 넘길 수 없습니다. 예약 입력에 주어지는 시간이 아닙니다.`,
    previewTitle: '입력한 값 기준 미리보기',
    previewHint: '변경 사항은 저장 후 적용됩니다. 기존 예약 기록은 삭제하지 않습니다.',
    dateRange: '예약 가능한 장비 사용 날짜 (한국 시간)',
    deadline: '모든 예약의 종료 마감 (한국 시간)',
    nextOpening: (at: string, date: string) => `한국 시간 ${at}에 ${date} 날짜가 새로 열립니다.`,
    exclusions: '시작·종료 시각은 정각 단위로 선택합니다. 차단일과 같은 채널의 중복 예약은 계속 제한됩니다.',
    invalidDraft: '두 항목 모두 1 이상의 정수를 입력하면 규칙을 미리 볼 수 있습니다.',
    flowTitle: '현재 예약 진행 방식',
    flow: '예약하기 → 대기열(사용 시) → 달력 → 블록 클릭·드래그 → 이름 입력 및 저장',
    queueNote: '대기열 사용 여부와 관계없이 2분 안에 블록 선택과 저장을 마쳐야 합니다. 만료 또는 새로고침 시 첫 화면으로 돌아갑니다. 대기열 사용 시에는 대기 시간이 아닌 입장부터 2분을 셉니다. 대기열 사용 여부는 Render에서 설정합니다.',
    save: '예약 규칙 저장',
    saving: '저장 중...',
    saved: '예약 규칙을 저장했습니다.',
    saveError: '규칙을 저장하지 못했습니다. 다시 시도해주세요.',
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
