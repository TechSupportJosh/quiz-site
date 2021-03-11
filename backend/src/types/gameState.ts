import { Player, PlayerAnswer } from "./player";

export enum Phase {
  Lobby = 1,
  PreQuestion,
  Question,
  Answers,
  PostAnswers,
  Scoreboard,
  End,
}

export interface GameState {
  phase: Phase;
  players: Player[];
  currentQuestion: {
    index: number;
    timeStarted: Date;
    answers: Map<string, PlayerAnswer>;
  };
}
