export type QuestionType = "mcq" | "tf" | "short";

export interface QuizQuestion {
  type: QuestionType;
  q: string;
  options?: string[];
  correct?: number | boolean;
  accept?: string[];
  explain: string;
}

export interface MissionQuiz {
  title: string;
  subtitle: string;
  minutes: number;
  passingPct: number;
  placeholder?: boolean;
  questions: QuizQuestion[];
}

export interface LessonBlock {
  topic: string;
  points: string[];
}

export interface DailyChallenge {
  question: string;
  type: "mcq" | "short";
  options?: string[];
  correct?: number | string;
  xpReward: number;
  hint?: string;
}

export interface Lesson {
  day: number;
  title: string;
  objective: string;
  block1: LessonBlock;
  block2: LessonBlock;
  demo?: string;
  homework?: string;
  // Extended learning modes
  videoId?: string;          // lesson_videos table ID — triggers protected video player
  videoTitle?: string;       // display label for the video tab
  notes?: string;            // markdown-style notes for the Notes tab
  dailyChallenge?: DailyChallenge; // one question bonus challenge per day
}

export interface CourseModule {
  id: string;
  name: string;
  week: number;
  tagline: string;
  lessons: Lesson[];
  quiz: MissionQuiz | null;
}

export interface Track {
  id: "beginner" | "intermediate" | "expert";
  name: string;
  subtitle: string;
  tagline: string;
  priceTZS: string;
  passingPct: number;
  tone: string;
  toneDeep: string;
  cardGradient: [string, string];
  modules: CourseModule[];
  enrolled: boolean;
  requires?: string;
}

/* Linear node = a lesson day OR a trailing Mission Quest for a module */
export type JourneyNode =
  | (Lesson & { kind: "lesson" })
  | { kind: "quest"; title: string; quest: MissionQuiz };

export interface Quest {
  id: string;
  label: string;
  done: boolean;
  rewarded: boolean;    // true only after claim_quest_reward() succeeds
  target: number;
  progress: number;
  icon: "book" | "quiz" | "duel" | "clock" | "zap";
  xpReward: number;
  coinsReward: number;
}

export interface Achievement {
  id: string;
  label: string;
  icon: "rocket" | "flame" | "crown" | "heart";
  earned: boolean;
}
