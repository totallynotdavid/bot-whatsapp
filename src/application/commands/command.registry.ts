import type { ICommand } from "./command.interface";

export class CommandRegistry {
  private commands = new Map<string, ICommand>();
  private aliases = new Map<string, string>();

  register(command: ICommand): void {
    const { name, aliases } = command.metadata;

    if (!this.isValidCommand(command)) {
      throw new Error(`Comando inválido: ${name}`);
    }

    const lowerName = name.toLowerCase();
    this.commands.set(lowerName, command);

    for (const alias of aliases) {
      this.aliases.set(alias.toLowerCase(), lowerName);
    }
  }

  resolve(name: string): ICommand | null {
    const lower = name.toLowerCase();

    if (this.commands.has(lower)) {
      return this.commands.get(lower)!;
    }

    const canonical = this.aliases.get(lower);
    if (canonical) {
      return this.commands.get(canonical) || null;
    }

    return null;
  }

  getAllCommands(): ICommand[] {
    return Array.from(this.commands.values());
  }

  suggestSimilar(name: string): string[] {
    const allNames = [...this.commands.keys(), ...this.aliases.keys()];

    return allNames
      .filter((cmd) => this.similarity(name, cmd) > 0.6)
      .slice(0, 3);
  }

  private isValidCommand(command: ICommand): boolean {
    return (
      typeof command.execute === "function" &&
      command.metadata.name.length > 0 &&
      command.metadata.description.length > 0
    );
  }

  private similarity(a: string, b: string): number {
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshtein(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshtein(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = new Array(a.length + 1);
    }

    for (let i = 0; i <= b.length; i++) {
      matrix[i]![0] = i;
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0]![j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i]![j] = matrix[i - 1]![j - 1]!;
        } else {
          matrix[i]![j] = Math.min(
            matrix[i - 1]![j - 1]! + 1,
            matrix[i]![j - 1]! + 1,
            matrix[i - 1]![j]! + 1
          );
        }
      }
    }

    return matrix[b.length]![a.length]!;
  }
}
