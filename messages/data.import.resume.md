# summary

Summary of a command.

# description

More information about a command. Don't repeat the summary.

# examples

- <%= config.bin %> <%= command.id %>

# flags.use-most-recent.summary

Summary for use-most-recent.

# flags.job-id.summary

Summary for job-id.

# flags.wait.summary

Summary for wait.

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
