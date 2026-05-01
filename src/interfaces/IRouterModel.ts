interface IRouterModelStatus {
  value: string;
  args: string[];
  preset: string;
  exit_code?: number;
  failed?: boolean;
}

export interface IRouterModel {
  id: string;
  aliases?: string[];
  tags: string[];
  object: string;
  owned_by: string;
  created: number;
  status: IRouterModelStatus;
}
