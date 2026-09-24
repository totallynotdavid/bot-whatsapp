import type { JobName, JobPayload } from "../../domain/job";

export interface JobScheduler {
  enqueue<N extends JobName>(name: N, payload: JobPayload<N>): Promise<void>;
}
