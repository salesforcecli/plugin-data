/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { MultiStageOutput } from '@oclif/multi-stage-output';
import { IngestJobV2, JobInfoV2 } from '@jsforce/jsforce-node/lib/api/bulk2.js';
import { Schema } from '@jsforce/jsforce-node';
import terminalLink from 'terminal-link';

type Options = {
  resume: boolean;
  title: string;
  baseUrl: string;
  jsonEnabled: boolean;
};

export class BulkIngestStages {
  private mso: MultiStageOutput<JobInfoV2>;
  private resume: boolean;

  public constructor({ resume, title, baseUrl, jsonEnabled }: Options) {
    this.resume = resume;
    this.mso = new MultiStageOutput<JobInfoV2>({
      title,
      jsonEnabled,
      stages: ['Creating ingest job', 'Processing the job'],
      stageSpecificBlock: [
        {
          stage: 'Processing the job',
          label: 'Processed records',
          type: 'dynamic-key-value',
          get: (data): string | undefined => {
            if (data?.numberRecordsProcessed) {
              return data.numberRecordsProcessed.toString();
            }
          },
        },
        {
          stage: 'Processing the job',
          label: 'Successful records',
          type: 'dynamic-key-value',
          get: (data): string | undefined => {
            const numberRecordsFailed = data?.numberRecordsFailed ?? 0;

            if (data?.numberRecordsProcessed) {
              return (data.numberRecordsProcessed - numberRecordsFailed).toString();
            }
          },
        },
        {
          stage: 'Processing the job',
          label: 'Failed records',
          type: 'dynamic-key-value',
          get: (data): string | undefined => {
            const numberRecordsFailed = data?.numberRecordsFailed ?? 0;

            if (data?.numberRecordsProcessed) {
              return numberRecordsFailed.toString();
            }
          },
        },
      ],
      postStagesBlock: [
        {
          label: 'Status',
          type: 'dynamic-key-value',
          bold: true,
          get: (data): string | undefined => data?.state,
        },
        {
          label: 'Job Id',
          type: 'dynamic-key-value',
          bold: true,
          get: (data): string | undefined =>
            data?.id &&
            terminalLink(
              data.id,
              `${baseUrl}/lightning/setup/AsyncApiJobStatus/page?address=${encodeURIComponent(`/${data.id}`)}`,
              {
                fallback: (text, url) => `${text} (${url})`,
              }
            ),
        },
      ],
    });
  }

  public start(): void {
    if (this.resume) {
      this.mso.skipTo('Processing the job');
    } else {
      this.mso.goto('Creating ingest job');
    }
  }

  public processingJob(): void {
    this.mso.goto('Processing the job');
  }

  public setupJobListeners(job: IngestJobV2<Schema>): void {
    job.on('inProgress', (res: JobInfoV2) => {
      this.mso.updateData(res);
    });
  }

  public update(data: JobInfoV2): void {
    this.mso.updateData(data);
  }

  public stop(): void {
    this.mso.stop();
  }

  public error(): void {
    this.mso.error();
  }
}
