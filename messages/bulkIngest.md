# export.resume

Run "sf %s --job-id %s" to resume the operation.

# error.timeout

The operation timed out after %s minutes.

Run "sf %s --job-id %s" to resume it.

# error.failedRecordDetails

Job finished being processed but failed to process %s records.

# error.failedRecordDetails.actions

- Get the job results by running: "sf data bulk results -o %s --job-id %s".
- View the job in the org: "sf org open -o %s --path '/lightning/setup/AsyncApiJobStatus/page?address=%2F%s'".

# error.jobFailed

Job failed to be processed due to:

%s

# error.jobFailed.actions

- Get the job results by running: "sf data bulk results -o %s --job-id %s".
- View the job in the org: "sf org open -o %s --path '/lightning/setup/AsyncApiJobStatus/page?address=%2F%s'".

# error.jobAborted

Job has been aborted.

# error.jobAborted.actions

- Get the job results by running: "sf data bulk results -o %s --job-id %s".
- View the job in the org: "sf org open -o %s --path '/lightning/setup/AsyncApiJobStatus/page?address=%2F%s'".

# flags.column-delimiter.summary

Column delimiter used in the CSV file. Default is COMMA.
