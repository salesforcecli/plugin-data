# summary

Resume a bulk import job that you previously started. Uses Bulk API 2.0.

# description

The command uses the job ID returned by the "sf data import bulk" command or the most recently-run bulk import job.

# examples

- Resume a bulk import job from your default org using an ID:

  <%= config.bin %> <%= command.id %> --job-id 750xx000000005sAAA

- Resume the most recently run bulk import job for an org with alias my-scratch:

  <%= config.bin %> <%= command.id %> --use-most-recent --target-org my-scratch

# flags.use-most-recent.summary

Use the job ID of the bulk import job that was most recently run.

# flags.job-id.summary

Job ID of the bulk import.

# flags.wait.summary

Time to wait for the command to finish, in minutes.

# error.failedRecordDetails

Job finished being processed but failed to import %s records.

To review the details of this job, run:
sf org open --target-org %s --path "/lightning/setup/AsyncApiJobStatus/page?address=%2F%s"

# error.timeout

The operation timed out after %s minutes.

Try re-running "sf data import resume --job-id %s" with a bigger wait time.

# error.jobFailed

Job failed to be processed due to:
%s

To review the details of this job, run:
sf org open --target-org %s --path "/lightning/setup/AsyncApiJobStatus/page?address=%2F%s"

# error.jobAborted

Job has been aborted.

To review the details of this job, run:
sf org open --target-org %s --path "/lightning/setup/AsyncApiJobStatus/page?address=%2F%s"
