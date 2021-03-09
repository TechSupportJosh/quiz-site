const Enum = require("enum");
const express = require("express");
const Logger = require("./logger");

const app = express();

const http = require("http").Server(app);
const io = require("socket.io")(http);

const GameState = new Enum(["Lobby", "PreQuestion", "Question", "Answers", "PostAnswers", "Scoreboard"]);

const gameLogger = new Logger("Game");
const questions = require("./quiz.json");

const state = {
  gameState: GameState.Lobby,
  players: [],
  currentQuestion: {
    index: -1,
    timeStarted: null,
    answers: Object.create(null, {}),
  },
};

function timeout(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// https://stackoverflow.com/a/12646864
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

async function sendQuestion() {
  // Get the current question
  const question = questions[state.currentQuestion.index];
  console.log(question);
  const answers = [...question.correctAnswers, ...question.incorrectAnswers];

  // Shuffle answers
  shuffleArray(answers);

  state.gameState = GameState.PreQuestion;
  // Send game-state for pre-question
  io.emit("game-state", {
    state: "pre-question",
  });

  await timeout(5000);

  state.gameState = GameState.Question;

  // Track the time so we can ignore late entries
  state.currentQuestion.answers = Object.create(null, {});
  state.currentQuestion.timeStarted = new Date();

  io.emit("game-state", {
    state: "question",
    question: question.question,
    answers: answers,
    image: question.image,
  });

  await timeout(30000);

  state.gameState = GameState.Answers;

  io.emit("game-state", {
    state: "answers",
    correctAnswers: question.correctAnswers,
    incorrectAnswers: question.incorrectAnswers,
  });

  await timeout(5000);

  state.gameState = GameState.PostAnswers;

  // For each player, tell them how many points they got or did not got
  state.players.forEach((player) => {
    // Check whether they answered
    const answer = state.currentQuestion.answers[player.username];
    let pointDelta = 0;
    if (answer && answer.correct) {
      pointDelta = Math.floor(200 + 1000 * (1 - (answer.timeReceived - state.currentQuestion.timeStarted) / 30000));
    }

    player.score += pointDelta;

    io.to(player.socketId).emit("game-state", {
      state: "post-answers",
      score: player.score,
      pointDelta: pointDelta,
    });
  });

  await timeout(5000);

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

  await timeout(5000);

  // Add to question index
  const nextQuestion = questions[state.currentQuestion.index + 1];
  if (!nextQuestion) return; // This is the end of the quiz TODO: Handle end of quiz

  state.currentQuestion.index++;
  sendQuestion();
}

io.on("connection", (socket) => {
  socket.on("join-game", (data) => {
    if (data.username === "") {
      socket.emit("join-game-response", {
        error: "Please enter a name!",
      });
    }
    // Check whether a player already exists with this name
    else if (state.players.includes(data.username)) {
      socket.emit("join-game-response", {
        error: "Someone is already playing with this name!",
      });
    } else {
      gameLogger.info(`${data.username} has joined the game. Socket ID: ${socket.id}. Current state: ${state.gameState}`);

      // Add player to state
      state.players.push({
        username: data.username,
        socketId: socket.id,
        score: 0,
      });

      // If we're in the lobby, broadcast new game state to everyone
      if (state.gameState == GameState.Lobby) {
        io.emit("game-state", {
          state: "lobby",
          players: state.players.map((player) => player.username),
        });
      } else if (
        state.gameState == GameState.PreQuestion ||
        state.gameState == GameState.Question ||
        state.gameState == GameState.Answers ||
        state.gameState == GameState.PostAnswers
      ) {
        // If they're midway through, send mid-round
        socket.emit("game-state", {
          state: "mid-round",
        });
      }
      // TODO: Handle scoreboard
    }
  });

  socket.on("start-game", (data) => {
    // If the game has already started, ignore this event
    if (state.gameState != GameState.Lobby) return;

    state.gameState = GameState.InGame;

    state.currentQuestion.index = 0;

    sendQuestion();
  });

  socket.on("answer", (data) => {
    if (state.gameState != GameState.Question) return;

    // Check whether this answer is a valid answer for the question
    const question = questions[state.currentQuestion.index];
    const answers = [...question.correctAnswers, ...question.incorrectAnswers];
    const player = state.players.find((player) => player.socketId == socket.id);

    if (!player) return gameLogger.warn("Received answer from player that does not exist");

    if (!answers.includes(data.answer)) return gameLogger.warn(`Received non-valid answer from ${player.username}`);

    if (player.username in state.currentQuestion.answers) return gameLogger.warn(`Received multiple answers from ${player.username}`);

    gameLogger.info(`Received answer from ${player.username}: ${data.answer}`);
    state.currentQuestion.answers[player.username] = {
      correct: question.correctAnswers.includes(data.answer),
      timeReceived: new Date(),
    };
  });
});

app.use(express.static(__dirname + "/public"));

http.listen(3000, () => {
  console.log("Listening on 3000");
});
