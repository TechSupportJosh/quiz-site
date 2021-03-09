export interface Player {
  username: string;
  socketId: string;
  score: number;
}

export interface PlayerAnswer {
  isCorrect: boolean;
  timeReceived: Date;
}
