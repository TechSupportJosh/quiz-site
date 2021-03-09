// Credit to Sikari for simple logging class
// https://bitbucket.org/Sikarii/

const colors = {
  info: "\x1b[36m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
  success: "\x1b[32m",
};

type LogType = "info" | "warn" | "error" | "success";

export default class Logger {
  public readonly namespace: string;

  constructor(namespace: string) {
    this.namespace = namespace;
  }

  public info(message: any) {
    this.doLog(message, "info");
  }

  public warn(message: any) {
    this.doLog(message, "warn");
  }

  public error(message: any) {
    this.doLog(message, "error");
  }

  public success(message: any) {
    this.doLog(message, "success");
  }

  private doLog(message: any, level: LogType) {
    const color = colors[level];
    const dateTime = new Date().toLocaleTimeString("en-GB");

    console.log(`[${dateTime}] <\x1b[34m${this.namespace}\x1b[0m> ${color}${message}\x1b[0m`);
  }
}
