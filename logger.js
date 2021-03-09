// Credit to Sikari for simple logging class
// https://bitbucket.org/Sikarii/

const colors = {
  info: "\x1b[36m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
  success: "\x1b[32m",
};

class Logger {
  constructor(namespace) {
    this.namespace = namespace;
  }

  info(message) {
    this.doLog(message, "info");
  }

  warn(message) {
    this.doLog(message, "warn");
  }

  error(message) {
    this.doLog(message, "error");
  }

  success(message) {
    this.doLog(message, "success");
  }

  doLog(message, level) {
    const color = colors[level];
    const dateTime = new Date().toLocaleTimeString("en-GB");

    console.log(
      `[${dateTime}] <\x1b[34m${this.namespace}\x1b[0m> ${color}${message}\x1b[0m`
    );
  }
}

module.exports = Logger;
