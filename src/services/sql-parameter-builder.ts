/**
 * Keeps PostgreSQL placeholders and values synchronized.
 *
 * Example:
 *   add("tenant-id") returns "$1"
 *   add("user-id") returns "$2"
 *
 * The final values array becomes:
 *   ["tenant-id", "user-id"]
 */
export class SqlParameterBuilder {
  readonly #values: unknown[] = [];

  public add(value: unknown): string {
    this.#values.push(value);

    return `$${this.#values.length}`;
  }

  public toArray(): unknown[] {
    /*
     * Return a copy so callers cannot accidentally modify
     * the internal parameter list.
     */
    return [...this.#values];
  }
}