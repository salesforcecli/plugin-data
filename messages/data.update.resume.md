# summary

Summary of a command.

# description

More information about a command. Don't repeat the summary.

# examples

asdfsadf

# flags.use-most-recent.summary

Use the job ID of the bulk update job that was most recently run.

# flags.job-id.summary

Job ID of the bulk update.

# flags.wait.summary

Time to wait for the command to finish, in minutes.

# error.failedRecordDetails

Job finished being processed but failed to update %s records.

To review the details of this job, run this command:

sf org open --target-org %s --path "/lightning/setup/AsyncApiJobStatus/page?address=%2F%s"

# error.timeout

The operation timed out after %s minutes.

Try re-running "sf data update resume --job-id %s" with a bigger wait time.

# error.jobFailed

Job failed to be processed due to:

%s

To review the details of this job, run this command:

sf org open --target-org %s --path "/lightning/setup/AsyncApiJobStatus/page?address=%2F%s"

# error.jobAborted

Job has been aborted.

To review the details of this job, run this command:

sf org open --target-org %s --path "/lightning/setup/AsyncApiJobStatus/page?address=%2F%s"
