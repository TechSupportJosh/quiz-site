// Creater socket
import { io } from "socket.io-client";

const socketUrl = process.env.NODE_ENV === "development" ? "http://localhost:3000" : "";
console.log(socketUrl);
const socket = io(socketUrl);

const joinGameContainer = document.getElementById("join-container")!;
const joinGameButton = document.getElementById("join-game")!;
const joinGameUsername = document.getElementById("join-username")! as HTMLInputElement;
const joinGameAlert = document.getElementById("join-game-alert")!;

type PhaseScreen = "join" | "lobby" | "pre-question" | "mid-round" | "question" | "answers" | "post-answers" | "scoreboard";

joinGameButton.addEventListener("click", () => {
  // Send connection message to socket
  socket.emit("join-game", {
    username: joinGameUsername.value,
  });

  // Disable button until response is received
  joinGameButton.setAttribute("disabled", "disabled");
});

socket.on("join-game-response", (data: { error?: string }) => {
  if (data.error) {
    joinGameAlert.textContent = data.error;
    joinGameAlert.style.display = "";
  } else {
    // If no error is given, we'll receive a game-state event too
    joinGameAlert.style.display = "none";
  }
  joinGameButton.removeAttribute("disabled");
});

const lobbyContainer = document.getElementById("lobby-container")!;
const lobbyPlayerCount = document.getElementById("lobby-player-count")!;
const lobbyPlayerContainer = document.getElementById("lobby-player-container")!;
const lobbyStartGame = document.getElementById("lobby-start-game")!;

lobbyStartGame.addEventListener("click", () => {
  // Send connection message to socket
  socket.emit("start-game");
});

const preQuestionContainer = document.getElementById("pre-question-container")!;
const preQuestionCountdown = document.getElementById("pre-question-timer")!;

const questionContainer = document.getElementById("question-container")!;
const questionLabel = document.getElementById("question-label")!;
const questionImageContainer = document.getElementById("question-image-container")!;
const questionImage = document.getElementById("question-image")!;
const questionTimer = document.getElementById("question-timer")!;
const questionTimerProgressBar = document.getElementById("question-timer-progress-bar")!;
const answerContainer = document.getElementById("answer-container")!;

let selectedAnswer = "";

socket.on("game-state", (data: any) => {
  if (data.state == "lobby") {
    // Add players
    lobbyPlayerCount.textContent = data.players.length;
    lobbyPlayerContainer.innerHTML = "";
    data.players.forEach((playerName: string) => {
      lobbyPlayerContainer.insertAdjacentHTML(
        "beforeend",
        `
            <div class="col-2">
                <h3>${playerName}</h3>
            </div>
        `
      );
    });
  } else if (data.state == "pre-question") {
    let counter = 5;
    preQuestionCountdown.textContent = counter.toString();
    const timer = setInterval(() => {
      preQuestionCountdown.textContent = (--counter).toString();

      if (counter < 1) clearInterval(timer);
    }, 1000);
  } else if (data.state == "mid-round") {
  } else if (data.state == "question") {
    selectedAnswer = "";
    // Draw the question
    questionLabel.textContent = data.question;

    const symbols = ["????", "????", "????", "???"];

    answerContainer.innerHTML = "";
    data.answers.forEach((answer: string, index: number) => {
      answerContainer.insertAdjacentHTML(
        "beforeend",
        `
            <div class="col-6 mb-4">
                <button class="btn answer-button w-100 text-white" id="answer-button-${index}" answer="${answer}">
                    <h4>${symbols[index]} ${answer} ${symbols[index]}</h4>
                </button>
            </div>
        `
      );

      document.getElementById(`answer-button-${index}`)!.addEventListener("click", (event) => {
        // Emit answer event
        socket.emit("answer", {
          answer: answer,
        });

        // Disable all buttons
        document.querySelectorAll(".answer-button").forEach((button) => {
          button.setAttribute("disabled", "disabled");
        });

        document.getElementById(`answer-button-${index}`)!.classList.add("selected");
      });
    });

    if (data.image) {
      questionImageContainer.style.display = "";
      questionImage.setAttribute("src", "/assets/" + data.image);
    } else {
      questionImageContainer.style.display = "none";
    }

    // Start timer
    let countdown = 30;
    questionTimer.textContent = countdown.toString();

    questionTimerProgressBar.classList.add("started");
    const timer = setInterval(() => {
      questionTimer.textContent = (--countdown).toString();

      if (countdown < 1) {
        clearInterval(timer);
        questionTimerProgressBar.classList.remove("started");
        questionTimerProgressBar.classList.add("finished");
      }
    }, 1000);
  } else if (data.state == "answers") {
    data.incorrectAnswers.forEach((answer: string) => {
      const button = document.querySelector(`.answer-button[answer="${answer}"]`)! as HTMLElement;

      button.setAttribute("disabled", "disabled");
      button.style.backgroundColor = "#ff4444";
      button.firstElementChild!.textContent = `??? ${answer} ???`;
    });
    data.correctAnswers.forEach((answer: string) => {
      const button = document.querySelector(`.answer-button[answer="${answer}"]`)! as HTMLElement;

      button.setAttribute("disabled", "disabled");
      button.style.backgroundColor = "#00C851";
      button.firstElementChild!.textContent = `?????? ${answer} ??????`;
    });

    questionContainer.style.backgroundColor = data.correctAnswers.includes(selectedAnswer) ? "#00C851" : "#ff4444";
  } else if (data.state == "post-answers") {
    if (data.pointDelta == 0) {
      postAnswersPointDelta.textContent = "You got it wrong ????";
    } else {
      postAnswersPointDelta.textContent = `Well done, you got ${data.pointDelta} points!`;
    }
    postAnswersPointTotal.textContent = `You have ${data.score} points in total.`;
  } else if (data.state == "scoreboard") {
    scoreboardList.innerHTML = "";
    data.players.forEach(
      (
        player: {
          username: string;
          score: number;
        },
        index: number
      ) => {
        scoreboardList.insertAdjacentHTML(
          "beforeend",
          `
        <li class="list-group-item">${index ? "" : "????"} ${player.username} - ${player.score}</li>
        `
        );
      }
    );
  }

  showScreen(data.state);
});

const midRoundContainer = document.getElementById("mid-round-container")!;
const postAnswersContainer = document.getElementById("post-answers-container")!;
const postAnswersPointDelta = document.getElementById("point-delta-label")!;
const postAnswersPointTotal = document.getElementById("point-total-label")!;

const scoreboardContainer = document.getElementById("scoreboard-container")!;
const scoreboardList = document.getElementById("scoreboard-list")!;

function showScreen(screen: PhaseScreen) {
  joinGameContainer.style.display = screen == "join" ? "flex" : "none";
  lobbyContainer.style.display = screen == "lobby" ? "flex" : "none";
  preQuestionContainer.style.display = screen == "pre-question" ? "flex" : "none";
  midRoundContainer.style.display = screen == "mid-round" ? "flex" : "none";
  questionContainer.style.display = screen == "question" ? "flex" : "none";
  postAnswersContainer.style.display = screen == "post-answers" ? "flex" : "none";
  scoreboardContainer.style.display = screen == "scoreboard" ? "flex" : "none";
}

showScreen("join");
