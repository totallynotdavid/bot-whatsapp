import type { ICommand } from "../commands/command.interface";

export interface ICommandRegistry {
  register(command: ICommand): void;
  resolve(name: string): ICommand | null;
  getAllCommands(): ICommand[];
  suggestSimilar(name: string): string[];
}
