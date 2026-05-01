import { PROVIDER_NAME } from "../constants";

export interface IAuth {
  type: string;
  key: string;
}

export interface IAuthFile {
  [PROVIDER_NAME]: IAuth;
}
