import * as jf from "joiful";

export class JoinGameDTO {
  @(jf.string().alphanum().min(1).max(24).required())
  username!: string;
}
