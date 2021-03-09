import * as jf from "joiful";

export class AnswerDTO {
  @(jf.string().required())
  answer!: string;
}
