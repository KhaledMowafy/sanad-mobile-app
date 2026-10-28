export interface Abortable {
  abort(): void;
}

/** Stops the in-flight answer. StreamAnswer then emits the message with status "stopped". */
export class StopGeneration {
  execute(controller: Abortable): void {
    controller.abort();
  }
}
