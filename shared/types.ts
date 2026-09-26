export type Level = 'easy' | 'medium' | 'chart';
export type Topic = 'تقنية' | 'مجتمع' | 'سياحة' | 'بيئة' | 'نقل' | 'اقتصاد';
export interface Chart { title: string; unit: string; values: { label: string; value: number }[]; note?: string }
export interface Question {
  id: string; level: Level; topic: Topic; headline: string; prompt: string;
  options: string[]; correct: number; explanation: string; lesson: string;
  year: string; source: { name: string; url: string }; chart?: Chart;
}
export type PublicQuestion = Omit<Question, 'correct' | 'explanation' | 'lesson'>;
export interface Answer { questionId: string; selected: number; correct: number; isCorrect: boolean; explanation: string; lesson: string }
export interface RoundView { questions: PublicQuestion[]; answers: Answer[]; completed: boolean; score: number; title: string; vote: string | null; environment: string }
export interface Stats {
  completed: number; scoreSum: number; distribution: number[];
  questions: { id: string; topic: Topic; prompt: string; total: number; correct: number; choices: {label:string;count:number}[] }[];
  votes: { label: string; count: number }[]; updatedAt: string; environment: string;
}
export const titles = ['بداية الاستكشاف', 'مستكشف واعد', 'مستكشف البيانات', 'خبير الأرقام'];
export const cities = ['جدة', 'الرياض', 'العلا', 'أبها', 'المدينة المنورة', 'الخبر'];
export const levelNames: Record<Level, string> = { easy: 'اكتشف الرقم', medium: 'اختبر توقّعك', chart: 'اقرأ البيانات' };
