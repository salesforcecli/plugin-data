# export.resume

Run "sf data import resume --job-id %s" to resume the operation.

# error.timeout

The operation timed out after %s minutes.

Run "sf data import resume --job-id %s" to resume it.

# error.failedRecordDetails

Job finished being processed but failed to update %s records.

To review the details of this job, run this command:

sf org open --target-org %s --path "/lightning/setup/AsyncApiJobStatus/page?address=%2F%s"

# error.jobFailed

Job failed to be processed due to:

%s

To review the details of this job, run this command:

sf org open --target-org %s --path "/lightning/setup/AsyncApiJobStatus/page?address=%2F%s"

# error.jobAborted

Job has been aborted.

To review the details of this job, run this command:

sf org open --target-org %s --path "/lightning/setup/AsyncApiJobStatus/page?address=%2F%s"
