/* eslint-disable @typescript-eslint/no-explicit-any */

import { JobMeta } from '@/pythonTypes';

export const queuesQueryOptions = {
    queryKey: ['monitor', 'queues'],
    queryFn: async () => {
        const response = await fetch('/monitor/queues');
        return response.json() as Promise<{ queues: Record<string, any> }>;
    },
};

export const workersQueryOptions = {
    queryKey: ['monitor', 'workers'],
    queryFn: async () => {
        const response = await fetch('/monitor/workers');
        return response.json() as Promise<{ workers: Record<string, any> }>;
    },
};

export const jobsQueryOptions = {
    queryKey: ['monitor', 'jobs'],
    queryFn: async () => {
        const response = await fetch('/monitor/jobs');
        return response.json() as Promise<
            Array<{ q_name: string; job_id: string; meta: JobMeta }>
        >;
    },
};
