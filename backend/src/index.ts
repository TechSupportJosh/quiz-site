import "reflect-metadata";
import Logger from "./logger";
import { createServer } from "http";
import { Server, ServerOptions, Socket } from "socket.io";
import { sleep, shuffleArray } from "./utils";
import { validateAsClass } from "joiful";

import { GameState, Phase } from "./types/gameState";
import { JoinGameDTO } from "./types/joinGame.dto";
import { AnswerDTO } from "./types/answer.dto";

const serverLogger = new Logger("Server");
const gameLogger = new Logger("Game");

const httpServer = createServer();
const ioOptions: Partial<ServerOptions> = {};

// For development, allow requests from localhost:1234 (parcel serve)
if (process.env.NODE_ENV === "development") {
  ioOptions.cors = {
    origin: "http://localhost:1234",
    methods: ["GET", "POST"],
  };

  serverLogger.info("Starting server in development mode");
}

const io = new Server(httpServer, ioOptions);

const questions = require("../quiz.json");

const state: GameState = {
  phase: Phase.Lobby,
  players: [],
  currentQuestion: {
    index: -1,
    timeStarted: new Date(),
    answers: new Map(),
  },
};

async function sendQuestion() {
  // Get the current question
  const question = questions[state.currentQuestion.index];
  const answers = [...question.correctAnswers, ...question.incorrectAnswers];

  // Shuffle answers
  shuffleArray(answers);

  state.phase = Phase.PreQuestion;
  // Send game-state for pre-question
  io.emit("game-state", {
    state: "pre-question",
  });

  await sleep(5000);

  state.phase = Phase.Question;

  // Track the time so we can ignore late entries
  state.currentQuestion.answers.clear();
  state.currentQuestion.timeStarted = new Date();

  io.emit("game-state", {
    state: "question",
    question: question.question,
    answers: answers,
    image: question.image,
  });

  await sleep(30000);

  state.phase = Phase.Answers;

  io.emit("game-state", {
    state: "answers",
    correctAnswers: question.correctAnswers,
    incorrectAnswers: question.incorrectAnswers,
  });

  await sleep(5000);

  state.phase = Phase.PostAnswers;

  // For each player, tell them how many points they got or did not got
  state.players.forEach((player) => {
    // Check whether they answered
    const answer = state.currentQuestion.answers.get(player.username);
    let pointDelta = 0;
    if (answer && answer.isCorrect) {
      pointDelta = Math.floor(200 + 1000 * (1 - (answer.timeReceived.getTime() - state.currentQuestion.timeStarted.getTime()) / 30000));
    }

    player.score += pointDelta;

    io.to(player.socketId).emit("game-state", {
      state: "post-answers",
      score: player.score,
      pointDelta: pointDelta,
    });
  });

  await sleep(5000);

  io.emit("game-state", {
    state: "scoreboard",
    players: state.players
      .map((player) => {
        return {
          username: player.username,
          score: player.score,
        };
      })
      .sort((player) => player.score),
  });

  await sleep(5000);

  // Add to question index
  const nextQuestion = questions[state.currentQuestion.index + 1];
  if (!nextQuestion) return; // This is the end of the quiz TODO: Handle end of quiz

  state.currentQuestion.index++;
  sendQuestion();
}

function validateUsername(username: string) {
  // TODO: Additional name restrictions?
  const existingPlayer = state.players.find((player) => player.username === username);
  if (existingPlayer) return "Someone is already playing with this username!";

  return undefined;
}

io.on("connection", (socket: Socket) => {
  socket.on("join-game", (rawData) => {
    const result = validateAsClass(rawData, JoinGameDTO);

    if (result.error)
      return socket.emit("join-game-response", {
        error: result.error.details.map((e) => e.message).join("<br>"),
      });

    const data = result.value;

    const usernameValidationError = validateUsername(data.username);
    if (usernameValidationError)
      return socket.emit("join-game-response", {
        error: usernameValidationError,
      });

    // If the game phase is in end, display an error message
    if (state.phase === Phase.End)
      return socket.emit("join-game-response", {
        error: "A game has just finished! Please wait before trying again.",
      });

    gameLogger.info(`${data.username} has joined the game. Socket ID: ${socket.id}. Current state: ${state.phase}`);

    // Add player to state
    state.players.push({
      username: data.username,
      socketId: socket.id,
      score: 0,
    });

    // If we're in the lobby, broadcast new game state to everyone
    if (state.phase === Phase.Lobby)
      return io.emit("game-state", {
        state: "lobby",
        players: state.players.map((player) => player.username),
      });

    // Otherwise, display a mid-round screen
    socket.emit("game-state", {
      state: "mid-round",
    });
  });

  socket.on("start-game", () => {
    // If the game has already started, ignore this event
    if (state.phase !== Phase.Lobby) return;

    state.currentQuestion.index = 0;
    sendQuestion();
  });

  socket.on("answer", (rawData) => {
    if (state.phase !== Phase.Question) return;

    const player = state.players.find((player) => player.socketId == socket.id);
    if (!player) return gameLogger.warn("Received answer from player that does not exist");

    const result = validateAsClass(rawData, AnswerDTO);

    if (result.error) return gameLogger.warn(`Received invalid answer from ${player.username}: ${result.error.annotate()}`);

    const data = result.value;

    // Check whether this answer is a valid answer for the question
    const question = questions[state.currentQuestion.index];
    const answers = [...question.correctAnswers, ...question.incorrectAnswers];

    if (!answers.includes(data.answer)) return gameLogger.warn(`Received unknown answer from ${player.username}`);

    if (state.currentQuestion.answers.has(player.username)) return gameLogger.warn(`Received multiple answers from ${player.username}`);

    gameLogger.info(`Received answer from ${player.username}: ${data.answer}`);

    state.currentQuestion.answers.set(player.username, {
      isCorrect: question.correctAnswers.includes(data.answer),
      timeReceived: new Date(),
    });
  });
});

httpServer.listen(3000, () => {
  serverLogger.info("Listening on port 3000");
});
