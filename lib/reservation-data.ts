export type BookingStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export type Booking = {
  id: string;
  applicant: string;
  affiliation: string;
  equipment: string;
  date: string;
  startTime: string;
  endTime: string;
  purpose: string;
  status: BookingStatus;
};

export const initialBookings: Booking[] = [
  {
    id: 'bk-001',
    applicant: '김연구',
    affiliation: '전기화학 연구실',
    equipment: 'Potentiostat / Galvanostat SP-300',
    date: '2026-04-22',
    startTime: '10:00',
    endTime: '12:00',
    purpose: '리튬이온 전지 전극의 cyclic voltammetry 측정',
    status: 'approved',
  },
  {
    id: 'bk-002',
    applicant: '박석사',
    affiliation: '에너지재료 연구실',
    equipment: 'Potentiostat / Galvanostat SP-300',
    date: '2026-04-23',
    startTime: '13:30',
    endTime: '16:30',
    purpose: '촉매 샘플의 EIS 분석 및 반복 측정',
    status: 'pending',
  },
  {
    id: 'bk-003',
    applicant: '이학부',
    affiliation: '나노소자 실험실',
    equipment: 'Potentiostat / Galvanostat SP-300',
    date: '2026-04-24',
    startTime: '09:00',
    endTime: '10:00',
    purpose: '전해질 교체 후 기준 전극 안정화 테스트',
    status: 'rejected',
  },
];

export const initialBlockedDates = ['2026-04-25', '2026-04-30'];

export const initialNotices = [
  '4월 25일은 장비 정기 점검으로 예약이 불가합니다.',
  '사용 후 셀과 전극을 세척하고, 측정 파일은 로컬 PC에 백업해 주세요.',
];

export function getStatusLabel(status: BookingStatus) {
  switch (status) {
    case 'approved':
      return '승인';
    case 'rejected':
      return '반려';
    case 'cancelled':
      return '취소됨';
    case 'pending':
    default:
      return '승인 대기';
  }
}
