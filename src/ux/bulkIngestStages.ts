/*
 * Copyright 2026, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { MultiStageOutput } from '@oclif/multi-stage-output';
import { IngestJobV2, JobInfoV2 } from '@jsforce/jsforce-node/lib/api/bulk2.js';
import { Schema } from '@jsforce/jsforce-node';
import terminalLink from 'terminal-link';
import { StageStatus } from 'node_modules/@oclif/multi-stage-output/lib/stage-tracker.js';

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

  public stop(finalStatus?: StageStatus): void {
    this.mso.stop(finalStatus);
  }

  public error(): void {
    this.mso.error();
  }
}
